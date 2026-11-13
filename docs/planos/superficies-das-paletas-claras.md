# Superfícies das paletas claras

Situação: Concluída em 12/11/2026 · Onde: `main`, commit `010f6727` · Atualizado: 12/11/2026

## Objetivo
Nas paletas claras (Claro, Areia, Lavanda, Céu e Rosa) o cartão, o campo e a página tinham a mesma cor: no PC o
conteúdo ficava num `painel` branco, igual ao cartão e ao campo (Planejamento › Semanas de treino: o cartão e o "Buscar
modelo" não se destacavam). O modo padrão passa a separar a página do cartão pelo tom, sem sombra e sem borda grossa;
"Contraste alto" e "Bordas reforçadas" continuam como reforço adicional.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Página tingida, cartão e campo brancos | `fundo` e `painel` (o mesmo tom nas claras) tingidos; `superficie` e `campo` continuam `#FFFFFF` | Gustavo, 12/11 (pedido com consultoria de design) |
| D2 | O campo se separa do cartão pelo contorno, não por um fundo cinza | `bordaCampo` (≥ 3:1) já é bem mais forte que o `divisor` do cartão; campo cinza ficaria parecido com o desabilitado (`superficie3`) | executor-front, 12/11 |
| D3 | Faixa do título e linhas (`superficie2`) entre a página e o cartão | mais clara que a página nova, para a faixa não se confundir com ela (o que o print mostrava) | executor-front, 12/11 (o pedido autorizou revisar a faixa) |
| D4 | Seleção continua neutra (`superficie3` + `bordaCampo` + ✓); Claro e Areia sem mudança | Céu e Rosa ganharam um passo de tom na seleção para continuar ≥ 1,1:1 contra o fundo novo (o item ativo do menu fica sobre ele) | executor-front, 12/11 |
| D5 | Trava `borda` × `fundo` de 1,8 para 1,7 | existia porque o cartão branco "sumia" no fundo quase branco; agora quem separa é o tom (trava nova) | executor-front, 12/11 |
| D6 | Nada de sombra, borda grossa nem cor nova; paletas escuras, texto, status, marca e fases intocados | — | Gustavo, 12/11 |

A decisão D1 do `editor-de-treino-visual.md` (fundo quase branco, 30/10) fica substituída: o cinza de então
(`#EAEAED`) se confundia com a faixa, que era mais escura; o tom novo é mais claro e a faixa passou a ficar acima dele.

### Valores (antes → depois)
| Paleta | `fundo` / `painel` | `superficie2` (faixa, linha, hover) | `superficie3` (seleção) | cartão × página (PC) |
| --- | --- | --- | --- | --- |
| Claro | `#F7F7F8` / `#FFFFFF` → `#F2F2F4` / `#F2F2F4` | `#F4F4F5` → `#F8F8F9` | `#E7E7EA` (igual) | 1,00 → 1,12 |
| Areia | `#FAF9F6` / `#FFFFFF` → `#F3F1EB` / `#F3F1EB` | `#F7F5F0` → `#F9F7F2` | `#E7E3DB` (igual) | 1,00 → 1,13 |
| Lavanda | `#F7F8FF` / `#FFFFFF` → `#EFF0FA` / `#EFF0FA` | `#F4F4F5` → `#F8F8F9` (do Claro) | `#E6E0FF` (igual) | 1,00 → 1,13 |
| Céu | `#F0F7FF` / `#FFFFFF` → `#EBF2FC` / `#EBF2FC` | `#F4F4F5` → `#F8F8F9` (do Claro) | `#DBEAFE` → `#D5E5FB` | 1,00 → 1,13 |
| Rosa | `#FFF9FB` / `#FFFFFF` → `#FAEFF3` / `#FAEFF3` | `#F4F4F5` → `#F8F8F9` (do Claro) | `#FCE7F3` → `#F8DCEA` | 1,00 → 1,12 |

No celular (sem `painel`) o cartão × página ia de 1,04–1,08 para 1,12–1,13. `textoSuave` sobre o fundo novo: 6,81 a
6,91 (≥ 4,5); `bordaCampo` sobre o fundo: 3,45 a 4,18 e sobre o cartão 3,91 a 4,72 (o `divisor` do cartão: 1,42 a 1,48).
O espelho CSS do tema claro (`app/global.css`, `--color-background`, `--color-muted`, `--color-secondary`) acompanha.

## Passos
- [x] 1. Capturas "antes" com os tokens antigos (spec temporário, API simulada) — evidência abaixo
- [x] 2. `fundo` e `painel` tingidos nas cinco claras; capturas; faixa ainda igual à página → `superficie2` mais claro (passo seguinte)
- [x] 3. `superficie2` do Claro e da Areia; capturas "depois"; travas em `tema/tokens.test.ts`; espelho em `global.css`; `e2e/agenda-legivel.spec.ts` (cor esperada da `superficie2`)
- [x] 4. `docs/design-e-front.md` 4.3 com os valores novos — commit/run: — (a sessão principal integra)

## Evidência (12/11)
- Travas novas em `app/src/tema/tokens.test.ts`: nas claras, cartão e campo ≥ 1,1:1 contra `fundo` e `painel`; contorno
  do campo ≥ 2 × o do cartão; `superficie2` entre a página e o cartão (≥ 1,04:1 de cada lado); `painel` = `fundo`.
- Comandos (em `app/`), todos verdes em 12/11: `npx tsc --noEmit`; `npx eslint` em `tokens.ts`, `tokens.test.ts` e
  `agenda-legivel.spec.ts`; `npx jest` (301 suítes, 6521 testes); e2e (247 testes) `planejamento-colecoes`,
  `financeiro`, `agenda-legivel`, `paletas-da-marca`, `marca-paletas`, `paleta-do-aluno`, `cores-por-situacao`,
  `impressao-emulada`, `abas-foco`, `folha-foco`, `larguras-ajustes-cadastro-lembretes`, `composicao-rodape`,
  `filtros-nas-listas`, `biblioteca-catalogo`, `comparacao-de-fotos` e `agenda-composicao`.
- Capturas (fora do repositório, pasta temporária da sessão `scratchpad/superficies/`): `antes-<paleta>-<tela>.png` e
  `depois-<paleta>-<tela>.png` para as cinco paletas em Planejamento (1440 e 390 px), Novo lançamento (formulário),
  Cobranças com os filtros abertos e Ajustes › Tema (seleção e foco do teclado), mais o Claro com contraste alto, o
  Claro e a Areia com bordas reforçadas (Planejamento 1440).

## Fora do escopo
- Paletas escuras, tokens de texto, status, marca e fases.
- `ui/Campo.tsx` (outra frente com alterações locais): não precisou mudar.

## O que ficou para trás
- Não conferido renderizado: tema escuro (não mudou), texto ampliado, área do aluno, Agenda e editor de treino nas
  claras (a `superficie2` mais clara deixa o hover das linhas e o item da agenda um pouco mais suaves; contraste coberto
  pelos testes).
- No celular (390 px), o botão "Nova semana de treino" do Planejamento sai cortado à direita (já era assim antes; não é
  das superfícies).
