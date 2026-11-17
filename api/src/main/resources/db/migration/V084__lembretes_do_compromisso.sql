-- Lembretes do compromisso (plano lembretes-do-compromisso, D1): até 5 antecedências em minutos (1 a 40320 = 28 dias),
-- escolhidas por quem marca; lista vazia = sem lembrete. Os compromissos que já existem ficam com 30 minutos antes.
-- O CHECK cobre tamanho, faixa e elemento nulo (ALL com nulo não reprova sozinho); duplicata é recusada pelo serviço.
ALTER TABLE compromisso ADD COLUMN lembretes_minutos integer[] NOT NULL DEFAULT '{30}';
ALTER TABLE compromisso ADD CONSTRAINT ck_compromisso_lembretes CHECK (
    cardinality(lembretes_minutos) <= 5
    AND array_position(lembretes_minutos, NULL::integer) IS NULL
    AND 1 <= ALL (lembretes_minutos)
    AND 40320 >= ALL (lembretes_minutos));
