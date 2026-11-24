# Dieta em tabela, arrastar para reordenar e menu com submenu

Situação: Entregue (passos 1, 1c, 1d, 2, 2b e 3 na `main` e em `origin/main`; ajustes visuais de 23/11 no commit `aba2b8e6`, publicado no run 45310566613) · Onde: `main` (fast-forward `224cb659`, push `c3d3359e`, run 44559836626 verde, web `c3d3359ed612`); a branch `dieta-tabela` segue como worktree · Atualizado: 23/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Validade: vale enquanto `treinador/dieta/CartaoRefeicao.tsx`, `treinador/painel/EditarPainel.tsx` e `ui/Navegacao.tsx` não mudarem de forma incompatível; ao trazer a `main`, refazer a conferência dos arquivos em conflito. Só app: sem API, sem migration.

## Objetivo
Três melhorias de tela, em ordem: (1) alimentos do editor de dieta numa tabela com cabeçalho de colunas; (2) arrastar para reordenar (alça ≡) no lugar das setas na linha, com ↑↓ no menu ⋯ como alternativa; (3) menu lateral do treinador com submenu flutuante no trilho.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Parte 3 (menu) | Só depois de o trabalho dos grupos recolhíveis (`gruposRecolhidos`, `Navegacao.tsx`) estar commitado na `main`; antes, `git merge main` na branch e construir por cima | Gustavo, 18/11 |
| D2 | Entrega | Commits pequenos por assunto na branch `dieta-tabela`; sem push e sem merge na `main` | Gustavo, 18/11 |
| D3 | Arrastar | Peça compartilhada em `ui/` (sem biblioteca nova); alça aria-hidden; ↑↓ no menu ⋯ ("Mover para cima/baixo", nomes "Subir X"/"Descer X"); aviso "Ordem alterada" com Desfazer | Gustavo, 18/11 |
| D4 | Tabela | Abaixo de ~760 px de largura da opção volta ao cartão empilhado de hoje; colunas numa estrutura única, para a fibra acrescentar uma depois | Gustavo, 18/11 (a estrutura única é da sessão principal) |
| D5 | Parte 3: onde entra o submenu | Só no PC minimizado (72 px, o que o botão de recolher produz). O trilho do tablet (768 a 1023) continua com um ícone por item e o rótulo curto embaixo: os nomes dos grupos ("Acompanhamento", "Configurações") não cabem nos 80 px sem um rótulo curto novo, que é decisão de glossário. A confirmar com o Gustavo | executor-front, 18/11 |
| D6 | Opções em abas e "Trocar alimento" (passo 1c) | Opções da refeição em abas (APG) com a comparação dos totais acima e a aberta na largura toda; "Trocar alimento" com texto, secundário compacto e neutro, embaixo do nome na tabela. O limite da tabela passa a 910 px de opção (D4 era ~760; a coluna das ações reserva só o ⋯ e a lixeira) | Gustavo, 19/11 (o número é da medida) |

## Passos
Publicação (19/11/2026): `git merge dieta-tabela` na `main` (fast-forward) e um push só, `c3d3359e`; deploy no run 44559836626 (todos os jobs verdes). Os passos 2, 2b e 3 foram nesse push.
- [x] 1. Dieta em tabela (`CartaoRefeicao.tsx`: `OpcaoDaRefeicao` e `LinhaItem`) — executor-front — commit: `ab54d9de` (18/11; `e2e/dieta-tabela.spec.ts`)
- [x] 1d. Tabela em 1280 (o "Próximo passo" acima): feito em 20/11/2026 — commit `f8fed1ae`
- [x] 1c. Opções em abas (`AbasDeOpcao`, `ComparacaoDasOpcoes`, `dominio/opcoesDaRefeicao`) e "Trocar alimento" com texto no `CartaoRefeicao` — executor-front, 19/11 — commit: `d239688a` (19/11, "Editor de dieta: opções da refeição em abas, comparação e Trocar alimento") — evidência: jest `CartaoRefeicao.test.tsx` e `opcoesDaRefeicao.test.ts`; e2e `dieta-opcoes-em-abas.spec.ts` e os `dieta-*`; capturas em 390, 1280 e 1920 (escuro) no rascunho da sessão
- [x] 2. Arrastar para reordenar: peça em `ui/` (`ArrasteDaLista`), regra em `dominio/reordenar`, refeições (lista mestre no PC), exercícios e blocos; sessões ficaram fora (ver abaixo) — executor-front — commits: 98cef762, be3a9e8a — evidência: `e2e/arrastar.spec.ts`, `editor-clareza.spec.ts`, `reordenar.test.ts`
- [x] 2b. Alça de arrastar nos alimentos de cada opção (`LinhaItem`) e ⋯ da refeição, depois do passo 1 — executor-front — commit: 89a095e8 — evidência: `e2e/arrastar.spec.ts`, e2e `dieta-*` verdes
- [x] 3. Menu: submenu flutuante dos grupos no PC minimizado (72 px, "Menu Button" da APG, `ui/SubmenuDoTrilho.tsx`) e fio vertical do grupo aberto; regra pura em `dominio/gruposDoMenu` (`itemAtivo`, `sinaisDoIconeDoGrupo`, `topoDoSubmenu`) — executor-front — commit: fdd363e8 (base `d4095696`) — evidência: `e2e/menu-do-treinador.spec.ts` 26/26, `ajuda` 8/8, `configuracoes` 18/18, `painel` 44/44, jest 115/115

