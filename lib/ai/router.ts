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
    prompt: string;
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
            const { text } = await generateText({
                model,
                prompt: opts.prompt,
                temperature: opts.temperature ?? 0.7,
            });
            return {
                text,
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
