-- Hellington Andrade, tecnico, cadastrado em 04/09/2026.
-- Guardamos SHA256(PBKDF2): o navegador calcula o PBKDF2 e o servidor
-- confere so o SHA-256 em cima, que e barato o bastante pro limite do Worker.
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico) VALUES ('HELLINGTON ANDRADE', '8d1609b22853af9cf4bf54f74eef021bf420c3dcb075a0d1b7e0d269f1127a03', 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash, eh_tecnico = 1, ativo = 1;
