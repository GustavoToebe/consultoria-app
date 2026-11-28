-- Preenchimento (leva 2, 29/11): com TREINOS_PLANO_APLICAR ligada por padrão, toda consultoria que JÁ tem linha em
-- direitos_locais ganha as funcionalidades do catálogo (RecursosDoApp: MOBILIDADE, PDF, EQUIPE) que faltarem, para ninguém
-- perder função ao ligar a chave. Só acrescenta: nada é removido, a ordem do que existe fica, limites, versão e confirmação
-- não mudam (a próxima sincronização da Central, com versão maior, continua valendo). Consultoria sem linha continua sem linha
-- (sem linha nada é barrado). A comparação ignora caixa, como o PlanoDaConsultoria. Idempotente: rodar de novo não muda nada.
-- A leva 4 tem uma V117 provisória: vira V118 no merge dela.
UPDATE direitos_locais d
SET funcionalidades = d.funcionalidades || f.faltam,
    atualizado_em = now()
FROM (
    SELECT dl.consultoria_id,
           ARRAY(SELECT c.codigo
                 FROM unnest(ARRAY['MOBILIDADE', 'PDF', 'EQUIPE']) WITH ORDINALITY AS c(codigo, ordem)
                 WHERE NOT EXISTS (SELECT 1 FROM unnest(dl.funcionalidades) AS x(codigo) WHERE upper(x.codigo) = c.codigo)
                 ORDER BY c.ordem) AS faltam
    FROM direitos_locais dl
) f
WHERE d.consultoria_id = f.consultoria_id
  AND cardinality(f.faltam) > 0;
