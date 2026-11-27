-- Regras de atenção do treinador, etapa 1 (docs/planos/regras-de-atencao.md). Número PROVISÓRIO: renumerar no merge final para o
-- próximo livre. Desligado por padrão (TREINOS_REGRAS_ATENCAO_HABILITADO): sem a chave nada é avaliado e as rotas dão 503.
-- O treinador escreve a regra ("me avise quando o sono for 5 ou menos"); o servidor só aplica a regra dele no envio e grava o fato.
-- Nada de texto livre do aluno aqui; o fato é dado derivado de saúde: nunca em log, auditoria nem mensagem de erro.

-- 1. Alvo da FK composta do fato (hoje só há PK(id) e UNIQUE(pasta_id)).
ALTER TABLE atualizacao ADD CONSTRAINT atualizacao_consultoria_id_id_key UNIQUE (consultoria_id, id);

-- 2. A regra da consultoria: uma linha por regra ligada ou desligada (desligar = ativa false; apagar leva as exceções da etapa 2).
--    pergunta_id só nos modelos de uma pergunta (NOTA_ABAIXO, SIM, ITEM_MARCADO); limite só nos de número. As faixas por modelo
--    (escala da nota, 1 a 10, 0,1 a 50 kg, 1 a 31 dias) e o teto de 50 por consultoria são do serviço (RegrasDeAtencaoService).
CREATE TABLE regra_de_atencao (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    tipo           varchar(14) NOT NULL CONSTRAINT ck_regra_atencao_tipo
        CHECK (tipo IN ('NOTA_ABAIXO', 'NOTA_CAIU', 'SIM', 'PESO_MUDOU', 'POUCOS_TREINOS', 'ITEM_MARCADO')),
    pergunta_id    varchar(100),
    limite         numeric(4, 1) CONSTRAINT ck_regra_atencao_limite_faixa CHECK (limite BETWEEN 0 AND 50),
    ativa          boolean NOT NULL DEFAULT true,
    versao         bigint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    alterado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_regra_atencao_pergunta CHECK ((pergunta_id IS NOT NULL AND btrim(pergunta_id) <> '')
        = (tipo IN ('NOTA_ABAIXO', 'SIM', 'ITEM_MARCADO'))),
    CONSTRAINT ck_regra_atencao_limite CHECK ((limite IS NOT NULL) = (tipo IN ('NOTA_ABAIXO', 'NOTA_CAIU', 'PESO_MUDOU', 'POUCOS_TREINOS'))),
    -- Alvo da FK composta das exceções por aluno (etapa 2).
    CONSTRAINT ux_regra_atencao_consultoria_id UNIQUE (consultoria_id, id)
);
-- Duas regras iguais contariam o ponto em dobro. NULLS NOT DISTINCT (PG 15+): os modelos sem pergunta ficam com uma linha cada.
CREATE UNIQUE INDEX ux_regra_atencao_tipo_pergunta ON regra_de_atencao (consultoria_id, tipo, pergunta_id) NULLS NOT DISTINCT;

-- 3. O resultado congelado no envio: tipo, pergunta e limite vigentes naquele envio. Sem regra_id (o fato já congela tudo; apagar a
--    regra não reescreve atualizações antigas) e sem itens marcados (a resposta ITENS_DO_PLANO já guarda id e nome, imutável).
--    valor_observado com sinal (NOTA_CAIU e PESO_MUDOU guardam o Δ atual − anterior); nulo no SIM e no ITEM_MARCADO.
CREATE TABLE atualizacao_atencao (
    id              uuid PRIMARY KEY,
    consultoria_id  uuid NOT NULL REFERENCES consultoria (id),
    atualizacao_id  uuid NOT NULL,
    tipo            varchar(14) NOT NULL CONSTRAINT ck_atualizacao_atencao_tipo
        CHECK (tipo IN ('NOTA_ABAIXO', 'NOTA_CAIU', 'SIM', 'PESO_MUDOU', 'POUCOS_TREINOS', 'ITEM_MARCADO')),
    pergunta_id     varchar(100),
    limite_vigente  numeric(4, 1),
    valor_observado numeric(8, 1),
    criado_em       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_atualizacao_atencao_atualizacao FOREIGN KEY (consultoria_id, atualizacao_id)
        REFERENCES atualizacao (consultoria_id, id) ON DELETE CASCADE
);
-- Um fato por (atualização, modelo, pergunta); também serve a contagem da lista e o detalhe (prefixo consultoria + atualização).
CREATE UNIQUE INDEX ux_atualizacao_atencao ON atualizacao_atencao (consultoria_id, atualizacao_id, tipo, pergunta_id) NULLS NOT DISTINCT;

-- 4. Preferência do membro para o push de atenção (Perfil › Notificações). Coluna nova com padrão: não reescreve linha antiga.
ALTER TABLE usuario ADD COLUMN push_atencao boolean NOT NULL DEFAULT true;

-- 5. Tipo novo da fila do push (V106): ATUALIZACAO_ATENCAO (19 caracteres, cabe no varchar(20)). Texto fixo no código, sem nome.
ALTER TABLE push_envio DROP CONSTRAINT ck_push_envio_tipo;
ALTER TABLE push_envio ADD CONSTRAINT ck_push_envio_tipo
    CHECK (tipo IN ('COMPROMISSO', 'PLANO_LIBERADO', 'ATUALIZACAO_ATENCAO')) NOT VALID;
ALTER TABLE push_envio VALIDATE CONSTRAINT ck_push_envio_tipo;
