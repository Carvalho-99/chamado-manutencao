// Autenticação.
//
// A diferença central em relação ao que existia antes: a conferência acontece
// AQUI, no servidor. Antes ela acontecia no navegador da pessoa, e por isso dava
// pra pular a tela de login escrevendo uma linha no console (F12). Agora o token
// de sessão é sorteado pelo servidor e guardado no banco — não tem como forjar,
// porque quem inventar um token qualquer simplesmente não vai achar par no banco.
//
// Sobre o cálculo da senha: o navegador faz as 200 mil iterações do PBKDF2 (caro,
// mas roda no celular da pessoa) e manda o resultado. Aqui a gente só confere um
// SHA-256 em cima disso — microssegundos, cabe folgado no limite de CPU do Worker.
// Fazer as 200 mil iterações aqui estouraria o limite e o login não funcionaria.

const HORAS = 60 * 60 * 1000;

// Sessão curta nos dois papéis, de propósito.
//
// Cheguei a propor deixar o técnico logado por semanas, pra ele tocar na
// notificação e já cair dentro do chamado. O Bruno vetou: na Forest, logar a
// cada ação é decisão de segurança — os aparelhos são compartilhados e cada
// início e cada finalização precisa ser atribuível a uma pessoa de verdade.
//
// Isto aqui é só a rede de segurança do servidor. Quem manda no dia a dia é o
// navegador, que descarta o token ao fechar o app (sessionStorage), exatamente
// como o sistema se comporta hoje.
const VALIDADE = { tecnico: 12 * HORAS, lider: 12 * HORAS };

export async function sha256hex(texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Comparação em tempo constante: não vaza o hash caractere a caractere.
export function confere(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function novoToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function lerConfig(env, chave) {
  const r = await env.DB.prepare('SELECT valor FROM configuracoes WHERE chave = ?').bind(chave).first();
  return r ? r.valor : null;
}

async function criarSessao(env, nome, papel, externo) {
  const token = novoToken();
  const agora = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessoes (token, nome, papel, externo, criada_em, expira_em) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    token, nome, papel, externo ? 1 : 0,
    new Date(agora).toISOString(),
    new Date(agora + VALIDADE[papel]).toISOString()
  ).run();
  return { token, nome, papel, externo: !!externo };
}

/**
 * corpo: { papel: 'lider'|'tecnico', nome, senhaHash, nomeExterno? }
 * senhaHash é o PBKDF2 já calculado pelo navegador — a senha em si nunca chega aqui.
 */
export async function login(env, corpo) {
  const papel = corpo.papel === 'lider' ? 'lider' : 'tecnico';
  const senhaHash = String(corpo.senhaHash || '');
  if (!/^[0-9a-f]{64}$/.test(senhaHash)) return { erro: 'senha inválida' };

  const recebido = await sha256hex(senhaHash);

  // ---- caminho "Outros": pessoa de fora, senha compartilhada ----
  if (corpo.nome === 'Outros') {
    const nome = String(corpo.nomeExterno || '').trim().toUpperCase().slice(0, 60);
    if (!nome) return { erro: 'informe seu nome' };

    // Impede alguém entrar por "Outros" usando o nome de quem já é cadastrado.
    const existe = await env.DB.prepare(
      'SELECT 1 FROM usuarios WHERE upper(nome) = ? AND ativo = 1'
    ).bind(nome).first();
    if (existe) return { erro: 'Esse nome já está cadastrado — selecione ele na lista e entre com a senha dele.' };

    const esperado = await lerConfig(env, papel === 'lider' ? 'senha_outros_lider' : 'senha_outros_tecnico');
    if (!esperado || !confere(recebido, esperado)) return { erro: 'senha incorreta' };
    return criarSessao(env, nome + ' (externo)', papel, true);
  }

  // ---- pessoa cadastrada ----
  const coluna = papel === 'lider' ? 'eh_lider' : 'eh_tecnico';
  const u = await env.DB.prepare(
    `SELECT nome, senha_hash FROM usuarios WHERE nome = ? AND ${coluna} = 1 AND ativo = 1`
  ).bind(String(corpo.nome || '')).first();

  // Mesmo erro pra usuário inexistente e senha errada: não entrega quem existe.
  if (!u || !confere(recebido, u.senha_hash)) return { erro: 'usuário ou senha incorretos' };

  return criarSessao(env, u.nome, papel, false);
}

/** Devolve a sessão de quem chamou, ou null. É o portão de tudo que é protegido. */
export async function sessaoDe(env, request) {
  const cab = request.headers.get('Authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7).trim() : '';
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const s = await env.DB.prepare(
    'SELECT nome, papel, externo, expira_em FROM sessoes WHERE token = ?'
  ).bind(token).first();
  if (!s) return null;

  if (Date.parse(s.expira_em) < Date.now()) {
    await env.DB.prepare('DELETE FROM sessoes WHERE token = ?').bind(token).run();
    return null;
  }
  return { nome: s.nome, papel: s.papel, externo: !!s.externo, token };
}

export async function logout(env, token) {
  if (/^[0-9a-f]{64}$/.test(token || '')) {
    await env.DB.prepare('DELETE FROM sessoes WHERE token = ?').bind(token).run();
  }
}

/** Sessões vencidas não se apagam sozinhas; limpamos de carona nos logins. */
export async function limparSessoesVencidas(env) {
  await env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?')
    .bind(new Date().toISOString()).run();
}