## Próximo passo (pedido de 19/11, Gustavo): a tabela de alimentos TEM que aparecer em 1280 com o menu aberto
Hoje, em 1280, a opção mede ~650 px e o limite da tabela é ~910 px: tudo fica empilhado (medido no passo 1c). Meta: tabela a partir de ~640 px de largura da opção. Caminho, nesta ordem, parando quando couber:
- a) Quantidade e Unidade num campo só: número com a unidade num seletor dentro do campo ("50 g ▾"), nomes acessíveis separados para quantidade e unidade;
- b) colunas Kcal, P, C, G e Fibras com ~56 px, números à direita (cabe "26,0 g");
- c) a lixeira do alimento vai para o ⋯ como "Excluir alimento" (com texto); na linha ficam só ⋯ e a alça;
- d) se ainda faltar, lista de refeições mais estreita (~260 px) a partir de 1024.
Nome do alimento com reticências e o nome inteiro na dica; nenhum número cortado. Entregar com capturas em 1280 com o menu aberto e recolhido (escuro) e commit próprio "dieta: tabela em 1280". Recalibrar `e2e/dieta-tabela.spec.ts` (limite medido).

**Feito em 20/11/2026, commit `f8fed1ae` (sem push):** os quatro caminhos (a, b, c e d) foram necessários. Limite da tabela: 656 px de opção (era 910); em 1280 com o menu aberto a opção mede 668 px (836 recolhido; 1263 px de janela empilha, 1273 já é tabela). **Fechado em 23/11/2026:** mantidas as colunas de 48 px sem `" g"`, nome mínimo de 140 px e campos do item manual na 2ª linha; `"Trocar alimento"` voltou para secundário neutro (`superficie2`/`borda`/`bordaCampo`) mantendo `"+ Opção"` na cor de ação; tabela 4.5 de `docs/design-e-front.md` e comentário de `ui/Botao.tsx` atualizados. Evidência: typecheck, lint, jest relacionado 24/24, e2e `dieta-tabela` 8/8, `dieta-opcoes-em-abas` 7/7, `dieta-ajustes` 16/16, `dieta-por-dia` 26/26, `dieta-opcoes-e-preparo` 9/9, `dieta-editor-melhorias` 10/10, `cores-historico-dieta` 16/16, `arrastar` 8/8, `editor-clareza` 20/20, `editor-inspetor-sobras` 29/29, `tela-larga` 19/19, `fibra-do-alimento` 17/17 e mais três; capturas em 1280 (menu aberto e recolhido), 1024, 1920 e 390.

