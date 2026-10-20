-- Marca permanente de estorno no aviso de pagamento. Quando a InfinitePay manda o evento "refunded" de uma transação, o aviso
-- guarda aqui o instante da primeira vez. Nula = o provedor nunca avisou estorno desta transação. A marca só nasce e nunca é
-- apagada nem zerada por aviso posterior (paid, repetição ou retorno do navegador): o conciliador, ao vê-la, manda o aviso
-- para a conferência (ESTORNO_INFORMADO) mesmo que a consulta ainda diga "pago", e nunca dá baixa automática nem altera uma
-- baixa existente. Não é dado de pessoa.
ALTER TABLE aviso_de_pagamento ADD COLUMN estorno_avisado_em timestamptz;
