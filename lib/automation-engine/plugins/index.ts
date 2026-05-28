// ============================================================================
// plugins/index.ts — barrel de todos os átomos disponíveis
// ============================================================================
// Sprint 3.0: adiciona modify_contact, modify_deal, create_task, condition.
// ============================================================================

export { triggerEvent } from './triggers/event';
export { triggerSchedule } from './triggers/schedule';

export { actionLog } from './actions/log';
export { actionHttpRequest } from './actions/http-request';
export { actionSendTelegram } from './actions/send-telegram';
export { actionSendWhatsapp } from './actions/send-whatsapp';
export { actionSendEmail } from './actions/send-email';
export { actionModifyContact } from './actions/modify-contact';
export { actionModifyDeal } from './actions/modify-deal';
export { actionCreateTask } from './actions/create-task';
export { actionRunAi } from './actions/run-ai';

export { logicWaitFixed } from './logic/wait-fixed';
export { logicWaitUntil } from './logic/wait-until';
export { logicCondition } from './logic/condition';
export { logicHumanApproval } from './logic/human-approval';
