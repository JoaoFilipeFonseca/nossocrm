/**
 * POST /api/contacts/[id]/comments          — adiciona um comentário
 * DELETE /api/contacts/[id]/comments?commentId=...  — remove (só o autor)
 *
 * CT-1 Fase 3. Auth por sessão; RLS de contact_comments valida a org.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const PostSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();

async function resolveOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401 };
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single();
  if (profileError || !profile?.organization_id) return { error: 'Profile not found' as const, status: 404 };
  return { user, organizationId: profile.organization_id as string };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const ctx = await resolveOrg(supabase);
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const raw = await request.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    // Confirma que o contacto é da org.
    const { data: contact, error: contactError } = await supabase
      .from('contacts').select('id, organization_id').eq('id', contactId).maybeSingle();
    if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 });
    if (!contact || contact.organization_id !== ctx.organizationId) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('contact_comments')
      .insert({
        organization_id: ctx.organizationId,
        contact_id: contactId,
        author_id: ctx.user.id,
        body: parsed.data.body,
      })
      .select('id, created_at')
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ ok: true, comment: inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await params;
    const supabase = await createClient();
    const ctx = await resolveOrg(supabase);
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const commentId = request.nextUrl.searchParams.get('commentId');
    if (!commentId) return NextResponse.json({ error: 'commentId em falta' }, { status: 400 });

    // Só o autor pode apagar o próprio comentário (RLS já confina à org).
    const { error: delError } = await supabase
      .from('contact_comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', ctx.user.id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
