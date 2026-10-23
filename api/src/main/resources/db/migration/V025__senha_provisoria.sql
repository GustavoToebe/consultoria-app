-- Senha provisória definida pelo treinador (23/10): enquanto ligada, o login pede uma senha nova antes de abrir a sessão.
alter table usuario add column trocar_senha boolean not null default false;
