import { ToolLoopAgent, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { CRMCallOptionsSchema, type CRMCallOptions } from '@/types/ai';
import { createCRMTools } from './tools';
import { formatPriorityPtBr } from '@/lib/utils/priority';
import { AI_DEFAULT_MODELS, AI_DEFAULT_PROVIDER } from './defaults';

type AIProvider = 'google' | 'anthropic';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampText(v: unknown, max = 240): string | undefined {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s) return undefined;
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + 'â¦';
}

function formatCockpitSnapshotForPrompt(snapshot: any): string[] {
    if (!snapshot || typeof snapshot !== 'object') return [];

    const lines: string[] = [];

    const deal = snapshot.deal;
    if (deal && typeof deal === 'object') {
        const title = clampText(deal.title, 120) || clampText(deal.name, 120);
        const value = typeof deal.value === 'number' ? deal.value : undefined;
        const probability = typeof deal.probability === 'number' ? deal.probability : undefined;
        const priority = clampText(deal.priority, 30);
        const status = clampText(deal.status, 80);
        lines.push(`ð§¾ Deal (cockpit): ${title ?? '(sem tÃ­tulo)'}${value != null ? ` â R$ ${value.toLocaleString('pt-BR')}` : ''}`);
        if (probability != null) lines.push(`   - Probabilidade: ${probability}%`);
        if (priority) lines.push(`   - Prioridade: ${formatPriorityPtBr(priority)}`);
        if (status) lines.push(`   - Status/Stage ID: ${status}`);
        const lossReason = clampText(deal.lossReason, 200);
        if (lossReason) lines.push(`   - Motivo perda: ${lossReason}`);
    }

    const stage = snapshot.stage;
    if (stage && typeof stage === 'object') {
        const label = clampText(stage.label, 80);
        if (label) lines.push(`ð·ï¸ EstÃ¡gio atual (label): ${label}`);
    }

    const contact = snapshot.contact;
    if (contact && typeof contact === 'object') {
        const name = clampText(contact.name, 80);
        const role = clampText(contact.role, 80);
        const email = clampText(contact.email, 120);
        const phone = clampText(contact.phone, 60);
        lines.push(`ð¤ Contato (cockpit): ${name ?? '(sem nome)'}${role ? ` â ${role}` : ''}`);
        if (email) lines.push(`   - Email: ${email}`);
        if (phone) lines.push(`   - Telefone: ${phone}`);
        const notes = clampText(contact.notes, 220);
        if (notes) lines.push(`   - Notas do contato: ${notes}`);
    }

    const signals = snapshot.cockpitSignals;
    if (signals && typeof signals === 'object') {
        if (typeof signals.daysInStage === 'number') {
            lines.push(`â±ï¸ Dias no estÃ¡gio: ${signals.daysInStage}`);
        }

        const nba = signals.nextBestAction;
        if (nba && typeof nba === 'object') {
            const action = clampText(nba.action, 120);
            const reason = clampText(nba.reason, 160);
            if (action) lines.push(`ð PrÃ³xima melhor aÃ§Ã£o (cockpit): ${action}${reason ? ` â ${reason}` : ''}`);
        }

        const ai = signals.aiAnalysis;
        if (ai && typeof ai === 'object') {
            const action = clampText(ai.action, 120);
            const reason = clampText(ai.reason, 180);
            if (action) lines.push(`ð¤ Sinal da IA (cockpit): ${action}${reason ? ` â ${reason}` : ''}`);
        }
    }

    const lists = snapshot.lists;
    if (lists && typeof lists === 'object') {
        const activitiesTotal = lists.activities?.total;
        if (typeof activitiesTotal === 'number') {
            const preview = Array.isArray(lists.activities?.preview) ? lists.activities.preview.slice(0, 6) : [];
            lines.push(`ðï¸ Atividades no cockpit: ${activitiesTotal}`);
            for (const a of preview) {
                const t = clampText(a?.type, 30);
                const title = clampText(a?.title, 120);
                const date = clampText(a?.date, 40);
                if (t || title) lines.push(`   - ${date ? `[${date}] ` : ''}${t ? `${t}: ` : ''}${title ?? ''}`.trim());
            }
        }

        const notesTotal = lists.notes?.total;
        if (typeof notesTotal === 'number') {
            lines.push(`ð Notas no cockpit: ${notesTotal}`);
        }

        const filesTotal = lists.files?.total;
        if (typeof filesTotal === 'number') {
            lines.push(`ð Arquivos no cockpit: ${filesTotal}`);
        }

        const scriptsTotal = lists.scripts?.total;
        if (typeof scriptsTotal === 'number') {
            const preview = Array.isArray(lists.scripts?.preview) ? lists.scripts.preview.slice(0, 6) : [];
            lines.push(`ð¬ Scripts no cockpit: ${scriptsTotal}`);
            for (const s of preview) {
                const title = clampText(s?.title, 80);
                const cat = clampText(s?.category, 30);
                if (title) lines.push(`   - ${cat ? `(${cat}) ` : ''}${title}`);
            }
        }
    }

    return lines;
}


