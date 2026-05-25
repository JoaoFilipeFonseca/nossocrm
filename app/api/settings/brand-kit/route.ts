import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const KitSchema = z
  .object({
    brand_primary_color: z.string().nullable().optional(),
    brand_secondary_color: z.string().nullable().optional(),
    brand_accent_color: z.string().nullable().optional(),
    brand_neutral_color: z.string().nullable().optional(),
    font_headline: z.string().nullable().optional(),
    font_body: z.string().nullable().optional(),
    logo_full_url: z.string().nullable().optional(),
    logo_symbol_url: z.string().nullable().optional(),
    logo_mono_url: z.string().nullable().optional(),
    logo_inverse_url: z.string().nullable().optional(),
    photo_personal_url: z.string().nullable().optional(),
    photo_team_url: z.string().nullable().optional(),
    tom_voz: z.string().nullable().optional(),
    filosofia: z.string().nullable().optional(),
    pilares: z.array(z.string()).optional(),
    vocabulario_banido: z.array(z.string()).optional(),
    vocabulario_preferido: z.record(z.string(), z.string()).optional(),
    saudacao_padrao: z.string().nullable().optional(),
    despedida_padrao: z.string().nullable().optional(),
    assinatura_email: z.string().nullable().optional(),
    nome_profissional: z.string().nullable().optional(),
    cargo: z.string().nullable().optional(),
    ami: z.string().nullable().optional(),
    nipc: z.string().nullable().optional(),
    telefone: z.string().nullable().optional(),
    email_profissional: z.string().nullable().optional(),
    morada_escritorio: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    facebook_url: z.string().nullable().optional(),
    instagram_url: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
    youtube_url: z.string().nullable().optional(),
    bio_curta: z.string().nullable().optional(),
    bio_longa: z.string().nullable().optional(),
    segmento_alvo: z.string().nullable().optional(),
    proposta_unica: z.string().nullable().optional(),
    frases_marca: z.array(z.string()).optional(),
  })
  .strict();

async function resolveProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: json({ error: 'Unauthorized' }, 401) };
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) {
    return { supabase, error: json({ error: 'Profile not found' }, 404) };
  }
  return { supabase, profile };
}

export async function GET() {
  const { supabase, profile, error } = await resolveProfile();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from('ai_brand_kits')
    .select('*')
    .eq('organization_id', profile!.organization_id)
    .maybeSingle();

  if (dbError) return json({ error: dbError.message }, 500);

  return json({ kit: data ?? null, isAdmin: profile!.role === 'admin' });
}

export async function PUT(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { supabase, profile, error } = await resolveProfile();
  if (error) return error;
  if (profile!.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const raw = await req.json().catch(() => null);
  const parsed = KitSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const payload: Record<string, unknown> = {
    organization_id: profile!.organization_id,
    ...parsed.data,
  };

  const { error: upsertError } = await supabase
    .from('ai_brand_kits')
    .upsert(payload, { onConflict: 'organization_id' });

  if (upsertError) return json({ error: upsertError.message }, 500);

  return json({ ok: true });
}
