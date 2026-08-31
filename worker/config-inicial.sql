-- Senhas compartilhadas. Saem do codigo-fonte das paginas e vem pra ca.
-- Guardadas como SHA256(PBKDF2), igual as senhas de pessoa.
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO configuracoes (chave, valor) VALUES ('senha_outros_lider', 'f0d8e3a318153df6c5470ed46ac71e90e911dc8c09bae3de225fa375586200a7')
  ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor;
INSERT INTO configuracoes (chave, valor) VALUES ('senha_outros_tecnico', '82d8f4a811b7b7ba2f62f323ed11d1e6cc39b274de155290fe50a26ff80c4cb1')
  ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor;
INSERT INTO configuracoes (chave, valor) VALUES ('senha_cancelar', 'b4deeb50c501f6c61b0e66679de81859bd9d474503fbdcb741bb46d03164fca3')
  ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor;
