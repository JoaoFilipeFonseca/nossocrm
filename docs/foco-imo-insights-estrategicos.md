# Foco Imo, Camada de Insights Estratégicos

**Documento complementar ao CRM em desenvolvimento**
Versão: 1.0
Data: 27 de Maio de 2026
Autor: Sessão estratégica entre João Fonseca e Claude

---

# ⚠️ INSTRUÇÃO CRÍTICA, LER ANTES DE QUALQUER AÇÃO ⚠️

## Esta é informação COMPLEMENTAR ao trabalho já em curso no Foco Imo

Este documento NÃO substitui, NÃO anula, NÃO obriga a refazer nada do que já está construído. É um complemento estratégico para tornar o CRM único e diferenciado.

## Regras obrigatórias para qualquer Claude que use este documento

1. **NUNCA incorporar, alterar, criar ou modificar código com base neste documento sem perguntar primeiro ao João.** Em momento algum este documento é autorização para agir.

2. **Analisar criticamente** cada ponto antes de propor: faz sentido neste momento do desenvolvimento? Acrescenta valor real ao MVP ou pode esperar?

3. **Sugerir sempre** ao apresentar um ponto:
   - (a) Onde dentro do CRM faz sentido encaixar
   - (b) Porque é que faz sentido (justificação clara)
   - (c) Qual o esforço estimado (baixo, médio, alto)
   - (d) Qual o impacto esperado em € ou em qualidade

4. **Questionar antes de incorporar.** Formato sugerido: "Encontrei o ponto X neste documento. Faria sentido encaixar em [Y] porque [Z]. Queres que avance, queres que adapte, ou guardamos para fase posterior?"

5. **Se houver conflito** entre algo neste documento e o que já está construído, NÃO decidir sozinho. Apresentar ao João a opção, com prós e contras.

6. Este documento serve para **inspirar e enriquecer**, não para ditar. A direção do CRM é do João.

7. **Filtrar pela meta real**: o objetivo é faturar 100.000€+ em 2026. Qualquer feature que não contribua para esta meta deve ser questionada antes de ser sugerida.

---

# Contexto

| Campo | Valor |
|---|---|
| Utilizador | João Fonseca |
| Profissão | Consultor Imobiliário |
| Agência | RE/MAX Majestic |
| Base geográfica | Maia, atua em todo o Norte de Portugal |
| Marca pessoal | "João Fonseca" (por defeito) |
| Marca alternativa | Fonseca & Rodrigues (F&R), só quando explicitamente pedido |
| Parceira de negócio | Helena Rodrigues |
| CRM em construção | Foco Imo, desenvolvido em Claude Code |
| Faturação 2025 | 48.000€ brutos |
| Meta 2026 | 100.000€+ brutos |

## Matemática base

| Indicador | Valor |
|---|---|
| Meta anual bruta | 100.000€ |
| Ticket médio estimado | 4.500€ a 5.000€ por negócio |
| Negócios necessários por ano | 20 a 22 |
| Escrituras por mês (média) | ~2 |
| Conversas humanas qualificadas (CHQ) por dia útil sugeridas | 10 |
| Total CHQ por ano | ~2.000 |

## Filosofia central do CRM

> O Foco Imo é um sistema para gerar e proteger mais conversas humanas qualificadas, nunca para as substituir. Todas as features devem servir este propósito.

---

# Parte 1: As 5 prioridades fundacionais

**Status: URGENTE, são a base do MVP. Já guardadas na memória.**

Ordem por retorno esperado em € (do maior para o menor). Construir nesta sequência.

## 1.1 Resposta a leads em menos de 5 minutos + Power List diária + Daily money number

| Sub-feature | Descrição |
|---|---|
| Resposta automática imediata | SMS/WhatsApp personalizado disparado em menos de 1 minuto após entrada de lead |
| Notificação push imediata ao João | Para ligar pessoalmente dentro de 5 min |
| Power List diária | 20 contactos prioritários a tocar hoje, ordenados por probabilidade de receita |
| Daily money number | Número objetivo do dia ligado à meta anual: "Hoje precisas de X chamadas, Y reuniões, Z propostas para alcançares os 100k" |
| Tracker em tempo real | Indicador visível: estás à frente, em linha, ou atrasado em relação à meta |

**Justificação em €:** velocidade de resposta abaixo de 5 min multiplica taxa de contacto por 8 a 10x. Sozinha resolve o gap nº1 documentado do João (consistência humana). Pode valer a diferença entre 80k e 120k.

## 1.2 Matching automático novos imóveis vs base de compradores

| Sub-feature | Descrição |
|---|---|
| Nova angariação dispara matching | Em menos de 2 min após criação, o sistema cruza com base de compradores ativos |
| Notificação ao João | Lista priorizada de compradores a contactar AGORA |
| Notificação ao comprador | Mensagem personalizada com o imóvel, antes de ir aos portais |
| Pipeline de matches | Visível separadamente, com prazos curtos por etapa |

