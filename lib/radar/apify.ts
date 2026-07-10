/**
 * Brief 6 — Radar Maia. Cliente mínimo da API da Apify.
 *
 * A recolha corre 1x/dia. Cada portal tem um actor pay-per-result. Corremos em
 * modo síncrono (run-sync-get-dataset-items) com um tecto de itens por portal,
 * limitado às NOVAS entradas das últimas horas (URL de pesquisa por data).
 *
 * O token vive em organization_settings.apify_token (chave do João, server-only).
 */

export interface PortalConfig {
  portal: string;
  actor: string; // username~name (formato path da API)
  buildInput: (opts: { maxItems: number; janelaHoras: number }) => Record<string, unknown>;
}

/**
 * Configuração dos portais. As URLs de pesquisa apontam ao concelho da Maia,
 * ordenadas pelas mais recentes. Idealista é a fonte fiável de particular/agência.
 */
export const PORTALS: Record<string, PortalConfig> = {
  idealista: {
    portal: 'idealista',
    actor: 'memo23~idealista-scraper',
    buildInput: ({ maxItems }) => ({
      // Maia, ordenado pelas mais recentes. O radar deduplica por hash, por isso
      // basta varrer o topo das novidades todos os dias.
      startUrls: ['https://www.idealista.pt/comprar-casas/maia/?ordem=data-desc'],
      maxItems,
      splitByPrice: false,
      monitoringMode: false,
      scrapeAgencies: false,
    }),
  },
  olx: {
    portal: 'olx',
    actor: 'piotrv1001~olx-listings-scraper',
    buildInput: ({ maxItems }) => ({
      country: 'pt',
      mode: 'search',
      searchQuery: 'apartamento moradia venda maia',
      sortBy: 'created_at:desc',
      maxItems,
      includeDetails: false,
    }),
  },
};

const APIFY_BASE = 'https://api.apify.com/v2';

/**
 * Corre um actor de forma síncrona e devolve os itens do dataset.
 * Lança em erro de rede/HTTP; o chamador trata (nunca 5xx a jusante).
 */
export async function runActorSync(
  token: string,
  actorPath: string,
  input: Record<string, unknown>,
  opts: { maxItems: number; timeoutSecs?: number; memoryMbytes?: number } = { maxItems: 150 },
): Promise<unknown[]> {
  const params = new URLSearchParams({ token });
  if (opts.maxItems) params.set('maxItems', String(opts.maxItems));
  if (opts.timeoutSecs) params.set('timeout', String(opts.timeoutSecs));
  if (opts.memoryMbytes) params.set('memory', String(opts.memoryMbytes));
  params.set('format', 'json');
  params.set('clean', 'true');

  const url = `${APIFY_BASE}/acts/${actorPath}/run-sync-get-dataset-items?${params.toString()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'foco-imo-radar/1.0' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Apify ${actorPath} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json().catch(() => [])) as unknown;
  return Array.isArray(data) ? data : [];
}

/** Recolhe um portal (por config). Devolve os itens brutos do dataset. */
export async function collectPortal(
  token: string,
  cfg: PortalConfig,
  opts: { maxItems: number; janelaHoras: number },
): Promise<unknown[]> {
  const input = cfg.buildInput(opts);
  const memory = cfg.portal === 'olx' ? 1024 : undefined; // o actor OLX precisa de mais memória
  return runActorSync(token, cfg.actor, input, { maxItems: opts.maxItems, timeoutSecs: 120, memoryMbytes: memory });
}
