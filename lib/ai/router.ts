/**
 * AI Model Router — Multi-provider with feature-aware routing and automatic fallback.
 *
 * Strategy:
 *   - Each FEATURE has a PRIMARY and SECONDARY model assigned (different providers).
 *   - On primary failure (rate-limit, 503, capacity, API key error), automatically tries SECONDARY.
 *   - Centralized place to tune routing as we observe quality differences.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import { buildCachedSystem, flattenSystem, logCacheStats, type CachedBlock } from './cache';

export type AIFeature =
    | 'chat'              // Pilot chat with tools — fast iteration
    | 'briefing'          // Daily briefing / summaries
    | 'workflow_icp'      // Angariação - ICP
    | 'workflow_swot'     // Angariação - SWOT
    | 'workflow_desc'     // Angariação - Descrição marketing
    | 'workflow_pitch'    // Angariação - Pitch reunião
    | 'email_draft'       // Email para cliente
    | 'whatsapp_draft'    // WhatsApp/SMS para cliente
    | 'deal_coach'        // Análise de visita / coach
    | 'imovel_extract'    // Captar imóvel de link/texto — extracção estruturada
    | 'generic';          // Default

export type Provider = 'google' | 'anthropic';

interface ProviderConfig {
    provider: Provider;
    model: string;
}

/**
 * FEATURE ROUTING TABLE — primary first, fallback second.
 * Tuned per João's setup (real estate Portugal).
 */
