-- Biblioteca unificada (D-001, D-006): cada suplemento vira uma linha de alimento com tipo SUPLEMENTO.
-- Não edita migration antiga. kcal fica nulo na cópia (D-005: sem valor nutricional; ausência não vira zero).
-- Alimento comum continua obrigado a ter kcal. A porção em texto, a marca, o link, o cupom, os sabores
-- e o nome de busca (unicidade sem acento) são copiados: sem essas colunas a linha perderia o que já estava gravado.
-- A base 100 g só preenche a coluna obrigatória; não é valor de rótulo e a tela não a mostra quando não há kcal.

ALTER TABLE alimento ADD COLUMN tipo varchar(20) NOT NULL DEFAULT 'ALIMENTO';
ALTER TABLE alimento ADD CONSTRAINT alimento_tipo_check CHECK (tipo IN ('ALIMENTO', 'SUPLEMENTO'));
ALTER TABLE alimento ADD CONSTRAINT alimento_kcal_obrigatoria_check CHECK (tipo = 'SUPLEMENTO' OR kcal IS NOT NULL);
ALTER TABLE alimento ALTER COLUMN kcal DROP NOT NULL;

ALTER TABLE alimento ADD COLUMN marca varchar(80);
ALTER TABLE alimento ADD COLUMN link varchar(500);
ALTER TABLE alimento ADD COLUMN cupom varchar(40);
ALTER TABLE alimento ADD COLUMN sabores jsonb;
ALTER TABLE alimento ADD COLUMN porcoes_por_embalagem varchar(40);
ALTER TABLE alimento ADD COLUMN porcao varchar(80);
ALTER TABLE alimento ADD COLUMN nome_busca varchar(160);

DROP INDEX ux_alimento_nome;
CREATE UNIQUE INDEX ux_alimento_nome ON alimento (consultoria_id, tipo, lower(nome::text)) WHERE ativo;
CREATE UNIQUE INDEX ux_alimento_suplemento_nome ON alimento (consultoria_id, nome_busca) WHERE ativo AND tipo = 'SUPLEMENTO';

INSERT INTO alimento (
    id, consultoria_id, nome, base_quantidade, base_unidade,
    kcal, proteina, carboidrato, gordura,
    ativo, origem, criado_em, versao,
    tipo, marca, link, cupom, sabores, porcoes_por_embalagem, porcao, grupo, nome_busca)
SELECT
    id, consultoria_id, nome, 100, 'g',
    NULL, NULL, NULL, NULL,
    ativo, 'MANUAL', criado_em, versao,
    'SUPLEMENTO', marca, link, cupom, sabores, porcoes_por_embalagem, porcao, categoria, nome_busca
FROM suplemento;

DROP TABLE suplemento;
