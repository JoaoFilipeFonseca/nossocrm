// ============================================================================
// workflow-engine.edge.ts — Edge Function que executa automações
// ============================================================================
// Localização final: /supabase/functions/automation-execute/index.ts
//
// Ambiente: Deno (Supabase Edge Functions)
// Invocação: POST com body { automation_id, trigger_payload, organization_id, ... }
// ============================================================================

// @ts-expect-error — imports Deno
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error — imports Deno
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { registry } from '../../../lib/automation-engine/registry.ts';
import { resolveVariables } from '../../../lib/automation-engine/template.ts';
import { publishEvent } from '../../../lib/automation-engine/event-bus.ts';
import type {
  AutomationDefinition,
  AutomationNode,
  ExecutionContext,
  AtomOutput,
} from '../../../lib/automation-engine/types.ts';

// ----------------------------------------------------------------------------
// Limites e timeouts
// ----------------------------------------------------------------------------
const MAX_NODES_PER_RUN = 200; // safety cap contra loops infinitos
const INLINE_WAIT_MAX_MS = 150_000; // 150s. Acima disto, suspende.

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  let body: ExecuteRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  
  const supabase = createSupabaseClient();
  
  // Cria ou retoma execução
  let execution: ExecutionRow;
  try {
    if (body.execution_id) {
      execution = await loadExecution(supabase, body.execution_id);
    } else {
      execution = await createExecution(supabase, body);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
  
  // Resposta imediata. Trabalho continua em background.
  // @ts-expect-error — EdgeRuntime é global em Supabase Edge Functions
  EdgeRuntime.waitUntil(runExecution(supabase, execution, body.resume_node_id));
  
  return jsonResponse({ execution_id: execution.id, status: 'started' });
});

// ----------------------------------------------------------------------------
// Loop principal de execução
// ----------------------------------------------------------------------------
async function runExecution(
  supabase: SupabaseClient,
  exec: ExecutionRow,
  resumeNodeId?: string
): Promise<void> {
  try {
    const automation = await loadAutomation(supabase, exec.automation_id);
    const def = automation.definition as AutomationDefinition;
    
    await updateExecution(supabase, exec.id, { status: 'running' });
    
    let currentNodeId = resumeNodeId ?? findFirstExecutableNode(def);
    let nodesProcessed = 0;
    
    while (currentNodeId) {
      if (nodesProcessed++ > MAX_NODES_PER_RUN) {
        throw new Error(`Limite de ${MAX_NODES_PER_RUN} nós por execução atingido`);
      }
      
      const node = def.nodes.find((n) => n.id === currentNodeId);
      if (!node) throw new Error(`Nó ${currentNodeId} não encontrado`);
      
      const atom = registry.get(node.atom);
      if (!atom) throw new Error(`Átomo ${node.atom} não registado`);
      
      // Pula triggers (já foram executados)
      if (atom.category === 'trigger' && !resumeNodeId) {
        currentNodeId = findNextNode(def, currentNodeId);
        continue;
      }
      
      // Resolve variáveis na config
      const resolvedConfig = resolveVariables(node.config, exec.variables ?? {});
      
      // Constrói contexto
      const context = buildContext({
        supabase,
        exec,
        node,
        config: resolvedConfig,
      });
      
      // Regista início do nó
      const nodeExecId = await recordNodeStart(supabase, exec, node);
      
      try {
        const output = await executeWithTimeout(
          atom.execute(context),
          atom.timeoutMs ?? 30_000
        );
        
        await recordNodeSuccess(supabase, nodeExecId, output);
        
        // Acumula output em variables
        exec.variables = exec.variables ?? {};
        exec.variables[node.id] = { output };
        
        await updateExecution(supabase, exec.id, {
          variables: exec.variables,
          current_node_id: node.id,
        });
        
        // Trata sinais especiais do output
        if (isSuspendSignal(output)) {
          await suspendExecution(supabase, exec.id, currentNodeId, output);
          return;
        }
        
        const branch = isBranchSignal(output) ? output._branch : undefined;
        currentNodeId = findNextNode(def, currentNodeId, branch);
        
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await recordNodeError(supabase, nodeExecId, errMsg);
        
        // Política de retry
        const shouldRetry = atom.retry && (await getRetryCount(supabase, nodeExecId)) < atom.retry.maxAttempts;
        if (shouldRetry) {
          await scheduleRetry(supabase, exec.id, currentNodeId, atom.retry!.backoffMs);
          return;
        }
        
        throw err;
      }
    }
    
    // Fim do fluxo
    await completeExecution(supabase, exec);
    await publishEvent(supabase, {
      eventType: 'automation.completed',
      payload: { automation_id: exec.automation_id, execution_id: exec.id },
      organizationId: exec.organization_id,
      source: 'workflow-engine',
    });
    
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await failExecution(supabase, exec.id, errMsg);
    await publishEvent(supabase, {
      eventType: 'automation.failed',
      payload: {
        automation_id: exec.automation_id,
        execution_id: exec.id,
        error: errMsg,
      },
      organizationId: exec.organization_id,
      source: 'workflow-engine',
    });
  }
}

