// Gerenciamento de usuários — a parte que o Paulo Henrique e o Marcio usam.
//
// Por que isto existe no servidor e não na tela: até aqui a lista de quem pode
// entrar morava dentro das páginas, então só dava pra mudar republicando o
// site. Para alguém cadastrar pelo navegador, a lista precisa viver num lugar
// que aceite ordens — e que saiba conferir QUEM está mandando antes de obedecer.

import { sha256hex } from './auth.js';

/**
 * Confere o dígito verificador do CPF.
 *
 * A senha de todo mundo é o CPF, por decisão da Forest. Validar aqui no
 * servidor, e não só na tela, é o que garante que ninguém cadastre com uma
 * senha inventada burlando o formulário.
 *
 * Também pega erro de digitação: foi assim que apareceu o CPF errado do
 * Fernando Betim, que simplesmente não conseguia entrar.
 */
export function cpfValido(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  for (const ate of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += n[i] * (ate + 1 - i);
    let dig = (soma * 10) % 11;
    if (dig === 10) dig = 0;
    if (dig !== n[ate]) return false;
  }
  return true;
}

const nomeLimpo = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 60);

/** Lista completa, só para administrador. Não devolve senha. */
export async function listar(env) {
  const { results } = await env.DB.prepare(
    `SELECT nome, eh_lider, eh_tecnico, eh_admin, ativo
       FROM usuarios ORDER BY ativo DESC, nome`
  ).all();
  return results.map(u => ({
    nome: u.nome,
    lider: !!u.eh_lider,
    tecnico: !!u.eh_tecnico,
    admin: !!u.eh_admin,
    ativo: !!u.ativo
  }));
}

/**
 * Cadastra ou atualiza.
 *
 * O navegador manda o CPF e também o hash já calculado. O CPF serve só para a
 * conferência do dígito e é descartado — as 200 mil iterações do cálculo são
 * caras demais para rodar aqui dentro e estourariam o limite de CPU do Worker.
 *
 * O que chega é o PBKDF2; o que o banco guarda é um SHA-256 em cima dele, que é
 * o que o login confere. Gravar o PBKDF2 cru faria o cadastro "funcionar" e a
 * pessoa não conseguir entrar depois — foi exatamente o que o teste pegou.
 */
export async function salvar(env, sessao, corpo) {
  const nome = nomeLimpo(corpo.nome);
  const cpf = String(corpo.cpf || '').replace(/\D/g, '');
  const hash = String(corpo.senhaHash || '');
  const lider = corpo.lider ? 1 : 0;
  const tecnico = corpo.tecnico ? 1 : 0;
  const admin = corpo.admin ? 1 : 0;

  if (nome.length < 3)        return { erro: 'informe o nome completo', status: 400 };
  if (!/^[A-ZÀ-Ú ]+$/.test(nome)) return { erro: 'o nome deve ter só letras', status: 400 };
  if (!lider && !tecnico)     return { erro: 'marque se é líder, técnico ou os dois', status: 400 };
  if (!cpfValido(cpf))        return { erro: 'CPF inválido — confira os números', status: 400 };
  if (!/^[0-9a-f]{64}$/.test(hash)) return { erro: 'senha mal formada', status: 400 };

  const jaExiste = await env.DB.prepare('SELECT nome FROM usuarios WHERE nome = ?').bind(nome).first();

  const guardado = await sha256hex(hash);

  await env.DB.prepare(
    `INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
     VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(nome) DO UPDATE SET
       senha_hash = excluded.senha_hash, eh_lider = excluded.eh_lider,
       eh_tecnico = excluded.eh_tecnico, eh_admin = excluded.eh_admin, ativo = 1`
  ).bind(nome, guardado, lider, tecnico, admin).run();

  console.log('usuario', jaExiste ? 'atualizado' : 'cadastrado', ':', nome, 'por', sessao.nome);
  return { ok: true, nome, novo: !jaExiste };
}

/**
 * Tira o acesso.
 *
 * Desativa em vez de apagar: o nome da pessoa aparece nos chamados que ela
 * atendeu, e apagar a linha deixaria esse histórico apontando para alguém que
 * não existe mais. Tirar o acesso é o pedido; apagar o rastro não.
 */
export async function remover(env, sessao, corpo) {
  const nome = nomeLimpo(corpo.nome);

  // Duas travas contra o administrador se trancar do lado de fora.
  if (nome === sessao.nome) {
    return { erro: 'você não pode remover o seu próprio acesso', status: 400 };
  }
  const u = await env.DB.prepare('SELECT eh_admin, ativo FROM usuarios WHERE nome = ?').bind(nome).first();
  if (!u || !u.ativo) return { erro: 'usuário não encontrado', status: 404 };

  if (u.eh_admin) {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE eh_admin = 1 AND ativo = 1').first();
    if ((r?.n || 0) <= 1) {
      return { erro: 'não dá para remover o último administrador — alguém precisa poder gerenciar usuários', status: 409 };
    }
  }

  await env.DB.prepare('UPDATE usuarios SET ativo = 0 WHERE nome = ?').bind(nome).run();
  // As sessões abertas dessa pessoa morrem junto, senão ela continuaria dentro
  // do sistema até o token vencer.
  await env.DB.prepare('DELETE FROM sessoes WHERE nome = ?').bind(nome).run();

  console.log('acesso removido:', nome, 'por', sessao.nome);
  return { ok: true, nome };
}
