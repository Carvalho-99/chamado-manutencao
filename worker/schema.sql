-- Banco de chamados de manutenção.
--
-- Vindo do Firestore, onde as regras de integridade viviam no firestore.rules.
-- Aqui elas viram CHECK e NOT NULL: o banco passa a recusar dado inválido por
-- conta própria, mesmo que um bug no código tente gravar besteira.

-- ---------------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chamados (
  -- AUTOINCREMENT (e não só PRIMARY KEY) de propósito: garante que um número
  -- nunca é reaproveitado, nem depois de apagar. Era exatamente o bug do
  -- "quantidade de documentos + 1" que existia no começo.
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  lider             TEXT    NOT NULL CHECK (length(lider)      BETWEEN 1 AND 80),
  setor             TEXT    NOT NULL CHECK (length(setor)      BETWEEN 1 AND 60),
  maquina           TEXT    NOT NULL CHECK (length(maquina)    BETWEEN 1 AND 80),
  tipo_problema     TEXT    NOT NULL CHECK (length(tipo_problema) BETWEEN 1 AND 20),
  observacao        TEXT    NOT NULL CHECK (length(observacao) BETWEEN 1 AND 1000),
  -- 1 urgente · 2 crítico · 3 manutenção preventiva · 4 está funcionando
  prioridade        INTEGER NOT NULL CHECK (prioridade IN (1, 2, 3, 4)),

  status            TEXT    NOT NULL DEFAULT 'Aberto'
                            CHECK (status IN ('Aberto','Em andamento','Finalizado','Cancelado')),

  mes               TEXT    NOT NULL CHECK (length(mes) = 7),   -- MM/AAAA

  -- Quando a maquina fica livre pra manutencao. NULL = ja esta livre.
  disponivel_em     TEXT,
  data_criacao      TEXT    NOT NULL,
  data_inicio       TEXT,
  data_fim          TEXT,
  data_cancelamento TEXT,

  tecnico_inicio    TEXT,
  tecnico_fim       TEXT,
  cancelado_por     TEXT,
  solucao           TEXT,

  criado_em         TEXT    NOT NULL,   -- carimbo do servidor, não do navegador

  -- Coerência entre status e os campos que ele exige. Impede um chamado
  -- "Finalizado" sem solução ou sem quem finalizou.
  CHECK (status <> 'Em andamento' OR (data_inicio IS NOT NULL AND tecnico_inicio IS NOT NULL)),
  CHECK (status <> 'Finalizado'   OR (data_fim    IS NOT NULL AND tecnico_fim    IS NOT NULL AND solucao IS NOT NULL)),
  CHECK (status <> 'Cancelado'    OR (data_cancelamento IS NOT NULL AND cancelado_por IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_mes    ON chamados(mes);
CREATE INDEX IF NOT EXISTS idx_chamados_criado ON chamados(criado_em);

-- ---------------------------------------------------------------------------
-- Usuários
--
-- Duas colunas de papel em vez de uma: PAULO HENRIQUE e MARCIO ALMEIDA são
-- líder E técnico ao mesmo tempo, com o mesmo CPF.
--
-- A senha continua sendo o CPF, e o hash é o MESMO que já estava nas páginas
-- (PBKDF2-SHA256, 200 mil iterações, temperado com o nome). Ninguém precisa
-- trocar de senha: o que muda é ONDE a conferência acontece — sai do navegador
-- da pessoa e vai pro servidor, que é o que acaba com o truque do F12.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  nome       TEXT PRIMARY KEY,
  senha_hash TEXT    NOT NULL CHECK (length(senha_hash) = 64),
  eh_lider   INTEGER NOT NULL DEFAULT 0 CHECK (eh_lider  IN (0,1)),
  eh_tecnico INTEGER NOT NULL DEFAULT 0 CHECK (eh_tecnico IN (0,1)),
  ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo     IN (0,1)),
  CHECK (eh_lider = 1 OR eh_tecnico = 1)
);

-- ---------------------------------------------------------------------------
-- Sessões
--
-- O que substitui o sessionStorage. O token é sorteado pelo servidor e só ele
-- sabe a quem pertence — não dá pra forjar digitando no console do navegador.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessoes (
  token      TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  papel      TEXT NOT NULL CHECK (papel IN ('lider','tecnico')),
  externo    INTEGER NOT NULL DEFAULT 0 CHECK (externo IN (0,1)),
  criada_em  TEXT NOT NULL,
  expira_em  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
