// ============================================================================
// plugins/index.ts — barrel de todos os átomos disponíveis
// ============================================================================
// Sprint 1.3, commit 3 de 4.
//
// Cada átomo é re-exportado a partir do seu ficheiro. O registry itera sobre
// Object.values(plugins) e regista tudo o que tiver shape de AtomDefinition.
//
// Adicionar um átomo novo = (1) criar o ficheiro e (2) adicionar uma linha
// aqui. Sem necessidade de mexer em registry.ts.
//
// Convenção: o nome exportado é em camelCase, o id é o "{category}.{name}"
// dot-snake. Ex: actionSendTelegram -> 'action.send_telegram'.
// ============================================================================

export { triggerEvent } from './triggers/event';

export { actionLog } from './actions/log';
export { actionHttpRequest } from './actions/http-request';
export { actionSendTelegram } from './actions/send-telegram';

export { logicWaitFixed } from './logic/wait-fixed';