/**
 * Build context prompt from call options
 * This injects rich context into the system prompt at runtime
 */
function buildContextPrompt(options: CRMCallOptions): string {
    const parts: string[] = [];

    if (options.boardId) {
        parts.push(`ð Board ID: ${options.boardId}`);
        if (options.boardName) parts.push(`   Nome: ${options.boardName}`);
    }

    if (options.dealId) {
        parts.push(`ð¼ Deal ID: ${options.dealId}`);
    }

    if (options.contactId) {
        parts.push(`ð¤ Contato ID: ${options.contactId}`);
    }

    if (options.stages && options.stages.length > 0) {
        const stageList = options.stages.map(s => `${s.name} (${s.id})`).join(', ');
        parts.push(`ð¯ EstÃ¡gios: ${stageList}`);
    }

    if (options.dealCount !== undefined) {
        parts.push(`ð MÃ©tricas:`);
        parts.push(`   - Deals: ${options.dealCount}`);
        if (options.pipelineValue) parts.push(`   - Pipeline: R$ ${options.pipelineValue.toLocaleString('pt-BR')}`);
        if (options.stagnantDeals) parts.push(`   - Parados: ${options.stagnantDeals}`);
        if (options.overdueDeals) parts.push(`   - Atrasados: ${options.overdueDeals}`);
    }

    if (options.wonStage) parts.push(`â EstÃ¡gio Ganho: ${options.wonStage}`);
    if (options.lostStage) parts.push(`â EstÃ¡gio Perdido: ${options.lostStage}`);

    if (options.userName) {
        parts.push(`ð UsuÃ¡rio: ${options.userName}`);
    }

    if ((options as any).cockpitSnapshot) {
        const lines = formatCockpitSnapshotForPrompt((options as any).cockpitSnapshot);
        if (lines.length > 0) {
            parts.push('');
            parts.push('====== CONTEXTO DO COCKPIT ======');
            parts.push(...lines);
        }
    }

    return parts.length > 0
        ? `\n\n====== CONTEXTO DO USUÃRIO ======\n${parts.join('\n')}`
        : '';
}

/**
 * Base instructions for the CRM Agent
 */
