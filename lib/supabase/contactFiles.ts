/**
 * Contact Files Service
 * Upload, download and manage permanent files attached to contacts via Supabase Storage.
 * Includes: caderneta predial, CC, certificados energéticos, plantas, fotos do imóvel, etc.
 */
import { supabase } from './client';

export interface ContactFile {
    id: string;
    organization_id: string;
    contact_id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
    category: ContactFileCategory;
    description: string | null;
    created_at: string;
    created_by: string | null;
}

export type ContactFileCategory =
    | 'cc'
    | 'caderneta'
    | 'certificado_energetico'
    | 'licenca_utilizacao'
    | 'planta'
    | 'foto_imovel'
    | 'contrato'
    | 'procuracao'
    | 'registo_predial'
    | 'outro';

export const CATEGORY_LABELS: Record<ContactFileCategory, string> = {
    cc: '🪪 Cartão Cidadão',
    caderneta: '📋 Caderneta Predial',
    certificado_energetico: '⚡ Certificado Energético',
    licenca_utilizacao: '📜 Licença Utilização',
    planta: '📐 Planta',
    foto_imovel: '📸 Foto do Imóvel',
    contrato: '📄 Contrato',
    procuracao: '✍️ Procuração',
    registo_predial: '🏠 Registo Predial',
    outro: '📁 Outro',
};

const BUCKET = 'contact-files';

/**
 * Upload a file attached to a contact.
 * Path scheme: `{organization_id}/{contact_id}/{timestamp}-{sanitized_filename}`
 */
export async function uploadContactFile(
    contactId: string,
    organizationId: string,
    file: File,
    category: ContactFileCategory = 'outro',
    description?: string
): Promise<ContactFile> {
    if (file.size > 25 * 1024 * 1024) {
        throw new Error('Ficheiro demasiado grande (máx 25 MB)');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `${organizationId}/${contactId}/${timestamp}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (uploadErr) throw new Error(`Upload falhou: ${uploadErr.message}`);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    const { data, error } = await supabase
        .from('contact_files')
        .insert({
            organization_id: organizationId,
            contact_id: contactId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || null,
            category,
            description: description ?? null,
            created_by: userId,
        })
        .select()
        .single();
    if (error) {
        await supabase.storage.from(BUCKET).remove([filePath]).catch(() => {});
        throw new Error(`Erro a registar ficheiro: ${error.message}`);
    }
    return data as ContactFile;
}

/**
 * List all files attached to a contact.
 */
export async function listContactFiles(contactId: string): Promise<ContactFile[]> {
    const { data, error } = await supabase
        .from('contact_files')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ContactFile[];
}

/**
 * Get a temporary signed URL to download/preview a file (valid 1 hour).
 */
export async function getContactFileSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, expiresIn);
    if (error || !data) throw new Error(error?.message || 'Falha a gerar URL');
    return data.signedUrl;
}

/**
 * Delete a file (removes from storage and DB).
 */
export async function deleteContactFile(fileId: string, filePath: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([filePath]).catch(() => {});
    const { error } = await supabase.from('contact_files').delete().eq('id', fileId);
    if (error) throw new Error(error.message);
}

/**
 * Update file metadata (category, description, rename).
 */
export async function updateContactFile(
    fileId: string,
    patch: Partial<Pick<ContactFile, 'file_name' | 'category' | 'description'>>
): Promise<ContactFile> {
    const { data, error } = await supabase
        .from('contact_files')
        .update(patch)
        .eq('id', fileId)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as ContactFile;
}
