// Tempo real.
//
// É o que substitui o onSnapshot do Firestore: o painel e a TV continuam
// atualizando sozinhos, sem ninguém apertar nada.
//
// Como funciona: cada tela abre um WebSocket com este Durable Object e fica
// escutando. Quando um chamado é aberto, iniciado, finalizado ou cancelado, a
// API avisa aqui e a mensagem é repassada pra todo mundo conectado.
//
// Existe UMA instância só deste objeto (nome fixo "chamados"), que é o que
// permite as telas conversarem entre si — é justamente pra isso que Durable
// Objects existem, ao contrário de um Worker comum, que não guarda estado.

export class TempoReal {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // ---- uma tela quer escutar ----
    if (url.pathname === '/conectar') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('esperava websocket', { status: 426 });
      }
      const par = new WebSocketPair();

      // acceptWebSocket (em vez de accept) liga a hibernação: o objeto pode
      // dormir enquanto ninguém fala, sem derrubar as conexões. É o que deixa
      // a TV ficar ligada o dia inteiro sem custo.
      this.state.acceptWebSocket(par[1]);

      return new Response(null, { status: 101, webSocket: par[0] });
    }

    // ---- a API avisa que algo mudou ----
    if (url.pathname === '/avisar') {
      const mensagem = await request.text();
      let entregues = 0;
      for (const ws of this.state.getWebSockets()) {
        try { ws.send(mensagem); entregues++; }
        catch { /* conexão morta; o runtime limpa sozinho */ }
      }
      return Response.json({ entregues });
    }

    return new Response('rota desconhecida', { status: 404 });
  }

  // A tela manda "ping" de vez em quando pra provar que continua viva.
  webSocketMessage(ws, msg) {
    if (msg === 'ping') ws.send('pong');
  }

  webSocketClose(ws, codigo, motivo, limpo) {
    // Nada a fazer: a hibernação já tira a conexão da lista.
  }

  webSocketError() {}
}
