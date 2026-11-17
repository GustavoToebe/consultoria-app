# Como o nome do aluno aparece para os colegas

Situação: Em andamento (Onda 4B, item L, da sessão de 17/11/2026; só começa depois da troca de nomes da Onda 4) · Onde: main · Atualizado: 17/11/2026 (passos 2 e 3 feitos, sem commit) · Base: `e6537dc3`

Fonte: decisão do Gustavo de 17/11/2026. Validade: vale enquanto o nome do aluno chegar a outros alunos por posts, comentários, votos, Colegas e perfil do colega.

## Objetivo
O aluno escolhe como o nome dele aparece para os outros alunos. O servidor monta o nome; o nome completo nunca sai quando a escolha não é `NOME_COMPLETO`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Coluna | `aluno.exibicao_do_nome`, nula, com CHECK: `NOME` (primeiro nome; é o padrão quando nula), `NOME_COMPLETO`, `APELIDO`, `NOME_E_APELIDO` ("Ana (Aninha)"). Sem apelido, `APELIDO` e `NOME_E_APELIDO` caem no primeiro nome | Gustavo, 17/11 |
| D2 | Migration | número livre na hora (V085 se o C36 não a usou; hoje o C36 não precisou de migration; a V086 acabou sendo o CHECK da kcal e a N2 do contato pega a próxima livre na hora do merge); subir os totais em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` | Gustavo, 17/11 |
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
- [x] 2. API: migration, escolha no perfil, montagem do nome no servidor em todos os pontos, exportação e anonimização, testes de vazamento (executor) — feito em 17/11 sem commit (árvore local); migration **V085** (`aluno.exibicao_do_nome`, `varchar(20)`, CHECK `ck_aluno_exibicao_do_nome`; total de migrations 84 na época; a V086 é o CHECK da kcal do alimento e a N2 do contato vai para a próxima número livre na hora do merge); contrato abaixo; testes `NomeExibidoTest`, `NomeNoMuralIntegrationTest`, `ExibicaoDoNomeMigrationTest` — commit: —
- [x] 3. Tela: cartão "Meu perfil" com as 4 opções e prévia, e2e em 390 e 1280, Ajuda (executor-front) — feito em 17/11 sem commit (árvore local sobre `78e0bd63`). Grupo "Como seu nome aparece para os colegas" dentro do `aluno/CartaoMeuPerfil` (logo depois de "Reservar meu perfil": o atalho da Comunidade rola até o topo do cartão e o interruptor tem de ficar à vista em 390 px), peça `aluno/EscolhaDoNome.tsx` (`GradeDeOpcoes` + `OpcaoCartao`, prévia de cada opção na descrição), mesmo "Salvar perfil" (um primário); nome e apelido de `GET /aluno/meus-dados`, lidos de novo quando o apelido muda (`aluno/versaoDoApelido.ts`, avisado pelo `CartaoApelido`); 422 no campo `exibicaoDoNome` embaixo do grupo. Regra pura `nomeParaColegas` e `OPCOES_DE_NOME` em `dominio/perfilDaComunidade.ts` (espelho de `NomeExibido.paraColegas`); `corpoDoPerfil` leva `exibicaoDoNome` (sem ele, salvar só a cor ou o "Entendi" zerariam a escolha). O app mostra só o que a API manda: Colegas e o perfil do colega não compõem mais o apelido; `AutorDoPost` e os votos continuam mostrando o apelido à parte só quando a API o manda (a equipe). `superficie3` → `sobre` no hover/seleção de `AutorDoPost`, `CartaoDoPost`, `BotoesDeReacao`, `BlocoDaEnquete` e `treinador/comunidade.tsx` (`coresDaEnquete.test` mede o azul sobre `sobre`). Ajuda (`conteudo.ts`): Comunidade do treinador e do aluno. Verificações: typecheck e lint ok; jest de `aluno/`, `comunidade/`, `dominio/perfilDaComunidade`, `perfilDoColega`, `comunidade` ok; e2e `perfil-comunidade`, `perfil-do-colega`, `nivel-do-aluno`, `bom-trabalho`, `pods-da-comunidade` ok (390 e 1280; claro, escuro, areia e contraste alto) e `comunidade.spec.ts` 172 ok com 4 falhas que já existiam no `559e7b4e` sem esta mudança ("Nova publicação" do aluno e "publica aviso" do treinador: o aviso e a troca para a aba Alunos depois de publicar). Pendente fora do escopo: `dominio/fotoDePerfil.iniciais` pega o "(" de "Aluno (Fictí)" ("A(" no círculo das iniciais) — commit: —
- [ ] 4. Revisão independente (LGPD, vazamento do nome completo, menor) e correções — correções do revisor feitas em 17/11 sem commit (ver "Correções da revisão" abaixo); falta o Gustavo decidir o inativo — commit: —

## Contrato da API (passo 2, 17/11)
- `GET`/`PUT /aluno/comunidade/perfil` ganham `exibicaoDoNome` (`NOME`, `NOME_COMPLETO`, `APELIDO`, `NOME_E_APELIDO`): o `GET` devolve sempre o valor efetivo (nula = `NOME`); no `PUT`, campo **ausente do JSON não muda** a escolha gravada (revisão de 17/11; o app novo manda o campo sempre), `null` explícito ou em branco volta a `NOME`, e valor fora da lista (ou que não é texto) dá 422 `PERFIL_INVALIDO` no campo `exibicaoDoNome`, sem repetir o valor; auditoria só quando a forma que o colega vê muda (nula e `NOME` são iguais).
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

## Correções da revisão (17/11, sem commit; revisor independente)
- `PUT /aluno/comunidade/perfil` sem `exibicaoDoNome` apagava a escolha em silêncio: o campo virou `JsonNode` (como `perfilReservado`): ausente = não muda, `null` ou em branco = `NOME`, fora da lista ou não texto = 422 `PERFIL_INVALIDO` no campo, sem eco. Auditoria só quando a forma que o colega vê muda.
- Caminho da equipe (nome completo, apelido, denúncias) só para o papel `TREINADOR` explícito (`PostsVisiveisDoMural.equipe`): sem usuário ou com outro papel, vale o caminho do aluno (`ComunidadeService.souAluno`, `EnquetesDoMuralService`).
- `NomeExibido.paraColegas`: espaços (inclusive NBSP e separadores Unicode) viram espaço comum antes do strip, o primeiro nome nunca sai vazio (nome sem nada utilizável = "Membro"). Limite documentado no teste, sem heurística: U+200B não separa palavra e "SOUZALIMA, ANA" mostra "SOUZALIMA,".
- Testes novos em `NomeNoMuralIntegrationTest`: resposta do `PUT .../votos` de B, mural de pod, autor inativo nos comentários do mural e do aulão, aluno renomeado pelo treinador (o aluno nunca recebe a cópia gravada), `APELIDO` sem o primeiro nome em nenhuma resposta, `PUT` sem o campo, 422 por tipo errado e auditoria só quando muda.

## O que ficou para trás
- **Decisão em aberto (Gustavo; item 1 do revisor): aluno inativo com `APELIDO`.** Hoje inativo perde o apelido e cai no primeiro nome (D1: "Ana" em vez de "Aninha"), mesmo quando escolheu `APELIDO`; vale também em `NOME_E_APELIDO` ("Ana"). Comportamento e teste mantidos até ele decidir se o inativo mantém o apelido escolhido.
- Exportação do aluno: `comunidade.perfil.exibicaoDoNome` sai nulo quando ele não escolheu, não `NOME` (revisor, menor 5; mantido).
- Iniciais com o nome montado: `iniciais('Ana (Aninha)')` dá "A("; correção proposta em `dominio/fotoDePerfil.ts`: a primeira letra ou dígito de cada palavra (`/[\p{L}\p{N}]/u`), com o caso no teste (arquivo fora do escopo do passo 3).
- Posts e comentários antigos continuam com o nome completo gravado em `autor_nome` (cópia da criação, visível só à equipe); o aluno nunca o recebe. Passo 3 (tela) e a Ajuda dependem do contrato acima.
