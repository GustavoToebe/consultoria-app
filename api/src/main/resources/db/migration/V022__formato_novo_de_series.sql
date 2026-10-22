-- Formato novo de séries e metodologia (22/10). Sem compatibilidade: ainda não há cliente real.

-- 1. Apaga, de todas as consultorias, tudo que guarda série ou metodologia no formato antigo: os registros de execução
--    do aluno, as versões publicadas e os planos de treino, e os modelos de metodologia, de séries, de dia e de
--    semana de treino e os pacotes (PASTA_PLANO, que levam a dieta do pacote junto). Ficam as coleções (pasta_modelo),
--    as pastas dos alunos, as dietas, a mobilidade e os outros modelos. Antes de qualquer push, o Gustavo deve confirmar
--    que não há nada a guardar na produção e alguém deve conferir que o backup do dia rodou. Ordem pelas chaves estrangeiras
--    da V001 (execucao_serie -> plano_treino_versao -> plano_treino; nada aponta para receita).
DELETE FROM execucao_serie;
DELETE FROM plano_treino_versao;
DELETE FROM plano_treino;
DELETE FROM receita WHERE tipo IN ('METODOLOGIA', 'SERIES', 'SESSAO_TREINO', 'PLANO_TREINO', 'PASTA_PLANO');
