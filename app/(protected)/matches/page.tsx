import { MatchesClient } from '@/features/matches/MatchesClient';

export const metadata = { title: 'Inbox Bruto | Foco Imo' };
export const dynamic = 'force-dynamic';

export default async function InboxBrutoPage() {
  return <MatchesClient />;
}
