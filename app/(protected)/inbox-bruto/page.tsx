import { InboxBrutoClient } from '@/features/inbox-bruto/InboxBrutoClient';

export const metadata = { title: 'Matches | Foco Imo' };
export const dynamic = 'force-dynamic';

export default async function InboxBrutoPage() {
  return <InboxBrutoClient />;
}
