/**
 * MKT-BIBLIOTECA Fatia 2 — templates da marca renderizados pelo CRM (satori/ImageResponse).
 * Peças compostas e deterministas: cores/identidade do Brand Kit + foto do imóvel por URL
 * assinado + copy aprovada. Sem IA de imagem. Cada formato nasce desenhado de raiz para as
 * suas dimensões, com margens de segurança (nada de cortes de um rácio para o outro).
 */
import React from 'react';

export type RenderFormat = 'anuncio' | 'post' | 'story' | 'flyer';
export type RenderRatio = 'square' | 'portrait';
export type TemplateVariant = 'classico' | 'faixa';

export const FORMAT_LABELS: Record<RenderFormat, string> = {
  anuncio: 'Criativo para anúncio Meta',
  post: 'Post orgânico FB/IG',
  story: 'Story / Reel',
  flyer: 'Flyer / One-pager (PDF)',
};

export const VARIANT_LABELS: Record<TemplateVariant, string> = {
  classico: 'Clássico (foto + faixa da marca)',
  faixa: 'Imersivo (foto inteira + gradiente)',
};

/** Dimensões certas por formato. Posts têm DOIS rácios de raiz (decisão do João 11/06). */
export function dimensionsFor(format: RenderFormat, ratio?: RenderRatio): { width: number; height: number } {
  if (format === 'story') return { width: 1080, height: 1920 };
  if (format === 'flyer') return { width: 1240, height: 1754 }; // A4 a 150dpi → PDF
  if (format === 'post' && ratio === 'portrait') return { width: 1080, height: 1350 }; // 4:5, ideal IG
  return { width: 1080, height: 1080 };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function hexOrDefault(value: string | null | undefined, fallback: string): string {
  return value && HEX_RE.test(value.trim()) ? value.trim() : fallback;
}

export interface TemplateBrand {
  primary: string;
  accent: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  ami: string | null;
  website: string | null;
}

export interface TemplateImovel {
  titulo: string;
  local: string | null;
  preco: string | null;
  detalhes: string | null; // ex.: "T3 · 152 m² · 2 WC"
  fotoUrl: string | null;
}

export interface TemplateTexts {
  headline: string;
  sub: string | null;
  cta: string | null;
  descricao?: string | null; // flyer
  destaques?: string[]; // flyer
}

export interface TemplateProps {
  variant: TemplateVariant;
  format: RenderFormat;
  ratio?: RenderRatio;
  brand: TemplateBrand;
  imovel: TemplateImovel | null;
  texts: TemplateTexts;
}

/** Brand kit cru (linhas da BD) → cores e identidade com fallbacks premium. */
export function brandFromKit(kit: Record<string, unknown> | null | undefined): TemplateBrand {
  const k = (kit ?? {}) as Record<string, string | null>;
  return {
    primary: hexOrDefault(k.brand_primary_color, '#16324f'),
    accent: hexOrDefault(k.brand_accent_color, '#c8a24b'),
    nome: (k.nome_profissional || 'João Fonseca').toString(),
    cargo: k.cargo ?? null,
    telefone: k.telefone ?? null,
    ami: k.ami ?? null,
    website: k.website ?? null,
  };
}

function footerLine(brand: TemplateBrand): string {
  return [brand.ami ? `AMI ${brand.ami}` : null, brand.telefone, brand.website]
    .filter(Boolean)
    .join('   ·   ');
}

/* Elementos auxiliares (satori: flexbox apenas, containers com children precisam de display flex). */

function BrandChip({ brand, size }: { brand: TemplateBrand; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        color: brand.primary,
        borderRadius: size * 0.35,
        padding: `${size * 0.35}px ${size * 0.7}px`,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      {brand.nome.toUpperCase()}
    </div>
  );
}

function PriceChip({ brand, preco, size }: { brand: TemplateBrand; preco: string; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: brand.accent,
        color: '#10212f',
        borderRadius: size * 0.35,
        padding: `${size * 0.35}px ${size * 0.7}px`,
        fontSize: size,
        fontWeight: 700,
      }}
    >
      {preco}
    </div>
  );
}

function Foto({ url, width, height }: { url: string | null; width: number; height: number }) {
  if (url) {
     
    return <img src={url} width={width} height={height} style={{ objectFit: 'cover' }} alt="" />;
  }
  return (
    <div
      style={{
        display: 'flex',
        width,
        height,
        background: 'linear-gradient(135deg, #2c4a6e 0%, #16324f 100%)',
      }}
    />
  );
}

