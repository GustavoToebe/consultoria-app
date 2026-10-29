# Avaliação física (circunferências)

Situação: Código pronto na branch, falta o Gustavo rodar `mvn verify` (Docker) e juntar · Onde: branch `evo-avaliacao` (worktree, commits locais, sem push) · Atualizado: 28/10/2026

## Objetivo
O treinador registra as circunferências do aluno (em cm) por data e compara de 2 a 4 datas numa tabela medida × data,
com a diferença em cm entre a primeira e a última escolhida, e baixa esse comparativo em PDF. O aluno vê as avaliações
dele no Histórico (só leitura, com a mesma comparação). Referência do concorrente: "Compare várias datas de avaliação
física e mostre resultado real pro paciente".

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | O que se mede | Só circunferências em cm, uma casa decimal, 5 a 300: braço direito/esquerdo, peitoral, cintura, abdômen, quadril, coxa direita/esquerda, panturrilha direita/esquerda. Todas opcionais, ao menos uma. Observação opcional até 1000 | Gustavo, 28/10 |
| 2 | Peso | Não é duplicado: o comparativo mostra o peso do registro de peso da mesma data, "—" se não houver | Gustavo, 28/10 |
| 3 | Nada de interpretação | Sem dobras, % de gordura, classificação, cor de "bom/ruim" ou texto que interprete. Ausente = "—", nunca zero | Gustavo, 28/10 |
| 4 | Quem grava | Só a equipe. Permissões do peso: leitura `ALUNO_SENSIVEL_LER`, escrita `ALUNO_SENSIVEL_LER` + `ALUNO_SENSIVEL_ALTERAR` (igual ao `ExecucoesTreinadorController` e ao `LesaoController`). Sem permissão nova | Gustavo, 28/10 |
| 5 | Auditoria | `AVALIACAO_FISICA_REGISTRADA/ALTERADA/EXCLUIDA`, entidade `AVALIACAO_FISICA`, resumo fixo, nunca medidas | Gustavo, 28/10 |
| 6 | Uma avaliação por data | Segunda avaliação na mesma data do mesmo aluno = 422 `AVALIACAO_INVALIDA` no campo `data` (índice único `ux_avaliacao_fisica_aluno_data` como rede da corrida). Motivo: a comparação escolhe **datas**; duas na mesma data deixariam a coluna ambígua. Igual ao peso (um por dia), mas sem substituir sozinho | Claude, 28/10 |
| 7 | Validação | Tudo no serviço, 422 `AVALIACAO_INVALIDA` com `fieldErrors` (`data`, `medidas.<nome>`, `medidas`, `observacao`). Data obrigatória, não futura (Brasília) e não antes de 1900. Mais de uma casa decimal é recusado (não arredonda escondido) | Claude, 28/10 |
| 8 | Lock otimista | `versao` (`@Version`) obrigatória no `PUT` (ausente ou diferente = 409 `CONFLITO_EDICAO`, como `LancamentoService`). No `DELETE` o `?versao=` é opcional: se vier e for diferente, 409 | Claude, 28/10 |
| 9 | Rotas de edição fora do aluno | `PUT/DELETE /avaliacoes-fisicas/{id}`: o aluno sai da própria linha (já filtrada pela consultoria); outra consultoria = 404 | Gustavo, 28/10 |
| 10 | Rota do aluno | `GET /aluno/avaliacoes-fisicas` num controller próprio (`AvaliacaoFisicaAlunoController`, `hasRole('ALUNO')`), listado no `ArquiteturaTest` junto dos outros controllers do aluno | Claude, 28/10 |
| 11 | Comparar | 2 a 4 datas; colunas em ordem cronológica; "Diferença" = última − primeira escolhida, só quando os dois valores existem, com sinal (+ / −, "0,0 cm" sem sinal), sem cor; linha do peso (kg) com a mesma regra | Gustavo, 28/10 |
| 12 | PDF | `pdf/pdfAvaliacaoFisica.ts`, molde dos outros (`topo` de `pdf/html.ts`, sem mexer nele), só com a funcionalidade `PDF` do plano (`NoPlano`) | Gustavo, 28/10 |
| 13 | Exportação, anonimização, excluir conta | Seção `avaliacoesFisicas` na exportação com `ALUNO_SENSIVEL_LER`; anonimização (e "Excluir minha conta", que passa por ela) apaga as linhas | Gustavo, 28/10 |
| 14 | Sem RLS | O consultoria não usa RLS (nenhuma migration usa; os papéis vêm do `roles-banco.sql` e do callback `afterMigrate`). A tabela segue o padrão das migrations recentes: FK composta `(consultoria_id, aluno_id)` → `aluno (consultoria_id, id)` | Claude, 28/10 |

## Passos
- [x] 0. Esta frente registrada — commit: 25d1566
- [x] 1. API: V035, entidade, serviço, controllers, exportação, anonimização, totais das migrations (34 → 35), `ArquiteturaTest` — commit: 284800e
- [x] 2. `AvaliacaoFisicaIntegrationTest` (10 testes: CRUD e auditoria, 422 por campo, uma por data, 409 de versão no PUT e no DELETE, outra consultoria 404, Assistente 403, aluno só o próprio, exportação, anonimização, excluir conta) e `ValidacaoDaAvaliacaoTest` (6, sem Docker) — commit: 284800e. **O de integração não rodou aqui (sem Docker).**
- [x] 3. App: `dominio/avaliacaoFisica.ts` (validação espelhada, diferença, formatação, comparação) com teste — commit: e5bbd18
- [x] 4. App: `treinador/CartaoAvaliacaoFisica` (lista com `LinhaDaLista`, Folha de nova/editar, excluir com `PainelConfirmacao`, comparar e PDF), cartão no Histórico do aluno, auditoria e ajuda — commit: e5bbd18
- [x] 5. `pdf/pdfAvaliacaoFisica.ts` com teste (escape e "—") — commit: e5bbd18
- [x] 6. e2e `e2e/avaliacao-fisica.spec.ts` (registrar e comparar a 390 e 1280 px; aluno só consulta) — commit: e5bbd18
- [ ] 7. `mvn verify` com Docker no PC do Gustavo; juntar com as outras frentes (acertar o total de migrations) — Gustavo

