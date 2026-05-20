import Link from 'next/link';
import ImovelForm from '@/components/imoveis/ImovelForm';

export const metadata = { title: 'Novo imóvel | Foco Imo' };

export default function NovoImovelPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <Link href="/imoveis" className="text-sm text-blue-600 hover:underline">
          ← Imóveis
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Novo imóvel</h1>
      <ImovelForm mode="create" />
    </div>
  );
}
