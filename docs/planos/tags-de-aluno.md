# Tags do aluno

Situação: Em andamento (18/11/2026): API (V093), regra pura e telas prontas sem commit; revisão independente pendente; Ajuda, guias e AGENTS.md em andamento por outro agente · Onde: main (sem commit até o Gustavo pedir) · Atualizado: 18/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa); aceita a "parte de C10" que `inicio-e-agenda.md` deixava para "se o Gustavo aceitar". Base: `main` em `1af8c940`. Validade: vale enquanto `Aluno`, `AlunoService`, `GET /alunos` (filtros), `treinador/DadosDoAluno`, `app/src/app/treinador/alunos/index.tsx` e `CARTOES_DE_CONFIGURACAO` não mudarem de forma incompatível; refazer "Conferido no código" ao começar.

## Objetivo
O treinador marca os alunos com tags livres da consultoria (ex.: "Online", "Retorno") para achar e filtrar a lista. Só a equipe vê; o aluno nunca vê. Não é campo para saúde.

## Conferido no código (18/11/2026)
- Migrations hoje: V087 é a última na `main`; **V088** (playlists) está commitada (`57c01924`); **V089** é da fibra, em curso. Esta frente usa o **próximo número livre depois da fibra** (esperado V090; saiu V093, porque V090 a V092 são do Financeiro, ver `financeiro-em-fases.md`), conferido na pasta antes de criar; uma migration por vez.
- Não conferido: estrutura de `GET /alunos` (filtros repetíveis atuais e `FILTRO_INVALIDO`), `SelecaoMultiplaSuspensa`/grupo "Identificação" no painel "Filtros de alunos", cores de identificação (`identificacao.*` em `tema/tokens`), `CARTOES_DE_CONFIGURACAO` e a exportação/anonimização do aluno.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Modelo | Lista de tags da consultoria (`@TenantId`); digitar uma tag nova no campo do aluno a cria e ela fica disponível aos outros alunos | Gustavo, 18/11 |
| D2 | Nome | 1 a 30 caracteres depois do strip e do NFC; único na consultoria sem diferença de maiúsculas nem de acento (índice único sobre o nome normalizado) | Gustavo, 18/11 |
| D3 | Cor | De uma lista fechada, tirada das cores de identificação que o app já tem; nunca a cor da marca nem as de situação | Gustavo, 18/11 |
| D4 | Limite | Até 10 tags por aluno | Gustavo, 18/11 |
| D5 | Permissões | Ler com `ALUNO_LER`; gravar no aluno com `ALUNO_ALTERAR`. **Renomear, trocar a cor e apagar a tag da consultoria: também `ALUNO_ALTERAR`** (decisão da sessão principal, a confirmar). Justificativa: a tag é rótulo de organização da carteira de alunos, quem pode alterar o cadastro dos alunos já pode marcar e desmarcar; uma permissão nova obrigaria migration e mexeria nos perfis padrão sem ganho de proteção (a tag não carrega dado sensível). Apagar ou renomear afeta vários alunos de uma vez: por isso o painel de confirmação diz em quantos alunos a tag está | Gustavo (leitura e gravação), sessão principal (gestão) |
| D6 | O aluno | Nunca vê as tags. O texto de ajuda diz que não é campo para saúde | Gustavo, 18/11 |
| D7 | LGPD | Nada em log; auditoria com resumo fixo (sem o nome da tag); a exportação LGPD do aluno leva os nomes das tags dele. **Anonimização: a ligação aluno↔tag sai** (decisão da sessão principal, a confirmar). Justificativa: o nome da tag é texto livre digitado pelo treinador e pode identificar ou revelar algo sobre a pessoa; a tag em si (lista da consultoria) fica, porque não é dado do aluno. "Excluir minha conta" pelo aluno segue o mesmo caminho da anonimização | Gustavo (exportação e log), sessão principal (anonimização) |
| D8 | Migration | Próximo número livre depois da fibra; FK composta com `consultoria_id`; `ON DELETE CASCADE` na ligação; sobe o total nos dois testes de migration e a lista do `AGENTS.md` | Gustavo, 18/11 |
| D9 | Filtro | `GET /alunos` aceita `tag` repetível (OU dentro do filtro, E com os outros); id de outra consultoria = 404; valor malformado = 400 `FILTRO_INVALIDO` sem repetir o valor. No app, seletor "Tags" no painel "Filtros de alunos" (`SelecaoMultiplaSuspensa`, grupo Identificação), com o filtro no endereço como os outros | Gustavo, 18/11 |
| D10 | Tela | Em Dados do aluno, campo de tags com chips removíveis e criação ao digitar; na lista de alunos, as tags na linha (no máximo 2 e "+N"); em Configurações (`CARTOES_DE_CONFIGURACAO`), cartão "Tags dos alunos" para renomear, trocar a cor e apagar, com `PainelConfirmacao` dizendo em quantos alunos a tag está | Gustavo, 18/11 |
| D11 | Entrega | Sem commit nem push até o Gustavo pedir | Gustavo, 18/11 |

