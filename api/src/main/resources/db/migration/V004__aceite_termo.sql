-- Aceite do termo de uso e do aviso de privacidade: uma linha por usuário e versão (a versão vale para os dois textos).
-- Tabela própria e não a auditoria, que é apagada depois de um ano.
CREATE TABLE public.aceite_termo (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    versao character varying(40) NOT NULL,
    aceito_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aceite_termo_pkey PRIMARY KEY (id),
    CONSTRAINT aceite_termo_usuario_versao_key UNIQUE (usuario_id, versao),
    CONSTRAINT aceite_termo_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id),
    CONSTRAINT aceite_termo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id)
);
