-- 20/10/2026: Hellington sai (e mecanico, nao da equipe de manutencao),
-- Kaua Pedroso entra como tecnico.
--
-- Hellington e DESATIVADO, nao apagado: ele atendeu 12 chamados e o nome
-- dele aparece no historico. Apagar a linha deixaria o historico orfao.
UPDATE usuarios SET ativo = 0 WHERE nome = 'HELLINGTON ANDRADE';

INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico) VALUES ('KAUA PEDROSO', '6c9ca2fd48ac6b7e5c7224381b160eb066e0f21f08ff3c4b1189a71e5fe3eae1', 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash, eh_tecnico = 1, ativo = 1;
