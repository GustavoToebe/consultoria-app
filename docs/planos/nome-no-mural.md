# Como o nome do aluno aparece para os colegas

Situação: Em andamento (Onda 4B, item L, da sessão de 17/11/2026; só começa depois da troca de nomes da Onda 4) · Onde: main · Atualizado: 17/11/2026 (passo 2 feito, sem commit) · Base: `e6537dc3`

Fonte: decisão do Gustavo de 17/11/2026. Validade: vale enquanto o nome do aluno chegar a outros alunos por posts, comentários, votos, Colegas e perfil do colega.

## Objetivo
O aluno escolhe como o nome dele aparece para os outros alunos. O servidor monta o nome; o nome completo nunca sai quando a escolha não é `NOME_COMPLETO`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Coluna | `aluno.exibicao_do_nome`, nula, com CHECK: `NOME` (primeiro nome; é o padrão quando nula), `NOME_COMPLETO`, `APELIDO`, `NOME_E_APELIDO` ("Ana (Aninha)"). Sem apelido, `APELIDO` e `NOME_E_APELIDO` caem no primeiro nome | Gustavo, 17/11 |
| D2 | Migration | número livre na hora (V085 se o C36 não a usou; hoje o C36 não precisou de migration; a N2 do contato anda junto: V086 ou seguinte); subir os totais em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` | Gustavo, 17/11 |
| D3 | Contrato | `GET`/`PUT /aluno/comunidade/perfil` com o campo `exibicaoDoNome`; valor fora da lista = 422 `PERFIL_INVALIDO`; o app manda o corpo completo, como já faz; menor escolhe igual aos outros | Gustavo, 17/11 |
| D4 | Onde o servidor monta o nome | **O SERVIDOR monta**, nunca mande o nome completo a outro aluno quando a escolha não for `NOME_COMPLETO` (nada de mandar tudo e o app esconder): posts e comentários do mural e das aulas, lista de votos da enquete, lista de Colegas e perfil do colega e qualquer outro DTO do aluno que hoje leve o nome de outro aluno (listar antes de mexer) | Gustavo, 17/11 |
| D5 | Equipe | continua vendo o nome completo e o apelido | Gustavo, 17/11 |
| D6 | LGPD | exportação leva a escolha; anonimização e "Excluir minha conta" zeram a coluna | Gustavo, 17/11 |
| D7 | Tela | cartão "Meu perfil" da Conta do aluno: "Como seu nome aparece para os colegas", as 4 opções com a prévia ao lado de cada uma, montada com o nome dele; e2e em 390 e 1280 | Gustavo, 17/11 |
| D8 | Documentação | `AGENTS.md` (itens da Comunidade e V070) e Ajuda (`conteudo.ts`; guias em PDF na Onda 5) | Gustavo, 17/11 |
| D9 | Revisão | revisor independente, só leitura, depois do J e do L: LGPD e vazamento do nome completo em qualquer resposta para outro aluno, inclusive menor | Gustavo, 17/11 |
| D10 | Sem compatibilidade | sem flag; nula = `NOME` | regra do projeto |

## Passos
- [ ] 1. Mapa: todo DTO/consulta em que um aluno vê o nome de outro (explorador, só leitura) — commit: —
- [x] 2. API: migration, escolha no perfil, montagem do nome no servidor em todos os pontos, exportação e anonimização, testes de vazamento (executor) — feito em 17/11 sem commit (árvore local); migration **V085** (`aluno.exibicao_do_nome`, `varchar(20)`, CHECK `ck_aluno_exibicao_do_nome`; total de migrations 84; a N2 do contato fica com a V086); contrato abaixo; testes `NomeExibidoTest`, `NomeNoMuralIntegrationTest`, `ExibicaoDoNomeMigrationTest` — commit: —
- [ ] 3. Tela: cartão "Meu perfil" com as 4 opções e prévia, e2e em 390 e 1280, Ajuda (executor-front) — commit: —
- [ ] 4. Revisão independente (LGPD, vazamento do nome completo, menor) e correções — commit: —

## Contrato da API (passo 2, 17/11)
- `GET`/`PUT /aluno/comunidade/perfil` ganham `exibicaoDoNome` (`NOME`, `NOME_COMPLETO`, `APELIDO`, `NOME_E_APELIDO`): o `GET` devolve sempre o valor efetivo (nula = `NOME`); o `PUT` aceita nulo ou em branco (volta a `NOME`) e valor fora da lista dá 422 `PERFIL_INVALIDO` no campo `exibicaoDoNome`, sem repetir o valor; auditoria só quando a forma que o colega vê muda (nula e `NOME` são iguais).
- Para **outro aluno** o servidor manda o nome já montado (`NomeExibido.paraColegas`, o único ponto) e nunca o gravado no post: `autorNome` (mural e comentários), `nome` (votante, amostra de votantes, lista de Colegas e perfil do colega, inclusive reservado e menor). `autorApelido`/`apelido` chegam **nulos** (`autorApelido` no JSON; `apelido` do votante some; `apelido` de `ColegaDaLista` e `PerfilResponse` vai nulo), porque o apelido já entrou no nome. A lista de Colegas ordena pelo nome exibido.
- O próprio aluno também recebe o nome montado (no perfil e nos posts dele): serve de prévia de como os colegas o veem.
- A **equipe** continua com o nome completo (o gravado) e o apelido atual, em todas as rotas dela.
- Aluno inativo: perde o apelido (`APELIDO` e `NOME_E_APELIDO` caem no primeiro nome), a escolha `NOME_COMPLETO` vale; anonimizado mostra só o texto já anonimizado.
- Exportação do aluno: `comunidade.perfil.exibicaoDoNome` (valor gravado, nulo = não escolheu). Anonimização e "Excluir minha conta" zeram a coluna (`Aluno.anonimizar`).

## Critérios de aceite
- Nenhuma resposta a aluno traz o nome completo de outro aluno com escolha diferente de `NOME_COMPLETO` (teste por endpoint).
- `PERFIL_INVALIDO` em valor fora da lista; nula se comporta como `NOME`; anonimizar e excluir conta zeram a coluna; exportação leva a escolha.

## Fora do escopo
- Mudar o que a equipe vê; foto do colega.

## O que ficou para trás
- Posts e comentários antigos continuam com o nome completo gravado em `autor_nome` (cópia da criação, visível só à equipe); o aluno nunca o recebe. Passo 3 (tela) e a Ajuda dependem do contrato acima.