**Justificação em €:** acelera ciclo, fecha mais rápido, ganha negócios à concorrência. Imóveis off market criam maior margem negocial.

## 1.3 Banco de motivated sellers

| Sub-feature | Descrição |
|---|---|
| Caçador de eventos de vida | Monitoriza casamentos, divórcios, heranças, mudanças de cidade |
| Caçador de anúncios particulares | Idealista, Imovirtual, OLX, Custojusto, Facebook Marketplace |
| Caçador de angariações paradas | Imóveis listados há 90+ dias por concorrência (proprietários cansados) |
| Outreach automatizado | Sequência de toques estruturada, com mensagens específicas para cada tipo |

**Justificação em €:** resolve o gap nº2 (pipeline de captação). Cria fluxo constante de leads vendedoras a custo próximo de zero.

## 1.4 Reativação trimestral automática da base

| Sub-feature | Descrição |
|---|---|
| Segmentação automática | Toda a base classificada: comprador investidor, comprador 1.ª habitação, vendedor, curioso, ex-cliente, referenciador |
| Ondas de reativação | A cada trimestre, ondas inteligentes de toques (conteúdo, dados, novidades de zona) |
| Detetor de movimento | IA identifica quem responde, quem clica, quem pede informação, e sinaliza para contacto humano |

**Justificação em €:** recupera 5 a 15% de revenue perdida hoje. A maior parte dos contactos passados são leads quentes esquecidas.

## 1.5 Painel de receita real ponderada + gap para meta visível diariamente

| Sub-feature | Descrição |
|---|---|
| Receita ponderada por probabilidade | Cada negócio no pipeline tem probabilidade real (baseada em histórico, não otimismo) |
| Previsão 30/60/90 dias | "Vais receber X com confiança Y" |
| Gap para a meta | Vermelho, amarelo, verde por semana, por mês, por trimestre |
| Heatmap do mês | Calendário visual com dias produtivos vs dias parados |
| Alerta de seca | Se em qualquer semana houver menos de N CHQ, alerta imediato |

**Justificação em €:** mantém o João honesto e focado onde dói. Sem este painel, o trabalho perde âncora à meta.

---

# Parte 2: Os 10 princípios de design (o ouro estrutural)

**Status: filosofia de design, não features. Decidir antes de programar.**

> Estes são princípios que moldam todo o CRM. Os marcados como CRÍTICOS devem ser decididos na primeira semana de construção; são impossíveis de retroinstalar sem destruir hábitos já formados.

## 2.1 [CRÍTICO] Tela do hoje como único ecrã de entrada

Quando o João abre o Foco Imo, vê UMA tela. Sem menus. Sem dashboards bonitos. Sem escolhas.

| Bloco | Conteúdo |
|---|---|
| Power List do dia | 20 contactos a tocar hoje, por prioridade |
| Daily money number | Receita esperada se cumprir a lista |
| 1 ação inadiável | A coisa que se não fizer hoje, falha o mês |
| Estado da meta | "Estás a X% do mês com Y dias úteis restantes" |

Tudo o resto a 2 cliques de distância, visível por opção, não por defeito.

**Princípio:** cada escolha extra ao abrir o CRM é energia mental gasta antes da 1.ª chamada. O melhor CRM elimina decisões, não acrescenta opções.

## 2.2 Atrito é uma feature, não um bug

Diferentes ações têm diferentes níveis de atrito por design:

| Ação | Atrito |
|---|---|
| Logar chamada feita | Zero. Botão único ou comando de voz, 5 segundos |
| Adicionar nova lead | Baixo. 4 campos mínimos, 30 segundos |
| Mover negócio para fase seguinte | Médio. Confirmar critérios da fase, 1 min |
| Mover negócio para trás | Alto. Descrever porquê em texto, 2 min |
| Marcar lead como perdida | Muito alto. Categorizar motivo + lição + marcar para reativação, 3 min |
| Fechar o dia sem cumprir Power List | Desconfortável. Diálogo confronta com o que falhou |

**Princípio:** o que queres encorajar, facilita. O que queres evitar, custa. O atrito desenhado força consciência.

## 2.3 Pipeline ao contrário (matemática reversa visível)

Pipeline normal mostra para a frente (Lead → 1.º contacto → entrevista → ...). É vaidoso.

Pipeline ao contrário trabalha de trás para a frente:

| Pergunta | Resposta operativa |
|---|---|
| 100k brutos em 2026 | ~22 escrituras |
| 22 escrituras | ~30 CPCV (taxa fecho 75%) |
| 30 CPCV | ~50 propostas |
| 50 propostas | ~150 visitas reais |
| 150 visitas | ~400 entrevistas/conversas qualificadas |
| 400 conversas | ~2.000 leads tocadas |
| 2.000 leads | ~10 leads novas/dia ou 50 reativações/semana |

