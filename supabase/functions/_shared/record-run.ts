// Regista a corrida de uma automação de sistema em `system_automations`
// (last_run_at / last_run_ok / last_run_error + contadores run_count/fail_count).
//
// Best-effort: NUNCA lança nem bloqueia a automação. Serve só para que a página
// /automacoes mostre a "Última corrida" real (e não "nunca") nas automações que
// são edge functions de cron. Espelha o bloco inline da `automation-meta-insights`.
//
// `key` é a chave em system_automations (ex.: 'lead-followups', 'backup-weekly'),
// que NÃO é necessariamente igual ao slug da edge function.
// deno-lint-ignore-file no-explicit-any
export async function recordAutomationRun(
  supabase: any,
  key: string,
  ok: boolean,
  errorText?: string | null,
): Promise<void> {
  try {
    const { data: cur } = await supabase
      .from('system_automations')
      .select('run_count, fail_count')
      .eq('key', key)
      .maybeSingle();
    await supabase
      .from('system_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: ok,
        last_run_error: errorText ?? null,
        run_count: (cur?.run_count ?? 0) + 1,
        fail_count: (cur?.fail_count ?? 0) + (ok ? 0 : 1),
      })
      .eq('key', key);
  } catch (_e) {
    // best-effort — a contabilidade nunca trava a automação
  }
}
