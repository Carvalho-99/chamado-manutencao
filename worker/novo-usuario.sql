-- Rodrigo Ferreira, gerente da fabrica, cadastrado em 09/09/2026.
-- Recebe os DOIS papeis: abre chamado como lider e acompanha como tecnico,
-- igual PAULO HENRIQUE e MARCIO ALMEIDA.
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico) VALUES ('RODRIGO FERREIRA', '1ab75d325a02f403f8cef2ace462f805392af0d54df6f70e9233c2a3a033de02', 1, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash, eh_lider = 1, eh_tecnico = 1, ativo = 1;