**Princípio:** mostrar todos os dias na tela do hoje "estás a -X conversas para chegares à meta". A matemática não mente.

## 2.4 Fio narrativo de cada contacto (humanos, não registos)

Cada contacto tem um campo livre em prosa: a história da relação. Mantido por IA a partir de logs + atualização manual de 2 min após cada interação importante.

Exemplo:
> "Conheci Maria Silva num open house em Mar 2025. Procurava T3 em Maia, orçamento 280k. Tem 2 filhos (Tomás 8, Inês 5). Decisora principal mas marido (Pedro, engenheiro civil) tem voto. Viu 4 imóveis comigo, escolheu um da concorrência por proximidade da escola. Em Jan 2026 mandou-me mensagem perguntando por imóvel de investimento. Filho Tomás muda de escola em 2027, mencionou que talvez vendam o atual."

**Princípio:** cinco anos depois, o João terá algo que nenhum concorrente tem: contexto humano profundo de centenas de pessoas. É o que faz alguém dizer "este consultor lembra-se mesmo de mim".

## 2.5 Desenhado para o pior dia, não para o melhor

A maioria dos CRMs assume uso ideal. O Foco Imo deve servir o João quando está exausto, distraído, em pé na rua, no carro.

O que o CRM mostra em 2 min antes de uma chamada:

| Mostra | NÃO mostra |
|---|---|
| Última interação relevante (1 frase) | Histórico cronológico completo |
| Estado emocional/intenção atual (1 frase) | Todos os campos preenchidos |
| Próximo passo lógico desta chamada | Listagem de imóveis vistos |

**Princípio:** o CRM serve quando o João está fraco. Em forma, ele sabe fazer tudo sem ele.

## 2.6 [CRÍTICO] Restrição da honestidade no dashboard

Métricas BANIDAS do Foco Imo (mesmo que pareçam úteis):

| Métrica banida | Porquê |
|---|---|
| Total de contactos na base | Não é riqueza, é peso morto |
| Número de leads geradas | Vaidade |
| Tarefas criadas | Vaidade |
| Mensagens enviadas | Vaidade |
| Imóveis na base | Vaidade |

Métricas PERMITIDAS:

| Métrica honesta | O que mede |
|---|---|
| Conversas Humanas Qualificadas (CHQ) | Única métrica de input que importa |
| Reuniões geradas | Output que prediz tudo o resto |
| Propostas enviadas | Realidade comercial |
| Comissão fechada vs prevista | Verdade financeira |
| Taxa de conversão por fase | Onde dói realmente |
| Tempo médio por fase | Velocidade do ciclo |
| Receita ponderada pendente | Pipeline real, descontado por probabilidade histórica |

**Princípio:** decidir no início, é impossível tirar métricas vaidosas depois sem revolta interna.

## 2.7 Arquivo composto de casos (a riqueza invisível)

Cada negócio fechado gera automaticamente um "case study" anonimizado e pesquisável:

| Campo | Conteúdo |
|---|---|
| Tipo de cliente | Família, investidor, 1.ª habitação, herança, divórcio |
| Origem da lead | Canal exato |
| Tempo até fecho | Em dias |
| Número de visitas | Quantas até proposta |
| Objeção principal | O que quase matou o negócio |
| O que destravou | Frase ou ação que mudou o jogo |
| Comissão final | Valor real |
| Lições | 2 a 3 takeaways em texto |

**Princípio:** em 3 anos, será a biblioteca pessoal do João, mais valiosa do que qualquer livro genérico. Quase nenhum consultor o constrói.

## 2.8 [CRÍTICO] Friday Mirror (espelho da semana)

Sexta feira às 16h, sessão obrigatória de 20 minutos. Não fecha o sistema sem responder.

5 perguntas semanais:

1. O que correu bem esta semana? (qual a vitória real)
2. O que evitei fazer? (a verdade desconfortável)
3. Quem me prometi contactar e não contactei?
4. Que padrão me começo a repetir, bom ou mau?
5. Qual é a única coisa da próxima semana?

Arquivo timestamped. Ao fim de 1 ano, 52 entradas. Em 3 anos, biografia operacional honesta da evolução.

**Princípio:** auto-accountability institucionalizada. Sem isto, drift garantido.

## 2.9 Modo silêncio (sabedoria de design)

O CRM tem que saber quando se calar:

| Quando o CRM cala | Significado |
|---|---|
| Sextas após 19h até segundas 8h | Sem notificações, família e descanso protegidos |
| Aniversários dos filhos | Modo silêncio total |
| Janelas de Power Hour (sugestão: 9h-10h) | Sem interrupções para foco profundo |
| Após 3 chamadas seguidas | Sugere pausa de 10 min |
| Botão "modo cocoon" | Tudo silencia por X horas a pedido |