## Ajustes de 23/11/2026 (commit `aba2b8e6`, publicado no run 45310566613; base `daff8929`; vale até alguém mexer em `AbasDeOpcao.tsx` ou na dica de `ui/Navegacao.tsx`)
- **Dica "Expandir menu" cobrindo o título (menu recolhido no PC):** a dica de todo controle só de ícone do menu sai à direita do trilho, na altura do controle; o "Expandir menu" fica na linha do título da tela, então cobria o começo dele (medido em 1280: dica x 84 a 177, título "Ajuda" a partir de x 141). Correção em `ui/Navegacao.tsx`: `useDicaNoMenu` ganhou o parâmetro `abaixo` e só o `BotaoRecolher` o usa; a dica desce para baixo do botão, na coluna do menu (x do botão, 4 px abaixo), em vez de ir à direita. As dicas da lupa, do avatar e dos itens não mudam. Contrapartida: com o mouse ou o foco no botão a dica cobre a lupa de busca. E2e: `menu-do-treinador.spec.ts` confere que a dica não sobrepõe o título.
- **Lasca das abas da dieta em 390 px:** o esmaecido das bordas das abas era pintado com `useFundoDaArea()` (fundo da página), mas as abas ficam dentro do cartão da refeição (`superficie`); no escuro isso deixava um retângulo mais escuro, em degraus, ao lado da aba e do "+ Opção". Correção em `treinador/dieta/AbasDeOpcao.tsx`: o esmaecido usa `cores.superficie`. Não mudou: a ponta da aba vizinha (por exemplo "Opç") continua aparecendo sob o esmaecido, porque é o indício de que há mais abas (o mesmo do `ui/Abas`); se a lasca que incomodava for essa ponta, a saída é decisão de desenho (esmaecido mais largo, aba inteira ou nenhuma) e mexe em `ui/FaixaDeChips`/`ui/Abas`, peças compartilhadas.
- **Lasca: parcial.** O retângulo escuro saiu; a ponta da aba vizinha continua (fraca no claro, visível no escuro). O `AbasDeOpcao` tem rolagem própria e dá para esconder a ponta só nele (ex.: esmaecido mais largo ou aba inteira), sem mexer em `ui/Abas` nem `FaixaDeChips`; não feito porque muda o desenho e pede nova rodada de capturas.
- **Telas afetadas pela dica (`ui/Navegacao`, compartilhada):** todas as do treinador no PC com menu lateral; só muda a posição da dica do botão de recolher (nos dois estados, aberto e minimizado; o aberto não foi capturado). Padrão 4.6: nenhum (não é modal, formulário nem filtro). Esmaecido com o fundo da página dentro de cartão: a mesma troca de cor provavelmente vale onde `Abas` ou `FaixaDeChips` ficam dentro de um `Cartao` sem a prop `fundo`; não verificado nem alterado.
- Capturas em 1280 (menu) e 390 (abas), escuro e claro, antes e depois, ficaram fora do repositório.

## Conflitos previstos ao trazer a `main`
- `treinador/dieta/CartaoRefeicao.tsx` e `ComplementosDaDieta.tsx` (frente "seções nascem fechadas", lote C), `treinador/treino/*` (lote D) e `treinador/plano/*`; a frente da fibra acrescenta uma coluna "Fibras" na tabela.

## Fora do escopo
- Qualquer mudança de API ou de dados.

## O que ficou para trás
- Sessões do plano (chips do `SeletorDeSessoes`): sem arraste; continuam com ← → no `CartaoSessao`. Chips que quebram linha pedem destino em 2D (a regra `destinoDoArraste` já tem o eixo `linhas`) e alça dentro de cada chip; fica para quando o Gustavo pedir.
- Refeições no celular (cartões empilhados): sem alça (precisaria de um encaixe no `CabecalhoDoItem`, compartilhado com mobilidade e questionário); a ordem muda pelo ⋯ da refeição.
- Rolagem automática perto da borda: resolvida na web pelo plano `arrastar-com-copia-translucida` (19/11); no aparelho nativo continua sem (`shortcut:` em `ui/ArrasteDaLista.tsx`).
- Arraste por toque (Android/iOS, toque longo de 250 ms) não foi conferido em aparelho; só e2e com mouse na web.
- Opções em abas (1c): em 1280 o inspetor dá ~650 px à opção, abaixo dos 910 da tabela, então a tabela só aparece a partir de ~1541 px de janela (o empilhado segue em 1280); com três opções, a terceira aba fica atrás do esmaecido em 1280 e em 390 (as abas rolam, como no `ui/Abas`, e a comparação lista todas). O `e2e/editor-inspetor-sobras.spec.ts` (dieta, linhas 158-174) ainda procura "Opção A"/"Opção B" como títulos lado a lado: é da sessão principal (o arquivo também tem o treino).
- Menu (parte 3): no PC minimizado os passos do passeio dos itens agrupados saem (os itens só existem no submenu), como no grupo recolhido (D7 do `menu-grupos-recolhiveis`); o submenu no tablet nativo largo (Modal, Voltar do Android) não foi conferido em aparelho; submenu sem rolagem própria (cabe com até ~13 itens em 720 px); o "Expandir" fica com o realce de mouse preso depois de minimizar até o mouse passar nele (realce de hover do react-native-web; provavelmente já existia, porque o mesmo botão já mudava de lugar entre os modos, mas não foi conferido na base); `docs/design-e-front.md` 4.4 (`Navegacao`) e o parágrafo "Menu do treinador" do `AGENTS.md` ainda descrevem "Buscar com o recolher ao lado" (sessão principal); os guias em PDF (`scripts/guias/gerar.mjs`, saem de `ajuda/conteudo.ts`) não foram gerados de novo com a frase nova do menu.
