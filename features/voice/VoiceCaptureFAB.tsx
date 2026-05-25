'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, X, Loader2, CheckCircle2, AlertCircle, Square, Trash2 } from 'lucide-react';

type Stage = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

type ResultData = {
  intent: string | null;
  summary: string | null;
  transcript: string | null;
  entity_created: any;
  error_message: string | null;
};

const INTENT_LABELS: Record<string, string> = {
  task: '🎯 Tarefa',
  note: '📝 Nota',
  lead: '👤 Novo contacto',
  call_recording: '📞 Chamada',
  unknown: '❓ Não classificado',
};

export const VoiceCaptureFAB: React.FC = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  // Esconder em rotas onde estorva (ex: login)
  const hideFAB = pathname?.startsWith('/login') || pathname?.startsWith('/install') || pathname === '/';

  const cleanup = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => () => cleanup(), []);

  const reset = () => {
    cleanup();
    setStage('idle');
    setError(null);
    setSeconds(0);
    setCaptureId(null);
    setResult(null);
  };

  const startRecording = async () => {
    setError(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      setStage('recording');
      tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      const msg = e?.name === 'NotAllowedError'
        ? 'Permissão do microfone negada. Active nas definições do browser.'
        : (e?.message || 'Não foi possível aceder ao microfone');
      setError(msg);
      setStage('error');
    }
  };

  const stopRecording = (): Promise<Blob | null> => new Promise((resolve) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return resolve(null);
    mr.onstop = () => {
      const mime = mr.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      resolve(blob);
    };
    try { mr.stop(); } catch { resolve(null); }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  });

  const upload = async (blob: Blob) => {
    setStage('uploading');
    const form = new FormData();
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('webm') ? 'webm' : 'audio';
    form.append('audio', blob, `voice-${Date.now()}.${ext}`);
    if (pathname) form.append('context_hint', `rota actual: ${pathname}`);
    try {
      const res = await fetch('/api/voice/process', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || `Erro ${res.status}`); setStage('error'); return; }
      setCaptureId(data.id);
      setStage('processing');
      pollProcessing(data.id);
    } catch (e: any) {
      setError(e?.message || 'Falhou'); setStage('error');
    }
  };

  const pollProcessing = (id: string) => {
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries++;
      if (tries > 30) { // ~60s
        if (pollRef.current) clearInterval(pollRef.current);
        setError('Demorou mais do que o esperado, verifique mais tarde'); setStage('error'); return;
      }
      try {
        const res = await fetch(`/api/voice/${id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) return;
        if (data.capture.status === 'done') {
          if (pollRef.current) clearInterval(pollRef.current);
          setResult({
            intent: data.capture.intent,
            summary: data.capture.extracted_data?.summary || null,
            transcript: data.capture.transcript,
            entity_created: data.capture.entity_created,
            error_message: null,
          });
          setStage('done');
        } else if (data.capture.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.capture.error_message || 'Processamento falhou'); setStage('error');
        }
      } catch { /* keep polling */ }
    }, 2000);
  };

  const handleStop = async () => {
    const blob = await stopRecording();
    if (!blob) { setError('Gravação vazia'); setStage('error'); return; }
    if (blob.size < 1000) { setError('Áudio demasiado curto'); setStage('error'); return; }
    await upload(blob);
  };

  const handleClose = () => {
    if (stage === 'recording') { /* user wants to cancel */ }
    reset();
    setOpen(false);
  };

  if (hideFAB) return null;

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setTimeout(startRecording, 200); }}
          aria-label="Ditar para o CRM"
          className="fixed z-40 bottom-20 md:bottom-6 right-4 md:right-6 h-14 w-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xl flex items-center justify-center transition-transform active:scale-95"
        >
          <Mic className="h-6 w-6" />
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={() => stage !== 'uploading' && stage !== 'processing' && handleClose()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full md:max-w-md md:rounded-2xl rounded-t-2xl border border-slate-200 dark:border-white/10 max-h-[85vh] overflow-y-auto"
          >
            <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-rose-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Voz para o CRM</h2>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="p-6">
              {stage === 'idle' && (
                <div className="text-center py-6">
                  <button
                    onClick={startRecording}
                    className="h-24 w-24 mx-auto rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95"
                  >
                    <Mic className="h-10 w-10" />
                  </button>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Tap para começar a gravar</p>
                </div>
              )}

              {stage === 'recording' && (
                <div className="text-center py-6">
                  <button
                    onClick={handleStop}
                    className="h-24 w-24 mx-auto rounded-full bg-rose-600 text-white shadow-lg flex items-center justify-center animate-pulse"
                  >
                    <Square className="h-10 w-10" fill="currentColor" />
                  </button>
                  <p className="mt-4 text-2xl font-mono text-slate-900 dark:text-white">
                    {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">A gravar… tap para parar e processar</p>
                  <button onClick={reset} className="mt-4 text-xs text-slate-400 hover:text-rose-500 inline-flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Cancelar
                  </button>
                </div>
              )}

              {(stage === 'uploading' || stage === 'processing') && (
                <div className="text-center py-6">
                  <Loader2 className="h-12 w-12 mx-auto text-rose-500 animate-spin" />
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    {stage === 'uploading' ? 'A enviar áudio…' : 'A transcrever e classificar…'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">10 a 30 segundos</p>
                </div>
              )}

              {stage === 'done' && result && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-semibold">Processado</span>
                  </div>
                  {result.intent && (
                    <div>
                      <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        {INTENT_LABELS[result.intent] || result.intent}
                      </span>
                    </div>
                  )}
                  {result.summary && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Resumo</div>
                      <div className="text-sm text-slate-900 dark:text-white">{result.summary}</div>
                    </div>
                  )}
                  {result.entity_created && (
                    <div className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 text-sm">
                      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Acção tomada</div>
                      {result.entity_created.kind === 'deal_activity' && (
                        <div className="text-slate-900 dark:text-white">
                          Activity criada no negócio ligado. <a href={`/boards`} className="text-rose-500 hover:underline">Abrir boards</a>
                        </div>
                      )}
                      {result.entity_created.kind === 'contact' && (
                        <div className="text-slate-900 dark:text-white">
                          Novo contacto: <strong>{result.entity_created.name}</strong>. <a href={`/contacts`} className="text-rose-500 hover:underline">Ver contactos</a>
                        </div>
                      )}
                      {result.entity_created.kind === 'unmatched' && (
                        <div className="text-amber-700 dark:text-amber-300">
                          ⚠️ {result.entity_created.reason || 'Não foi possível ligar a um negócio existente'}
                        </div>
                      )}
                      {result.entity_created.kind === 'error' && (
                        <div className="text-rose-700 dark:text-rose-300">Erro: {result.entity_created.error}</div>
                      )}
                      {result.entity_created.kind === 'unknown' && (
                        <div className="text-slate-600 dark:text-slate-300">IA não conseguiu classificar. Transcript guardado abaixo.</div>
                      )}
                    </div>
                  )}
                  {result.transcript && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer hover:text-slate-700">Transcrição</summary>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{result.transcript}</p>
                    </details>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={reset} className="flex-1 py-2 px-4 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm">
                      Gravar outra
                    </button>
                    <button onClick={handleClose} className="py-2 px-4 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm">
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {stage === 'error' && (
                <div className="text-center py-6">
                  <AlertCircle className="h-10 w-10 mx-auto text-rose-500" />
                  <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error || 'Erro desconhecido'}</p>
                  <button onClick={reset} className="mt-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm">
                    Tentar de novo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceCaptureFAB;
