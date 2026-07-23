'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ditado por voz via Web Speech API (webkitSpeechRecognition), em pt-PT.
 * Progressive enhancement: se o browser não suportar, `supported` é false e o
 * botão de microfone não deve aparecer. Sem dependências externas.
 */

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number;[i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useDictation(onFinalText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onFinalText);
  onTextRef.current = onFinalText;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      try {
        recogRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const toggle = () => {
    if (listening) {
      try {
        recogRef.current?.stop();
      } catch {
        /* noop */
      }
      setListening(false);
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const recog = new Ctor();
    recog.lang = 'pt-PT';
    recog.continuous = true;
    recog.interimResults = false;
    recog.onresult = (e) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim()) onTextRef.current(finalText.trim());
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recogRef.current = recog;
    try {
      recog.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return { supported, listening, toggle };
}
