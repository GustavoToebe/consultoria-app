# Evolução da lista de compras

Situação: Pronta na branch (falta juntar na `main` e publicar) · Onde: branches `evo-compras` e `evo-categorias` (worktrees, sem push) · Atualizado: 28/10/2026

## Objetivo
A lista de compras do aluno vira uma lista de mercado de verdade: além de Semana e Mês, o período de 14 dias; marcar o
que já comprou ("N de M comprados" com barra, "Limpar marcações"); ajustar a quantidade de um item e acrescentar itens
dele. Tudo só no aparelho do aluno, sem API e sem mudar a dieta nem a regra de cálculo. Referência: a lista de um
concorrente (7/14/30 dias, "2 de 6 comprados", "Limpar marcações", "Ajustar lista", "Adicionar item").

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Período de 14 dias | Além de 7 e 30, na tela do aluno, na prévia do treinador e nos PDFs (lista e PDF Detalhado da dieta, que usa o mesmo seletor) | Gustavo, 28/10 |
| 2 | "Comprado" | Marcar/desmarcar, "N de M comprados" com barra, "Limpar marcações". Só no aparelho, sem API. Guardado por usuário, versão publicada da dieta e período; versão nova ou outro período = lista sem marcações | Gustavo, 28/10 |
| 3 | Ajustes pessoais | Item avulso (nome até 80, quantidade e unidade livres e opcionais) e quantidade própria de item calculado, com "Voltar ao calculado". Nunca altera a dieta. A tela diz "ajustado por você" / "adicionado por você". Mesma chave das marcações | Gustavo, 28/10 |
| 4 | PDF do aluno | Inclui ajustes e avulsos marcados como tal, com a caixinha vazia para marcar no papel. A prévia do treinador não tem ajustes | Gustavo, 28/10 |
| 5 | Cálculo | Sem mudança (fatores, opção por refeição); só o período novo. Não une itens por nome parecido | Gustavo, 28/10 |
| 6 | Treinador | Só a prévia, sem marcações | Gustavo, 28/10 |
| 7 | Rótulos do período | "Semana", "2 semanas" e "Mês" (valor `duasSemanas`, 14 dias fixos); título do PDF "2 semanas (14 dias)". "Quinzena" ficou de fora porque costuma ser 15 dias | Claude, 28/10 |
| 8 | Onde fica | Documento `listaDeCompras` no `RepositorioLocal` (kv do SQLite no celular, `treinos:<usuarioId>:listaDeCompras` na web), o mesmo lugar da dieta salva: sai no "Sair" (`apagarTudo`) e na sessão recusada (`reterSoAFila`), não entra em `SOBREVIVEM_AO_SAIR` nem em `CHAVES_DA_FILA_RETIDA` | Claude, 28/10 |
| 9 | Formato guardado | Um documento só, da versão em uso: `{versaoId, periodo, escolhas, periodos: {semana?, duasSemanas?, mes?}}`, cada período com `comprados`, `ajustes` e `avulsos`. Versão diferente da salva começa do zero e substitui o documento ao gravar (não acumula versões antigas). Lido sempre por `normalizarListaSalva` (o que não confere é descartado, sem conversão) | Claude, 28/10 |
| 10 | Período e opção lembrados | A tela abre no último período e nas últimas opções por refeição escolhidos para aquela versão (senão as marcações da opção B sumiriam ao voltar para a tela). Não muda o cálculo | Claude, 28/10 |
| 11 | Quantidade livre | Texto (quantidade até 20, unidade até 20), sem conversão nem soma: "1 pacote", "2 kg". Ajuste exige a quantidade; avulso, só o nome. No máximo 100 avulsos por período | Claude, 28/10 |
| 12 | Remover e limpar | Sem painel: o aviso traz "Desfazer" (10 s), como a cópia de plano | Claude, 28/10 |
| 13 | "Ajustar lista" | Botão que liga o modo de ajuste: cada linha ganha "Ajustar" (calculado) ou "Editar"/"Remover" (avulso). Fora dele a linha toda marca/desmarca | Claude, 28/10 |
| 14 | Marcas de item que sumiu | Ficam guardadas (trocar a opção de volta as traz), mas a contagem só soma itens da lista atual | Claude, 28/10 |
| 15 | Categorias | Lista agrupada pelo grupo do alimento (como o concorrente): grupos em ordem alfabética (pt-BR, sem acento), "Outros itens" para o que não tem grupo e "Adicionados por você" (avulsos do aluno) no fim; cabeçalho com a contagem. Na tela do aluno, na prévia do treinador e nos PDFs | Gustavo, 28/10 |
| 16 | De onde vem o grupo | Coluna nova `alimento.grupo` (texto livre até 60, opcional; nulo = sem grupo). A publicação da dieta copia o grupo do alimento atual para `ConteudoDieta.Item.grupo`, como os fatores (o do cliente é sobrescrito; item manual = nulo); a prévia do treinador recebe o atual por `GET /alimentos/fatores` | Gustavo, 28/10 |
| 17 | Alimentos que já existem | A V038 preenche só os de origem `CATALOGO` com o grupo do item do catálogo de mesmo nome (`lower(btrim(nome))`, a mesma comparação da V027), e só quando há exatamente um item correspondente com grupo. Não há `nome_busca` no alimento nem `unaccent` no banco; alimento renomeado pelo treinador fica sem grupo | Claude, 28/10 |
| 18 | Texto do grupo | Normalizado no servidor (`GrupoDoAlimento.normalizar`: controle vira espaço, espaços seguidos viram um, em branco = nulo); acima de 60 caracteres depois disso = 422 `ALIMENTO_INVALIDO` no campo `grupo` (cadastro) ou erro da linha (planilha). "Carnes" e "carnes" caem no mesmo grupo da lista (chave sem acento e sem caixa; vale o nome como apareceu primeiro) | Claude, 28/10 |
| 19 | Campo no app | Texto livre "Grupo (opcional)" com sugestões em botões (até 8), como a Categoria de "Outros": os grupos já usados na consultoria e os do catálogo (`GET /catalogo/alimentos/grupos`); sem o catálogo (erro), só os da consultoria. A linha da biblioteca mostra o grupo antes dos fatores | Claude, 28/10 |
| 20 | Onde fica a contagem | O cartão "Lista da semana" guarda o "N de M comprados", os botões e as notas; cada grupo vem num cartão próprio com `CabecalhoDeGrupo` (como a Agenda). A contagem continua sobre a lista toda | Claude, 28/10 |
| 21 | PDF | Uma faixa por grupo na tabela ("Carnes e derivados (3)"), com estilo em linha para valer também no PDF Detalhado da dieta; só o corpo da tabela mudou (`corpoDaTabela`, `corpoDoAluno`), o cabeçalho do documento não | Claude, 28/10 |
| 22 | Demo | Os alimentos do `SeedDemo` ganham os grupos do catálogo, para a lista do aluno demo sair agrupada | Claude, 28/10 |

