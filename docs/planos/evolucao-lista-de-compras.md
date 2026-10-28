# Evolução da lista de compras

Situação: Em andamento · Onde: branch `evo-compras` (worktree, sem push) · Atualizado: 28/10/2026

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

## Passos
- [x] 0. Esta frente registrada — commit: (primeiro commit da branch)
- [ ] 1. Domínio: período `duasSemanas` (`PERIODOS_DA_LISTA`, `tituloDaLista`, `textoDoPeriodo`, preferência do PDF da dieta) e `dominio/listaDeComprasDoAluno.ts` (marcações, ajustes, avulsos, contagem, normalização), com testes — commit: —
- [ ] 2. `RepositorioLocal.lerListaDeCompras/salvarListaDeCompras` (chave-valor e SQLite), teste no `offline.test.ts` (volta igual, não mistura usuários, sai no "Sair" e na sessão recusada) — commit: —
- [ ] 3. Tela do aluno (`aluno/ListaDeComprasDoAluno`), PDF com ajustes/avulsos, Ajuda do aluno e do treinador — commit: —
- [ ] 4. e2e `lista-de-compras.spec.ts` (14 dias, marcar, limpar, ajustar, voltar ao calculado, avulso) e verificação — commit: —

## Fora do escopo
- Itens agrupados por categoria (como no concorrente): o item da dieta não traz grupo do alimento; precisaria levar o
  grupo da biblioteca para a versão publicada (API). Anotado em "O que ficou para trás".
- Sincronizar marcações entre aparelhos (decisão 2: só no aparelho).

## O que ficou para trás
- Agrupar a lista por categoria do alimento (precisa do grupo na versão publicada da dieta).

## Texto para o AGENTS.md
(acrescentar ao item "Lista de compras")

Período de 7, 14 ou 30 dias (`PeriodoDaLista` `semana`/`duasSemanas`/`mes`, `PERIODOS_DA_LISTA`, rótulos Semana/2 semanas/Mês) na tela do aluno, na prévia do treinador e nos PDFs. Na tela do aluno (`aluno/ListaDeComprasDoAluno`, regras puras em `dominio/listaDeComprasDoAluno.ts`) o aluno marca o que comprou ("N de M comprados" com `BarraProgresso`, "Limpar marcações" com desfazer no aviso), ajusta a quantidade de um item calculado (texto livre, "ajustado por você", "Voltar ao calculado") e acrescenta itens avulsos (nome até 80, quantidade e unidade livres até 20, "adicionado por você", remover com desfazer), no modo "Ajustar lista". Nada disso vai à API nem muda a dieta: fica no documento `listaDeCompras` do `RepositorioLocal` (kv do SQLite / `treinos:<usuarioId>:listaDeCompras`), um só, da versão publicada em uso (`{versaoId, periodo, escolhas, periodos}`; versão nova começa do zero), lido por `normalizarListaSalva`; sai no "Sair" e na sessão recusada (não está em `SOBREVIVEM_AO_SAIR` nem na fila retida). O PDF do aluno (`documentoListaDeCompras` com `itensDoAluno`) leva os ajustes e avulsos marcados como tal e caixas vazias; a prévia do treinador (`ui/ListaDeCompras`) não tem marcações nem ajustes. Teste de tela: `e2e/lista-de-compras.spec.ts`.