**Princípio:** desenhar o silêncio é mais difícil do que desenhar o barulho. Os CRMs comerciais maximizam engagement (querem-te sempre lá). O Foco Imo deve maximizar a produtividade real, que inclui descanso. Alinhado com o Zorbuddha.

## 2.10 Contrato consigo próprio

Quando o João cria o Foco Imo, escreve um contrato pessoal de 1 página no sistema:

| Cláusula | Conteúdo |
|---|---|
| Compromisso de uso | Vou abrir o CRM 1.ª coisa de manhã e última de noite |
| Compromisso de input | Vou logar toda interação relevante no próprio dia |
| Compromisso de honestidade | Não vou ajustar números para parecer melhor |
| Compromisso de revisão | Vou cumprir o Friday Mirror sem exceção |
| Métricas não negociáveis | Mínimo X CHQ por dia, máximo Y dias sem revisão |
| Consequência se falhar | Coisa concreta a fazer (definida pelo João) |

Mostrado em momentos críticos: antes de saltar revisão, antes de adiar logging mais de 24h, sempre que Power List fica por cumprir.

**Princípio:** o "eu lúcido" a falar com o "eu cansado", materializado em sistema.

---

# Parte 3: Automações por alavanca de receita

**Status: features candidatas a MVP ou pós-MVP, organizadas pelas 7 alavancas que geram dinheiro.**

## 3.1 Alavanca: Mais leads qualificadas a menor custo

| Feature | O que faz | Impacto € |
|---|---|---|
| Caçador de motivated sellers | (Ver 1.3) | Alto |
| Caçador de eventos de vida | (Ver 1.3) | Alto |
| Geographic farming automatizado | Escolher rua/prédio premium, sequência de toques (carta, anúncio Meta geo, porta a porta), medir resposta | Médio (longo prazo, alto) |
| Avaliação como isco | Calculadora pública entrega avaliação em 24h, cada pedido = lead vendedora qualificada | Alto |
| Lead magnets segmentados | Por perfil (proprietário, comprador, investidor): guia, simulador, checklist com sequência automática | Médio |

## 3.2 Alavanca: Maior conversão em cada fase

| Feature | O que faz | Impacto € |
|---|---|---|
| Velocidade de resposta como KPI público | (Ver 1.1) | Alto |
| Scripts integrados de PNL Vítor Neves | Durante chamada, ecrã mostra perguntas chave, sinais a captar, próximos passos | Alto |
| Banco de objeções e respostas | Cada objeção que ouve registada; CRM sugere a resposta que funcionou no passado | Médio |
| Análise de perda (Win/Loss) | Cada negócio perdido obriga a registar motivo; vê padrões e corrige | Médio |
| Detetor de garrafalo monetizado | "Estás a perder 18.000€/ano na fase de 1.º contacto"; não estatística, dinheiro | Médio |
| Funil de aquecimento de longa duração | Leads sem compra em 90 dias entram em nurturing de 2 a 3 anos | Alto (30 a 40% dos negócios fecham com leads "velhas") |

## 3.3 Alavanca: Negócios maiores (comissão por transação acima da média)

| Feature | O que faz | Impacto € |
|---|---|---|
| Foco em segmento premium dentro do CRM | Filtro automático "leads acima de X€" tratadas com workflow próprio (mais toques, materiais premium) | Alto |
| Banco de investidores | Lista separada de investidores ativos com perfil de procura claro, matching em minutos | Alto |
| Cross sell de intermediação de crédito | Cada comprador tem flag automática para propor intermediação | Alto (receita adicional já existente) |
| Parcerias com fee | Track de parcerias (notários, decoração, mudanças, seguros) com comissão associada | Médio |
| Negociação data driven | Histórico de propostas vs valor final por zona, justifica comissão sem descontar | Alto (margem protegida) |

## 3.4 Alavanca: Mais transações pelo mesmo cliente (referrals e repeat)

| Feature | O que faz | Impacto € |
|---|---|---|
| Pedido de referência no momento exato | CRM deteta sentimento positivo do cliente, sugere envio de pedido | Alto (1 a 3 negócios extra por cliente) |
| Programa de referenciadores | Cada referenciador com perfil, valor gerado, recompensa associada; top 10 recebe tratamento VIP | Alto |
| Reativação anual da base completa | (Ver 1.4) | Alto |
| Aniversário da escritura | Mensagem automática personalizada todos os anos | Médio (retenção) |
| Identificação de "prontos para mover" na base | Filtros: filhos com 6 anos (mudança escola), casamento há 5 anos (1.º filho), 65+ anos (downsizing), aniversários da escritura. Outreach proativo | Alto |

## 3.5 Alavanca: Reduzir negócios perdidos (anti-leak)

