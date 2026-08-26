// Carteiro de notificações do sistema de chamados.
//
// Ele existe por um motivo só: mandar push exige uma chave secreta, e chave
// secreta não pode morar no navegador (qualquer um leria o código-fonte e
// spammaria o time inteiro). Então o segredo mora aqui.
//
// Rotas:
//   POST /inscrever  { inscricao, tecnico }  -> guarda o aparelho do técnico
//   POST /cancelar   { endpoint }            -> esquece o aparelho
//   POST /notificar  { docId }               -> avisa todo mundo sobre um chamado
//
// O site fala com este Worker, mas os dados continuam todos no Firebase. Se um
// dia o sistema migrar pra Cloudflare, este arquivo não muda.

import { buildPushPayload } from '@block65/webcrypto-web-push';

const ORIGENS_PERMITIDAS = [
  'https://chamado-manutencao.web.app',
  'https://chamado-manutencao.firebaseapp.com',
  'https://chamados.forest.ind.br',
  'http://localhost:5000'
];

// Chamado só pode notificar se foi aberto agora. Sem isto, alguém poderia pegar
// o número de um chamado antigo e reenviar aviso quando quisesse.
const JANELA_MS = 5 * 60 * 1000;

const cabecalhosCors = (origem) => ({
  'Access-Control-Allow-Origin': ORIGENS_PERMITIDAS.includes(origem) ? origem : ORIGENS_PERMITIDAS[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
});

const json = (dados, status, origem) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json', ...cabecalhosCors(origem) }
  });

