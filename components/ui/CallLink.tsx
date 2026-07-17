'use client';

/**
 * CallLink — link de chamada consciente da plataforma.
 * iOS: dispara o Atalho "Ligar CRM" (gravação Notta + chamada) via
 * interceptCallClick; resto: `tel:` normal. Ver lib/calls/index.ts.
 * Serve para usar dentro de Server Components (a ficha do contacto é um).
 */

import React from 'react';
import { telHref, interceptCallClick } from '@/lib/calls';

interface CallLinkProps {
  phone: string | null | undefined;
  className?: string;
  title?: string;
  'aria-label'?: string;
  /** Corre no clique (ex.: registar CHQ) antes do desvio para o Atalho. */
  onCall?: () => void;
  children: React.ReactNode;
}

export function CallLink({ phone, className, title, onCall, children, ...rest }: CallLinkProps) {
  const href = telHref(phone);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      className={className}
      title={title}
      aria-label={rest['aria-label']}
      onClick={(e) => {
        onCall?.();
        interceptCallClick(e, phone);
      }}
    >
      {children}
    </a>
  );
}

export default CallLink;