## Passos
- [x] 0. Esta frente registrada — commit: 13e8b34
- [x] 1. Domínio: período `duasSemanas` (`PERIODOS_DA_LISTA`, `tituloDaLista`, `textoDoPeriodo`, preferência do PDF da dieta) e `dominio/listaDeComprasDoAluno.ts` (marcações, ajustes, avulsos, contagem, normalização), com testes — commit: 13e8b34
- [x] 2. `RepositorioLocal.lerListaDeCompras/salvarListaDeCompras` (chave-valor e SQLite), teste no `offline.test.ts` (volta igual, não mistura usuários, sai no "Sair" e na sessão recusada) — commit: 13e8b34
- [x] 3. Tela do aluno (`aluno/ListaDeComprasDoAluno`), PDF com ajustes/avulsos, Ajuda do aluno e do treinador — commit: b42c247
- [x] 4. e2e `lista-de-compras.spec.ts` (14 dias, marcar, limpar, ajustar, voltar ao calculado, avulso) e verificação (390 e 1280 px) — commit: b42c247

### Categorias (branch `evo-categorias`)
- [x] 5. API: `alimento.grupo` (V038, preenche os do catálogo), `GrupoDoAlimento`, cadastro/edição (422 `ALIMENTO_INVALIDO` no `grupo`), importar do catálogo copia, planilha com a coluna opcional `grupo`, `ConteudoDieta.Item.grupo` copiado em `paraPublicar`, `FatoresDoAlimento.grupo`, seed demo; testes `GrupoDoAlimentoTest` (sem banco) e `GrupoDoAlimentoIntegrationTest`, `ImportacaoIntegrationTest` com a coluna, totais de migration 34 → 35 — commit: e108a25
- [x] 6. App: `dominio/gruposDaLista` (`agruparLista`, `sugerirGrupos`), `LinhaDaLista.grupo`, `comFatoresDaBiblioteca` com o grupo, `gruposDoAluno`; tela do aluno, prévia do treinador e PDFs agrupados; campo Grupo na Biblioteca › Alimentos; coluna Grupo na importação (modelos regerados); Ajuda; e2e — commit: 9b12de5
- [ ] 7. Rodar no PC do Gustavo: `mvn verify` (integração com Docker) e `npm run e2e -- e2e/lista-de-compras.spec.ts` no checkout principal depois de juntar as frentes

## Verificação (28/10, nesta máquina)
- `npm run typecheck` e `npm run lint` sem erro; `npm test`: 155 suítes, 2102 testes verdes (inclui `listaDeComprasDoAluno.test.ts`, `offline.test.ts` nas duas implementações, `pdf.test.ts` e `injecao.test.ts`).
- `npm run e2e -- e2e/lista-de-compras.spec.ts`: os casos antigos (5) passaram na primeira rodada; o caso novo, em 390 e 1280 px, passou depois de corrigir o seletor "Semana" (ambíguo com "2 semanas"), rodado contra o mesmo `dist-e2e`.
- Não verificado: Android/iOS de verdade (SQLite do aparelho); a bateria do `offline.test.ts` cobre o SQLite pelo Node.