async function sha256hex(texto) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ---------------------------------------------------------------------------
// Sessão anônima no Firebase, pra conseguir ler o chamado e conferir se ele
// existe mesmo. Guardamos o refresh token, então só UM usuário anônimo é criado
// no projeto inteiro, em vez de um novo a cada notificação.
// ---------------------------------------------------------------------------
async function tokenFirebase(env) {
  const salvo = await env.INSCRICOES.get('auth:refresh');

  if (salvo) {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(salvo)}`
    });
    if (r.ok) return (await r.json()).id_token;
    // token revogado ou inválido: cai fora e cria sessão nova
  }

  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  if (!r.ok) throw new Error('nao consegui abrir sessao no Firebase');
  const d = await r.json();
  await env.INSCRICOES.put('auth:refresh', d.refreshToken);
  return d.idToken;
}

async function lerChamado(env, docId) {
  const token = await tokenFirebase(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJETO_FIREBASE}` +
              `/databases/(default)/documents/chamados/${encodeURIComponent(docId)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const campos = (await r.json()).fields || {};
  const txt = (c) => (campos[c] && campos[c].stringValue) || '';
  return {
    id: txt('id'),
    lider: txt('lider'),
    setor: txt('setor'),
    maquina: txt('maquina'),
    observacao: txt('observacao'),
    status: txt('status'),
    dataCriacao: txt('dataCriacao'),
    prioridade: Number((campos.prioridade && campos.prioridade.integerValue) || 0)
  };
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------
const ROTULO_PRIORIDADE = { 1: '🔴 URGENTE', 2: '🟡 Crítico', 3: '🟢 Funcionando' };

async function enviarPara(env, inscricao, mensagem) {
  const payload = await buildPushPayload(mensagem, inscricao, {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLICA,
    privateKey: env.VAPID_PRIVADA
  });
  return fetch(inscricao.endpoint, payload);
}

async function dispararParaTodos(env, chamado) {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLICA,
    privateKey: env.VAPID_PRIVADA
  };

  const urgente = chamado.prioridade === 1;
  const mensagem = {
    data: {
      titulo: `${ROTULO_PRIORIDADE[chamado.prioridade] || 'Chamado'} · ${chamado.maquina}`,
      corpo: `${chamado.setor} — ${chamado.observacao}`.slice(0, 160) + `\nAberto por ${chamado.lider}`,
      id: chamado.id,
      prioridade: chamado.prioridade,
      url: './login.html'
    },
    options: { ttl: 6 * 60 * 60, urgency: urgente ? 'high' : 'normal' }
  };

  const lista = await env.INSCRICOES.list({ prefix: 'sub:' });
  let enviados = 0, removidos = 0, falhas = 0;

  for (const chave of lista.keys) {
    const guardado = await env.INSCRICOES.get(chave.name, 'json');
    if (!guardado) continue;
    try {
      const payload = await buildPushPayload(mensagem, guardado.inscricao, vapid);
      const r = await fetch(guardado.inscricao.endpoint, payload);
      if (r.status === 404 || r.status === 410) {
        // O aparelho desinstalou o app ou limpou os dados: some com a inscricao
        // pra nao ficar tentando pra sempre.
        await env.INSCRICOES.delete(chave.name);
        removidos++;
      } else if (r.ok) {
        enviados++;
      } else {
        falhas++;
        console.warn('push recusado', r.status, guardado.tecnico);
      }
    } catch (e) {
      falhas++;
      console.error('erro no push para', guardado.tecnico, e.message);
    }
  }
  return { enviados, removidos, falhas };
}

// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const origem = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
    }
    if (request.method !== 'POST') {
      return json({ erro: 'use POST' }, 405, origem);
    }

    let corpo;
    try { corpo = await request.json(); }
    catch { return json({ erro: 'corpo invalido' }, 400, origem); }

    // ---- guarda o aparelho de um tecnico ----
    if (url.pathname === '/inscrever') {
      const { inscricao, tecnico } = corpo;
      if (!inscricao || !inscricao.endpoint || !inscricao.keys) {
        return json({ erro: 'inscricao invalida' }, 400, origem);
      }
      const chave = 'sub:' + await sha256hex(inscricao.endpoint);
      await env.INSCRICOES.put(chave, JSON.stringify({
        inscricao,
        tecnico: String(tecnico || '').slice(0, 80),
        criadaEm: new Date().toISOString()
      }));
      return json({ ok: true }, 200, origem);
    }

    // ---- esquece o aparelho ----
    if (url.pathname === '/cancelar') {
      if (!corpo.endpoint) return json({ erro: 'endpoint faltando' }, 400, origem);
      await env.INSCRICOES.delete('sub:' + await sha256hex(corpo.endpoint));
      return json({ ok: true }, 200, origem);
    }

    // ---- avisa todo mundo sobre um chamado ----
    if (url.pathname === '/notificar') {
      const docId = String(corpo.docId || '');
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(docId)) {
        return json({ erro: 'docId invalido' }, 400, origem);
      }

      // Ja avisamos sobre este chamado? Evita push duplicado se a tela reenviar.
      if (await env.INSCRICOES.get('feito:' + docId)) {
        return json({ ok: true, jaAvisado: true }, 200, origem);
      }

      // A checagem que impede alguem de spammar o time com chamados inventados:
      // o chamado precisa existir de verdade, estar Aberto, e ser recem-criado.
      const chamado = await lerChamado(env, docId);
      if (!chamado)                     return json({ erro: 'chamado nao encontrado' }, 404, origem);
      if (chamado.status !== 'Aberto')  return json({ erro: 'chamado nao esta aberto' }, 409, origem);

      const idade = Date.now() - Date.parse(chamado.dataCriacao || '');
      if (!(idade >= 0 && idade < JANELA_MS)) {
        return json({ erro: 'chamado antigo demais para notificar' }, 409, origem);
      }

      await env.INSCRICOES.put('feito:' + docId, '1', { expirationTtl: 86400 });
      const resultado = await dispararParaTodos(env, chamado);
      console.log('notificado', chamado.id, JSON.stringify(resultado));
      return json({ ok: true, ...resultado }, 200, origem);
    }

    // Manda uma notificacao de teste APENAS pro aparelho que pediu.
    // Serve pra pessoa confirmar na hora que a ativacao funcionou, sem precisar
    // abrir um chamado de verdade so pra testar. Nao faz fan-out pro time.
    if (url.pathname === '/testar') {
      const chave = 'sub:' + await sha256hex(String(corpo.endpoint || ''));
      const guardado = await env.INSCRICOES.get(chave, 'json');
      if (!guardado) return json({ erro: 'aparelho nao inscrito' }, 404, origem);
      try {
        const r = await enviarPara(env, guardado.inscricao, {
          data: {
            titulo: '✅ Avisos ligados',
            corpo: 'É assim que você vai ser avisado quando abrir um chamado.',
            id: 'teste', prioridade: 3, url: './login.html'
          },
          options: { ttl: 60, urgency: 'high' }
        });
        return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502, origem);
      } catch (e) {
        return json({ erro: e.message }, 500, origem);
      }
    }

    return json({ erro: 'rota desconhecida' }, 404, origem);
  }
};
