/**
 * MKT-BIBLIOTECA Fatia 2 — POST /api/criativos/render
 *
 * Renderiza uma peça dos templates da marca no servidor (determinista, sem IA de imagem):
 * cores/identidade do Brand Kit + foto do imóvel (URL assinado) + textos aprovados.
 * - preview=true → devolve a imagem PNG (não guarda nada).
 * - sem preview → PNG (ou PDF no flyer) vai para o bucket privado creative-archive e
 *   nasce uma peça NOVA na biblioteca (versões, nunca sobrescreve; render_spec guarda
 *   os parâmetros para duplicar/editar um detalhe).
 */
import crypto from 'crypto';
import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  buildTemplate,
  brandFromKit,
  dimensionsFor,
  FORMAT_LABELS,
  type RenderFormat,
  type RenderRatio,
  type TemplateVariant,
  type TemplateImovel,
} from '@/lib/criativos/templates';
import { svgDimensions, type CreativeType } from '@/lib/criativos/shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  format: z.enum(['anuncio', 'post', 'story', 'flyer']),
  ratio: z.enum(['square', 'portrait']).default('square'),
  variant: z.enum(['classico', 'faixa', 'claro']).default('classico'),
  imovel_id: z.string().uuid().nullable().optional(),
  foto_path: z.string().max(400).nullable().optional(),
  texts: z.object({
    headline: z.string().min(1).max(90),
    sub: z.string().max(160).nullable().optional(),
    cta: z.string().max(70).nullable().optional(),
    descricao: z.string().max(600).nullable().optional(),
    destaques: z.array(z.string().max(80)).max(6).optional(),
  }),
  legenda: z.string().max(3000).nullable().optional(),
  preview: z.boolean().default(false),
  parent_id: z.string().uuid().nullable().optional(),
}).strict();

const TYPE_FOR_FORMAT: Record<RenderFormat, CreativeType> = {
  anuncio: 'banner',
  post: 'organic_post',
  story: 'story_cover',
  flyer: 'flyer',
};

const CHANNEL_FOR_FORMAT: Record<RenderFormat, string> = {
  anuncio: 'meta_ads',
  post: 'facebook_instagram',
  story: 'instagram',
  flyer: 'impressao',
};

function loadFont(file: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'assets', 'fonts', file));
}

function eur(n: number | null | undefined): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function mimeFromMagic(buf: Buffer): string | null {
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  return null;
}

/**
 * As fotos originais podem ter vários MB e o satori embute-as no SVG → o resvg
 * rebenta o limite do parser ("Buffer size limit exceeded"). Redimensionamos no
 * servidor para um data URI leve, com cadeia de recurso:
 * 1) sharp (respeita a orientação EXIF);
 * 2) o optimizador de imagens do próprio Next (lambda própria com sharp garantido);
 * 3) o original cru, se for pequeno o suficiente.
 */