| Feature | O que faz | Impacto € |
|---|---|---|
| Alerta de arrefecimento | Cliente sem interação há X dias = vermelho, com sugestão de toque | Alto |
| Detetor de fuga para concorrência | Sinais (pergunta por outras agências, mudança no discurso); CRM alerta com protocolo de retenção | Alto |
| Tracker de propostas em aberto | Cada proposta tem cronómetro, sem resposta em 48h = ação obrigatória | Alto |
| Carteira de imóveis em backup | Para cada comprador, sempre 3 alternativas pré-selecionadas; se o 1.º cai, mostra outro em 24h | Médio |

## 3.6 Alavanca: Mais ciclos por ano (acelerar tempo até comissão)

| Feature | O que faz | Impacto € |
|---|---|---|
| Matching automático em menos de 2 min | (Ver 1.2) | Alto |
| Pré-qualificação financeira no 1.º contacto | Pergunta integrada: capital próprio, pré-aprovação, prazo; categoriza | Alto (não desperdiça tempo) |
| Pipeline com tempo médio por fase visível | Vê logo onde está abaixo da média | Médio |
| Lista do dia (Power List) | (Ver 1.1) | Alto |
| Daily money number | (Ver 1.1) | Alto |

## 3.7 Alavanca: Fluxos de receita adicional

| Feature | O que faz | Impacto € |
|---|---|---|
| Pipeline de intermediação de crédito separado | Segundo pipeline com KPIs próprios | Médio (alto a prazo) |
| Serviço de avaliação paga | Para heranças, partilhas, separações; receita imediata sem comissão de venda | Médio |
| Parcerias geridas no CRM | Decoradores, advogados, contabilistas, seguros; fee tracked | Baixo a médio |
| Investor club | Lista exclusiva de investidores que pagam para receber 1.os negócios antes do mercado | Médio (alto a prazo) |

---

# Parte 4: Camadas técnicas

**Status: features organizadas por tipo de tecnologia. Permite priorização técnica.**

## 4.1 IA nativa (só possíveis porque é à medida)

| Feature | Descrição |
|---|---|
| Resumo automático de chamadas | Grava chamada (ou nota de voz no WhatsApp), IA transcreve e preenche campos do CRM |
| Briefing pré-reunião | 30 min antes de cada visita/entrevista, briefing gerado: quem é, histórico, sinais de compra, perguntas chave |
| Triagem de email com IA | Lê emails recebidos, classifica (lead nova, follow up, documental, ruído), sugere resposta |
| Voz para CRM | Nota de voz no WhatsApp para número dedicado, IA extrai e regista tudo |
| Detetor de risco emocional | IA lê últimas mensagens do cliente e sinaliza arrefecimento, dúvida, urgência |
| Gerador de propostas | Inputs: imóvel + perfil cliente. Output: proposta em PDF com identidade pronta a enviar |
| Resposta a objeções em tempo real | Cliente envia objeção via WhatsApp, IA sugere 3 respostas baseadas no que funcionou |
| Análise pós-chamada | IA aponta o que correu bem, o que falhou, que perguntas evitar |
| Audio briefing para o carro | Antes de visita, áudio de 2 min com resumo do contacto enquanto conduz |

## 4.2 Integração Google Calendar + GTD

| Feature | Descrição |
|---|---|
| Sincronização bidirecional Google Calendar | Tarefa no CRM aparece na agenda; evento na agenda aparece no CRM com cliente associado |
| Bloco automático de viagem | Visita em zona X cria bloco de viagem com tempo Google Maps antes e depois |
| Zonas protegidas | Família (fins de tarde, fins de semana), foco profundo (manhãs), espiritual (manhã cedo); CRM nunca agenda em cima |
| Plano semanal dentro do CRM | Domingo à noite, wizard guiado: pipeline atual, ONE Thing por área de vida, prioridades, blocos colocados na agenda |
| Plano diário gerado | Todas as manhãs, briefing no CRM com 3 prioridades, chamadas, follow ups, agenda do dia |
| Revisão de fim de dia | 19h, 5 perguntas guiadas: o que fiz, o que falhou, o que transita, gratidão, intenção amanhã |
| Captação universal (inbox GTD) | Único sítio no CRM para lançar tudo (lead, ideia, tarefa, livro, pessoa); processar para Próximas Ações, Projetos, Aguardando, Algum Dia. Replica os 5 databases Notion mas dentro do CRM |

## 4.3 Inteligência preditiva de pipeline

