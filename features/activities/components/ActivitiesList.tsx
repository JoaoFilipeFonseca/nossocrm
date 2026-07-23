import React, { useMemo, useState } from 'react';
import { Activity, Deal, Contact, Company } from '@/types';
import { ActivityRow } from './ActivityRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { CheckSquare } from 'lucide-react';
import { useDealQuickStats } from '@/lib/query/hooks/useDealQuickStats';
import { DealActivityModal } from '@/components/activity/DealActivityModal';

interface ActivitiesListProps {
    activities: Activity[];
    deals: Deal[];
    contacts: Contact[];
    companies: Company[];
    onToggleComplete: (id: string) => void;
    onEdit: (activity: Activity) => void;
    onDelete: (id: string) => void;
    selectedActivities?: Set<string>;
    onSelectActivity?: (id: string, selected: boolean) => void;
    onAddActivity?: () => void;
}

/**
 * Componente React `ActivitiesList`.
 *
 * @param {ActivitiesListProps} {
    activities,
    deals,
    onToggleComplete,
    onEdit,
    onDelete,
    selectedActivities = new Set(),
    onSelectActivity
} - Parâmetro `{
    activities,
    deals,
    onToggleComplete,
    onEdit,
    onDelete,
    selectedActivities = new Set(),
    onSelectActivity
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const ActivitiesList: React.FC<ActivitiesListProps> = ({
    activities,
    deals,
    contacts,
    companies,
    onToggleComplete,
    onEdit,
    onDelete,
    selectedActivities = new Set(),
    onSelectActivity,
    onAddActivity,
}) => {
    // Performance: Activities pode ser uma lista grande; evitamos `find` por linha (O(N*M)).
    const dealById = useMemo(() => {
        const map = new Map<string, Deal>();
        for (const d of deals) map.set(d.id, d);
        return map;
    }, [deals]);

    const contactById = useMemo(() => {
        const map = new Map<string, Contact>();
        for (const c of contacts) map.set(c.id, c);
        return map;
    }, [contacts]);

    const companyById = useMemo(() => {
        const map = new Map<string, Company>();
        for (const c of companies) map.set(c.id, c);
        return map;
    }, [companies]);

    // Uma única chamada de quick-stats para todos os negócios visíveis (evita N+1).
    const dealIds = useMemo(() => {
        const set = new Set<string>();
        for (const a of activities) if (a.dealId) set.add(a.dealId);
        return [...set];
    }, [activities]);
    const { data: quickStatsMap } = useDealQuickStats(dealIds);

    // Modal "Actividade" partilhado (uma instância; o negócio activo controla-o).
    const [activityDeal, setActivityDeal] = useState<Deal | null>(null);

    if (activities.length === 0) {
        return (
            <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-white/5 border-dashed">
                <EmptyState
                    icon={CheckSquare}
                    title="Nenhuma actividade encontrada"
                    description="Crie uma actividade para começar a acompanhar seu trabalho."
                    action={onAddActivity ? { label: 'Nova Actividade', onClick: onAddActivity } : undefined}
                />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map(activity => {
                const rowDeal = activity.dealId ? dealById.get(activity.dealId) : undefined;
                return (
                    <ActivityRow
                        key={activity.id}
                        activity={activity}
                        deal={rowDeal}
                        contact={activity.contactId ? contactById.get(activity.contactId) : undefined}
                        company={activity.clientCompanyId ? companyById.get(activity.clientCompanyId) : undefined}
                        onToggleComplete={onToggleComplete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        isSelected={selectedActivities.has(activity.id)}
                        onSelect={onSelectActivity}
                        quickStats={rowDeal ? quickStatsMap?.[rowDeal.id] : undefined}
                        onOpenActivity={setActivityDeal}
                    />
                );
            })}

            {activityDeal && (
                <DealActivityModal
                    dealId={activityDeal.id}
                    contactName={(activityDeal.contactId ? contactById.get(activityDeal.contactId)?.name : null) ?? activityDeal.title}
                    open={!!activityDeal}
                    onOpenChange={(o) => { if (!o) setActivityDeal(null); }}
                />
            )}
        </div>
    );
};
