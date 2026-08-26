#!/usr/bin/env node
//
// Gera o hash de senha usado nas telas de login.
//
// Uso:
//   node ferramentas/gerar-hash.js "NOME DA PESSOA" 00000000000
//
// Cole a linha impressa dentro da tabela USUARIOS do login correspondente
// (login-lider.html para líderes, login.html para técnicos) e lembre de
// adicionar também um <option> com o nome no <select> da mesma página.
//
// O nome é usado como tempero do hash, então precisa ser EXATAMENTE igual
// nos dois lugares — inclusive acentos e maiúsculas.

const crypto = require('crypto');

const [, , nome, senha] = process.argv;

if (!nome || !senha) {
  console.error('uso: node ferramentas/gerar-hash.js "NOME DA PESSOA" senha');
  process.exit(1);
}

const hash = crypto
  .pbkdf2Sync(senha, 'chamado-manutencao|' + nome, 200000, 32, 'sha256')
  .toString('hex');

console.log(`    '${nome}': '${hash}',`);
