# Cartão de indicador pintado

Situação: Entregue (commit `328df011`, publicado no run 45310566613) · Onde: main · Atualizado: 23/11/2026

> Atualização de 26/11/2026: fundo liso a 14% nas claras, degradê só no escuro, borda neutra e rótulo neutro; ver [superficie-pintada-lisa.md](superficie-pintada-lisa.md). As decisões D1 a D3 abaixo valem como estavam em 23/11.

## Objetivo
O cartão de indicador com significado (situação ou categoria) passa a ser "pintado": fundo em degradê da cor, borda de 1 px na
cor e rótulo e número na cor quando legíveis. O resto fica neutro. Uma peça só (`ui/CartaoDeIndicador`) e uma regra reutilizável
(`ui/superficiePintada`) para todas as telas, em vez de estilo por tela.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Fundo | Degradê de 135° da cor misturada à base (14% nas escuras; 11% nas claras e na Areia, subido de 8% em 26/11: o claro ficava apagado; acima de 11% o `textoSuave` cai abaixo de 4,5:1 no Claro e no Céu, e chegar a 14% pede escurecer o `textoSuave` das claras) até a base pura em 70%; `experimental_backgroundImage` no nativo (RN 0.86), `backgroundImage` no web; `forte` liso por baixo | Gustavo (pedido de 23/11); caminho conferido no código instalado do RN e do react-native-web |
| D2 | Borda | 1 px (`bordas.bloco`), cor a 50% sobre a base; a faixa grossa à esquerda saiu | Gustavo |
| D3 | Texto | Rótulo e número na cor só se ≥ 4,5:1 no ponto mais forte; senão `texto`. Detalhe em `textoSuave` | Gustavo (valor); rótulo pela WCAG 1.4.3 |
| D4 | Cores | Recebido/Pago `sucesso`; A receber/Em aberto/Vencendo/Para revisar `atencao`; Em atraso/Vencido/Atrasadas/Saídas avulsas `perigo`; Receita recorrente `informacao`; Recordes `conquista`; Entradas avulsas no azul dos Lançamentos; tipos de série na cor de identificação; resto neutro; zero e "—" neutros | Gustavo |
| D5 | Contrato | `superficiePintada(cor, base, variante, cores)` → `{ base, forte, degrade, borda, texto }`; `fundoPintado(p)` | Executor-front, a pedido do coordenador (reuso na ficha › Dados, lesões ativas) |

## Passos
- [x] 1. Regra pura `ui/superficiePintada.ts` e `ui/aparenciaDoIndicador.ts`, testes em `tema/tokens.test.ts` e `ui/contrasteDasPecas.test.ts` — commit/run: —
- [x] 2. `CartaoDeIndicador` pintado; Visão geral, Totais das Cobranças, Resultado do mês (também em Lançamentos) — commit/run: —
- [x] 3. Migrados para a peça: Interessados › Indicadores e "Treinos registrados" do resumo do aluno; `NumeroDeDestaque` (componente) apagado — commit/run: —
- [x] 4. Pintados sem migrar: mini-cartões do Início (`CartaoMini`), Séries por tipo (`ResumoDaSessao`), diferença do peso (`ResumoDoPeso`), variação no resumo da atualização (`ResumoDaAtualizacao`), "com erro" da importação (`TelaImportacao.Numeros`) — commit/run: —
- [x] 5. `docs/design-e-front.md` (4.1, 4.4, 4.5, 4.6) — commit/run: —
- [x] 6. E2e ajustados ("cartão de indicador pintado (23/11)"): `financeiro-visao-geral-19-11` (degradê no web), `interessados-indicadores` (mede o cartão, não o rótulo), `ficha-em-abas` (treinos da semana neutros) — commit/run: —
- [ ] 7. Commit e push pela sessão principal — commit/run: —

## Fora do escopo
- Degradê no nativo (Android/iOS) não foi visto renderizado; só o web (capturas). Conferir no próximo APK.
- `AGENTS.md` (item "Financeiro, Números e alimento (19/11)") ainda descreve o cartão antigo: atualização fica com o coordenador.

## O que ficou para trás
- Conferir o degradê no APK Android e no iPhone (o `forte` liso por baixo garante a legibilidade se não pintar).