/**
 * Variante "clássico": foto em cima, faixa da marca em baixo com headline, sub e rodapé.
 * Margens de segurança: 6% laterais; no story, 12% livres em cima e em baixo (UI do IG).
 */
function TemplateClassico({ format, ratio, brand, imovel, texts }: TemplateProps) {
  const { width, height } = dimensionsFor(format, ratio);
  const isStory = format === 'story';
  const pad = Math.round(width * 0.06);
  const fotoH = Math.round(height * (isStory ? 0.52 : ratio === 'portrait' ? 0.56 : 0.54));
  const headlineSize = Math.round(width * (isStory ? 0.062 : 0.052));
  const subSize = Math.round(width * 0.031);
  const metaSize = Math.round(width * 0.024);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, backgroundColor: brand.primary, fontFamily: 'Inter' }}>
      {isStory && <div style={{ display: 'flex', height: Math.round(height * 0.07) }} />}
      <div style={{ display: 'flex', position: 'relative', width, height: fotoH }}>
        <Foto url={imovel?.fotoUrl ?? null} width={width} height={fotoH} />
        <div style={{ display: 'flex', position: 'absolute', top: pad * 0.6, left: pad * 0.6 }}>
          <BrandChip brand={brand} size={metaSize} />
        </div>
        {imovel?.preco && (
          <div style={{ display: 'flex', position: 'absolute', top: pad * 0.6, right: pad * 0.6 }}>
            <PriceChip brand={brand} preco={imovel.preco} size={metaSize} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: `${pad * 0.8}px ${pad}px`, color: '#ffffff' }}>
        <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 700, lineHeight: 1.15 }}>{texts.headline}</div>
        {texts.sub && (
          <div style={{ display: 'flex', fontSize: subSize, marginTop: Math.round(pad * 0.35), opacity: 0.92, lineHeight: 1.3 }}>
            {texts.sub}
          </div>
        )}
        {imovel?.detalhes && (
          <div style={{ display: 'flex', fontSize: metaSize, marginTop: Math.round(pad * 0.35), opacity: 0.8 }}>
            {[imovel.detalhes, imovel.local].filter(Boolean).join('   ·   ')}
          </div>
        )}
        <div style={{ display: 'flex', flexGrow: 1 }} />
        {texts.cta && (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: brand.accent,
              color: '#10212f',
              fontSize: subSize,
              fontWeight: 700,
              padding: `${Math.round(pad * 0.3)}px ${Math.round(pad * 0.6)}px`,
              borderRadius: 14,
            }}
          >
            {texts.cta}
          </div>
        )}
        <div style={{ display: 'flex', marginTop: Math.round(pad * 0.45), fontSize: metaSize * 0.9, opacity: 0.75 }}>
          {footerLine(brand)}
        </div>
      </div>
      {isStory && <div style={{ display: 'flex', height: Math.round(height * 0.05) }} />}
    </div>
  );
}

