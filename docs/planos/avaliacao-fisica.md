# Avaliação física (circunferências)

Situação: Em andamento · Onde: branch `evo-avaliacao` (worktree, commits locais, sem push) · Atualizado: 28/10/2026

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
- [x] 0. Esta frente registrada — commit: (primeiro commit da branch)
- [ ] 1. API: V035, entidade, serviço, controllers, exportação, anonimização, totais das migrations, `ArquiteturaTest` — commit: —
- [ ] 2. `AvaliacaoFisicaIntegrationTest` (CRUD, 403, 404 de outra consultoria, aluno só o próprio, 422 por campo, data repetida, 409 de versão, anonimizado 409, exportação e anonimização) e `AvaliacaoFisicaValidacaoTest` (sem Docker) — commit: —
- [ ] 3. App: `dominio/avaliacaoFisica.ts` (validação espelhada, diferença, formatação, comparação) com teste — commit: —
- [ ] 4. App: `treinador/CartaoAvaliacaoFisica` (lista, Folha de nova/editar, excluir com `PainelConfirmacao`, comparar e PDF), cartão no Histórico do aluno, auditoria e ajuda — commit: —
- [ ] 5. `pdf/pdfAvaliacaoFisica.ts` com teste (escape e "—") — commit: —
- [ ] 6. e2e `e2e/avaliacao-fisica.spec.ts` (registrar e comparar) — commit: —

## Fora do escopo
- Dobras cutâneas, % de gordura, IMC, classificação e qualquer cálculo sobre as medidas.
- O aluno registrar as próprias medidas.
- Gráfico das medidas (a tabela basta nesta entrega).

## O que ficou para trás
- (preencher ao entregar)

## Texto para o AGENTS.md
(preencher ao entregar)