| Feature | Descrição |
|---|---|
| Pontuação dinâmica de leads | Score em tempo real conforme abertura de emails, visitas ao site, cliques em imóveis, tempo de resposta |
| Detetor de garrafalo | Mostra em que fase os negócios encalham mais e quanto tempo perdem; impacto em € |
| Previsão de comissão ponderada | Pipeline ponderado pela probabilidade real de cada fase |
| Cliente em risco de fugir | Proprietário angariado com 4 visitas sem proposta, alerta para reativar e rever preço |
| Hora ideal de contacto | Por padrão de resposta, sugere melhor hora para cada contacto |
| Ranking de ações que convertem | Atividades que mais correlacionam com escrituras; foco no ROI real |
| Alerta de fadiga | Deteta semanas com poucas conversas e avisa antes que o pipeline arrefeça |
| Modelo preditivo de emergência de vendedores | Por zona, IA prediz percentagem de proprietários que vai vender nos próximos 6 meses |

## 4.4 Integrações Portugal/Imobiliário

| Feature | Descrição |
|---|---|
| Idealista, Imovirtual, Casa Sapo, Supercasa | Imóveis novos na zona dos clientes geram alerta e matching |
| Predial Online / Finanças | Puxa documentação predial automaticamente |
| Calculadora mais valias | Embebida, simula líquido ao vendedor (relevante para o caso Aljezur) |
| IMT e Imposto de Selo | Cálculo automático para simulações |
| Taxa Euribor e bancos | Alerta quando muda, sugere reativar leads de compradores em espera |
| Sincronização com MaxWork e SIR (RE/MAX) | Evita duplicar trabalho |
| Geração de fichas para portais | Cria ficha do imóvel em formato Idealista, Imovirtual, etc. com texto otimizado por IA |

## 4.5 Portais (proprietário e comprador)

| Feature | Descrição |
|---|---|
| Portal do proprietário | Vendedor entra num link próprio e vê em tempo real: visitas realizadas, feedbacks, anúncios ativos, próximas ações |
| Portal do comprador | Comprador vê os imóveis que o João lhe enviou, dá rating, comenta, marca visitas |
| Relatórios automáticos quinzenais | Email com PDF de prestígio enviado ao proprietário a cada 14 dias |

## 4.6 Financeiro integrado

| Feature | Descrição |
|---|---|
| Tracker de comissões | Por negócio: prevista, partilha, líquido, projeção fiscal |
| Cash flow projetado | Próximos 30/60/90 dias com confiança |
| Despesas por negócio | Custos associados (publicidade, deslocações, home staging) para saber ROI real |
| Tracker da meta anual | 100k partido em mensal, semanal, diário; gap visível |
| Painel Helena vs João | Comissões individuais e partilhadas separadas, transparente |

## 4.7 Marketing e conteúdo integrados

| Feature | Descrição |
|---|---|
| Novo imóvel dispara conteúdo | Rascunho de post Instagram, email para base segmentada, ficha para portais, anúncio Meta |
| Segmentação automática da base | Comprador investidor, comprador 1.ª habitação, vendedor, curioso, ex-cliente, referenciador |
| Newsletter personalizada | Cada contacto recebe seleção diferente de imóveis com base no seu perfil |
| Pedido inteligente de testemunho | 7 dias após escritura, mensagem personalizada com 3 perguntas para gerar review forte |
| Gerador de carrosséis | Lança tema, IA monta os 8 cards no estilo da marca, exporta para Canva para refinar |

## 4.8 Compliance e legal

| Feature | Descrição |
|---|---|
| Tracker de prazos CPCV | Todas as datas críticas (financiamento, avaliação banco, escritura) na agenda com lembretes em cascata |
| Alerta de documentos a expirar | Cartão de cidadão, certidão predial, energético, avisa 30 dias antes |
| Checklist por tipo de negócio | Venda urbana, rústico, herança, divórcio, investimento; cada um com checklist legal própria |

---

# Parte 5: Camadas profundas (rare gold)

**Status: features pouco usuais que diferenciam o Foco Imo de qualquer CRM do mercado.**

## 5.1 Intimidade à escala

| Feature | Descrição |
|---|---|
| Perfil psicológico de cada contacto | Padrão de decisão (impulsivo vs analítico), motivador principal (segurança, status, família, liberdade), estilo preferido (texto, voz, número, história) |
| Memória entre conversas distantes | Quando ligar a alguém com quem não falas há 2 anos, briefing com nomes dos filhos, último imóvel, hobby mencionado |
| Histórico de promessas | Tudo o que prometeste a um cliente fica registado; CRM impede que falhes promessas pequenas |
| Pequenos sinais não comerciais | Aniversários, nascimentos, conquistas pessoais; CRM avisa e sugere toque humano sem pedir nada |
| Fio narrativo de cada contacto | (Ver 2.4, é o suporte deste pilar) |

**Nota sobre duplicação:** o fio narrativo (2.4) é a estrutura. Esta secção define o que se faz com ele.

## 5.2 Tu como ativo (gestão pessoal do João)