## Fora do escopo
- Dobras cutâneas, % de gordura, IMC, classificação e qualquer cálculo sobre as medidas.
- O aluno registrar as próprias medidas.
- Gráfico das medidas (a tabela basta nesta entrega).

## O que ficou para trás
- `AvaliacaoFisicaIntegrationTest`, `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` não rodaram aqui (sem Docker): rodar `mvn verify` antes do push.
- Ao juntar com as outras frentes: o total de migrations (aqui 35) e a lista de descrições do `FlywayMigrationIntegrationTest` precisam somar as V0xx das outras frentes.
- PDFs dos guias (`app/public/guias`) não foram regerados (regra do briefing); a ajuda mudou em `ajuda/conteudo.ts` (treinador e aluno). Rodar `node scripts/guias/gerar.mjs` na junção.
- O aluno não baixa o comparativo em PDF (só a equipe tem o botão); se quiser, é reaproveitar `documentoAvaliacaoFisica` com a marca do pacote.
- Sem gráfico das medidas (só a tabela).
- Armadilha do ambiente (não do código): o cache do Metro é compartilhado entre worktrees que usam o mesmo `node_modules`; `expo export` sem `--clear` montou as rotas de outro checkout e o e2e viu a tela antiga. Com `--clear` passou.

## Texto para o AGENTS.md
- Avaliação física (`avaliacoes/`, V035 `avaliacao_fisica`, `@TenantId`, FK composta `(consultoria_id, aluno_id)`, única por `(aluno_id, data)`, `versao`): só circunferências em cm (braço direito/esquerdo, peitoral, cintura, abdômen, quadril, coxa direita/esquerda, panturrilha direita/esquerda; uma casa decimal, 5 a 300, todas opcionais e ao menos uma) e observação até 1000. O peso não é guardado: a resposta traz `pesoKg` do `registro_peso` da mesma data (nulo = sem peso). Nada de dobras, percentual de gordura, classificação ou interpretação; ausente é "—". Só a equipe grava, com as permissões do peso: `GET /alunos/{id}/avaliacoes-fisicas` (`ALUNO_SENSIVEL_LER`), `POST` no mesmo caminho e `PUT`/`DELETE /avaliacoes-fisicas/{id}` (`ALUNO_SENSIVEL_LER` + `ALUNO_SENSIVEL_ALTERAR`; `PUT` com `versao` obrigatória, `DELETE` com `?versao=` opcional, diferente = 409 `CONFLITO_EDICAO`); o aluno lê as dele em `GET /aluno/avaliacoes-fisicas` (`AvaliacaoFisicaAlunoController`, `hasRole('ALUNO')`, na lista do `ArquiteturaTest`). Validação no serviço (`ValidacaoDaAvaliacao`, espelho em `dominio/avaliacaoFisica.ts`): 422 `AVALIACAO_INVALIDA` com `fieldErrors` em `data` (obrigatória, não futura em Brasília, não antes de 1900, ou data já usada por outra avaliação do aluno), `medidas`, `medidas.<campo>` e `observacao`; a mensagem nunca repete o valor. Outra consultoria = 404; aluno anonimizado = 409 `ALUNO_ANONIMIZADO`. Auditoria `AVALIACAO_FISICA_REGISTRADA/ALTERADA/EXCLUIDA` com resumo fixo. Exportação: seção `avaliacoesFisicas` com `ALUNO_SENSIVEL_LER`; anonimização e "Excluir minha conta" apagam (`AvaliacaoFisicaService.apagarDoAluno`). App: `treinador/CartaoAvaliacaoFisica` na ficha (depois do Peso; `LinhaDaLista` com a caixa "Comparar" no `inicio`, lápis e lixeira com `ALUNO_SENSIVEL_ALTERAR`, `Folha` com as 10 medidas duas por linha, `PainelConfirmacao` no excluir) e o mesmo cartão sem `alunoId` no Histórico do aluno (só leitura). Comparar: 2 a 4 datas (`alternarEscolha`, `comparar`), colunas em ordem cronológica, linha do peso, linha sem valor nenhum some, "Diferença" = última − primeira só com os dois valores ("+1,5 cm", "−2,0 cm", "0,0 cm", sem cor). "Baixar comparativo" (`pdf/pdfAvaliacaoFisica.ts`, `topo` de `pdf/html.ts`) só na equipe e com `PDF` no plano (`NoPlano`). Testes: `AvaliacaoFisicaIntegrationTest`, `ValidacaoDaAvaliacaoTest`, `dominio/avaliacaoFisica.test.ts`, `pdf/pdfAvaliacaoFisica.test.ts`, `e2e/avaliacao-fisica.spec.ts`.
- Migration nova: o total passa a 35 com a V035 (`FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`).
