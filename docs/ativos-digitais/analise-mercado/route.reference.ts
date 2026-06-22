// ============================================================================
// ⚠️ FICHEIRO DE REFERÊNCIA — NÃO É CÓDIGO ACTIVO ⚠️
// Versão original criada pelo João (chat de IA). Guardada aqui como referência.
// O backend REAL será REESCRITO para alimentar o funil do CRM (contacto + negócio
// com proveniência), NÃO esta tabela isolada `leads_captura`. Ver PREP.md.
// ----------------------------------------------------------------------------
// FOCO IMO · ROTA DE CAPTURA · Análise de Mercado
// Caminho pretendido no projeto: app/api/leads/captura-amc/route.ts
// Next.js 16 App Router · Supabase
// Recebe o POST da landing page e grava na tabela `leads_captura`.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente Supabase com service role (lado servidor, nunca exposto ao browser).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS: permitir o POST a partir do domínio da landing.
// Ajustar ALLOWED_ORIGIN para o domínio final (ex.: https://joaofilipefonseca.pt)
const ALLOWED_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// Validação de telemóvel PT, com deteção de números falsos (repetidos, sequenciais, pares).
// NOTA: lógica boa e reutilizável — manter na versão final.
function isTelefoneValido(raw: string): boolean {
  let n = raw.replace(/[\s\-().]/g, "");
  n = n.replace(/^(\+351|00351)/, "");
  if (!/^[29]\d{8}$/.test(n)) return false;
  if (/^(\d)\1{8}$/.test(n)) return false;
  const asc = "0123456789";
  const desc = "9876543210";
  if (asc.includes(n) || desc.includes(n)) return false;
  const corpo = n.slice(1);
  if (asc.includes(corpo) || desc.includes(corpo)) return false;
  if (/^(\d\d)\1{3}\d?$/.test(n)) return false;
  if (new Set(n).size < 4) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const nome = (body.nome || "").toString().trim();
    const telefone = (body.telefone || "").toString().trim();
    const email = (body.email || "").toString().trim();

    if (!nome) {
      return NextResponse.json(
        { ok: false, error: "Nome é obrigatório." },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!isTelefoneValido(telefone)) {
      return NextResponse.json(
        { ok: false, error: "Telemóvel inválido." },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Email inválido." },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (body.consentimento !== true) {
      return NextResponse.json(
        { ok: false, error: "Consentimento em falta." },
        { status: 400, headers: corsHeaders() }
      );
    }

    const row = {
      nome,
      telefone,
      email,
      horario_contacto: body.horario || null,
      localizacao: body.localizacao || null,
      tipo_imovel: body.tipo || null,
      tipologia: body.tipologia || null,
      estado: body.estado || null,
      area: body.area || null,
      extras: Array.isArray(body.extras) ? body.extras : [],
      prazo_venda: body.prazo || null,
      motivo: body.motivo || null,
      origem: body.origem || "landing-analise-mercado",
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null,
      referrer: body.referrer || null,
      landing_url: body.landing_url || null,
      estado_lead: "novo",
      consentimento: true,
    };

    const { data, error } = await supabase
      .from("leads_captura")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { ok: false, error: "Erro ao gravar o lead." },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { ok: true, id: data.id },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json(
      { ok: false, error: "Pedido inválido." },
      { status: 400, headers: corsHeaders() }
    );
  }
}
