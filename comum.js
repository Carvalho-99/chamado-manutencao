// Funções compartilhadas por todas as telas do sistema de chamados.
// Ficam num arquivo só de propósito: função de segurança duplicada em 5 lugares
// é exatamente como um dos cinco acaba ficando pra trás numa correção.

// ---------------------------------------------------------------------------
// Escape de HTML.
// Tudo que vem do banco passa por aqui antes de virar innerHTML. Sem isso, uma
// observação de chamado com "<img onerror=...>" executa código no painel e na TV.
// ---------------------------------------------------------------------------
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Nome já escapado, com o "(externo)" discreto.
export function fmtNome(nome) {
  if (!nome) return '—';
  const m = String(nome).match(/^(.*) \(externo\)$/i);
  return m
    ? `${esc(m[1])} <span style="color:var(--text3);font-weight:400">(externo)</span>`
    : esc(nome);
}

// ---------------------------------------------------------------------------
// Senhas.
//
// O que este hash resolve: o CPF das pessoas não fica mais legível no código-fonte
// da página. Antes bastava "ver código-fonte" pra levar 18 CPFs completos.
//
// O que ele NÃO resolve: a conferência continua acontecendo no navegador, então
// quem entende do assunto ainda consegue pular a tela de login mexendo no
// sessionStorage. Fechar isso de verdade exige Firebase Auth (validação no
// servidor). Enquanto isso, quem protege os DADOS é o firestore.rules.
// ---------------------------------------------------------------------------
const PBKDF2_ITERACOES = 200000;

export async function hashSenha(senha, rotulo) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    'raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode('chamado-manutencao|' + rotulo),
      iterations: PBKDF2_ITERACOES,
      hash: 'SHA-256'
    },
    chave, 256
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Comparação em tempo constante, pra não vazar o hash caractere a caractere.
export function hashConfere(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// Mês de referência no formato MM/AAAA.
export function mesAtual(d = new Date()) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Sanitiza um id que vai ser colocado dentro de um onclick="...('AQUI')".
// Atributo com JS dentro não pode usar esc(): o &#39; seria decodificado pelo
// parser de HTML antes do JS ver, e reabriria a fuga da string. Aqui a defesa
// é lista branca — id do Firestore é só letra e número mesmo.
export function idSeguro(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[^A-Za-z0-9_-]/g, '');
}

// Classe CSS da prioridade, sem deixar valor do banco virar nome de classe.
export function prioClasse(p) {
  return [1, 2, 3, 4].includes(Number(p)) ? 'p' + Number(p) : '';
}
