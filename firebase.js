// Conexão com o Firebase, num lugar só.
//
// Além de tirar a configuração repetida de 4 arquivos, este módulo garante uma
// coisa que as regras passaram a exigir: NENHUMA leitura ou escrita no Firestore
// acontece antes da sessão anônima estar pronta.
//
// Por que sessão anônima: sem ela, a chave de API que qualquer um lê no
// código-fonte bastava pra baixar todos os chamados com um comando de terminal.
// Ela não identifica a pessoa — quem quiser ainda consegue uma sessão dessas —
// mas obriga a passar pelo fluxo do Firebase em vez de raspar o banco direto.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyCPiAWJ5q8FqVTqJ8NUgyFYqUtktqMmt94",
  authDomain: "chamado-manutencao.firebaseapp.com",
  projectId: "chamado-manutencao",
  storageBucket: "chamado-manutencao.firebasestorage.app",
  messagingSenderId: "329198000958",
  appId: "1:329198000958:web:05c31243c0ecb11c25ea6f"
});

export const db = getFirestore(app);

// Espere por isto antes de tocar no Firestore.
// Sem top-level await de propósito: WebView antigo de tablet pode não suportar,
// e um erro de sintaxe derrubaria a página inteira em vez de só o login.
export const pronto = signInAnonymously(getAuth(app))
  .then(() => true)
  .catch((e) => {
    console.error('Falha ao abrir sessão com o Firebase:', e);
    return false;
  });