async function fotoToDataUri(url: string, origin: string): Promise<string | null> {
  let buf: Buffer | null = null;
  try {
    const res = await fetch(url);
    if (res.ok) buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error('[criativos/render] download da foto falhou:', e);
  }

  if (buf) {
    try {
      const sharp = (await import('sharp')).default;
      const out = await sharp(buf)
        .rotate()
        .resize({ width: 1400, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      return `data:image/jpeg;base64,${out.toString('base64')}`;
    } catch (e) {
      console.error('[criativos/render] sharp indisponível, a usar o optimizador:', e);
    }
  }

  try {
    const opt = await fetch(`${origin}/_next/image?url=${encodeURIComponent(url)}&w=1080&q=75`, {
      headers: { accept: 'image/jpeg' },
    });
    if (opt.ok) {
      const ct = (opt.headers.get('content-type') || '').split(';')[0];
      if (ct === 'image/jpeg' || ct === 'image/png') {
        const b = Buffer.from(await opt.arrayBuffer());
        if (b.length < 8 * 1024 * 1024) return `data:${ct};base64,${b.toString('base64')}`;
      }
    }
  } catch (e) {
    console.error('[criativos/render] optimizador falhou:', e);
  }

  if (buf && buf.length < 3 * 1024 * 1024) {
    const mime = mimeFromMagic(buf);
    if (mime) return `data:${mime};base64,${buf.toString('base64')}`;
  }
  return null;
}

/**
 * Logos do Brand Kit chegam como data URI (muitas vezes SVG) ou URL. O satori precisa de
 * imagem com dimensões explícitas → 1) sharp converte para PNG pequeno; 2) sem sharp (a
 * lambda da Vercel pode não o ter — gotcha conhecido), um SVG segue CRU com as dimensões
 * lidas do viewBox (o satori/resvg suportam SVG em <image>). Tudo falhou → null e o
 * template cai para o nome em texto — o render nunca falha por causa do logo.
 */
async function logoToTemplateLogo(value: string | null | undefined): Promise<{ uri: string; width: number; height: number } | null> {
  if (!value) return null;
  try {
    let buf: Buffer | null = null;
    let mime = '';
    if (value.startsWith('data:')) {
      const comma = value.indexOf(',');
      if (comma < 0) return null;
      const meta = value.slice(5, comma);
      mime = meta.split(';')[0];
      const payload = value.slice(comma + 1);
      buf = meta.includes('base64')
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
    } else if (/^https?:\/\//.test(value)) {
      const res = await fetch(value);
      if (!res.ok) return null;
      mime = (res.headers.get('content-type') || '').split(';')[0];
      buf = Buffer.from(await res.arrayBuffer());
    }
    if (!buf || buf.length === 0 || buf.length > 2 * 1024 * 1024) return null;

    try {
      const sharp = (await import('sharp')).default;
      const out = await sharp(buf, { density: 300 })
        .resize({ height: 160, withoutEnlargement: false })
        .png()
        .toBuffer({ resolveWithObject: true });
      if (out.info.width && out.info.height) {
        return {
          uri: `data:image/png;base64,${out.data.toString('base64')}`,
          width: out.info.width,
          height: out.info.height,
        };
      }
    } catch (e) {
      console.error('[criativos/render] sharp indisponível para o logo, a tentar SVG cru:', e);
    }

    const text = buf.toString('utf8');
    if (mime === 'image/svg+xml' || text.trimStart().startsWith('<svg') || text.includes('<svg')) {
      const dims = svgDimensions(text);
      if (dims) {
        return {
          uri: `data:image/svg+xml;base64,${buf.toString('base64')}`,
          width: dims.width,
          height: dims.height,
        };
      }
    }
    return null;
  } catch (e) {
    console.error('[criativos/render] logo indisponível (fallback para texto):', e);
    return null;
  }
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const orgId = profile?.organization_id as string | undefined;
  if (!orgId) return Response.json({ error: 'Profile not found' }, { status: 404 });

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  try {
    // Brand Kit (service-role; leitura é segura, só campos de identidade pública).
    const admin = createStaticAdminClient();
    const { data: kit } = await admin
      .from('ai_brand_kits')
      .select('brand_primary_color, brand_accent_color, nome_profissional, cargo, ami, telefone, website, logo_full_url, logo_inverse_url')
      .eq('organization_id', orgId)
      .maybeSingle();
    const brand = brandFromKit(kit);
    brand.logo = await logoToTemplateLogo(kit?.logo_full_url as string | null);
    // Só o inverso é seguro sobre o cabeçalho escuro do flyer; sem ele, fica o nome em texto.
    brand.logoInverse = await logoToTemplateLogo(kit?.logo_inverse_url as string | null);

    // Imóvel + foto (RLS valida a org; URL assinado de 10 minutos só para o render).
    let imovel: TemplateImovel | null = null;
    if (body.imovel_id) {
      const { data: im } = await supabase
        .from('imoveis')
        .select('id, titulo_anuncio, tipo, tipologia, concelho, freguesia, preco_actual, area_util, quartos, wcs')
        .eq('id', body.imovel_id)
        .maybeSingle();
      if (!im) return Response.json({ error: 'Imóvel não encontrado' }, { status: 404 });

      let fotoUrl: string | null = null;
      let fotoPath = body.foto_path ?? null;
      if (!fotoPath) {
        const { data: fotos } = await supabase
          .from('imovel_fotos')
          .select('storage_path, is_principal, ordem')
          .eq('imovel_id', body.imovel_id)
          .order('is_principal', { ascending: false })
          .order('ordem', { ascending: true })
          .limit(1);
        fotoPath = fotos?.[0]?.storage_path ?? null;
      }
      if (fotoPath) {
        const { data: signed } = await supabase.storage.from('imovel-fotos').createSignedUrl(fotoPath, 600);
        fotoUrl = signed?.signedUrl ? await fotoToDataUri(signed.signedUrl, new URL(req.url).origin) : null;
      }

      const detalhes = [
        im.tipologia || im.tipo,
        im.area_util ? `${im.area_util} m²` : null,
        im.quartos != null ? `${im.quartos} quartos` : null,
        im.wcs != null ? `${im.wcs} WC` : null,
      ].filter(Boolean).slice(0, 3).join(' · ');

      imovel = {
        titulo: (im.titulo_anuncio as string | null) || [im.tipologia, im.concelho].filter(Boolean).join(' em ') || 'Imóvel',
        local: [im.freguesia, im.concelho].filter(Boolean).join(', ') || null,
        preco: eur(im.preco_actual as number | null),
        detalhes: detalhes || null,
        fotoUrl,
      };
    }

    const format = body.format as RenderFormat;
    const ratio = body.ratio as RenderRatio;
    const variant = body.variant as TemplateVariant;
    const { width, height } = dimensionsFor(format, ratio);

    const element = buildTemplate({
      variant,
      format,
      ratio,
      brand,
      imovel,
      texts: {
        headline: body.texts.headline,
        sub: body.texts.sub ?? null,
        cta: body.texts.cta ?? null,
        descricao: body.texts.descricao ?? null,
        destaques: body.texts.destaques ?? [],
      },
    });

    const image = new ImageResponse(element, {
      width,
      height,
      fonts: [
        { name: 'Inter', data: loadFont('inter-400.woff'), weight: 400, style: 'normal' },
        { name: 'Inter', data: loadFont('inter-700.woff'), weight: 700, style: 'normal' },
      ],
    });
    const png = Buffer.from(await image.arrayBuffer());

    if (body.preview) {
      return new Response(new Uint8Array(png), {
        headers: { 'content-type': 'image/png', 'cache-control': 'no-store' },
      });
    }

    // Flyer → embrulhar o PNG num PDF A4.
    let fileBytes: Buffer = png;
    let mime = 'image/png';
    let ext = 'png';
    if (format === 'flyer') {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([595.28, 841.89]); // A4 em pontos
      const embedded = await pdf.embedPng(new Uint8Array(png));
      page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
      fileBytes = Buffer.from(await pdf.save());
      mime = 'application/pdf';
      ext = 'pdf';
    }

    const storagePath = `${orgId}/gerados/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('creative-archive')
      .upload(storagePath, fileBytes, { contentType: mime, upsert: false });
    if (upErr) {
      console.error('[criativos/render] storage error:', upErr);
      return Response.json({ error: 'Falhou guardar a peça no cofre' }, { status: 500 });
    }

    const dims = `${width}×${height}`;
    const title = `${FORMAT_LABELS[format]} — ${body.texts.headline}`.slice(0, 120);
    const { data: inserted, error: dbErr } = await supabase
      .from('creative_archive')
      .insert({
        organization_id: orgId,
        owner_id: user.id,
        type: TYPE_FOR_FORMAT[format],
        channel: CHANNEL_FOR_FORMAT[format],
        origin: 'created',
        source: 'auto_generator',
        status: 'draft',
        title,
        content: body.legenda?.trim() || [body.texts.headline, body.texts.sub, body.texts.cta].filter(Boolean).join('\n'),
        tags: [format, dims],
        imovel_id: body.imovel_id ?? null,
        parent_id: body.parent_id ?? null,
        file_path: storagePath,
        file_name: `${format}-${dims}.${ext}`,
        file_size: fileBytes.length,
        mime_type: mime,
        render_spec: {
          format,
          ratio,
          variant,
          imovel_id: body.imovel_id ?? null,
          foto_path: body.foto_path ?? null,
          texts: body.texts,
          legenda: body.legenda ?? null,
          dims,
        },
      })
      .select('id')
      .single();

    if (dbErr) {
      await supabase.storage.from('creative-archive').remove([storagePath]).catch(() => {});
      console.error('[criativos/render] db error:', dbErr);
      return Response.json({ error: dbErr.message }, { status: 500 });
    }

    return Response.json({ ok: true, id: inserted.id }, { status: 201 });
  } catch (e) {
    console.error('[criativos/render] error:', e);
    return Response.json({ error: e instanceof Error ? e.message : 'Falhou o render' }, { status: 500 });
  }
}
