import 'server-only';

const IMG_REGEX = /<img[^>]+src=["']([^"'\s]+)["'][^>]*>/gi;
const MD_IMG_REGEX = /!\[[^\]]*\]\(([^)\s]+)/g;
const ALLOWED_EXT = /\.(jpe?g|png|webp|avif|heic)(\?|$)/i;
const SKIP_HINTS = [
  'logo', 'icon', 'sprite', 'favicon', 'badge', 'banner-ad',
  'avatar', 'profile', 'agent', 'consultor', 'pixel.gif',
];
const MIN_BYTES = 15 * 1024; // ignore < 15KB (provavelmente icons)

interface FoundImage {
  url: string;
  origin: 'html' | 'markdown';
}

export function extractImageUrls(content: string, baseUrl?: string): string[] {
  const found: FoundImage[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = IMG_REGEX.exec(content)) !== null) {
    const u = absolutize(m[1], baseUrl);
    if (u && !seen.has(u)) {
      seen.add(u);
      found.push({ url: u, origin: 'html' });
    }
  }
  while ((m = MD_IMG_REGEX.exec(content)) !== null) {
    const u = absolutize(m[1], baseUrl);
    if (u && !seen.has(u)) {
      seen.add(u);
      found.push({ url: u, origin: 'markdown' });
    }
  }

  return found
    .map((f) => f.url)
    .filter(isLikelyPropertyImage)
    .slice(0, 40);
}

function absolutize(raw: string, baseUrl?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('data:')) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (!baseUrl) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyPropertyImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (!ALLOWED_EXT.test(lower) && !lower.includes('cloudimg') && !lower.includes('akamai') && !lower.includes('cdn')) {
    // muitos CDNs servem imagens sem extensão — só excluir se for claramente não-imagem
    if (lower.endsWith('.svg') || lower.endsWith('.gif')) return false;
  }
  for (const hint of SKIP_HINTS) {
    if (lower.includes(hint)) return false;
  }
  return true;
}

interface DownloadResult {
  ok: number;
  errors: string[];
}

export async function downloadAndUploadPhotos(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (path: string, body: ArrayBuffer | Uint8Array, opts?: { contentType?: string; upsert?: boolean }) => Promise<{ error: { message: string } | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } | null };
      };
    };
    from: (table: string) => {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
      select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: Array<Record<string, unknown>> | null }> };
    };
  },
  organizationId: string,
  imovelId: string,
  urls: string[],
  options: { maxBytes?: number; maxCount?: number } = {},
): Promise<DownloadResult> {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const maxCount = options.maxCount ?? 30;

  const targets = urls.slice(0, maxCount);
  const ok: Array<{ path: string; bytes: number }> = [];
  const errors: string[] = [];

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 FocoImoBot/1.0',
          'Accept': 'image/*,*/*;q=0.5',
        },
        redirect: 'follow',
      });
      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        errors.push(`${url}: não é imagem (${contentType})`);
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < MIN_BYTES) {
        errors.push(`${url}: muito pequena (${buf.byteLength}B)`);
        continue;
      }
      if (buf.byteLength > maxBytes) {
        errors.push(`${url}: maior que ${(maxBytes / 1024 / 1024).toFixed(0)}MB`);
        continue;
      }

      const ext = guessExt(contentType, url);
      const safeName = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = `${organizationId}/${imovelId}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('imovel-fotos')
        .upload(storagePath, buf, { contentType, upsert: false });
      if (upErr) {
        errors.push(`${url}: ${upErr.message}`);
        continue;
      }
      ok.push({ path: storagePath, bytes: buf.byteLength });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      errors.push(`${url}: ${msg}`);
    }
  }

  if (ok.length > 0) {
    const { data: existing } = await supabase.from('imovel_fotos').select('ordem, is_principal').eq('imovel_id', imovelId);
    let maxOrdem = existing?.reduce((m, f) => Math.max(m, Number(f.ordem ?? 0)), -1) ?? -1;
    let hasPrincipal = existing?.some((f) => f.is_principal) ?? false;

    const rows = ok.map(({ path, bytes }) => {
      maxOrdem++;
      const isPrincipal = !hasPrincipal;
      if (isPrincipal) hasPrincipal = true;
      const { data: pub } = supabase.storage.from('imovel-fotos').getPublicUrl(path);
      return {
        organization_id: organizationId,
        imovel_id: imovelId,
        storage_path: path,
        url_publica: pub?.publicUrl ?? null,
        ordem: maxOrdem,
        is_principal: isPrincipal,
        bytes,
        origem: 'link',
      };
    });

    const { error } = await supabase.from('imovel_fotos').insert(rows);
    if (error) errors.push(`DB insert: ${error.message}`);
  }

  return { ok: ok.length, errors };
}

function guessExt(contentType: string, url: string): string {
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('avif')) return 'avif';
  if (contentType.includes('heic')) return 'heic';
  const m = url.toLowerCase().match(/\.(jpe?g|png|webp|avif|heic)(\?|$)/);
  if (m) return m[1] === 'jpeg' ? 'jpg' : m[1];
  return 'jpg';
}

/** Tenta Jina com formato HTML para apanhar mais URLs em sites JS-rendered. */
export async function fetchImagesFromUrl(url: string): Promise<string[]> {
  const fromHtml = await tryFetchAndExtract(url, false);
  if (fromHtml.length >= 5) return fromHtml;

  const fromJina = await tryFetchAndExtract(url, true);
  // combinar e dedup
  const set = new Set<string>([...fromHtml, ...fromJina]);
  return Array.from(set);
}

async function tryFetchAndExtract(url: string, useJina: boolean): Promise<string[]> {
  try {
    const fetchUrl = useJina ? `https://r.jina.ai/${url}` : url;
    const res = await fetch(fetchUrl, {
      headers: useJina
        ? { 'Accept': 'text/html', 'X-Return-Format': 'html' }
        : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const text = await res.text();
    return extractImageUrls(text, url);
  } catch {
    return [];
  }
}
