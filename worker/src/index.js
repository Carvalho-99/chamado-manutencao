// Servidor do sistema de chamados de manutenção.
//
// Faz três coisas:
//   1. a API dos chamados (login, abrir, iniciar, finalizar, cancelar)
//   2. o tempo real, pras telas atualizarem sozinhas
//   3. o push no celular do técnico
//
// A mudança mais importante em relação ao que existia antes: o navegador não
// fala mais direto com o banco. Ele fala com este servidor, que confere QUEM
// está pedindo antes de entregar ou gravar qualquer coisa. É isso que acaba com
// o truque de pular a tela de login pelo F12 — a pessoa até faz o painel
// aparecer, mas ele vem vazio, porque os dados nunca são enviados.

import { buildPushPayload } from '@block65/webcrypto-web-push';
import { login, logout, sessaoDe, limparSessoesVencidas } from './auth.js';
import * as chamados from './chamados.js';

export { TempoReal } from './tempo-real.js';

const ORIGENS_PERMITIDAS = [
  'https://chamado-manutencao.web.app',
  'https://chamado-manutencao.firebaseapp.com',
  'https://chamados.forest.ind.br',
  'http://localhost:5000'
];

const cors = (origem) => ({
  'Access-Control-Allow-Origin': ORIGENS_PERMITIDAS.includes(origem) ? origem : ORIGENS_PERMITIDAS[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
});

const json = (dados, status, origem) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origem) }
  });