// ----------------------------------------------------------------------------
// Helpers de execução
// ----------------------------------------------------------------------------
function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

function isSuspendSignal(output: AtomOutput): output is AtomOutput & { _suspend: true } {
  return typeof output === 'object' && output !== null && '_suspend' in output && output._suspend === true;
}

function isBranchSignal(output: AtomOutput): output is AtomOutput & { _branch: string } {
  return typeof output === 'object' && output !== null && '_branch' in output && typeof output._branch === 'string';
}

function findFirstExecutableNode(def: AutomationDefinition): string | null {
  // Encontra primeiro nó depois do trigger
  const triggerNode = def.nodes.find((n) => n.atom.startsWith('trigger.'));
  if (!triggerNode) return null;
  
  const firstEdge = def.edges.find((e) => e.source === triggerNode.id);
  return firstEdge?.target ?? null;
}

function findNextNode(
  def: AutomationDefinition,
  currentNodeId: string,
  branch?: string
): string | null {
  const edges = def.edges.filter((e) => e.source === currentNodeId);
  if (edges.length === 0) return null;
  
  if (branch) {
    const branchEdge = edges.find((e) => e.sourceHandle === branch);
    return branchEdge?.target ?? null;
  }
  
  return edges[0].target;
}

// ----------------------------------------------------------------------------
// Construção do contexto passado a cada átomo
// ----------------------------------------------------------------------------
function buildContext(params: {
  supabase: SupabaseClient;
  exec: ExecutionRow;
  node: AutomationNode;
  config: Record<string, unknown>;
}): ExecutionContext {
  const { supabase, exec, node, config } = params;
  
  return {
    supabase,
    executionId: exec.id,
    automationId: exec.automation_id,
    organizationId: exec.organization_id,
    nodeId: node.id,
    config,
    variables: exec.variables ?? {},
    triggerEvent: exec.trigger_event
      ? { type: exec.trigger_type ?? 'unknown', payload: exec.trigger_event }
      : undefined,
    contactId: exec.contact_id ?? undefined,
    dealId: exec.deal_id ?? undefined,
    imovelId: exec.imovel_id ?? undefined,
    isTest: exec.is_test,
    testOptions: exec.test_options ?? undefined,
    
    log: async (level, message, data) => {
      console.log(`[exec:${exec.id}][${level}] ${message}`, data ?? '');
    },
    
    getIntegration: async (integrationId) => {
      const { data: integration } = await supabase
        .from('automation_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();
      
      if (!integration) throw new Error(`Integração ${integrationId} não encontrada`);
      
      // Carregar e desencriptar credenciais (via pgsodium)
      const { data: creds } = await supabase.rpc('decrypt_integration_credentials', {
        p_integration_id: integrationId,
      });
      
      return {
        id: integration.id,
        provider: integration.provider,
        accountName: integration.account_name,
        metadata: integration.metadata ?? {},
        credentials: creds as Record<string, string>,
      };
    },
    
    getBrandKit: async () => {
      const { data, error } = await supabase
        .from('ai_brand_kits')
        .select('*')
        .eq('organization_id', exec.organization_id)
        .single();
      
      if (error || !data) throw new Error('Brand Kit não encontrado');
      return data as never;
    },
    
    getPromptTemplate: async (templateId) => {
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error || !data) throw new Error(`Template ${templateId} não encontrado`);
      return data as never;
    },
    
    recordActivity: async (type, data) => {
      if (!exec.deal_id) return;
      await supabase.from('deal_activities').insert({
        deal_id: exec.deal_id,
        organization_id: exec.organization_id,
        type,
        data,
        created_via: 'automation',
        source_execution_id: exec.id,
      });
    },
    
    archiveCreative: async (data) => {
      await supabase.from('creative_archive').insert({
        organization_id: exec.organization_id,
        ...data,
        source: 'automation',
        source_execution_id: exec.id,
      });
    },
  };
}

