# Hierarquia visual nos três temas (escada de superfícies, botão principal, cores de situação, vidro)

Situação: Em andamento (Onda 1A, 2D e 3H da sessão de 17/11/2026) · Onde: main · Atualizado: 17/11/2026 · Base: `e6537dc3` (sem commit de código ainda)

Fonte: decisões do Gustavo de 17/11/2026 (prompt da sessão). Validade: vale enquanto `app/src/tema/tokens.ts` e `docs/design-e-front.md` não mudarem fora desta frente; se mudarem, refazer as razões de contraste antes de reaproveitar.

## Objetivo
Cartão, faixa do título, poço e página se distinguem nos temas Claro, Areia e Escuro; o botão principal fica neutro (preto no claro e na Areia, branco no escuro) e a marca vira sinal (menu ativo, título, cartão "Hoje"); as cores de situação passam a cinco papéis com variante por tema; a barra inferior do aluno, a barra de descanso, o aviso de recorde e os cabeçalhos fixos ganham vidro (blur) sem perder contraste.

Substitui os passos 1 a 6 de [areia-contraste-e-cor.md](areia-contraste-e-cor.md) (os passos 7 a 10 de lá continuam valendo).

## Registro: a Areia de `#F4F1EA` não foi deliberada
O `AREIA` gravado em `tokens.ts` em 16/11 às 21:27 (página `#F4F1EA`, cartão `#FFFFFF`, razão cartão × página 1,13:1) **não foi uma decisão do Gustavo**. Isso resolve o passo 1 do plano da Areia: vale a escada abaixo, com piso de 1,6 na Areia.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Pisos de contraste por tema (cartão × página) | Claro ≥ 1,35, Areia ≥ 1,6, Escuro ≥ 1,15; borda × cartão ≥ 1,4; texto × cartão ≥ 7 | Gustavo, 17/11 |
| D2 | Faixa do título ≠ cartão e ≠ página; poço ≠ cartão | travado em teste, um por tema | Gustavo, 17/11 |
| D3 | Claro | página `#D9DCE1`, cartão `#FFFFFF`, faixa `#F2F3F5`, poço/`superficie2` `#EEF0F2`, campo `#FFFFFF` com `bordaCampo` | Gustavo, 17/11 |
| D4 | Areia | página `#CDCAC3`, cartão e campo `#FFFFFF`, faixa `#EDEBE7`, poço `#F1EFEB`, `faixaForte` `#C3C0B8` | Gustavo, 17/11 |
| D5 | Escuro | página `#09090B`, cartão `#1C1C20`, faixa `#26262B`, poço `#0F0F11` (mais escuro que o cartão), borda `#34343A` | Gustavo, 17/11 |
| D6 | Meia-noite, Oceano, Ameixa, Céu, Lavanda, Rosa | mesma escada, com o tom da paleta; ajustar um valor só se um piso não fechar e anotar a razão final de cada par aqui | Gustavo, 17/11 |
| D7 | Botão principal | `Botao primario` = fundo `texto`, texto `fundo`; destrutivo = contorno e texto em `perigo`, sem fundo cheio; tipo `cta` e `stndrd.cta` apagados (`ProximoPasso.tsx` usa `primario`) | Gustavo, 17/11 |
| D8 | Uso da marca | só no menu ativo, no título e no cartão "Hoje" do aluno | Gustavo, 17/11 |
| D9 | Cores de situação | sucesso, atenção, perigo, informação, conquista. Escuro `#00E699 #FFB020 #FF4D6A #4D9BFF #B57BFF`; Claro e Areia `#0E7A43 #8A5300 #C01834 #1D5FD1 #7A2FD0`; pílula tingida a 12%; número principal sempre na cor do texto; tokens neon do estudo (`acidLime` etc.) trocados | Gustavo, 17/11 |
| D10 | `BadgeNivel` | textos Iniciante, Intermediário, Avançado, cor de conquista; continua sem ligar em tela | Gustavo, 17/11 |
| D11 | Vidro | `expo-blur` na barra inferior do aluno, `BarraDescanso`, `AvisoDeRecorde` e cabeçalhos fixos; cartões de dados continuam sólidos; fundo ≈ 0,8 de opacidade (texto ≥ 4,5:1 sem blur); "reduzir transparência" (AccessibilityInfo) → fundo sólido; web com `backdrop-filter`; APK novo | Gustavo, 17/11 |
| D12 | Botão `destaque` | fundo tingido a 12% da cor de informação do tema, texto e ícone na cor de informação; usado em "Usar receita", "Modelos prontos" e "Adicionar refeição" (C94, C97); continua um primário por área | Gustavo, 17/11 |
| D13 | Sem camada de compatibilidade | os valores novos substituem os antigos, sem flag | regra do projeto |

## Passos
- [ ] A1. Escada de superfícies, teste primeiro (`tokens.test.ts`, `tokens.ts`, `global.css`) — executor-front · APK: sim (valor de token em JS) · commit: —
- [ ] A2. Botão principal invertido; apagar `cta` (`ui/Botao.tsx`, `ProximoPasso.tsx`) — executor-front · commit: —
- [ ] A3. Cinco papéis de situação, pílula a 12%, contraste em `contrasteDasPecas.test.ts`; tabela 4.5 e seção de botões do `design-e-front.md` — executor-front · commit: —
- [ ] A4. `BadgeNivel` — executor-front · commit: —
- [ ] D. Vidro (depende de A) — executor-front · APK novo, anotar em `docs/build-celular.md` · commit: —
- [ ] H2. Variante `destaque` do `Botao` e uso nos três botões (depende de D e de C81/C97 da frente do editor) — executor-front · commit: —

## Razão final de cada par (a preencher pelo executor-front)
| Tema | cartão × página | borda × cartão | texto × cartão | observação |
| --- | --- | --- | --- | --- |
| Claro | — | — | — | — |
| Areia | — | — | — | — |
| Escuro | — | — | — | — |
| Demais seis | — | — | — | — |

## Critérios de aceite
- Um teste por tema (Claro, Areia, Escuro) trava os pisos de D1 e D2; nenhum piso afrouxado, nenhum teste apagado.
- O contraste de cada cor de situação sobre o cartão e sobre o tingido de 12% está em `contrasteDasPecas.test.ts`, nos três temas.
- Nenhum uso de `cta`/`acidLime` sobra no código; `design-e-front.md` (tabela 4.5, botões, variante `destaque`) atualizado.
- Capturas fora do git, em 390 e 1280 px, nos temas Claro, Areia e Escuro, vistas na prancha da verificação final.

## Fora do escopo
- Mudar tipografia ou espaçamento; sombra no cartão (decidida contra em D4 do plano da Areia).
- `treinador/financeiro/` (`VisaoGeral.tsx`, `ResultadoDoMes.tsx`) é de outra sessão: se a troca de cores pedir mexer neles, parar e avisar o Gustavo.

## O que ficou para trás
- (nada ainda)
