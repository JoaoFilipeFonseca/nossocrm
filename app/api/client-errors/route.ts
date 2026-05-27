/**
 * POST /api/client-errors
 *
 * Sprint 18 c1 — recebe erro front-end (window.onerror / unhandledrejection)
 * e grava em public.client_errors. Resolve org_id do user autenticado (se
 * houver) para permitir admin filtrar por org no admin dashboard.
 *
 * Não falha alto se algo der errado: o objectivo é capturar, não bloquear.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const BodySchema = z
  .object({
    source: z.enum(['window.onerror', 'unhandledrejection', 'manual', 'react-boundary']),
    message: z.string().max(2000),
    stack: z.string().max(10000).nullable().optional(),
    url: z.string().max(2000).nullable().optional(),
    user_agent: z.string().max(500).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let organizationId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    organizationId = profile?.organization_id ?? null;
  }

  const { error } = await supabase.from('client_errors').insert({
    organization_id: organizationId,
    user_id: user?.id ?? null,
    source: parsed.data.source,
    message: parsed.data.message,
    stack: parsed.data.stack ?? null,
    url: parsed.data.url ?? null,
    user_agent: parsed.data.user_agent ?? null,
    metadata: parsed.data.metadata ?? {},
  });

  if (error) {
    // Logamos servidor-side; ao cliente devolvemos 202 para não criar loop
    console.error('[client-errors] insert failed:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 202 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
