'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onReady: (file: File) => void;
}

export default function AudioRecorder({ onReady }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    setElapsed(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const ext = (mr.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
        const fileName = `gravacao_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
        const file = new File([blob], fileName, { type: mr.mimeType || 'audio/webm' });
        onReady(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permissão negada');
      setRecording(false);
    }
  }

  function stop() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
  }

  if (!supported) {
    return (
      <div className="rounded-md bg-amber-50 text-amber-800 p-3 text-sm">
        O teu browser não suporta gravação áudio. Carrega um ficheiro em vez disso.
      </div>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="rounded-md border border-slate-300 p-4 flex items-center gap-3">
      {recording ? (
        <>
          <button type="button" onClick={stop}
            className="inline-flex items-center justify-center rounded-full bg-red-600 text-white w-12 h-12 hover:bg-red-700">
            <span className="block w-4 h-4 bg-white rounded-sm" />
          </button>
          <div>
            <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              A gravar… {mm}:{ss}
            </p>
            <p className="text-xs text-slate-500">Carrega no botão para parar.</p>
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={start}
            className="inline-flex items-center justify-center rounded-full bg-red-600 text-white w-12 h-12 hover:bg-red-700">
            🎙️
          </button>
          <div>
            <p className="text-sm font-medium text-slate-900">Gravar áudio</p>
            <p className="text-xs text-slate-500">Fala o que sabes do imóvel. A IA transcreve e extrai.</p>
          </div>
        </>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