| Feature | Descrição |
|---|---|
| Tracker de estado e performance | Antes de chamada importante, pergunta o estado (1 a 10); cruza com resultado; descobre em que estado fechas melhor |
| Simulador de negociações com IA | Antes de proposta difícil, treina com IA que faz de vendedor cético, comprador hesitante, herdeiro emocional |
| Power Hour sagrado | Bloco diário (sugestão 9h-10h) só para atividades que pagam: chamadas, propostas, reuniões. Tracker mostra cumprimento |
| Tracker de narrativa pessoal | O que se vai dizendo no Instagram, podcasts, posts; CRM agrega para construir marca coerente |
| Diário guiado de 5 min ao fim do dia | 5 perguntas curtas; ao longo de meses, IA identifica padrões |
| Sabbath / Bloqueios familiares | (Ver 2.9, modo silêncio é o suporte) |

**Nota:** esta camada é central para o conceito Zorbuddha. Material e espiritual no mesmo sistema.

## 5.3 Estratégia contra intuitiva

| Feature | Descrição |
|---|---|
| Atrasos estratégicos | Por vezes responder demasiado rápido arruína negócios premium; CRM sugere "espera 48h, este perfil reage melhor a alguma distância" baseado em padrões reais |
| Marketing inverso | Em vez de anunciar imóveis, anuncia compradores: "Tenho cliente pré-aprovado a procurar T3 na Maia até 350k. Conhece quem queira vender?" |
| Casual recap (não comercial) | Uma vez por mês, mensagem a cada lead morna sem agenda: "Soube que abriu um restaurante novo em Águas Santas, lembrei-me que vive aí" |
| Banco de "razões para ligar sem pedir nada" | CRM gera mensalmente pretextos legítimos para reativar (notícia de zona, novo desenvolvimento, mudança Euribor) |
| Disqualifying questions no 1.º contacto | Perguntas filtro logo no início (pré-aprovação, prazo real); custa tempo a tire kickers, ganha tempo para quem compra |

## 5.4 Pós-venda como motor de receita

| Feature | Descrição |
|---|---|
| Programa "Tinha um problema?" aos 6 meses | Mensagem proativa: "Surgiu alguma coisa que eu possa ajudar? Pintor, advogado, mudanças?"; resolve antes de virar queixa |
| Pasta digital de vida do imóvel | Área para o cliente onde ficam escritura, energético, garantias; anos depois precisam disso, estás lá |
| Avaliação anual gratuita do imóvel | "O seu imóvel valia X há um ano, vale Y hoje"; email automático no aniversário da escritura |
| Concierge de zona | Cliente comprou em zona nova, ao longo de 12 meses recebe guia local (escolas, restaurantes, médicos, oficinas) |
| Detetor de mudança de vida nos ex-clientes | (Ver 3.4, identificação de "prontos para mover") |

## 5.5 Inteligência de mercado oculta

| Feature | Descrição |
|---|---|
| Banco de preços reais de venda | CRM regista todos os fechos com preço final + condições; ao fim de 12 meses, base de dados real que portais não têm |
| Contra-inteligência de mercado | Antes de captação, CRM lista que outros consultores ativos na zona oferecem (preço pedido, comissão típica) |
| Termómetro real da zona | Quanto está a vender, em quantos dias, com que desconto sobre o pedido; atualizado em tempo real |
| Modelo preditivo de emergência de vendedores | (Ver 4.3) |

## 5.6 Camada Zorbuddha (alinhamento pessoal dentro do CRM)

**Esta camada é única para o João, integra valores espirituais com gestão profissional.**

| Feature | Descrição |
|---|---|
| Pergunta Essencial diária | O CRM faz a pergunta do dia da semana (espiritual, física, pessoal, relações, trabalho, negócio, finanças) e regista resposta |
| Tracker das 4 áreas de vida | Saúde, desenvolvimento pessoal, profissional, espiritual; vê ao vivo se está equilibrado |
| Tempo com filhos como KPI | Bloco de tempo dedicado aos filhos contabilizado como métrica não negociável |
| Diário de leitura | Tempo lido por dia automaticamente registado, com livro atual em curso |
| Alerta de drift | Se uma semana for só profissional e nada espiritual ou família, o CRM sinaliza |
| Integração da leitura | O que lês alimenta o sistema; highlights consultáveis por tema |
| Família dentro do CRM | Mulher, filhos, pais como entidades com aniversários, eventos, compromissos |

## 5.7 Confronto e auto-accountability

| Feature | Descrição |
|---|---|
| Relatório semanal honesto ao domingo | (Ver 2.8, Friday Mirror é o suporte; este é uma variante para olhar a semana antes de começar a próxima) |
| Auto-deteção de padrões de fuga | Se há semanas em que evitas chamadas, CRM nomeia o padrão: "Esta semana evitaste contactar 8 leads quentes. Que receio está por trás?" |
| Sinal de drift de carreira | Se em qualquer mês a atividade não corresponde ao consultor que dizes querer ser, CRM mostra o gap |
| Plano de continuidade | Se desapareceres uma semana, Helena ou parceiro consegue pegar nos negócios em 1 hora; tudo documentado por padrão |

