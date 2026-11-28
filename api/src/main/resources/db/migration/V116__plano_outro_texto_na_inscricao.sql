-- Texto de "Outro" na escolha do plano da inscrição completa (leva 2, 27/11): a página sem a pergunta `plano_combinado`
-- (só a Ficha rápida a tem) não tinha onde guardar o que a pessoa escreveu. Nulo = não escolheu "Outro", escolheu um plano
-- da lista (a API descarta o texto) ou veio pela Ficha rápida. Texto livre da pessoa: dado pessoal (vai na exportação;
-- a anonimização e a retenção apagam a linha inteira). Só metadados: coluna nula, sem default, sem dado antigo a migrar.
ALTER TABLE inscricao ADD COLUMN plano_outro_texto varchar(120);
