# Superfície pintada lisa nas claras

Situação: Aplicada e commitada na main local, sem push (verificações abaixo) · Onde: main (local) · Atualizado: 26/11/2026

## Objetivo
Nas paletas claras o degradê da superfície pintada ia até o branco e a metade direita do cartão sumia no fundo (Saraiva: "no fundo
branco não ficou tão destacado"). A tinta passa a ser lisa no cartão inteiro nas claras, a borda fica neutra e a cor fica só no
ponto e no valor. A regra mora num lugar só, `ui/superficiePintada.ts`, não tela por tela. Continua a frente
[cartao-de-indicador-pintado.md](cartao-de-indicador-pintado.md) (23/11).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Fundo nas claras (Claro, Areia, Céu, Lavanda, Rosa) | Tinta lisa a 14% no cartão inteiro, sem degradê. Escolhida entre (a) 11% liso e (b) 14% liso numa prancha lado a lado (1280, Claro e Areia) | Gustavo, 26/11 |
| D2 | Fundo no escuro | Mantém o degradê de 14% (decisão visual aprovada) | Gustavo |
| D3 | `textoSuave` | O do tema, sem tom próprio: sobre a tinta de 14% passa 4,5:1 nas cinco claras, pior caso 4,76 (Céu sobre `superficie2`); medido com as cores de situação e de identificação sobre `superficie` e `superficie2` | Gustavo, a partir da medição |
| D4 | Borda | Neutra (`divisor`) em toda superfície pintada; a barrinha à esquerda fica onde já existia (séries) | Gustavo |
| D5 | Rótulo | Neutro (`textoSuave`) em toda superfície pintada; cor só no ponto e no valor (Financeiro, Números, Interessados, resumo do aluno, mini-cartões do Início, Séries por tipo, banner, Barra de descanso, ladrilhos do peso, da atualização e da importação) | Gustavo |
| D6 | Banner "Próximo passo" | Ganha a barrinha à esquerda na cor da situação (âmbar; `perigo` no atraso), a mesma peça das séries (`CamadaDaSerie`), em todos os temas, sem tinta mais forte só nele | Gustavo |
| D7 | Hover do mini-cartão do Início | Pinta sobre `superficie3` (o hover do cartão neutro): sobre `sobre` o `textoSuave` caía a 4,33:1 (Céu) e 4,39:1 (Claro) com 14%. Era essa a razão do "acima de 11% o `textoSuave` cai" da D1 da frente de 23/11 | Sessão principal (restrição medida) |
| D8 | Largura da barrinha | Gustavo, 26/11: 4 px nos dois, a mesma peça das séries (`LARGURA_DA_FAIXA_DA_SERIE`); o "3 px" do pedido era aproximação | Decidida |

## Passos
- [x] 1. `ui/superficiePintada.ts` (14% liso nas claras, degradê no escuro, borda `divisor`, `degrade` nulo nas claras) — commit/run: —
- [x] 2. Rótulos neutros: `aparenciaDoIndicador`, `CartaoMini`, `ProximoPasso`, `BarraDescanso`, `ResumoDaSessao`, `ResumoDoPeso`, `ResumoDaAtualizacao`, `TelaImportacao`, título do recorde (`ExercicioAluno`); `Tabela` com o fio sempre `divisor` — commit/run: —
- [x] 3. Barrinha no `ProximoPasso` (`CamadaDaSerie`, só a faixa) — commit/run: —
- [x] 4. Testes: `tema/tokens.test.ts` (fórmula, liso nas claras e degradê no escuro, `textoSuave` ≥ 4,5:1 nas cinco claras), `ui/contrasteDasPecas.test.ts`, `ui/Tabela.test.tsx` — commit/run: — (jest 461 suítes e 11.201 testes verdes; `tsc` limpo; `lint` sem erro)
- [x] 5. E2e ajustados (`cores-por-situacao`, `ficha-em-abas`, `ficha-resumo-em-cartoes`, `financeiro-visao-geral-19-11`, `ficha-lesoes-tabela`); suíte completa em 26/11: 3.364 passaram, 314 pulados (capturas sem `CAPTURAS_PALETAS`), 2 falharam e passaram isoladas depois (`ficha-lesoes-tabela` por causa do fio neutro, ajustada; `editor-de-treino-reorganizado:358` em 390 px, intermitente) e prancha com Lavanda também em 1280 (`capturas-paletas.spec.ts`) — commit/run: —
- [x] 6. Prancha completa em 390 e 1280 (Início, Financeiro, editor de treino, dieta; Claro, Areia, Céu, Lavanda, Rosa e Escuro): 48 capturas, 0 texto abaixo do mínimo, 0 rolagem lateral, 0 erro de página — commit/run: —
- [x] 7. `docs/design-e-front.md` (4.1, 4.4, 4.5, 4.6) e `AGENTS.md` — commit/run: —
- [x] 8a. Commit local na `main` ("Superfície pintada lisa a 14% nas paletas claras"), só desta frente — commit/run: ver `git log`
- [ ] 8b. Push, depois que o Gustavo conferir no celular e avisar — commit/run: —

## Fora do escopo
- Trocar a fonte mono dos valores em dinheiro por números tabulares na fonte normal: o Gustavo vai perguntar ao Saraiva.
- Degradê do escuro e pintura no nativo (Android e iOS) não foram vistos renderizados; só o web (capturas).

## O que ficou para trás
- D8 decidida (4 px nos dois); nada pendente.
- Claro e Rosa em 390 e 1280 e a Lavanda em 390 passaram nas medições automáticas, mas só Areia, Céu, Escuro e Lavanda (1280) foram abertos e olhados imagem a imagem.
