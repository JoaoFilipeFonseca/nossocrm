import type { Metadata } from 'next';
import DealCockpitClient from '@/features/deals/cockpit/DealCockpitClient';

/**
 * Cockpit do negócio — rota canónica única.
 * O antigo cockpit v1 (wrapper do Focus do Inbox) foi aposentado; o cockpit
 * rico passou a ser o único. `/cockpit-v2` continua como redirect para aqui.
 * URL: /deals/[dealId]/cockpit
 */
export async function generateMetadata({ params }: { params: Promise<{ dealId: string }> }): Promise<Metadata> {
  const { dealId } = await params;
  return { title: `Negócio ${dealId} | Foco Imo` };
}

export default async function DealCockpitPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return <DealCockpitClient dealId={dealId} />;
}
