import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));
// When running from a git worktree inside .claude/worktrees/, node_modules live
// 3 levels up at the repo root. Turbopack needs an explicit root to resolve them.
const repoRoot = configDir.includes('/.claude/worktrees/')
  ? path.resolve(configDir, '../../../')
  : configDir;

// Versão humana do build: YYMMDD_HHmm (Lisboa).
// Injectada em build time para sidebar/mobile mostrarem "260522_2156" em vez de "v5b5108b".
function buildVersionTag(): string {
  try {
    const now = new Date();
    // Forçar Lisboa (Europe/Lisbon)
    const fmt = new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Europe/Lisbon',
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(now).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
    return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}`;
  } catch {
    return 'dev';
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TAG: buildVersionTag(),
  },
  // As fontes dos templates da marca são lidas por fs no render serverless (MKT-BIBLIOTECA).
  outputFileTracingIncludes: {
    '/api/criativos/render': ['./assets/fonts/**'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Otimiza imports de bibliotecas com barrel files (index.js que re-exporta tudo)
  // Isso evita carregar módulos não utilizados, reduzindo o bundle em 15-25KB
  // Ref: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
  experimental: {
    optimizePackageImports: [
      'lucide-react',      // 1500+ ícones, carrega só os usados
      'recharts',          // Biblioteca de gráficos pesada
      'date-fns',          // Utilitários de data
      '@radix-ui/react-icons',
    ],
  },
  turbopack: {
    root: repoRoot,
  },
  async rewrites() {
    return [{ source: '/api/chat', destination: '/api/ai/chat' }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/api/mcp",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, X-Api-Key" },
        ],
      },
    ];
  },
};

export default nextConfig;
