-- Documentos PDF: tema_pdf (V096) passa a ser o MODELO escolhido (seis valores, igual a app/src/pdf) e opcoes_pdf guarda só as
-- sobrescritas de opções (chave ausente = valor do modelo). O JSON é validado pela API (OpcoesPdf); aqui só se garante que é objeto.
ALTER TABLE consultoria DROP CONSTRAINT consultoria_tema_pdf_check;
ALTER TABLE consultoria ADD CONSTRAINT consultoria_tema_pdf_check
    CHECK (tema_pdf IN ('CLASSICO', 'MINIMALISTA', 'MARCANTE', 'COMPACTO', 'ELEGANTE', 'ESPORTIVO'));
ALTER TABLE consultoria ADD COLUMN opcoes_pdf jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE consultoria ADD CONSTRAINT consultoria_opcoes_pdf_check CHECK (jsonb_typeof(opcoes_pdf) = 'object');
