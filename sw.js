// Service worker do sistema de chamados.
//
// A única função dele é receber notificação push e mostrar na tela — é o pedaço
// que o Android mantém vivo depois que o técnico fecha o app.
//
// De propósito ele NÃO guarda página nenhuma em cache. Cache de HTML num sistema
// que muda de estado o tempo todo é fábrica de bug: o técnico veria um chamado
// que já foi finalizado. Aqui é push e só.

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

const ICONE = './icone-192.png';

self.addEventListener('push', (evento) => {
  let d = {};
  try { d = evento.data ? evento.data.json() : {}; } catch (_) { d = {}; }

  const urgente = Number(d.prioridade) === 1;
  const titulo  = d.titulo || 'Novo chamado de manutenção';
  const corpo   = d.corpo  || 'Toque para abrir o painel.';

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: ICONE,
      badge: ICONE,
      // Urgente vibra mais forte e mais tempo, pra dar pra sentir no bolso.
      vibrate: urgente ? [300, 100, 300, 100, 300] : [200, 100, 200],
      // Urgente fica na tela até alguém tocar; o resto some sozinho.
      requireInteraction: urgente,
      // Uma tag por chamado: se o mesmo push chegar duas vezes, o Android
      // substitui em vez de empilhar duas notificações iguais.
      tag: d.id ? 'chamado-' + d.id : 'chamado',
      renotify: true,
      data: { url: d.url || './login.html' }
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || './login.html';

  evento.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Se o painel já estiver aberto, traz ele pra frente em vez de abrir outro.
    for (const janela of abertas) {
      if (janela.url.includes('/admin.html') || janela.url.includes('/login.html')) {
        return janela.focus();
      }
    }
    return self.clients.openWindow(destino);
  })());
});
