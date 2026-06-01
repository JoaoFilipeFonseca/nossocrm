import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MessageCircle } from 'lucide-react';
import { getContactById, getContactReferrals, getContactDealsSummary, getContactComments } from '@/lib/contacts/detail';
import { createClient } from '@/lib/supabase/server';
import { MetaAttribution } from '@/components/MetaAttribution';
import ContactFilesPanel from '@/features/contacts/components/ContactFilesPanel';
import { ContactRichPanel } from '@/features/contacts/components/ContactRichPanel';
import { ContactComments } from '@/features/contacts/components/ContactComments';
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

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  const [referrals, dealsSummary, comments] = await Promise.all([
    getContactReferrals(id),
    getContactDealsSummary(id),
    getContactComments(id),
  ]);

  // Utilizador actual (para permitir apagar só os próprios comentários).
  let currentUserId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    currentUserId = user?.id ?? null;
  } catch { /* opcional */ }

  const cf: ContactCustomFields = contact.customFields ?? {};
  const disc = cf.disc ? DISC_META[cf.disc] : null;
  const initials = (contact.name || '?').trim().charAt(0).toUpperCase();
  const stageLabel = contact.stage && !UUID_RE.test(contact.stage) ? contact.stage : null;

  const waPhone = contact.phone ? toWhatsAppPhone(contact.phone) : null;

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

          {/* CT-1: propriedades + relações + notas (editável) */}
          <ContactRichPanel
            contactId={contact.id}
            initialCustomFields={cf}
            initialNotes={contact.notes ?? ''}
            initialBirthDate={contact.birthDate}
            initialReferredBy={referrals.referredBy}
            initialReferred={referrals.referred}
          />

          {/* Documentos (reusa ContactFilesPanel) */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Documentos</h2>
            <ContactFilesPanel contactId={contact.id} />
          </div>

          {/* Comentários */}
          <ContactComments contactId={contact.id} initialComments={comments} currentUserId={currentUserId} />
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