## Verificação das categorias (28/10, nesta máquina)
- API: `mvn -o -q compile` e `test-compile` sem erro; `GrupoDoAlimentoTest` (4) e `ArquiteturaTest` (15) verdes. Os testes de integração
  (`GrupoDoAlimentoIntegrationTest`, `FatoresDosAlimentosIntegrationTest`, `ImportacaoIntegrationTest`, migrations) não rodaram: sem Docker aqui.
- App: `npm run typecheck` e `npm run lint` sem erro; `npm test`: 156 suítes, 2111 testes verdes (inclui `gruposDaLista.test.ts`,
  `listaDeCompras*.test.ts`, `pdf.test.ts` e `injecao.test.ts` com o grupo envenenado); `node --test scripts/importacao/modelos.test.mjs` verde.
- e2e não rodado aqui (o `node_modules` desta máquina empacota outro checkout): o spec foi atualizado e fica para o checkout principal.

## Fora do escopo
- Sincronizar marcações entre aparelhos (decisão 2: só no aparelho).

## O que ficou para trás
- Ordem própria dos grupos (como "hortifrúti primeiro", na ordem do mercado): hoje é alfabética. Fica para o Gustavo decidir.
- Item manual da dieta (sem alimento) sempre cai em "Outros itens"; dar grupo a ele exigiria um campo no editor da dieta.
- O aluno não escolhe o grupo do item avulso: todos vão para "Adicionados por você".

## Texto para o AGENTS.md
(acrescentar ao item "Lista de compras")

Período de 7, 14 ou 30 dias (`PeriodoDaLista` `semana`/`duasSemanas`/`mes`, `PERIODOS_DA_LISTA`, rótulos Semana/2 semanas/Mês) na tela do aluno, na prévia do treinador e nos PDFs. Na tela do aluno (`aluno/ListaDeComprasDoAluno`, regras puras em `dominio/listaDeComprasDoAluno.ts`) o aluno marca o que comprou ("N de M comprados" com `BarraProgresso`, "Limpar marcações" com desfazer no aviso), ajusta a quantidade de um item calculado (texto livre, "ajustado por você", "Voltar ao calculado") e acrescenta itens avulsos (nome até 80, quantidade e unidade livres até 20, "adicionado por você", remover com desfazer), no modo "Ajustar lista". Nada disso vai à API nem muda a dieta: fica no documento `listaDeCompras` do `RepositorioLocal` (kv do SQLite / `treinos:<usuarioId>:listaDeCompras`), um só, da versão publicada em uso (`{versaoId, periodo, escolhas, periodos}`; versão nova começa do zero), lido por `normalizarListaSalva`; sai no "Sair" e na sessão recusada (não está em `SOBREVIVEM_AO_SAIR` nem na fila retida). O PDF do aluno (`documentoListaDeCompras` com `itensDoAluno`) leva os ajustes e avulsos marcados como tal e caixas vazias; a prévia do treinador (`ui/ListaDeCompras`) não tem marcações nem ajustes. Teste de tela: `e2e/lista-de-compras.spec.ts`.

(e um item novo, logo depois do da lista de compras)

- Grupo do alimento (V038, `biblioteca/GrupoDoAlimento`): `alimento.grupo` é texto livre opcional do treinador (até 60 depois de `GrupoDoAlimento.normalizar`: controle vira espaço, espaços seguidos viram um, em branco = nulo; acima disso 422 `ALIMENTO_INVALIDO` no campo `grupo`, ou erro da linha na planilha), só para agrupar a lista de compras. Importar do catálogo copia o grupo de lá (`GrupoDoAlimento.doCatalogo`); a V038 preencheu os alimentos `CATALOGO` que já existiam pelo item de mesmo nome (`lower(btrim(nome))`, só com uma correspondência, sem sobrescrever); a importação por planilha aceita a coluna opcional `grupo` (modelo `alimentos.*` regerado). Como os fatores, o grupo é copiado do alimento **atual** para `ConteudoDieta.Item.grupo` em `PlanoDietaService.paraPublicar` (o que o cliente manda é sobrescrito; item manual ou alimento de outra consultoria = nulo; o rascunho fica como veio) e `GET /alimentos/fatores` o traz para a prévia (`comFatoresDaBiblioteca` aplica os dois). App: campo "Grupo (opcional)" na Biblioteca › Alimentos com sugestões (`dominio/gruposDaLista.sugerirGrupos`: os da consultoria e os de `GET /catalogo/alimentos/grupos`); a lista de compras (aluno, prévia do treinador, PDF da lista e PDF Detalhado da dieta) sai agrupada por `dominio/gruposDaLista.agruparLista` (grupos em ordem alfabética pt-BR sem acento e sem caixa, "Outros itens" para o que não tem grupo e, no fim, "Adicionados por você" com os avulsos do aluno; `gruposDoAluno` mantém o ajustado no grupo do alimento), um cartão por grupo com `CabecalhoDeGrupo` e a contagem ("3 itens"), uma faixa por grupo no PDF. A conta, a ordem dentro do grupo e o "N de M comprados" não mudam. Testes: `GrupoDoAlimentoTest`, `GrupoDoAlimentoIntegrationTest`, `gruposDaLista.test.ts`, `e2e/lista-de-compras.spec.ts`.
