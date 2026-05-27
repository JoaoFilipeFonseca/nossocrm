# Checklist pré-live — Foco Imo CRM

> Marca cada caixa só depois de testar a sério.
> Sem self-engano. Se uma caixa não tem ✅ legítimo, NÃO é live.
> Última actualização: 27 Mai 2026, Sprint 15.

---

## 🔒 Segurança & dados

- [ ] **Backup automático a correr** (Sprint 15 C1 já configurado, validar 1ª execução Domingo 31/5 às 3h)
  - Verificar bucket `backups/` no Supabase Storage tem 1 ficheiro `{org_id}/2026-W22.json` (smoke já feito).
  - Próximo Domingo deve adicionar `2026-W23.json` sem intervenção.
- [ ] **Passwords default trocadas** ou aceites como "12345678" temporário até cliente entrar
  - Decisão registada em `memory/feedback_passwords_12345678.md` — cliente muda na 1ª entrada.
- [ ] **Service role key NÃO está exposta** em commits, chat, screenshots
  - `git log -S "service_role" --all` deve ser limpo
  - Vercel env vars: confirmar que `SUPABASE_SECRET_KEY` está set e não está em `NEXT_PUBLIC_*`
- [ ] **RLS activado em todas as tabelas com dados de cliente**
  - Query rápida: `select tablename from pg_tables where schemaname='public' and rowsecurity=false;` deve listar 0 ou só tabelas técnicas (cron, pg_*, etc.)
- [ ] **Vault secrets gravados:** `automation_cron_secret`, `backup_cron_secret` (validar via `select name from vault.decrypted_secrets`)

## 📞 Telemóvel + Gravação chamadas

- [ ] **iPhone — gravação via altifalante testada end-to-end** (Sprint 12 C1.5 capture nativo + Sprint pendente iOS workaround)
  - 1 chamada real a ti próprio, processada pelo Gemini, resumo visível em `/calls/[id]`
- [ ] **Botão LogCHQQuick no kanban funciona no iPhone** (testar tap rápido + popover não corta no ecrã)
- [ ] **FAB CHQ global aparece em todas as páginas** (Sprint 13 C3) excepto login/setup
  - Confirmar em mobile e desktop

## 🌐 Tracking & analytics

- [ ] **GTM-KK65ZDBS (João)** disparado em todas as páginas críticas
  - Abrir DevTools → Network → filtrar `gtm.js` em `/dashboard`, `/inbox`, `/boards`, `/contacts`
- [ ] **GTM-PD49QDGS (Outlier)** continua a disparar em paralelo (`memory/reference_gtm_setup.md`)
- [ ] **Tags Meta Pixel + Lead/Contact eventos** disparam ao submeter formulários nas LPs (`memory/feedback_tracking_obrigatorio.md`)

## ⚖️ Legal & GDPR

- [ ] **T&C aceites no signup** (página `/login` ou modal pós-criação de conta)
- [ ] **Endpoint admin GDPR cascade delete** funcional (`memory/decisao_gdpr_tc_retencao.md`)
- [ ] **Política de retenção documentada** (`memory/decisao_gdpr_tc_retencao.md` é a fonte canónica)
- [ ] **Disclaimers CIRS/INE nos relatórios premium** (`memory/reference_relatorios_premium.md`)

## 🎨 Marca & copy

- [ ] **AMI 10092** visível em footers/PDFs
- [ ] **Telefones, emails, NIPC** corretos (`memory/reference_dados_marca_e_legais.md`)
- [ ] **Brand Kit em `/settings/marca`** preenchido (cores, logo, tom voz, frases banidas)
- [ ] **PT-PT pré-AO 1990** sem deslizes óbvios em UI visível
  - Sweep alargado B-007 fica para Julho — só os pontos de contacto com cliente final TÊM de estar limpos

## 💰 Métricas honestas

- [ ] **Meta anual definida em `/settings/metas`** (Sprint 10 c1)
- [ ] **Visão "🎯 Honestos" no `/dashboard` mostra números reais** (Sprint 10 c3)
- [ ] **CHQ a contar acima de zero** em pelo menos 1 categoria (Sprint 11 c1+c2 + Sprint 13)

## 🔥 Alertas pipeline

- [ ] **Banner deals frios aparece quando há estagnados** (Sprint 14 c2)
- [ ] **Badge "Xd na fase" visível em DealCards abertos** (Sprint 14 c1)

## ⚙️ Infraestrutura

- [ ] **Cloudflare Pages / Vercel deployment a 100%** (`memory/feedback_hosting.md` — Vercel é o canónico para o CRM)
- [ ] **Service Worker dinâmico a fazer update automático** (Sprint 12 c3) — testar deploy + refresh em telemóvel, versão YYMMDD_HHmm na sidebar muda em < 60s
- [ ] **DNS `joaofilipefonseca.pt` na Cloudflare** OK (`memory/reference_dns_cloudflare.md`)
- [ ] **Sentry ou equivalente** capturado erros front-end (avaliar — actualmente só `client_errors_log` da `protecoes_28abr.md`)

## 📱 E2E mobile

- [ ] **iPhone Safari** (`memory/reference_portal_ios_compat.md`)
  - Abrir um deal → carregar no FAB → registar CHQ → confirmar toast verde
  - Inbox Foco → painel direito recolhível funciona (Sprint 12 c2)
  - DealDetailModal abre sem cortar info (Sprint 12 c1)
- [ ] **Android Chrome**
  - Idem ao iPhone
  - Gravar chamada via input capture abre app de voz nativa do Android
- [ ] **Desktop Chrome/Firefox/Safari**
  - Toggle "🎯 Honestos" no /dashboard mostra os 7 números
  - Banner deals frios clicável abre PipelineAlertsModal

## 🚨 Plano de rollback

Se algo correr mal em produção:

1. **Bug não crítico** (UI escapou, copy errado) → fix forward em commit pequeno + push
2. **Bug crítico** (dados, auth, payments) → `git revert <sha>` + push imediato
3. **Dados corrompidos** → ir ao bucket `backups/`, baixar último JSON da org, restaurar manualmente tabela a tabela
4. **Telegram alert canal** → `memory/feedback_telegram_silencioso.md` regra: só leads novos + falhas essenciais

---

## Quem assina (data + nome)

- [ ] João Fonseca confirmou os 11 itens críticos (assinatura abaixo, formato livre)

```
Data: __/__/____
Nome: __________
Confirmo que testei pessoalmente os 11 itens com ☑️ acima e que o CRM está
pronto para uso real.
```

**Filtro final:** se ainda há uma única caixa por marcar nas secções 🔒 Segurança & dados e 📞 Telemóvel, NÃO é live.
