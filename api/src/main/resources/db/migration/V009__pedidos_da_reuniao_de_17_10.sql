-- Pedidos do Saraiva na reunião de 17/10 (sem compatibilidade: ainda não há cliente real).

-- 1. O app abre no claro: padrão novo e as consultorias existentes passam para o claro. Cada pessoa continua escolhendo
--    o tema em Perfil, e a Marca continua podendo trocar o padrão.
ALTER TABLE consultoria ALTER COLUMN tema_padrao SET DEFAULT 'CLARO';
UPDATE consultoria SET tema_padrao = 'CLARO';

-- 2. Ciclo de atualização padrão da consultoria (aluno sem valor próprio usa este; nulo = sem padrão).
ALTER TABLE consultoria ADD COLUMN dias_atualizacao_padrao integer
    CONSTRAINT consultoria_dias_atualizacao_padrao_check CHECK (dias_atualizacao_padrao BETWEEN 1 AND 365);

-- 3. Medicação e ergogênicos sem categorias fixas: a categoria vira texto livre e opcional, como nos suplementos.
ALTER TABLE ergogenico DROP CONSTRAINT ergogenico_categoria_check;
ALTER TABLE ergogenico ALTER COLUMN categoria TYPE character varying(60);
ALTER TABLE ergogenico ALTER COLUMN categoria DROP NOT NULL;
UPDATE ergogenico SET categoria = CASE categoria
    WHEN 'INJETAVEL' THEN 'Injetáveis'
    WHEN 'ORAL' THEN 'Orais'
    WHEN 'PEPTIDEO' THEN 'Peptídeos'
    WHEN 'MEDICAMENTO' THEN 'Medicamentos'
    WHEN 'OUTRO' THEN 'Outros'
    ELSE categoria END;
