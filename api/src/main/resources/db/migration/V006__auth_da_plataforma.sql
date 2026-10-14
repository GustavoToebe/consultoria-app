-- A sessão (refresh) e o limite de login passam para o módulo de autenticação da plataforma, que cria o próprio esquema
-- `plataforma`. Quem estava logado entra de novo.
DROP TABLE public.refresh_token;

-- `login_tentativa` continua só para cadastro, convite e refresh; os contadores de login antigos não servem ao módulo.
DELETE FROM public.login_tentativa WHERE chave LIKE 'login-%';
