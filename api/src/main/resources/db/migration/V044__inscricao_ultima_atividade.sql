-- Interessados, lote 1 (29/10): a retenção de 180 dias passa a contar da última atividade da inscrição, não só da última
-- alteração da linha. Antes, uma nota recente numa recusada antiga não segurava a limpeza e era apagada junto (achado B3).
-- Toda atividade (andamento, nota e, nos próximos lotes, retorno, mensagem preparada) grava esta coluna na própria linha,
-- por UPDATE: a limpeza, que apaga pela mesma linha, espera a trava e confere de novo o valor gravado.
ALTER TABLE inscricao ADD COLUMN ultima_atividade_em timestamptz;

UPDATE inscricao i SET ultima_atividade_em = greatest(i.atualizada_em,
    coalesce((SELECT max(n.criada_em) FROM inscricao_nota n
              WHERE n.consultoria_id = i.consultoria_id AND n.inscricao_id = i.id), i.atualizada_em));

ALTER TABLE inscricao ALTER COLUMN ultima_atividade_em SET NOT NULL,
    ALTER COLUMN ultima_atividade_em SET DEFAULT now();

DROP INDEX ix_inscricao_retencao;
CREATE INDEX ix_inscricao_retencao ON inscricao (ultima_atividade_em) WHERE situacao IN ('RECUSADA', 'DESISTIU');
