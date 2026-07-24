import { redirect } from 'next/navigation';

/**
 * Rota legada `/deals/[dealId]/cockpit-v2` → `/deals/[dealId]/cockpit`.
 * O cockpit rico deixou de ser "v2": passou a ser o cockpit único. Alias
 * mantido para marcadores e links antigos (arrumação do CRM, W5).
 */
export default async function DealCockpitV2Page({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  redirect(`/deals/${dealId}/cockpit`);
}
