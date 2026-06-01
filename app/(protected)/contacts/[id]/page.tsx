import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MessageCircle } from 'lucide-react';
import { getContactById, getContactReferrals, getContactDealsSummary } from '@/lib/contacts/detail';
import { MetaAttribution } from '@/components/MetaAttribution';
import ContactFilesPanel from '@/features/contacts/components/ContactFilesPanel';
import { toWhatsAppPhone } from '@/lib/phone';
import type { ContactCustomFields, DiscProfile } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contacto | Foco Imo' };

const DISC_META: Record<DiscProfile, { label: string; dot: string; chip: string }> = {
  D: { label: 'D — Dominante', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  I: { label: 'I — Influente', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  S: { label: 'S — Estável', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  C: { label: 'C — Consciencioso', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatPtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' });
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  const [referrals, dealsSummary] = await Promise.all([
    getContactReferrals(id),
    getContactDealsSummary(id),
  ]);

  const cf: ContactCustomFields = contact.customFields ?? {};
  const disc = cf.disc ? DISC_META[cf.disc] : null;
  const initials = (contact.name || '?').trim().charAt(0).toUpperCase();
  const stageLabel = contact.stage && !UUID_RE.test(contact.stage) ? contact.stage : null;

  const waPhone = contact.phone ? toWhatsAppPhone(contact.phone) : null;

  // Linhas de propriedade (CT-1) — só as que têm valor.
  const propRows: { icon: string; label: string; node: React.ReactNode }[] = [];
  if (cf.address) propRows.push({ icon: '📍', label: 'Morada / Investimento', node: cf.address });
  if (cf.familyMembers) propRows.push({ icon: '👨‍👩‍👧', label: 'Família', node: cf.familyMembers });
  if (cf.pets) propRows.push({ icon: '🐾', label: 'Animais', node: cf.pets });
  if (cf.triggers && cf.triggers.length > 0) {
    propRows.push({
      icon: '⚡',
      label: 'Triggers',
      node: (
        <div className="flex flex-wrap gap-1.5">
          {cf.triggers.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-700 border border-rose-200">{t}</span>
          ))}
        </div>
      ),
    });
  }
  const birthLabel = formatPtDate(contact.birthDate);
  if (birthLabel) propRows.push({ icon: '🎂', label: 'Aniversário', node: birthLabel });
  if (cf.quarter) propRows.push({ icon: '🗓️', label: 'Trimestre', node: cf.quarter });
  const lastActivity = formatPtDate(cf.lastActivityDate);
  if (lastActivity) {
    propRows.push({
      icon: '⏱️',
      label: 'Última actividade',
      node: cf.lastActivityNote ? `${lastActivity} · ${cf.lastActivityNote}` : lastActivity,
    });
  }
  if (cf.followUp) {
    const fu = formatPtDate(cf.followUpDate);
    propRows.push({
      icon: '🔔',
      label: 'Follow Up?',
      node: <span className="text-emerald-700 font-medium">Sim{fu ? ` · próximo a ${fu}` : ''}</span>,
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Voltar */}
      <div className="mb-4">
        <Link href="/contacts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Contactos
        </Link>
      </div>

      {/* CABEÇALHO */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5 sm:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-2xl font-bold font-display">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white truncate">{contact.name}</h1>
              {disc && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${disc.chip}`}>
                  <span className={`w-2 h-2 rounded-full ${disc.dot}`} /> DISC: {disc.label}
                </span>
              )}
            </div>
            {contact.role && (
              <p className="text-sm text-slate-500 mt-0.5">{contact.role}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                contact.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : contact.status === 'INACTIVE' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {contact.status === 'ACTIVE' ? 'Activo' : contact.status === 'INACTIVE' ? 'Inactivo' : 'Perdido'}
              </span>
              {stageLabel && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Etapa: {stageLabel}</span>
              )}
              {contact.attribution?.source === 'meta_ads' && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Origem: Meta Ads</span>
              )}
            </div>
          </div>
          {/* Acções rápidas */}
          <div className="flex flex-wrap gap-2 sm:w-44">
            {waPhone && (
              <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
                <Phone size={15} /> Ligar
              </a>
            )}
          </div>
        </div>
      </div>

      {/* GRELHA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PRINCIPAL */}
        <div className="lg:col-span-2 space-y-5">
          {/* CT-2: atribuição read-only */}
          <MetaAttribution attribution={contact.attribution} />

          {/* CT-1: propriedades */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sobre a pessoa</h2>
            </div>
            {propRows.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {propRows.map((row) => (
                  <div key={row.label} className="px-5 py-2.5 flex items-start gap-3 sm:gap-4">
                    <div className="w-40 shrink-0 text-xs font-medium text-slate-500 flex items-center gap-2 pt-0.5">
                      <span aria-hidden>{row.icon}</span> {row.label}
                    </div>
                    <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">{row.node}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 pb-4 text-sm text-slate-500">Sem campos preenchidos ainda. A edição chega na próxima fase.</p>
            )}

            {/* Relações (Indicado por / Indicou) */}
            {(referrals.referredBy.length > 0 || referrals.referred.length > 0) && (
              <div className="border-t border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
                {referrals.referredBy.length > 0 && (
                  <div className="px-5 py-2.5 flex items-start gap-3 sm:gap-4">
                    <div className="w-40 shrink-0 text-xs font-medium text-slate-500 flex items-center gap-2 pt-0.5"><span aria-hidden>🤝</span> Indicado por</div>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {referrals.referredBy.map((r) => (
                        <Link key={r.referralId} href={`/contacts/${r.contactId}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 text-xs font-medium">{r.name}</Link>
                      ))}
                    </div>
                  </div>
                )}
                {referrals.referred.length > 0 && (
                  <div className="px-5 py-2.5 flex items-start gap-3 sm:gap-4">
                    <div className="w-40 shrink-0 text-xs font-medium text-slate-500 flex items-center gap-2 pt-0.5"><span aria-hidden>↪️</span> Indicou</div>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {referrals.referred.map((r) => (
                        <Link key={r.referralId} href={`/contacts/${r.contactId}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 text-xs font-medium">{r.name}</Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notas */}
          {contact.notes && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Notas</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Documentos (reusa ContactFilesPanel) */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Documentos</h2>
            <ContactFilesPanel contactId={contact.id} />
          </div>
        </div>

        {/* LATERAL */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Contacto</h2>
            <div className="space-y-2 text-sm">
              {contact.phone && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300"><Phone size={14} className="text-slate-400" /> <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a></div>}
              {contact.email && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300"><Mail size={14} className="text-slate-400" /> <a href={`mailto:${contact.email}`} className="hover:underline break-all">{contact.email}</a></div>}
              {!contact.phone && !contact.email && <p className="text-slate-400 text-sm">Sem contactos registados.</p>}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Resumo</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                <div className="text-xs text-slate-500">Valor (LTV)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{(contact.totalValue || 0).toLocaleString('pt-PT')}€</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                <div className="text-xs text-slate-500">Negócios</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{dealsSummary.openCount} activo{dealsSummary.openCount === 1 ? '' : 's'}</div>
              </div>
            </div>
          </div>

          {/* Teaser CONTACT-360-AI */}
          <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-primary-700 flex items-center gap-1.5">✨ Próxima melhor acção</h2>
              <span className="text-[10px] uppercase tracking-wide font-bold text-primary-500 bg-white/70 px-1.5 py-0.5 rounded">Em breve</span>
            </div>
            <p className="text-sm text-primary-900/90 leading-relaxed">
              A IA vai cruzar família, triggers, DISC e última actividade para sugerir a melhor mensagem, à medida desta pessoa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
