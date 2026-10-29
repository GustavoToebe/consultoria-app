-- O aluno desliga, só para ele, os lembretes de cobrança por e-mail (descadastro). Nulo = recebe; preenchido = quando desligou.
-- O motivo de cancelamento ALUNO_DESLIGOU do lembrete não precisa de ajuste aqui: lembrete_cobranca.motivo é texto livre
-- (varchar(30)), sem CHECK. A anonimização e "Excluir minha conta" voltam a coluna a nulo (Aluno.anonimizar).
alter table aluno add column lembretes_cobranca_desligados_em timestamptz;
