-- WhatsApp da Meta: uma linha por fato (docs/planos/contato-da-consultoria.md, B13). Compromisso reaberto, remarcado de novo ou
-- cancelado de novo é um fato novo: ganha linha nova (ocorrencia = a anterior + 1) em vez de reaproveitar a que já saiu, e o
-- histórico dos envios (exportação do aluno, LGPD) guarda uma linha por mensagem. Lembrete de cobrança continua com ocorrencia 1:
-- uma cobrança, um aviso por tipo. Sem preenchimento retroativo: toda linha existente é a ocorrência 1.
ALTER TABLE whatsapp_envio ADD COLUMN ocorrencia integer NOT NULL DEFAULT 1
    CONSTRAINT ck_whatsapp_envio_ocorrencia CHECK (ocorrencia >= 1);
ALTER TABLE whatsapp_envio DROP CONSTRAINT ux_whatsapp_envio_referencia;
ALTER TABLE whatsapp_envio ADD CONSTRAINT ux_whatsapp_envio_referencia
    UNIQUE (consultoria_id, tipo, referencia_id, aluno_id, ocorrencia);
