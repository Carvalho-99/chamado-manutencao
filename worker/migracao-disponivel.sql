-- 04/11/2026: quando a maquina fica liberada pra manutencao.
-- NULL quer dizer "ja esta liberada", que e o caso da maioria dos chamados
-- urgentes — a maquina parou, entao o tecnico pode ir agora.
ALTER TABLE chamados ADD COLUMN disponivel_em TEXT;