async function sha256hex(texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Tempo real: uma instância só, pra todas as telas caírem na mesma conversa.
// ---------------------------------------------------------------------------
function salaTempoReal(env) {
  return env.TEMPO_REAL.get(env.TEMPO_REAL.idFromName('chamados'));
}

async function avisarTelas(env, tipo, chamado) {
  try {
    await salaTempoReal(env).fetch('https://interno/avisar', {
      method: 'POST',
      body: JSON.stringify({ tipo, chamado })
    });
  } catch (e) {
    // Aviso é conforto, não correção: se falhar, o dado já está gravado e a
    // próxima carga da tela mostra tudo certo.
    console.warn('nao consegui avisar as telas:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Push (inalterado no comportamento; agora disparado de dentro, não pela tela)
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

async function avisarCelulares(env, chamado) {
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
      const r = await enviarPara(env, guardado.inscricao, mensagem);
      if (r.status === 404 || r.status === 410) {
        await env.INSCRICOES.delete(chave.name);   // aparelho sumiu
        removidos++;
      } else if (r.ok) enviados++;
      else { falhas++; console.warn('push recusado', r.status, guardado.tecnico); }
    } catch (e) {
      falhas++;
      console.error('erro no push para', guardado.tecnico, e.message);
    }
  }
  return { enviados, removidos, falhas };
}

// ---------------------------------------------------------------------------
// COMPATIBILIDADE — remover depois da virada.
//
// O site em produção ainda grava no Firestore e chama /notificar pra disparar o
// push. Enquanto a virada não acontece, essas duas funções mantêm aquilo vivo.
// Sem isso, publicar a API nova quebraria a notificação de quem está usando o
// sistema agora.
// ---------------------------------------------------------------------------
const JANELA_MS = 5 * 60 * 1000;

async function tokenFirebase(env) {
  const salvo = await env.INSCRICOES.get('auth:refresh');
  if (salvo) {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(salvo)}`
    });
    if (r.ok) return (await r.json()).id_token;
  }
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  if (!r.ok) throw new Error('nao consegui abrir sessao no Firebase');
  const d = await r.json();
  await env.INSCRICOES.put('auth:refresh', d.refreshToken);
  return d.idToken;
}

async function lerChamadoFirestore(env, docId) {
  const token = await tokenFirebase(env);
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.PROJETO_FIREBASE}` +
    `/databases/(default)/documents/chamados/${encodeURIComponent(docId)}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const campos = (await r.json()).fields || {};
  const txt = (c) => (campos[c] && campos[c].stringValue) || '';
  return {
    id: txt('id'), lider: txt('lider'), setor: txt('setor'), maquina: txt('maquina'),
    observacao: txt('observacao'), status: txt('status'), dataCriacao: txt('dataCriacao'),
    prioridade: Number((campos.prioridade && campos.prioridade.integerValue) || 0)
  };
}

// ---------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const origem = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const rota = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origem) });
    }

    // ---- tempo real: WebSocket, autenticado pela query (o navegador não
    //      deixa mandar cabeçalho em WebSocket) ----
    if (rota === '/api/tempo-real') {
      const token = url.searchParams.get('token') || '';
      const falso = new Request(request.url, { headers: { Authorization: 'Bearer ' + token } });
      if (!await sessaoDe(env, falso)) return new Response('não autorizado', { status: 401 });
      return salaTempoReal(env).fetch('https://interno/conectar', request);
    }

    // ---- rotas públicas (não expõem dado de chamado) ----
    if (rota === '/api/pessoas' && request.method === 'GET') {
      return json(await chamados.listarPessoas(env), 200, origem);
    }
    if (rota === '/api/pendentes' && request.method === 'GET') {
      return json(await chamados.contarPendentes(env), 200, origem);
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return json({ erro: 'método não suportado' }, 405, origem);
    }

    let corpo = {};
    if (request.method === 'POST') {
      try { corpo = await request.json(); }
      catch { return json({ erro: 'corpo inválido' }, 400, origem); }
    }

    // ---- login ----
    if (rota === '/api/login') {
      ctx.waitUntil(limparSessoesVencidas(env));
      const r = await login(env, corpo);
      return r.erro ? json(r, 401, origem) : json(r, 200, origem);
    }

    // ================= daqui pra baixo, exige sessão válida =================
    const sessao = await sessaoDe(env, request);
    const protegida = rota.startsWith('/api/') &&
                      !['/api/login', '/api/pessoas', '/api/pendentes'].includes(rota);
    if (protegida && !sessao) {
      return json({ erro: 'sessão expirada, entre de novo' }, 401, origem);
    }

    if (rota === '/api/logout') {
      await logout(env, sessao.token);
      return json({ ok: true }, 200, origem);
    }

    if (rota === '/api/eu') {
      return json({ nome: sessao.nome, papel: sessao.papel, externo: sessao.externo }, 200, origem);
    }

    if (rota === '/api/chamados' && request.method === 'GET') {
      return json({ chamados: await chamados.listar(env) }, 200, origem);
    }

    if (rota === '/api/chamados' && request.method === 'POST') {
      const r = await chamados.abrir(env, sessao, corpo);
      if (r.erro) return json(r, r.status || 400, origem);
      ctx.waitUntil(avisarTelas(env, 'aberto', r.chamado));
      ctx.waitUntil(avisarCelulares(env, r.chamado));   // push já sai daqui de dentro
      return json(r, 200, origem);
    }

    const acao = rota.match(/^\/api\/chamados\/(\d+)\/(iniciar|finalizar|cancelar)$/);
    if (acao && request.method === 'POST') {
      const numero = Number(acao[1]);
      const r = await chamados[acao[2]](env, sessao, numero, corpo);
      if (r.erro) return json(r, r.status || 400, origem);
      ctx.waitUntil(avisarTelas(env, acao[2], r.chamado));
      return json(r, 200, origem);
    }

    // ---- push: inscrição do aparelho ----
    if (rota === '/inscrever' && request.method === 'POST') {
      const { inscricao } = corpo;
      if (!inscricao || !inscricao.endpoint || !inscricao.keys) {
        return json({ erro: 'inscrição inválida' }, 400, origem);
      }
      await env.INSCRICOES.put('sub:' + await sha256hex(inscricao.endpoint), JSON.stringify({
        inscricao,
        tecnico: sessao ? sessao.nome : String(corpo.tecnico || '').slice(0, 80),
        criadaEm: new Date().toISOString()
      }));
      return json({ ok: true }, 200, origem);
    }

    if (rota === '/cancelar' && request.method === 'POST') {
      if (!corpo.endpoint) return json({ erro: 'endpoint faltando' }, 400, origem);
      await env.INSCRICOES.delete('sub:' + await sha256hex(corpo.endpoint));
      return json({ ok: true }, 200, origem);
    }

    // COMPATIBILIDADE: o site que ainda grava no Firestore chama esta rota.
    // Sai do ar junto com a virada.
    if (rota === '/notificar' && request.method === 'POST') {
      const docId = String(corpo.docId || '');
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(docId)) return json({ erro: 'docId inválido' }, 400, origem);
      if (await env.INSCRICOES.get('feito:' + docId)) return json({ ok: true, jaAvisado: true }, 200, origem);

      const c = await lerChamadoFirestore(env, docId);
      if (!c)                    return json({ erro: 'chamado não encontrado' }, 404, origem);
      if (c.status !== 'Aberto') return json({ erro: 'chamado não está aberto' }, 409, origem);
      const idade = Date.now() - Date.parse(c.dataCriacao || '');
      if (!(idade >= 0 && idade < JANELA_MS)) return json({ erro: 'chamado antigo demais' }, 409, origem);

      await env.INSCRICOES.put('feito:' + docId, '1', { expirationTtl: 86400 });
      return json({ ok: true, ...await avisarCelulares(env, c) }, 200, origem);
    }

    if (rota === '/testar' && request.method === 'POST') {
      const guardado = await env.INSCRICOES.get('sub:' + await sha256hex(String(corpo.endpoint || '')), 'json');
      if (!guardado) return json({ erro: 'aparelho não inscrito' }, 404, origem);
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
