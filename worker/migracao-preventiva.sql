-- Abre a prioridade 4 (manutenção preventiva) no banco novo.
--
-- O SQLite não permite alterar um CHECK depois da tabela criada, então o jeito
-- é recriar: tabela nova com a restrição certa, copia os dados, troca o nome.
-- Seguro de fazer agora porque o D1 ainda não está em produção — o sistema vivo
-- continua no Firebase.
--
-- O AUTOINCREMENT se reposiciona sozinho ao copiar as linhas com id explícito,
-- então a numeração continua de onde parou.

CREATE TABLE chamados_novo (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  lider             TEXT    NOT NULL CHECK (length(lider)         BETWEEN 1 AND 80),
  setor             TEXT    NOT NULL CHECK (length(setor)         BETWEEN 1 AND 60),
  maquina           TEXT    NOT NULL CHECK (length(maquina)       BETWEEN 1 AND 80),
  tipo_problema     TEXT    NOT NULL CHECK (length(tipo_problema) BETWEEN 1 AND 20),
  observacao        TEXT    NOT NULL CHECK (length(observacao)    BETWEEN 1 AND 1000),

  -- 1 urgente · 2 crítico · 3 está funcionando · 4 manutenção preventiva
  prioridade        INTEGER NOT NULL CHECK (prioridade IN (1, 2, 3, 4)),

  status            TEXT    NOT NULL DEFAULT 'Aberto'
                            CHECK (status IN ('Aberto','Em andamento','Finalizado','Cancelado')),

  mes               TEXT    NOT NULL CHECK (length(mes) = 7),

  data_criacao      TEXT    NOT NULL,
  data_inicio       TEXT,
  data_fim          TEXT,
  data_cancelamento TEXT,

  tecnico_inicio    TEXT,
  tecnico_fim       TEXT,
  cancelado_por     TEXT,
  solucao           TEXT,

  criado_em         TEXT    NOT NULL,

  CHECK (status <> 'Em andamento' OR (data_inicio IS NOT NULL AND tecnico_inicio IS NOT NULL)),
  CHECK (status <> 'Finalizado'   OR (data_fim    IS NOT NULL AND tecnico_fim    IS NOT NULL AND solucao IS NOT NULL)),
  CHECK (status <> 'Cancelado'    OR (data_cancelamento IS NOT NULL AND cancelado_por IS NOT NULL))
);

INSERT INTO chamados_novo SELECT * FROM chamados;

DROP TABLE chamados;

ALTER TABLE chamados_novo RENAME TO chamados;

CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_mes    ON chamados(mes);
CREATE INDEX IF NOT EXISTS idx_chamados_criado ON chamados(criado_em);
