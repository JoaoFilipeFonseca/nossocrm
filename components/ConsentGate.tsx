'use client';

/**
 * Sprint 31 c1 — gate que monta ConsentModal quando user nao tem consentimentos
 * obrigatorios. Coloca-se uma vez no ProtectedShell para garantir cobertura em
 * todas as rotas autenticadas. Fecha gap checklist GDPR (`T&C aceites no signup`).
 *
 * O hook useConsent ja decide quando mostrar baseado em REQUIRED_CONSENTS.
 */
import React from 'react';
import { useConsent } from '@/hooks/useConsent';
import { ConsentModal } from './ConsentModal';

export const ConsentGate: React.FC = () => {
  const { shouldShowConsentModal, missingConsents, giveConsents, isLoading } = useConsent();

  if (isLoading) return null;
  if (!shouldShowConsentModal) return null;
  if (missingConsents.length === 0) return null;

  return (
    <ConsentModal
      isOpen
      missingConsents={missingConsents}
      onAccept={async (consents) => {
        await giveConsents(consents);
      }}
    />
  );
};

export default ConsentGate;
