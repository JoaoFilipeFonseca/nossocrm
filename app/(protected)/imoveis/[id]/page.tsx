import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getImovelById, listEventosByImovelId, listDealsByImovelId,
  listFotosByImovelId, listDocumentosByImovelId,
  formatPrecoEur, estadoChipClass, estadoLabel, eventoLabel, tipoLabel,
  CARACTERISTICAS_CATALOG,
} from '@/lib/imoveis';
import ImovelActions from '@/components/imoveis/ImovelActions';
import ImovelGaleria from '@/components/imoveis/ImovelGaleria';
import ImovelDocumentos from '@/components/imoveis/ImovelDocumentos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Imóvel | Foco Imo' };

export default async function ImovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imovel = await getImovelById(id);
  if (!imovel) notFound();

  const [eventos, deals, fotos, documentos] = await Promise.all([
    listEventosByImovelId(id),
    listDealsByImovelId(id),
    listFotosByImovelId(id),
    listDocumentosByImovelId(id),
  ]);

  const label = imovel.referencia ?? imovel.titulo_anuncio ?? imovel.id.slice(0, 8);
  const caracs = imovel.caracteristicas ?? {};
  const caracsAtivas = CARACTERISTICAS_CATALOG.filter((c) => caracs[c.key]);
  const precoM2 = imovel.preco_actual && imovel.area_util && imovel.area_util > 0
    ? Math.round(imovel.preco_actual / imovel.area_util) : null;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-4">
        <Link href="/imoveis" className="text-sm text-blue-600 hover:underline">← Imóveis</Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{label}</h1>
            <span className={estadoChipClass(imovel.estado)}>{estadoLabel(imovel.estado)}</span>
            <span className="text-xs uppercase tracking-wide text-slate-500">{tipoLabel(imovel.tipo)}</span>
          </div>
          {imovel.titulo_anuncio && <p className="text-sm text-slate-700 mt-1 font-medium">{imovel.titulo_anuncio}</p>}
          {imovel.morada && (
            <p className="text-sm text-slate-600 mt-1">
              {imovel.morada}
              {imovel.numero_policia && `, ${imovel.numero_policia}`}
              {imovel.codigo_postal && ` · ${imovel.codigo_postal}`}
              {imovel.freguesia && ` · ${imovel.freguesia}`}
            </p>
          )}
        </div>
        <ImovelActions imovelId={id} imovelLabel={label} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiBox label="Preço actual" value={formatPrecoEur(imovel.preco_actual)} accent />
        {precoM2 && <KpiBox label="Preço / m²" value={`${precoM2} €/m²`} />}
        {imovel.tipologia && <KpiBox label="Tipologia" value={imovel.tipologia} />}
        {imovel.area_util && <KpiBox label="Área útil" value={`${imovel.area_util} m²`} />}
      </div>

      {/* Galeria */}
      <section className="mb-10">
        <ImovelGaleria imovelId={id} fotos={fotos} />
      </section>

      {/* Características */}
      <Section title="Detalhes do imóvel">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DataRow label="Tipo" value={`${tipoLabel(imovel.tipo)}${imovel.subtipo ? ' · ' + imovel.subtipo : ''}`} />
          <DataRow label="Negócio" value={imovel.tipo_negocio} />
          <DataRow label="Estado conservação" value={imovel.estado_conservacao} />
          <DataRow label="Concelho · Freguesia" value={[imovel.concelho, imovel.freguesia].filter(Boolean).join(' · ')} />
          <DataRow label="Distrito" value={imovel.distrito} />
          <DataRow label="Código postal" value={imovel.codigo_postal} />
          <DataRow label="Área útil (m²)" value={imovel.area_util} />
          <DataRow label="Área bruta (m²)" value={imovel.area_bruta} />
          <DataRow label="Área terreno (m²)" value={imovel.area_terreno} />
          <DataRow label="Área dependente (m²)" value={imovel.area_dependente} />
          <DataRow label="Quartos" value={imovel.quartos} />
          <DataRow label="Suites" value={imovel.quartos_suite} />
          <DataRow label="WCs" value={imovel.wcs} />
          <DataRow label="Piso" value={imovel.piso} />
          <DataRow label="Pisos do imóvel" value={imovel.pisos_imovel} />
          <DataRow label="Cozinha" value={imovel.cozinha_tipo} />
          <DataRow label="Ano construção" value={imovel.ano_construcao} />
          <DataRow label="Ano remodelação" value={imovel.ano_remodelacao} />
        </div>
      </Section>

      {/* Eficiência energética e infraestruturas */}
      <Section title="Energia e infraestruturas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DataRow label="Certificado energético" value={imovel.certificado_energetico} highlight />
          <DataRow label="Nº CE / Validade" value={[imovel.ce_numero, imovel.ce_validade].filter(Boolean).join(' · ')} />
          <DataRow label="Aquecimento" value={imovel.aquecimento} />
          <DataRow label="Ar condicionado" value={imovel.tem_ac ? 'Sim' : 'Não'} />
          <DataRow label="Águas" value={imovel.agua} />
          <DataRow label="Painéis solares" value={imovel.paineis_solares} />
          <DataRow label="Caixilharia" value={imovel.caixilharia} />
          <DataRow label="Vidros duplos" value={imovel.vidros_duplos ? 'Sim' : 'Não'} />
          <DataRow label="Orientação" value={imovel.orientacao} />
          <DataRow label="Vista" value={imovel.vista} />
        </div>
      </Section>

      {/* Equipamentos */}
      {caracsAtivas.length > 0 && (
        <Section title={`Equipamentos e extras (${caracsAtivas.length})`}>
          <div className="flex flex-wrap gap-2">
            {caracsAtivas.map((c) => (
              <span key={c.key} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">
                ✓ {c.label}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Preços e fiscalidade */}
      <Section title="Preços e fiscalidade">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DataRow label="Preço actual" value={formatPrecoEur(imovel.preco_actual)} highlight />
          <DataRow label="Preço inicial" value={formatPrecoEur(imovel.preco_inicial)} />
          <DataRow label="Preço mínimo aceitável" value={formatPrecoEur(imovel.preco_minimo_aceitavel)} />
          {imovel.renda_mensal != null && <DataRow label="Renda mensal" value={formatPrecoEur(imovel.renda_mensal)} />}
          {imovel.tem_condominio && (
            <>
              <DataRow label="Condomínio mensal" value={formatPrecoEur(imovel.condominio_mensal)} />
              <DataRow label="Inclui" value={imovel.condominio_inclui} />
            </>
          )}
          <DataRow label="IMI anual" value={formatPrecoEur(imovel.imi_anual)} />
        </div>
      </Section>

      {/* Marketing */}
      {(imovel.descricao_longa || imovel.destaques?.length > 0) && (
        <Section title="Descrição & destaques">
          {imovel.destaques?.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-slate-700">
              {imovel.destaques.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
          {imovel.descricao_longa && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{imovel.descricao_longa}</p>
          )}
        </Section>
      )}

      {imovel.publicado_em?.length > 0 && (
        <Section title="Publicado em">
          <div className="flex flex-wrap gap-2">
            {imovel.publicado_em.map((p) => (
              <span key={p} className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-medium">
                {p}
              </span>
            ))}
          </div>
        </Section>
      )}

      {imovel.link_externo && (
        <div className="mb-8">
          <a href={imovel.link_externo} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
            Anúncio externo ↗
          </a>
        </div>
      )}

      {imovel.notas_privadas && (
        <Section title="Notas privadas">
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{imovel.notas_privadas}</p>
        </Section>
      )}

      {/* Documentos */}
      <Section title="Documentos">
        <ImovelDocumentos imovelId={id} documentos={documentos} />
      </Section>

      {/* Deals associados */}
      <Section title="Deals associados">
        {deals.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum deal ligado a este imóvel ainda.</p>
        ) : (
          <ul className="space-y-2">
            {deals.map((d) => (
              <li key={d.id} className="rounded-md border border-slate-200 p-3 flex items-center justify-between">
                <Link href={`/boards?dealId=${d.id}`} className="text-sm text-blue-600 hover:underline">
                  {d.title ?? d.id.slice(0, 8)}
                </Link>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  {d.status && <span>{d.status}</span>}
                  {d.value != null && <span className="font-medium">{formatPrecoEur(d.value)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Histórico */}
      <Section title="Histórico">
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-500">Sem eventos registados ainda.</p>
        ) : (
          <ol className="space-y-3">
            {eventos.map((e) => (
              <li key={e.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{eventoLabel(e.kind)}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(e.occurred_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}
                  </span>
                </div>
                {e.valor != null && <div className="text-sm text-slate-700 mt-1">{formatPrecoEur(e.valor)}</div>}
                {e.descricao && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{e.descricao}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function KpiBox({ label, value, accent }: { label: string; value: string | number | null; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${accent ? 'text-blue-900' : 'text-slate-900'}`}>{value ?? '—'}</p>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm mt-0.5 ${highlight ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {value == null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}
