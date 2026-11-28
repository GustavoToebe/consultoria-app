-- Importação assistida: JPG e PNG como reserva (D1/D8 do plano importacao-revisao-28-11), só com a chave
-- TREINOS_IA_ENVIAR_ARQUIVO_AO_PROVEDOR ligada (padrão desligada). Sem isso o save da imagem quebraria no CHECK da V068.
ALTER TABLE importacao_arquivo DROP CONSTRAINT ck_importacao_arquivo_formato;
ALTER TABLE importacao_arquivo ADD CONSTRAINT ck_importacao_arquivo_formato
    CHECK (formato IN ('PDF', 'DOCX', 'XLSX', 'CSV', 'TEXTO_LIVRE', 'JPG', 'PNG')) NOT VALID;