// ----------------------------------------------------------------------------
// Persistência
// ----------------------------------------------------------------------------
async function createExecution(
  supabase: SupabaseClient,
  body: ExecuteRequest
): Promise<ExecutionRow> {
  const automation = await loadAutomation(supabase, body.automation_id);
  
  const { data, error } = await supabase
    .from('automation_executions')
    .insert({
      automation_id: body.automation_id,
      organization_id: body.organization_id,
      automation_version: automation.version,
      trigger_event: body.trigger_payload ?? null,
      trigger_type: body.trigger_type ?? 'manual',
      contact_id: body.contact_id ?? null,
      deal_id: body.deal_id ?? null,
      imovel_id: body.imovel_id ?? null,
      is_test: body.is_test ?? false,
      test_options: body.test_options ?? null,
      variables: {},
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as ExecutionRow;
}

async function loadExecution(supabase: SupabaseClient, executionId: string): Promise<ExecutionRow> {
  const { data, error } = await supabase
    .from('automation_executions')
    .select('*')
    .eq('id', executionId)
    .single();
  if (error || !data) throw new Error(`Execução ${executionId} não encontrada`);
  return data as ExecutionRow;
}

async function loadAutomation(supabase: SupabaseClient, automationId: string) {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .single();
  if (error || !data) throw new Error(`Automação ${automationId} não encontrada`);
  return data;
}

async function updateExecution(
  supabase: SupabaseClient,
  executionId: string,
  patch: Partial<ExecutionRow>
): Promise<void> {
  await supabase.from('automation_executions').update(patch).eq('id', executionId);
}

async function recordNodeStart(
  supabase: SupabaseClient,
  exec: ExecutionRow,
  node: AutomationNode
): Promise<string> {
  const { data, error } = await supabase
    .from('automation_node_executions')
    .insert({
      execution_id: exec.id,
      organization_id: exec.organization_id,
      node_id: node.id,
      atom_id: node.atom,
      status: 'running',
      input: node.config,
    })
    .select('id')
    .single();
  if (error || !data) throw error;
  return data.id as string;
}

async function recordNodeSuccess(
  supabase: SupabaseClient,
  nodeExecId: string,
  output: AtomOutput
): Promise<void> {
  await supabase
    .from('automation_node_executions')
    .update({
      status: 'completed',
      output,
      completed_at: new Date().toISOString(),
    })
    .eq('id', nodeExecId);
}

async function recordNodeError(
  supabase: SupabaseClient,
  nodeExecId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from('automation_node_executions')
    .update({
      status: 'failed',
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', nodeExecId);
}

async function getRetryCount(supabase: SupabaseClient, nodeExecId: string): Promise<number> {
  const { data } = await supabase
    .from('automation_node_executions')
    .select('retry_count')
    .eq('id', nodeExecId)
    .single();
  return (data?.retry_count as number) ?? 0;
}

async function scheduleRetry(
  supabase: SupabaseClient,
  executionId: string,
  nodeId: string,
  backoffMs: number
): Promise<void> {
  const resumeAt = new Date(Date.now() + backoffMs).toISOString();
  await supabase.from('automation_schedules').insert({
    execution_id: executionId,
    organization_id: (await loadExecution(supabase, executionId)).organization_id,
    scheduled_for: resumeAt,
    resume_node_id: nodeId,
  });
  await updateExecution(supabase, executionId, {
    status: 'waiting',
    resume_at: resumeAt,
    resume_node_id: nodeId,
  });
}

async function suspendExecution(
  supabase: SupabaseClient,
  executionId: string,
  nodeId: string,
  output: AtomOutput
): Promise<void> {
  const suspendOutput = output as AtomOutput & { _resumeAt?: string };
  const resumeAt = suspendOutput._resumeAt ?? new Date(Date.now() + 60_000).toISOString();
  
  const exec = await loadExecution(supabase, executionId);
  await supabase.from('automation_schedules').insert({
    execution_id: executionId,
    organization_id: exec.organization_id,
    scheduled_for: resumeAt,
    resume_node_id: nodeId,
  });
  await updateExecution(supabase, executionId, {
    status: 'waiting',
    resume_at: resumeAt,
    resume_node_id: nodeId,
  });
}

async function completeExecution(supabase: SupabaseClient, exec: ExecutionRow): Promise<void> {
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - new Date(exec.started_at).getTime();
  await updateExecution(supabase, exec.id, {
    status: 'completed',
    completed_at: completedAt.toISOString(),
    duration_ms: durationMs,
  });
}

async function failExecution(
  supabase: SupabaseClient,
  executionId: string,
  errorMessage: string
): Promise<void> {
  await updateExecution(supabase, executionId, {
    status: 'failed',
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  });
}

// ----------------------------------------------------------------------------
// Tipos auxiliares (locais)
// ----------------------------------------------------------------------------
interface ExecuteRequest {
  automation_id: string;
  organization_id: string;
  trigger_payload?: Record<string, unknown>;
  trigger_type?: string;
  contact_id?: string;
  deal_id?: string;
  imovel_id?: string;
  is_test?: boolean;
  test_options?: Record<string, unknown>;
  execution_id?: string;
  resume_node_id?: string;
}

interface ExecutionRow {
  id: string;
  automation_id: string;
  organization_id: string;
  status: string;
  trigger_event: Record<string, unknown> | null;
  trigger_type: string | null;
  contact_id: string | null;
  deal_id: string | null;
  imovel_id: string | null;
  current_node_id: string | null;
  variables: Record<string, { output: unknown }> | null;
  resume_at: string | null;
  resume_node_id: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  is_test: boolean;
  test_options: Record<string, unknown> | null;
}

function createSupabaseClient(): SupabaseClient {
  // @ts-expect-error Deno globals
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-expect-error Deno globals
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta');
  return createClient(url, key);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
