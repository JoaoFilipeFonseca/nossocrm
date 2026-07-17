# Ligar pelo CRM com gravação Notta (iPhone)

**O que faz:** quando o João carrega em "Telefonar"/"Ligar" dentro do CRM no iPhone
(modal do negócio, ficha do contacto, lista de contactos ou Power List /hoje), o CRM
dispara o Atalho iOS **"Ligar CRM"**, que primeiro inicia a gravação na app Notta e
depois liga ao número. Chamadas feitas fora do CRM não passam por aqui e não gravam.

Fora do iPhone (PC/Android) o botão continua a ser um `tel:` normal.

## Criar o Atalho no iPhone (uma vez, ~2 minutos)

1. Abrir a app **Atalhos** (Shortcuts) no iPhone.
2. Tocar em **+** (novo atalho).
3. Tocar no nome no topo e renomear para exactamente: **Ligar CRM**
   (tem de ser este nome — é como o CRM o encontra).
4. Adicionar a 1.ª acção: pesquisar **Notta** → escolher a acção de
   **iniciar gravação** ("Start recording"/"Iniciar gravação").
   - Se não aparecer: abrir a app Notta uma vez, e em Definições do iPhone →
     Atalhos, confirmar que a Notta está autorizada.
5. Adicionar a 2.ª acção: pesquisar **Ligar** (Call/Phone) → escolher **Ligar**
   e no campo do número seleccionar a variável **Entrada do atalho** (Shortcut Input).
6. Nos detalhes do atalho (ícone ⓘ): activar **"Receber o que está no ecrã"** não é
   necessário; garantir que o tipo de entrada aceita **Texto**.
7. Guardar.

## Como usar no dia-a-dia

1. No CRM (Safari/atalho no ecrã), carregar em **Telefonar**.
2. O iOS pergunta "Abrir em Atalhos?" a primeira vez → **Abrir**.
3. A Notta começa a gravar e a chamada é marcada de seguida.
4. **Pôr a chamada em alta-voz** — a Notta grava pelo microfone; sem alta-voz só
   se ouve o lado do João.
5. No fim: parar a gravação na Notta. Para pôr no CRM: negócio → **Adicionar
   chamada** (upload do áudio; a IA transcreve, resume e regista) — ou guardar
   só o registo CHQ que o clique já criou.

## Notas legais e técnicas

- **Aviso de gravação:** em Portugal, gravar uma chamada exige o consentimento do
  interlocutor. Dizer no início: "esta chamada pode ser gravada para efeitos de
  acompanhamento, importa-se?".
- O iOS não deixa nenhuma app captar o áudio interno de uma chamada GSM — a Notta
  grava pelo **microfone** (daí a alta-voz). É a mesma limitação em todas as apps.
- O nome do Atalho vive em `lib/calls/index.ts` (`NOTTA_SHORTCUT_NAME`). Se um dia
  for renomeado no iPhone, tem de se actualizar lá também.
