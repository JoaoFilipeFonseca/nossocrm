/**
 * PATCH /api/messaging/channels/[id]/credentials
 *
 * Actualiza (faz merge) das credenciais de um canal já criado — por exemplo, o
 * Access Token do WhatsApp quando expira. Só admins da organização dona do canal.
 *
 * O token entra por aqui (nunca pelo chat) e NUNCA é devolvido ao cliente.
 */
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// Chaves de credencial aceites (partial merge — só se atualiza o que vier preenchido).
const ALLOWED_KEYS = ['accessToken', 'phoneNumberId', 'wabaId', 'appSecret', 'token', 'clientToken'] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (profile.role !== 'admin') return json({ error: 'Forbidden - Admin access required' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const patch: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) patch[key] = value.trim();
  }
  if (Object.keys(patch).length === 0) {
    return json({ error: 'Nada para actualizar (sem credenciais válidas).' }, 400);
  }

  const admin = await createAdminClient();

  const { data: channel, error: fetchError } = await admin
    .from('messaging_channels')
    .select('id, credentials')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!channel) return json({ error: 'Canal não encontrado' }, 404);

  const merged = { ...((channel.credentials as Record<string, unknown>) || {}), ...patch };

  const { error: updateError } = await admin
    .from('messaging_channels')
    .update({
      credentials: merged,
      status: 'connected',
      status_message: null,
      last_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (updateError) return json({ error: updateError.message }, 500);

  // NUNCA devolver as credenciais — só quais chaves foram actualizadas.
  return json({ ok: true, updated: Object.keys(patch) });
}
