// Operações de chamado.
//
// O que aqui dentro repete o que o firestore.rules fazia antes: só as transições
// de status previstas passam, os campos do chamado aberto não podem ser
// reescritos, e chamado não se apaga — cancelar vira status.
//
// A diferença é que agora quem valida é o servidor, sabendo QUEM está pedindo.
// Antes a regra só conseguia perguntar "tem sessão?"; agora ela sabe o nome.

import { sha256hex, confere, lerConfig } from './auth.js';

const SETORES = new Set([
  'CORTE', 'REBOBINAGEM', 'EMBALAGEM AUTOMÁTICA', 'EMBALAGEM MANUAL', 'COLAGEM',
  'PRENSAGEM', 'MANUTENÇÃO', 'ALMOXARIFADO', 'EMPILHADEIRAS', 'ÁREAS GERAIS'
]);
const TIPOS = new Set(['Mecânica', 'Elétrica', 'Não sei']);

const texto = (v, max) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

function mesDe(d = new Date()) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// O formato #0001 é só apresentação; no banco o número é inteiro de verdade.
export const formatarId = (n) => '#' + String(n).padStart(4, '0');

function paraTela(r) {
  return {
    docId: String(r.id),
    id: formatarId(r.id),
    numero: r.id,
    lider: r.lider,
    setor: r.setor,
    maquina: r.maquina,
    tipoProblema: r.tipo_problema,
    observacao: r.observacao,
    prioridade: r.prioridade,
    status: r.status,
    mes: r.mes,
    dataCriacao: r.data_criacao,
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
    dataCancelamento: r.data_cancelamento,
    tecnicoInicio: r.tecnico_inicio,
    tecnicoFim: r.tecnico_fim,
    canceladoPor: r.cancelado_por,
    solucao: r.solucao
  };
}

export async function listar(env) {
  const { results } = await env.DB.prepare('SELECT * FROM chamados ORDER BY id ASC').all();
  return results.map(paraTela);
}

export async function contarPendentes(env) {
  const r = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'Aberto'       THEN 1 ELSE 0 END) AS abertos,
       SUM(CASE WHEN status = 'Em andamento' THEN 1 ELSE 0 END) AS andamento
     FROM chamados`
  ).first();
  return { abertos: r?.abertos || 0, andamento: r?.andamento || 0 };
}

export async function abrir(env, sessao, corpo) {
  if (sessao.papel !== 'lider') return { erro: 'só líder abre chamado', status: 403 };

  const setor      = texto(corpo.setor, 60);
  const maquina    = texto(corpo.maquina, 80);
  const tipo       = texto(corpo.tipoProblema, 20);
  const observacao = texto(corpo.observacao, 1000);
  const prioridade = Number(corpo.prioridade);

  if (!SETORES.has(setor))      return { erro: 'setor inválido', status: 400 };
  if (!maquina)                 return { erro: 'informe a máquina', status: 400 };
  if (!TIPOS.has(tipo))         return { erro: 'tipo de problema inválido', status: 400 };
  if (!observacao)              return { erro: 'descreva o problema', status: 400 };
  if (![1, 2, 3].includes(prioridade)) return { erro: 'prioridade inválida', status: 400 };

  const agora = new Date().toISOString();

  // O nome de quem abriu vem da SESSÃO, nunca do que o navegador mandou.
  // É isso que impede alguém abrir chamado no nome de outra pessoa.
  const r = await env.DB.prepare(
    `INSERT INTO chamados (lider, setor, maquina, tipo_problema, observacao, prioridade,
                           status, mes, data_criacao, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, 'Aberto', ?, ?, ?)
     RETURNING *`
  ).bind(sessao.nome, setor, maquina, tipo, observacao, prioridade, mesDe(), agora, agora).first();

  return { chamado: paraTela(r) };
}

export async function iniciar(env, sessao, numero) {
  if (sessao.papel !== 'tecnico') return { erro: 'só técnico inicia chamado', status: 403 };

  // O WHERE com o status é a trava da transição: se o chamado já saiu de
  // "Aberto", nenhuma linha é afetada e a gente devolve conflito.
  const r = await env.DB.prepare(
    `UPDATE chamados SET status = 'Em andamento', data_inicio = ?, tecnico_inicio = ?
     WHERE id = ? AND status = 'Aberto' RETURNING *`
  ).bind(new Date().toISOString(), sessao.nome, numero).first();

  if (!r) return { erro: 'esse chamado já foi iniciado por outra pessoa', status: 409 };
  return { chamado: paraTela(r) };
}

export async function finalizar(env, sessao, numero, corpo) {
  if (sessao.papel !== 'tecnico') return { erro: 'só técnico finaliza chamado', status: 403 };

  const solucao = texto(corpo.solucao, 1000);
  if (!solucao) return { erro: 'descreva o que foi feito', status: 400 };

  const r = await env.DB.prepare(
    `UPDATE chamados SET status = 'Finalizado', data_fim = ?, tecnico_fim = ?, solucao = ?
     WHERE id = ? AND status = 'Em andamento' RETURNING *`
  ).bind(new Date().toISOString(), sessao.nome, solucao, numero).first();

  if (!r) return { erro: 'esse chamado não está em andamento', status: 409 };
  return { chamado: paraTela(r) };
}

export async function cancelar(env, sessao, numero, corpo) {
  if (sessao.papel !== 'tecnico') return { erro: 'só técnico cancela chamado', status: 403 };

  const senhaHash = String(corpo.senhaHash || '');
  if (!/^[0-9a-f]{64}$/.test(senhaHash)) return { erro: 'senha inválida', status: 400 };

  const esperado = await lerConfig(env, 'senha_cancelar');
  if (!esperado || !confere(await sha256hex(senhaHash), esperado)) {
    return { erro: 'senha de cancelamento incorreta', status: 403 };
  }

  // Cancelar marca, não apaga: quem cancelou e quando ficam registrados, e o
  // número do chamado continua existindo no histórico.
  const r = await env.DB.prepare(
    `UPDATE chamados SET status = 'Cancelado', data_cancelamento = ?, cancelado_por = ?
     WHERE id = ? AND status IN ('Aberto','Em andamento') RETURNING *`
  ).bind(new Date().toISOString(), sessao.nome, numero).first();

  if (!r) return { erro: 'esse chamado já foi encerrado', status: 409 };
  return { chamado: paraTela(r) };
}

/** Nomes pros <select> das telas de login — não expõe senha nenhuma. */
export async function listarPessoas(env) {
  const { results } = await env.DB.prepare(
    'SELECT nome, eh_lider, eh_tecnico FROM usuarios WHERE ativo = 1 ORDER BY nome'
  ).all();
  return {
    lideres:  results.filter(u => u.eh_lider).map(u => u.nome),
    tecnicos: results.filter(u => u.eh_tecnico).map(u => u.nome)
  };
}
