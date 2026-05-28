// Helper partilhado pelas edge functions de sistema (Sprint 28).
// Lê `params jsonb` da row `system_automations` pelo `key` e faz merge com
// defaults. Falha aberta: se a row não existe, a query erra ou um campo está
// em falta, devolve os defaults — automação nunca parte por erro de config.

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (t: string) => any };

export async function loadAutomationParams<T extends Record<string, unknown>>(
  supabase: SupabaseLike,
  key: string,
  defaults: T,
): Promise<T> {
  try {
    const { data, error } = await supabase
      .from('system_automations')
      .select('params')
      .eq('key', key)
      .maybeSingle();
    if (error || !data || !data.params || typeof data.params !== 'object') {
      return defaults;
    }
    return { ...defaults, ...(data.params as Record<string, unknown>) } as T;
  } catch {
    return defaults;
  }
}
