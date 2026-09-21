-- Renumeração das prioridades (21/09/2026).
--
-- Antes: 1 urgente · 2 crítico · 3 está funcionando · 4 preventiva
-- Agora: 1 urgente · 2 crítico · 3 preventiva · 4 está funcionando
--
-- O pedido foi deixar os números na ordem em que aparecem na tela. Como o 3 já
-- significava "está funcionando" em chamados gravados, não dava pra só trocar o
-- rótulo: o histórico passaria a mentir. Por isso o dado é convertido junto.
--
-- CASE em vez de três UPDATEs com um valor de passagem: cada linha recebe o
-- valor final de uma vez. A primeira tentativa usou 99 como passagem e o CHECK
-- da tabela barrou — corretamente, já que 99 não é prioridade válida.
UPDATE chamados
   SET prioridade = CASE prioridade WHEN 3 THEN 4 WHEN 4 THEN 3 END
 WHERE prioridade IN (3, 4);
