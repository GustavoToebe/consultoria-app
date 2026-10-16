-- O objeto da foto no bucket passa a se chamar consultorias/<consultoria_id>/fotos/<id>.jpg (antes era só o id). A fila de remoção
-- precisa saber a consultoria para montar o nome. Sem FK: a fila tem de sobreviver à consultoria que saiu.
-- O bucket estava vazio e as fotos desligadas, então não há formato antigo a preservar: a fila (vazia) é zerada.
DELETE FROM foto_remocao;
ALTER TABLE foto_remocao ADD COLUMN consultoria_id uuid NOT NULL;
