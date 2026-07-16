import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Página de arranque preferida do utilizador (Configurações → Página Inicial).
 * Vive em user_settings.default_route; fallback /dashboard.
 */
async function resolveHomeRoute(): Promise<string> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return '/dashboard'
        const { data: prefs } = await supabase
            .from('user_settings')
            .select('default_route')
            .eq('user_id', user.id)
            .maybeSingle()
        const route = prefs?.default_route as string | undefined
        // Só caminhos internos ("/x"), nunca URLs externas.
        if (route && route.startsWith('/') && !route.startsWith('//')) return route
    } catch { /* fallback */ }
    return '/dashboard'
}

/**
 * Componente React `Home`.
 * @returns {Promise<void>} Retorna uma Promise resolvida sem valor.
 */
export default async function Home() {
    // Bypass em desenvolvimento local: respeita a preferência na mesma
    if (process.env.NODE_ENV === 'development') {
        redirect(await resolveHomeRoute())
    }

    const installerEnabled = process.env.INSTALLER_ENABLED !== 'false'

    // Detecta se a instância já foi inicializada.
    // - Se falhar (env/supabase indisponível), tratamos como "não inicializada" quando o installer está enabled.
    let isInitialized: boolean | null = null
    try {
        const supabase = await createClient()
        const { data, error } = await supabase.rpc('is_instance_initialized')
        if (!error && typeof data === 'boolean') {
            isInitialized = data
        }
    } catch {
        isInitialized = null
    }

    // “Padrão ouro” pós-deploy:
    // - Se o installer está habilitado e a instância ainda não está inicializada (ou não dá pra checar),
    //   manda pro /install.
    // - Se já está inicializada, não força /install (vai pro app).
    if (installerEnabled) {
        if (isInitialized === true) {
            redirect(await resolveHomeRoute())
        }
        redirect('/install')
    }

    // Após um reset do banco (ou instância não inicializada), leva para o setup interno.
    if (isInitialized === false) {
        redirect('/setup')
    }

    redirect(await resolveHomeRoute())
}
