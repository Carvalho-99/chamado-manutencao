// Notificação push para o celular do técnico.
//
// Como funciona: o navegador do técnico gera uma "inscrição" (um endereço secreto
// que o Google usa pra entregar mensagens naquele aparelho). Essa inscrição é
// guardada no Worker, que é quem dispara o push quando entra chamado novo.
//
// Por que a inscrição não fica no Firestore: ela só interessa a quem envia, e
// guardá-la junto do Worker significa que ela acompanha o sistema numa eventual
// migração — sem ninguém precisar reativar notificação no celular.

// Chave pública do par VAPID. Pode ser lida por qualquer um; é a metade privada,
// que vive só como segredo do Worker, que prova a origem do push.
const VAPID_PUBLICA = 'BGETvLQyilxoV8ynkRrlT9UT2SjHhjd8X5N9Fvbv_muuiwPjmRCurMGDWt3x6t8q3TdKlg7CIfaQl29ihgdukuM';

// Endereço do Worker que envia os pushes. Preenchido no deploy.
export const WORKER = 'https://chamados-push.chamados-push.workers.dev';

const b64urlParaBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bruto = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...bruto].map(c => c.charCodeAt(0)));
};

// 'sem-suporte'  -> WebView do APK, ou navegador antigo: não dá pra ativar aqui
// 'bloqueada'    -> a pessoa negou a permissão; só reverte nas config. do navegador
// 'ativa'        -> já está inscrita neste aparelho
// 'desligada'    -> dá pra ativar
export async function estadoNotificacao() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueada';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const inscricao = reg && await reg.pushManager.getSubscription();
    return inscricao ? 'ativa' : 'desligada';
  } catch (_) {
    return 'desligada';
  }
}

export async function ativarNotificacoes(tecnico) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este aparelho não suporta notificação aqui. Abra o sistema pelo Chrome e instale o aplicativo.');
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw new Error('Permissão de notificação negada. Libere nas configurações do navegador.');
  }

  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;

  // Se já existe inscrição neste aparelho, reaproveita em vez de criar outra.
  const inscricao = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({
    userVisibleOnly: true,                                   // exigido pelo Chrome
    applicationServerKey: b64urlParaBytes(VAPID_PUBLICA)
  });

  const resposta = await fetch(WORKER + '/inscrever', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inscricao: inscricao.toJSON(), tecnico: tecnico || '' })
  });
  if (!resposta.ok) throw new Error('Não foi possível registrar no servidor de notificação.');

  return true;
}

export async function desativarNotificacoes() {
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = reg && await reg.pushManager.getSubscription();
  if (!inscricao) return;
  await fetch(WORKER + '/cancelar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: inscricao.endpoint })
  }).catch(() => {});   // se o servidor não responder, desinscreve local mesmo assim
  await inscricao.unsubscribe();
}

// Chamado pela tela de abertura, logo depois que o chamado é gravado.
// Falha aqui nunca pode derrubar a abertura do chamado — o chamado já está salvo.
export async function avisarChamadoNovo(docId) {
  try {
    await fetch(WORKER + '/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
      keepalive: true          // o tablet desloga logo em seguida; garante o envio
    });
  } catch (e) {
    console.warn('Chamado salvo, mas o aviso de push falhou:', e);
  }
}
