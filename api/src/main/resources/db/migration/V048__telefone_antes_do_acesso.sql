-- Telefone do aluno que ainda não tem acesso ao app (30/10, planilha real do Saraiva: a importação recusava toda linha com
-- telefone de aluno novo). O telefone de quem tem acesso continua em usuario.telefone; esta coluna só guarda o número até
-- o acesso existir (convite aceito ou "Definir e-mail e senha"), quando ele passa para o usuário e a coluna volta a nulo.
-- Já formatado por Formatos.telefone, como o do usuário. Dado pessoal: a anonimização apaga.
alter table aluno add column telefone_sem_acesso character varying(20);
