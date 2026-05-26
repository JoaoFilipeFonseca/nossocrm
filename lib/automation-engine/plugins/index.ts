// ============================================================================
// plugins/index.ts — barrel de todos os átomos disponíveis
// ============================================================================
// Sprint 3.0: adiciona modify_contact, modify_deal, create_task, condition.
// ============================================================================

export { triggerEvent } from './triggers/event';

export { actionLog } from './actions/log';
export { actionHttpRequest } from './actions/http-request';
export { actionSendTelegram } from './actions/send-telegram';
export { actionModifyContact } from './actions/modify-contact';
export { actionModifyDeal } from './actions/modify-deal';
export { actionCreateTask } from './actions/create-task';

export { logicWaitFixed } from './logic/wait-fixed';
export { logicCondition } from './logic/condition';