/** Variante "faixa" (imersivo): foto a sangrar com gradiente e texto por cima, em baixo. */
function TemplateFaixa({ format, ratio, brand, imovel, texts }: TemplateProps) {
  const { width, height } = dimensionsFor(format, ratio);
  const isStory = format === 'story';
  const pad = Math.round(width * 0.06);
  const headlineSize = Math.round(width * (isStory ? 0.066 : 0.056));
  const subSize = Math.round(width * 0.032);
  const metaSize = Math.round(width * 0.024);
  const bottomPad = isStory ? Math.round(height * 0.12) : pad;

  return (
    <div style={{ display: 'flex', position: 'relative', width, height, fontFamily: 'Inter', backgroundColor: brand.primary }}>
      <Foto url={imovel?.fotoUrl ?? null} width={width} height={height} />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          background: 'linear-gradient(180deg, rgba(8,18,28,0.35) 0%, rgba(8,18,28,0.05) 35%, rgba(8,18,28,0.82) 78%, rgba(8,18,28,0.92) 100%)',
        }}
      />
      <div style={{ display: 'flex', position: 'absolute', top: isStory ? Math.round(height * 0.08) : pad * 0.6, left: pad * 0.6 }}>
        <BrandChip brand={brand} size={metaSize} />
      </div>
      {imovel?.preco && (
        <div style={{ display: 'flex', position: 'absolute', top: isStory ? Math.round(height * 0.08) : pad * 0.6, right: pad * 0.6 }}>
          <PriceChip brand={brand} preco={imovel.preco} size={metaSize} />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: bottomPad,
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: headlineSize, fontWeight: 700, lineHeight: 1.12 }}>{texts.headline}</div>
        {texts.sub && (
          <div style={{ display: 'flex', fontSize: subSize, marginTop: Math.round(pad * 0.3), opacity: 0.95, lineHeight: 1.3 }}>
            {texts.sub}
          </div>
        )}
        {imovel?.detalhes && (
          <div style={{ display: 'flex', fontSize: metaSize, marginTop: Math.round(pad * 0.3), opacity: 0.85 }}>
            {[imovel.detalhes, imovel.local].filter(Boolean).join('   ·   ')}
          </div>
        )}
        {texts.cta && (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              marginTop: Math.round(pad * 0.45),
              backgroundColor: brand.accent,
              color: '#10212f',
              fontSize: subSize,
              fontWeight: 700,
              padding: `${Math.round(pad * 0.3)}px ${Math.round(pad * 0.6)}px`,
              borderRadius: 14,
            }}
          >
            {texts.cta}
          </div>
        )}
        <div style={{ display: 'flex', marginTop: Math.round(pad * 0.4), fontSize: metaSize * 0.9, opacity: 0.75 }}>
          {footerLine(brand)}
        </div>
      </div>
    </div>
  );
}

/** Flyer A4 (one-pager): cabeçalho da marca, foto, título, descrição, destaques e contacto. */
function TemplateFlyer({ brand, imovel, texts }: TemplateProps) {
  const { width, height } = dimensionsFor('flyer');
  const pad = Math.round(width * 0.07);
  const destaques = (texts.destaques ?? []).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, backgroundColor: '#ffffff', fontFamily: 'Inter' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: brand.primary,
          color: '#ffffff',
          padding: `${Math.round(pad * 0.45)}px ${pad}px`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: 1 }}>{brand.nome.toUpperCase()}</div>
          {brand.cargo && <div style={{ display: 'flex', fontSize: 20, opacity: 0.85, marginTop: 4 }}>{brand.cargo}</div>}
        </div>
        {imovel?.preco && <PriceChip brand={brand} preco={imovel.preco} size={30} />}
      </div>
      <div style={{ display: 'flex', width, height: Math.round(height * 0.38) }}>
        <Foto url={imovel?.fotoUrl ?? null} width={width} height={Math.round(height * 0.38)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: `${Math.round(pad * 0.6)}px ${pad}px`, color: '#10212f' }}>
        <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, lineHeight: 1.15 }}>{texts.headline}</div>
        {(imovel?.detalhes || imovel?.local) && (
          <div style={{ display: 'flex', fontSize: 24, marginTop: 14, color: '#475569' }}>
            {[imovel?.detalhes, imovel?.local].filter(Boolean).join('   ·   ')}
          </div>
        )}
        {texts.descricao && (
          <div style={{ display: 'flex', fontSize: 24, marginTop: 22, lineHeight: 1.45, color: '#1f2937' }}>{texts.descricao}</div>
        )}
        {destaques.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
            {destaques.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginTop: i === 0 ? 0 : 10 }}>
                <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, backgroundColor: brand.accent, marginRight: 14 }} />
                <div style={{ display: 'flex', fontSize: 24, color: '#1f2937' }}>{d}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexGrow: 1 }} />
        {texts.cta && (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: brand.primary,
              color: '#ffffff',
              fontSize: 26,
              fontWeight: 700,
              padding: '14px 28px',
              borderRadius: 14,
            }}
          >
            {texts.cta}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
          color: '#334155',
          fontSize: 20,
          padding: `${Math.round(pad * 0.35)}px ${pad}px`,
        }}
      >
        {footerLine(brand)}
      </div>
    </div>
  );
}

export function buildTemplate(props: TemplateProps): React.ReactElement {
  if (props.format === 'flyer') return <TemplateFlyer {...props} />;
  if (props.variant === 'faixa') return <TemplateFaixa {...props} />;
  return <TemplateClassico {...props} />;
}
