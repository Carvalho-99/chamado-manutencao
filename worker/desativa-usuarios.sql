-- 26/10/2026: Everson Santos e Vinicius Santos perderam o acesso.
--
-- DESATIVADOS, não apagados. O Vinicius atendeu 90 chamados (44 iniciados,
-- 46 finalizados, o último em 23/10) e o nome dele está nesse histórico.
-- Apagar a linha deixaria o registro apontando pra alguém que não existe mais.
-- Tirar o acesso é o pedido; apagar o rastro de quem atendeu, não.
UPDATE usuarios SET ativo = 0 WHERE nome IN ('EVERSON SANTOS', 'VINICIUS SANTOS');