const ROUTING: Record<AIFeature, [ProviderConfig, ProviderConfig]> = {
    chat:            [{ provider: 'google',    model: 'gemini-2.5-flash' }, { provider: 'anthropic', model: 'claude-sonnet-4-5' }],
    briefing:        [{ provider: 'google',    model: 'gemini-2.5-flash' }, { provider: 'anthropic', model: 'claude-sonnet-4-5' }],
    workflow_icp:    [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-pro' }],
    workflow_swot:   [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-pro' }],
    workflow_desc:   [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-pro' }],
    workflow_pitch:  [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-pro' }],
    email_draft:     [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-flash' }],
    whatsapp_draft:  [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-flash' }],
    deal_coach:      [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }, { provider: 'google',    model: 'gemini-2.5-pro' }],
    imovel_extract:  [{ provider: 'google',    model: 'gemini-2.5-flash' }, { provider: 'anthropic', model: 'claude-sonnet-4-5' }],
    generic:         [{ provider: 'google',    model: 'gemini-2.5-flash' }, { provider: 'anthropic', model: 'claude-sonnet-4-5' }],
};

export interface AIKeys {
    google?: string;
    anthropic?: string;
}

function makeModel(cfg: ProviderConfig, keys: AIKeys): LanguageModel | null {
    if (cfg.provider === 'google' && keys.google) {
        return createGoogleGenerativeAI({ apiKey: keys.google })(cfg.model);
    }
    if (cfg.provider === 'anthropic' && keys.anthropic) {
        return createAnthropic({ apiKey: keys.anthropic })(cfg.model);
    }
    return null;
}

/**
 * Errors that should trigger fallback to secondary provider.
 */
function isRetryableError(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.statusCode || err?.status;
    if (status === 429 || status === 503 || status === 529 || status === 502) return true;
    if (/rate.?limit|capacity|high demand|overloaded|temporar|unavailable/i.test(msg)) return true;
    return false;
}

interface RouterCallOptions {
    feature: AIFeature;
    /**
     * Mensagem do utilizador (dados dinâmicos do deal/contacto/imóvel).
     * Para activar prompt caching, passa também `system` separado.
     * Se `system` não for passado, este `prompt` é usado como prompt único (legacy).
     */
    prompt: string;
    /**
     * Prompt específico da feature (estático). Quando passado, vai como system
     * com cache_control ephemeral, junto com o GLOBAL_RULES_BLOCK partilhado.
     * Para Gemini é concatenado (implicit caching trata o resto).
     */
    system?: string;
    keys: AIKeys;
    temperature?: number;
    maxTokens?: number;
}

interface RouterCallResult {
    text: string;
    modelUsed: string;
    fallbackUsed: boolean;
    error?: string;
}

/**
 * Main entry point. Call this from API routes instead of generateText directly.
 */
export async function routedGenerate(opts: RouterCallOptions): Promise<RouterCallResult> {
    const [primary, secondary] = ROUTING[opts.feature];
    const attempts: Array<{ cfg: ProviderConfig; isPrimary: boolean }> = [
        { cfg: primary, isPrimary: true },
        { cfg: secondary, isPrimary: false },
    ];

    let lastError: Error | null = null;
    for (const { cfg, isPrimary } of attempts) {
        const model = makeModel(cfg, opts.keys);
        if (!model) {
            // No key for this provider; skip silently.
            console.warn(`[ai-router] Skipping ${cfg.provider} (no key) for feature=${opts.feature}`);
            continue;
        }
        try {
            // Prompt caching: quando `system` é passado, separa em blocks cached (Anthropic)
            // ou concatena (Gemini — beneficia de implicit caching sem código).
            let result;
            if (opts.system) {
                const cachedBlocks: CachedBlock[] = buildCachedSystem(opts.system);
                if (cfg.provider === 'anthropic') {
                    result = await generateText({
                        model,
                        system: cachedBlocks as never,
                        prompt: opts.prompt,
                        temperature: opts.temperature ?? 0.7,
                    });
                } else {
                    // Gemini: usa string flat (implicit caching activo por defeito em 2.5+)
                    result = await generateText({
                        model,
                        system: flattenSystem(cachedBlocks),
                        prompt: opts.prompt,
                        temperature: opts.temperature ?? 0.7,
                    });
                }
            } else {
                // Legacy path (sem cache) — backward compatible
                result = await generateText({
                    model,
                    prompt: opts.prompt,
                    temperature: opts.temperature ?? 0.7,
                });
            }
            logCacheStats(`${opts.feature} ${cfg.provider}/${cfg.model}`, result);
            return {
                text: result.text,
                modelUsed: `${cfg.provider}/${cfg.model}`,
                fallbackUsed: !isPrimary,
            };
        } catch (err: any) {
            lastError = err;
            console.warn(`[ai-router] ${cfg.provider}/${cfg.model} failed for feature=${opts.feature}:`, err?.message);
            if (!isRetryableError(err) && isPrimary) {
                // Non-retryable error on primary — still try secondary as safety
            }
            // Continue to next attempt
        }
    }

    throw new Error(`Todos os providers falharam para feature=${opts.feature}. Última erro: ${lastError?.message || 'unknown'}`);
}

export interface MultimodalCallOptions {
    feature: AIFeature;
    prompt: string;
    files: Array<{ data: ArrayBuffer | Uint8Array; mimeType: string }>;
    keys: AIKeys;
    temperature?: number;
}

/**
 * Multimodal generate — passes prompt + files (image or PDF) to Gemini/Claude.
 * Uses `messages` API with content parts (text + file).
 */
export async function routedGenerateMultimodal(opts: MultimodalCallOptions): Promise<RouterCallResult> {
    const [primary, secondary] = ROUTING[opts.feature];
    const attempts: Array<{ cfg: ProviderConfig; isPrimary: boolean }> = [
        { cfg: primary, isPrimary: true },
        { cfg: secondary, isPrimary: false },
    ];

    let lastError: Error | null = null;
    for (const { cfg, isPrimary } of attempts) {
        const model = makeModel(cfg, opts.keys);
        if (!model) continue;

        try {
            const content: Array<Record<string, unknown>> = [{ type: 'text', text: opts.prompt }];
            for (const f of opts.files) {
                const buf = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
                if (f.mimeType.startsWith('image/')) {
                    content.push({ type: 'image', image: buf, mediaType: f.mimeType });
                } else {
                    content.push({ type: 'file', data: buf, mediaType: f.mimeType });
                }
            }
            const { text } = await generateText({
                model,
                messages: [{ role: 'user', content: content as never }],
                temperature: opts.temperature ?? 0.7,
            });
            return {
                text,
                modelUsed: `${cfg.provider}/${cfg.model}`,
                fallbackUsed: !isPrimary,
            };
        } catch (err: any) {
            lastError = err;
            console.warn(`[ai-router multimodal] ${cfg.provider}/${cfg.model} failed:`, err?.message);
        }
    }

    throw new Error(`Multimodal providers falharam: ${lastError?.message || 'unknown'}`);
}

/**
 * Get a model instance for the given feature, returning the FIRST provider with a valid key.
 * Used by routes that need streaming (e.g. chat with tools) where we can't easily wrap with fallback.
 */
export function getModelForFeature(feature: AIFeature, keys: AIKeys): { model: LanguageModel | null; providerLabel: string } {
    const [primary, secondary] = ROUTING[feature];
    for (const cfg of [primary, secondary]) {
        const m = makeModel(cfg, keys);
        if (m) return { model: m, providerLabel: `${cfg.provider}/${cfg.model}` };
    }
    return { model: null, providerLabel: 'none' };
}

/**
 * Fetch both API keys from BD (org-scoped + user-scoped fallback).
 */
export async function fetchAIKeysForUser(supabase: any, userId: string): Promise<AIKeys> {
    const keys: AIKeys = {};

    // user_settings.ai_api_key stores a single key (legacy) — treat as Google by default
    const { data: us } = await supabase
        .from('user_settings')
        .select('ai_api_key, ai_provider')
        .eq('user_id', userId)
        .single();
    if (us?.ai_api_key && us.ai_provider === 'google') keys.google = us.ai_api_key;
    if (us?.ai_api_key && us.ai_provider === 'anthropic') keys.anthropic = us.ai_api_key;

    // organization_settings has provider-specific columns
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userId).single();
    if (profile?.organization_id) {
        const { data: os } = await supabase
            .from('organization_settings')
            .select('ai_google_key, ai_anthropic_key')
            .eq('organization_id', profile.organization_id)
            .single();
        if (os?.ai_google_key && !keys.google) keys.google = os.ai_google_key;
        if (os?.ai_anthropic_key && !keys.anthropic) keys.anthropic = os.ai_anthropic_key;
    }

    return keys;
}
