-- Contrato digital, passos 4 e 6 (docs/planos/contrato-digital.md). Número provisório (V109): o lote das 3 frentes ocupa a V106 e a V107 e o
-- Overtraining Pay a V108; no merge, renumerar para o próximo livre depois do último do main e acertar os totais dos testes de Flyway e de papéis.

-- 1. Par aluno + responsável (D28, 16 a 17 anos): dois contratos com o mesmo texto e o mesmo sha256, um por signatário, ligados por um
--    grupo. Cada um tem o seu aceite e as suas evidências (os CHECKs da V105 seguem valendo); cancelar e prorrogar valem para o grupo.
ALTER TABLE contrato_aluno ADD COLUMN grupo_id uuid;
CREATE INDEX ix_contrato_grupo ON contrato_aluno (consultoria_id, grupo_id) WHERE grupo_id IS NOT NULL;

-- 2. Declaração do responsável legal (D28): o registro guarda que quem assinou pelo link declarou ser o responsável. Só no signatário
--    RESPONSAVEL assinado.
ALTER TABLE contrato_aluno ADD COLUMN assinante_declarou_responsavel boolean;

-- 3. Guarda do assinado (D16): passados os 5 anos, a rotina apaga o texto e as evidências e marca o apagado; o esqueleto (ids, título, sha256,
--    situação) fica. Os bytes do PDF saem pela linha de contrato_arquivo, que a rotina apaga.
ALTER TABLE contrato_aluno ADD COLUMN apagado_em timestamptz;
ALTER TABLE contrato_aluno ADD CONSTRAINT ck_contrato_apagado CHECK (apagado_em IS NULL OR situacao = 'ASSINADO');

ALTER TABLE contrato_aluno DROP CONSTRAINT ck_contrato_texto_so_no_modelo;
ALTER TABLE contrato_aluno ADD CONSTRAINT ck_contrato_texto_so_no_modelo CHECK (
    (origem = 'MODELO'
        AND ((texto IS NOT NULL AND char_length(texto) BETWEEN 1 AND 100000)
            OR (texto IS NULL AND apagado_em IS NOT NULL)))
    OR (origem = 'PDF' AND texto IS NULL AND modelo_id IS NULL));

ALTER TABLE contrato_aluno DROP CONSTRAINT ck_contrato_assinado;
ALTER TABLE contrato_aluno ADD CONSTRAINT ck_contrato_assinado CHECK (
    -- Assinado e guardado: todas as evidências. O responsável traz o CPF e a declaração, o aluno traz a conta.
    (situacao = 'ASSINADO' AND apagado_em IS NULL
        AND assinado_em IS NOT NULL AND assinante_nome IS NOT NULL AND assinante_ip IS NOT NULL AND assinante_agente IS NOT NULL
        AND ((signatario = 'ALUNO' AND assinado_por_usuario_id IS NOT NULL AND assinante_cpf IS NULL
                AND assinante_declarou_responsavel IS NULL)
            OR (signatario = 'RESPONSAVEL' AND assinado_por_usuario_id IS NULL AND assinante_cpf IS NOT NULL
                AND assinante_declarou_responsavel IS TRUE)))
    -- Assinado e já apagado pela rotina de guarda: nenhuma evidência.
    OR (situacao = 'ASSINADO' AND apagado_em IS NOT NULL
        AND assinado_em IS NULL AND assinado_por_usuario_id IS NULL AND assinante_nome IS NULL AND assinante_cpf IS NULL
        AND assinante_ip IS NULL AND assinante_agente IS NULL AND assinante_declarou_responsavel IS NULL)
    OR (situacao <> 'ASSINADO'
        AND assinado_em IS NULL AND assinado_por_usuario_id IS NULL AND assinante_nome IS NULL AND assinante_cpf IS NULL
        AND assinante_ip IS NULL AND assinante_agente IS NULL AND assinante_declarou_responsavel IS NULL));
