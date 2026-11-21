-- Tema dos PDFs da consultoria (lista fechada, igual a app/src/pdf/temas.ts).
ALTER TABLE consultoria ADD COLUMN tema_pdf character varying(20) NOT NULL DEFAULT 'CLASSICO';
ALTER TABLE consultoria ADD CONSTRAINT consultoria_tema_pdf_check CHECK (tema_pdf IN ('CLASSICO', 'MINIMALISTA', 'MARCANTE'));