## Passos
- [x] 0. Plano, índice e a linha de `inicio-e-agenda.md` — sessão principal — commit: — (sem commit, estado local em 18/11/2026)
- [x] 1. API e migration (próximo número livre depois da fibra): tabelas `tag_aluno` e `aluno_tag`, serviço, rotas (listar, criar, renomear/cor, apagar, e a tag no aluno), filtro `tag` em `GET /alunos`, exportação LGPD, anonimização, auditoria, totais dos testes de migration e `AGENTS.md`; testes (CRUD, isolamento com 404, limite de 10, nome único sem caixa nem acento, filtro OU/E, 400 `FILTRO_INVALIDO`, exportação, anonimização) — executor — depende do commit da V089 — commit: — (sem commit, estado local em 18/11/2026; V093)
- [ ] 2. Revisão independente (migration + filtro multi-tenant): um revisor com o diff em arquivo — revisor — commit: n/a (pendente em 18/11/2026)
- [x] 3. Regra pura em `dominio/` com teste (normalizar e comparar nome, limite, cor, resumo "no máximo 2 e +N", leitura do filtro do endereço) — executor — depois do 1 — commit: — (sem commit, estado local em 18/11/2026)
- [x] 4. Telas: campo em Dados do aluno, tags na linha da lista, seletor no painel de filtros, cartão em Configurações; e2e em 390 e 1280 — executor-front — depois do 3 e do fim da frente "ficha do aluno" (mesmo arquivo `DadosDoAluno`) — commit: — (sem commit, estado local em 18/11/2026; rota nova `/treinador/alunos/tags`)
- [ ] 5. Ajuda, guias em PDF (uma vez no fim) e `AGENTS.md` — sessão principal — commit: — (em andamento por outro agente, sem commit)

## Critérios de aceite
- Tag criada ao digitar no aluno fica na lista da consultoria e aparece para os outros alunos; nome repetido (mesmo com outra caixa ou sem acento) usa a existente.
- 11ª tag no mesmo aluno é recusada com mensagem clara.
- Outra consultoria nunca vê nem altera tag (404); sem `ALUNO_LER`/`ALUNO_ALTERAR` ninguém lê/grava.
- Filtro por tags (OU dentro, E com os outros) funciona na lista e fica no endereço; valor malformado dá 400 `FILTRO_INVALIDO`.
- O aluno nunca recebe tag em nenhuma rota; a exportação do aluno leva os nomes; anonimizar apaga a ligação.
- Nada de nome de tag em log ou auditoria.
- `mvn verify`, typecheck, lint, jest e e2e da lista e da ficha verdes; conferido em 390 e 1280 px.

## Fora do escopo
- Tag visível ao aluno, tag com texto sobre saúde, tags em outras listas (Interessados, Atualizações), automação por tag.

## O que ficou para trás
- Confirmar D5 (gestão com `ALUNO_ALTERAR`) e D7 (anonimização apaga a ligação): está no README.
- Revisão independente (passo 2) ainda não feita.
