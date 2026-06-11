import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Anexa file_url (URL assinado, 1 hora) aos itens com ficheiro no bucket privado creative-archive. */
export async function attachSignedFileUrls<T extends { file_path?: string | null }>(
  supabase: ServerSupabase,
  items: T[],
): Promise<(T & { file_url: string | null })[]> {
  const paths = items.map((i) => i.file_path).filter(Boolean) as string[];
  let byPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('creative-archive')
      .createSignedUrls(paths, 60 * 60);
    byPath = new Map(
      (signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl]),
    );
  }
  return items.map((i) => ({ ...i, file_url: (i.file_path && byPath.get(i.file_path)) || null }));
}