---

# Parte 6: O que NÃO é MVP

**Status: features valiosas mas que devem esperar até a base estar a gerar dinheiro real. Guardar para fases 2 e 3.**

| Feature | Razão para esperar |
|---|---|
| Portais (proprietário e comprador) | Diferenciação premium, mas só faz sentido com volume de angariações |
| Investor club pago | Receita recorrente, mas requer rede já estabelecida |
| Voice cloning para outreach | Possível mas com considerações éticas, decidir depois |
| Concierge premium acima de X€ | Requer fluxo consistente de clientes premium |
| Programa formal de referência com fee | Útil mas pode ser informal no MVP |
| Integração com Predial Online/Finanças | Complexa, depende de APIs disponíveis |
| Gerador automático de carrosséis | Marketing automation, esperar até pipeline interno estar resolvido |
| Modelo preditivo de emergência de vendedores | Requer dados históricos suficientes |
| Contra-inteligência de mercado | Requer rede informal de informação |
| Tracker de narrativa pessoal | Útil mas não move receita diretamente |

---

# Parte 7: Ordem de implementação sugerida

**Status: proposta de sequência. Confirmar com o João antes de seguir.**

## Fase 1: Fundação (semanas 1 a 4)

1. **Tela do hoje como ecrã único** (princípio 2.1)
2. **Restrição da honestidade no dashboard** (princípio 2.6)
3. **Friday Mirror obrigatório** (princípio 2.8)
4. **Pipeline ao contrário visível** (princípio 2.3)
5. **Power List + Daily money number** (prioridade 1.1)
6. **Captura básica de leads + resposta rápida** (prioridade 1.1)
7. **Fio narrativo por contacto** (princípio 2.4)

## Fase 2: Aceleração (semanas 5 a 10)

8. **Matching automático compradores vs angariações** (prioridade 1.2)
9. **Banco de motivated sellers, versão inicial** (prioridade 1.3)
10. **Reativação trimestral, versão inicial** (prioridade 1.4)
11. **Painel de receita ponderada** (prioridade 1.5)
12. **Integração Google Calendar bidirecional** (4.2)
13. **Inbox GTD universal** (4.2)
14. **Plano semanal e diário guiado** (4.2)

## Fase 3: Inteligência (semanas 11 a 20)

15. **Tracker de comissões e cash flow** (4.6)
16. **Resumo automático de chamadas com IA** (4.1)
17. **Briefing pré-reunião** (4.1)
18. **Pontuação dinâmica de leads** (4.3)
19. **Detetor de garrafalo monetizado** (4.3)
20. **Win/Loss analysis** (3.2)
21. **Arquivo composto de casos** (princípio 2.7)
22. **Caçador de motivated sellers, versão completa** (1.3)

## Fase 4: Diferenciação (semanas 21+)

23. **Camada Zorbuddha completa** (5.6)
24. **Estratégia contra intuitiva** (5.3)
25. **Pós-venda como motor de receita** (5.4)
26. **Banco de preços reais de venda** (5.5)
27. **Simulador de negociações com IA** (5.2)
28. **Auto-deteção de padrões de fuga** (5.7)

## Fase 5: Escala (quando MVP gerar dinheiro real)

Tudo na Parte 6 (NÃO é MVP) reabre para discussão.

---

# Notas finais sobre duplicações

Durante a estruturação, foram identificados pontos que apareciam em múltiplas secções. A regra aplicada:

| Tipo de "duplicação" | O que foi feito |
|---|---|
| Mesma feature em secções diferentes | Mantida no local mais lógico; outras secções referem com "(Ver X.Y)" |
| Conceito relacionado mas com ângulo diferente | Ambos mantidos com nota explicando a diferença |
| Duplicação real | Eliminada |

Exemplos:
- **Power List, Daily money number, Matching automático**: descritos uma única vez em Parte 1, referenciados nas outras secções
- **Friday Mirror**: o princípio de design em 2.8, com variante de "domingo" em 5.7 (ângulo diferente: olhar para a semana à frente, não para a semana passada)
- **Fio narrativo**: princípio em 2.4 (estrutura), uso prático em 5.1 (intimidade à escala)
- **Modo silêncio**: princípio em 2.9, aplicação Zorbuddha em 5.6 e 5.2

---

# Como usar este documento (recordatório final)

1. Não é manual de implementação. É camada de inspiração estratégica.
2. Cada ponto carece de análise antes de implementação.
3. Toda decisão é do João.
4. O critério final: aproxima dos 100k+ ou afasta?
5. Em dúvida, perguntar. Sempre.

---

**Fim do documento.**