const BASE_INSTRUCTIONS = `VocÃª Ã© o Foco Imo Pilot, um assistente de vendas inteligente. ð

PERSONALIDADE:
- Seja proativo, amigÃ¡vel e analÃ­tico
- Use emojis com moderaÃ§Ã£o (mÃ¡ximo 2 por resposta)
- Respostas naturais (evite listas robÃ³ticas)
- MÃ¡ximo 2 parÃ¡grafos por resposta

FERRAMENTAS (15 disponÃ­veis):
ð ANÃLISE: analyzePipeline, getBoardMetrics
ð BUSCA: searchDeals, searchContacts, listDealsByStage, listStagnantDeals, listOverdueDeals, getDealDetails
â¡ AÃÃES: moveDeal, createDeal, updateDeal, markDealAsWon, markDealAsLost, assignDeal, createTask

MEMÃRIA DA CONVERSA (MUITO IMPORTANTE):
- USE as informaÃ§Ãµes das mensagens anteriores! Se vocÃª jÃ¡ buscou deals antes, use esses IDs.
- Quando o usuÃ¡rio diz "esse deal", "ele", "o Ãºnico", "o que acabei de ver" - use o ID do deal mencionado antes.
- NÃO busque novamente se vocÃª jÃ¡ tem as informaÃ§Ãµes na conversa.
- Se a Ãºltima busca retornou 1 deal, use o ID dele automaticamente.
- Para markDealAsWon/Lost: passe o dealId que vocÃª jÃ¡ conhece da conversa.
- Para moveDeal: use o dealId do deal que o usuÃ¡rio estÃ¡ se referindo.

REGRAS:
- Sempre explique os resultados das ferramentas
- Se der erro, informe de forma amigÃ¡vel
- Use o boardId do contexto automaticamente quando disponÃ­vel
- Para buscas (deals/contatos): ao chamar ferramentas de busca, passe APENAS o termo (ex.: "Nike"), sem frases como "buscar deal Nike".
- Para aÃ§Ãµes que alteram dados (criar, mover, marcar, atualizar, atribuir, criar tarefa):
    - NÃO peÃ§a confirmaÃ§Ã£o em texto (nÃ£o peÃ§a âsim/nÃ£oâ, âvocÃª confirma?â, etc.)
    - Chame a ferramenta diretamente; a UI jÃ¡ vai mostrar um card Ãºnico de Aprovar/Negar
    - SÃ³ faÃ§a perguntas se faltar informaÃ§Ã£o para executar (ex.: qual deal? qual estÃ¡gio?)
- PRIORIZE usar IDs que vocÃª jÃ¡ conhece antes de buscar novamente

APRESENTAÃÃO (MUITO IMPORTANTE):
- NÃO mostre IDs/UUIDs para o usuÃ¡rio final (ex.: "(ID: ...)")
- NÃO cite nomes internos de tools (ex.: "listStagnantDeals", "markDealAsWon")
- Sempre prefira: tÃ­tulo do deal (nome do card) + contato + valor + estÃ¡gio (quando fizer sentido)

========================================
ðµð¹ CONTEXTO IMOBILIÃRIO PORTUGAL
========================================

Ãs especialista em mediaÃ§Ã£o imobiliÃ¡ria em Portugal. Domina:

ð  ESTÃGIOS DE TRANSACÃÃO PT:
- AngariaÃ§Ã£o â captaÃ§Ã£o do imÃ³vel junto do proprietÃ¡rio
- CMA (AnÃ¡lise Comparativa de Mercado) â estudo de preÃ§o por comparativos
- CMI (Contrato de MediaÃ§Ã£o ImobiliÃ¡ria) â contrato com proprietÃ¡rio, exclusivo ou aberto
- Marketing & DivulgaÃ§Ã£o â fotos, vÃ­deo, descritivo, Idealista/Imovirtual/Casa Sapo
- QualificaÃ§Ã£o Financeira â confirmar orÃ§amento e crÃ©dito prÃ©-aprovado do comprador
- Visitas â mostrar, recolher feedback
- Propostas/NegociaÃ§Ã£o â contraproposta
- CPCV (Contrato Promessa Compra e Venda) â sinal, em advogado/notÃ¡rio
- Escritura â contrato definitivo em notÃ¡rio
- PÃ³s-Venda â IMI, mudanÃ§as, follow-up

ð TERMOS-CHAVE PT:
- FSBO â proprietÃ¡rio a vender sozinho
- ICP â perfil ideal do comprador (zona, tipologia, orÃ§amento, motivaÃ§Ã£o)
- IMI â Imposto Municipal sobre ImÃ³veis (anual)
- IMT â Imposto Municipal sobre TransacÃ§Ãµes (na compra)
- Imposto de Selo â 0.8% na escritura
- Taxa de EsforÃ§o â dÃ­vida/rendimento (mÃ¡x ~35%)
- Capital PrÃ³prio MÃ­nimo â entrada do banco (10-20%)
- AvaliaÃ§Ã£o BancÃ¡ria â banco contrata avaliador; pode divergir do preÃ§o

ð ZONAS PORTO (AMP):
Porto, Matosinhos, V.N. Gaia, Maia, Gondomar, Vila do Conde, PÃ³voa de Varzim, Valongo, Santo Tirso, Trofa, Espinho, V.N. FamalicÃ£o.

ð¬ LINGUAGEM:
- PortuguÃªs europeu (PT-PT), NUNCA brasileiro
- Tratamento por "tu" com o utilizador (relaÃ§Ã£o profissional informal)
- "negÃ³cio" ou "imÃ³vel" em vez de "deal" quando possÃ­vel
- Frases curtas, accionÃ¡veis
- Para drafts de mensagens A CLIENTES, default formal ("vocÃª"/"o senhor") salvo indicaÃ§Ã£o

ð¯ ESTILO DE OUTPUT (inspirado em CRMs profissionais PT):

Quando perguntam estado geral / "como estÃ¡ o negÃ³cio":
1. SumÃ¡rio executivo numa frase
2. 3 bullets accionÃ¡veis (bem / mal / foco)
3. PrÃ³xima acÃ§Ã£o concreta com nome (contacto ou deal)

Quando perguntam sobre um deal especÃ­fico:
1. Estado actual (estÃ¡gio, dias parado, valor â¬)
2. Ãltima actividade ou silÃªncio
3. SugestÃ£o concreta: "Liga ao [Nome] hoje. Mensagem sugerida: ..."

Quando perguntam sobre um cliente (por nome/telemÃ³vel):
1. Quem Ã© (tipo entidade, funÃ§Ã£o, lifecycle)
2. HistÃ³rico de interacÃ§Ãµes (atividades recentes)
3. Deals associados com valor + estÃ¡gio
4. Documentos disponÃ­veis
5. PrÃ³xima acÃ§Ã£o

ð ï¸ TOOLS NOVAS (Fase 4):
- listBoards â enumerar pipelines com contagens
- getOrgOverview â visÃ£o agregada de toda a organizaÃ§Ã£o
- getDailyBriefing â atividades hoje + leads 24h + deals parados
- getContactFullContext â tudo sobre um contacto (aceita nameOrPhone fuzzy)
- suggestNextActionForDeal â contexto rico para sugerir prÃ³xima acÃ§Ã£o

ð« NUNCA:
- Inventes dados que nÃ£o vieram das tools â usa tools sempre
- Mistures pt-PT com pt-BR
- Sejas vago ("considera contactar alguÃ©m" â NÃO. Diz "Liga Ã  Maria Silva hoje Ã  tarde")

â SEMPRE:
- Cita nÃºmeros reais das tools
- Nomeia contactos/deals especÃ­ficos
- Termina com call-to-action ou pergunta quando relevante
- Sugere texto concreto de SMS/WhatsApp/email quando pedido
- Linguagem accionÃ¡vel tipo "A tua energia deve ir para X porque Y"`;

