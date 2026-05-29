// Épico Meta Ads — Fase A, c2 — início do OAuth (redirect para o Facebook).
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMetaAppCredentials, buildAuthUrl } from '@/lib/integrations/meta/oauth';
import { metaRedirectUri } from '@/lib/integrations/meta/config';

function backToSettings(origin: string, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/settings/integracoes?meta=${code}#meta-ads`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', origin));

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return backToSettings(origin, 'sem_permissao');

  let appId: string;
  try {
    ({ appId } = await getMetaAppCredentials());
  } catch {
    return backToSettings(origin, 'config');
  }

  const state = crypto.randomUUID();
  const redirectUri = metaRedirectUri(origin);
  const authUrl = buildAuthUrl(appId, redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  // Cookie httpOnly para validar o `state` no callback (anti-CSRF). 10 min.
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
