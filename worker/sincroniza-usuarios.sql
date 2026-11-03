-- 03/11/2026: o D1 passa a ser a fonte da verdade dos usuarios.
--
-- Ate aqui a lista vivia dentro das paginas e o D1 era uma copia que foi
-- ficando para tras. Este arquivo iguala o D1 ao que esta em producao HOJE e
-- marca quem administra.

-- Coluna nova. Quem tem eh_admin pode cadastrar e remover usuarios.
ALTER TABLE usuarios ADD COLUMN eh_admin INTEGER NOT NULL DEFAULT 0;

-- Desativa todo mundo; logo abaixo reativamos quem realmente esta no ar.
-- Desativar em vez de apagar preserva o nome no historico dos chamados.
--
-- So mexe em 'ativo': a tabela exige que todo usuario tenha ao menos um papel,
-- entao zerar eh_lider e eh_tecnico junto quebraria a restricao. Os papeis de
-- quem continua ativo sao corrigidos nos INSERTs abaixo.
UPDATE usuarios SET ativo = 0;

INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('ALESSANDRO RODRIGUES', '9f5ac9fd511cad43c4b565b34f4e92fc74a9191adb4cf77de2cf7bd46d78dfab', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('AMARILDO SILVA', 'a0bd4858999c66dddd72742ff1767254707278cd2bac74e231a8a299d80b9ab9', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('ANTONIO SANTOS', '2de8a3293995d99fad3fb0f5a4ad0df960d19cf2ee18800b50be81c4d5b55cf5', 1, 0, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('ARGEU CARVALHO', '9a2207e5ccf5c5363b5f5a442854f3588fa849b2aa32d4201ee3f72b405321c6', 1, 0, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('CLEYTON MOREIRA', '3fb4812c4a62a98be56520bfde7a94911cc215df5b1d509a5e2d641b77fc53fe', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('FERNANDO BETIM', 'd2b6f2d965f7de958e9ae3376bb6d8893fa732acae1009a48065b145136bb62d', 1, 0, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('JOSUEL OLIVEIRA', '9311d45383f036e259277d97778cfb8701dd7efe109dbd2f246bb68029bccedf', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('JOVENIL SILVA', 'dcfbb4d946c552896795dc05c1d8e80502d6c51a78162820313cd41e0cbb0094', 1, 0, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('KAUA PEDROSO', '6c9ca2fd48ac6b7e5c7224381b160eb066e0f21f08ff3c4b1189a71e5fe3eae1', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('MARCIO ALMEIDA', '481d6186ea08c377a0ba39987d6dd67002356a6dff2cc73b4caaa4a50e1bf76e', 1, 1, 1, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('MATHEUS OLIVEIRA', 'c9d2530e438c895f2c93ca06a1ff0c53b7a155e55956bc2da09547e08a9403c4', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('PAULO CUNHA', '09f92acba6d71def20bf0e23a14d99efdd5b2960fe5971d1148380356d49845a', 1, 0, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('PAULO HENRIQUE', '019720dadf48a300033730f6b963d658e9d782ae05244bd47f47e4a5f9b326f4', 1, 1, 1, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('RODRIGO FERREIRA', '1ab75d325a02f403f8cef2ace462f805392af0d54df6f70e9233c2a3a033de02', 1, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('SAMUEL LIMA', 'fc6fdb05dc2013bb915de9914f46d86fb961f8c88b08b44fceba30e138ae4878', 1, 0, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
INSERT INTO usuarios (nome, senha_hash, eh_lider, eh_tecnico, eh_admin, ativo)
  VALUES ('VITTOR LODONHO', '384c7b1ece3adb183aba6ea66f8ce57e1217608591c963b3aee4c3cfd666f7a3', 0, 1, 0, 1)
  ON CONFLICT(nome) DO UPDATE SET senha_hash = excluded.senha_hash,
    eh_lider = excluded.eh_lider, eh_tecnico = excluded.eh_tecnico,
    eh_admin = excluded.eh_admin, ativo = 1;