/**
 * Factory function to create a CRM Agent with dynamic context
 * 
 * @param context - Type-safe context from the request
 * @param userId - Current user ID
 * @param apiKey - Google AI API key from organization_settings
 * @param modelId - Model to use (default from AI_DEFAULT_MODELS)
 */
export async function createCRMAgent(
    context: CRMCallOptions,
    userId: string,
    apiKey: string,
    modelId: string = AI_DEFAULT_MODELS.google,
    provider: AIProvider = AI_DEFAULT_PROVIDER
) {
    console.log('[CRMAgent] ð¤ Creating agent with context:', {
        boardId: context.boardId,
        boardName: context.boardName,
        stagesCount: context.stages?.length,
        userId,
        modelId,
        provider,
    });

    const model = provider === 'anthropic'
        ? createAnthropic({ apiKey })(modelId)
        : createGoogleGenerativeAI({ apiKey })(modelId);

    // Create tools with context injected
    const tools = createCRMTools(context, userId);

    console.log('[CRMAgent] ð ï¸ Tools created. Checking markDealAsWon config:', {
        needsApproval: (tools.markDealAsWon as any).needsApproval,
        description: tools.markDealAsWon.description
    });

    return new ToolLoopAgent({
        model,
        callOptionsSchema: CRMCallOptionsSchema,
        instructions: BASE_INSTRUCTIONS,
        // prepareCall runs ONCE at the start - injects initial context
        prepareCall: ({ options, ...settings }) => {
            return {
                ...settings,
                instructions: settings.instructions + buildContextPrompt(options),
            };
        },
        // prepareStep runs on EACH STEP - extracts and injects dynamic context
        prepareStep: async ({ messages, stepNumber, steps }) => {
            // Extract dealIds from previous tool results
            const foundDealIds: string[] = [];
            const foundDeals: Array<{ id: string; title: string }> = [];

            for (const step of steps) {
                // Check tool results for deal information
                if (step.toolResults) {
                    for (const result of step.toolResults) {
                        const data = ((result as any).result ?? (result as any).output ?? (result as any).data ?? result) as any;
                        // Extract deals from listDealsByStage, searchDeals, etc.
                        if (data?.deals && Array.isArray(data.deals)) {
                            for (const deal of data.deals) {
                                if (deal.id && !foundDealIds.includes(deal.id)) {
                                    foundDealIds.push(deal.id);
                                    foundDeals.push({ id: deal.id, title: deal.title || 'Unknown' });
                                }
                            }
                        }
                        // Extract single deal from getDealDetails
                        if (data?.id && data?.title && !foundDealIds.includes(data.id)) {
                            foundDealIds.push(data.id);
                            foundDeals.push({ id: data.id, title: data.title });
                        }
                    }
                }
            }

            // If we found deals, inject a context reminder
            if (foundDeals.length > 0) {
                const lastDeal = foundDeals[foundDeals.length - 1];
                const contextReminder = `\n\n[CONTEXTO DA CONVERSA: VocÃª jÃ¡ obteve informaÃ§Ãµes sobre ${foundDeals.length} deal(s). O Ãºltimo mencionado foi "${lastDeal.title}" (ID: ${lastDeal.id}). Use este ID automaticamente quando o usuÃ¡rio se referir a "esse deal", "ele", "o Ãºnico", etc.]`;

                console.log('[CRMAgent] ð¡ Injecting context reminder:', {
                    dealsFound: foundDeals.length,
                    lastDeal
                });

                // Add a system message with context (modifying messages)
                const systemMessage = messages[0];
                if (systemMessage && systemMessage.role === 'system') {
                    const enhancedSystem = {
                        ...systemMessage,
                        content: typeof systemMessage.content === 'string'
                            ? systemMessage.content + contextReminder
                            : systemMessage.content
                    };
                    return {
                        messages: [enhancedSystem, ...messages.slice(1)]
                    };
                }
            }

            return {}; // No modifications needed
        },
        tools,
        stopWhen: stepCountIs(10),
    });
}

/**
 * Export type for frontend type-safety
 */
export type CRMAgentType = Awaited<ReturnType<typeof createCRMAgent>>;
