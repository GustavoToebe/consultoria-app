-- Foto de perfil do aluno (opcional, reunião de 17/10). Pequena (JPEG até 300 KB e 1024 px, sem metadados), fica no banco
-- como a logo: não depende do bucket das fotos de atualização. Dado pessoal: sai na anonimização; na exportação, só a data.
CREATE TABLE aluno_foto_perfil (
    aluno_id       uuid PRIMARY KEY REFERENCES aluno (id),
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    jpeg           bytea NOT NULL,
    tamanho        integer NOT NULL CHECK (tamanho > 0),
    atualizada_em  timestamptz NOT NULL
);

CREATE INDEX ix_foto_perfil_consultoria ON aluno_foto_perfil (consultoria_id);
