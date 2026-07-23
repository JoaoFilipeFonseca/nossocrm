// TAREFAS Fase 2 — início do OAuth Google (redirect para o consentimento).
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAuthUrl, getGoogleAppCredentials } from '@/lib/integrations/google/oauth';
import { googleRedirectUri } from '@/lib/integrations/google/config';

function backToSettings(origin: string, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/settings/integracoes?google=${code}#google-calendar`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', origin));

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return backToSettings(origin, 'sem_permissao');

  let clientId: string;
  try {
    ({ clientId } = await getGoogleAppCredentials());
  } catch {
    // Ainda não há credenciais no Vault (passo do João no Google Cloud).
    return backToSettings(origin, 'config');
  }

  const state = crypto.randomUUID();
  const authUrl = buildAuthUrl(clientId, googleRedirectUri(origin), state);

  const res = NextResponse.redirect(authUrl);
  // Cookie httpOnly para validar o `state` no callback (anti-CSRF). 10 min.
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
