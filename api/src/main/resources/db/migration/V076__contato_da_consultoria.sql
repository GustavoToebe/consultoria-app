-- Contato da consultoria, nível 1 (docs/planos/contato-da-consultoria.md, C1). Tudo opcional e sem preenchimento retroativo:
-- sem nome do remetente vale o nome da consultoria; sem responder-para o e-mail sai sem reply_to; sem WhatsApp o aluno não vê o botão.
ALTER TABLE consultoria
    ADD COLUMN whatsapp varchar(20),
    ADD COLUMN email_remetente_nome varchar(60),
    ADD COLUMN email_responder_para varchar(254);
