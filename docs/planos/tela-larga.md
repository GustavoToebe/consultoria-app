# Tela larga: faixas de largura, régua única e editores de campos a 1400 px (só app)

Situação: Concluída em 19/11/2026 · Onde: `main` (branch `tela-larga` integrada por fast-forward, `75e80165` e o alinhamento da dieta do commit seguinte) · Atualizado: 19/11/2026

Plano escrito depois da entrega (a frente andou sem arquivo aqui; registro feito na sessão de 19/11 a partir do git e do que o Gustavo decidiu).

## Objetivo
Em tela larga o app usa o espaço sem esticar campo nem texto: faixas de largura da área de conteúdo (compacta, normal, larga, ultralarga), uma régua única para as colunas e um teto para os editores de campos.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Faixas | Medidas na área de conteúdo, nunca na janela (`faixaDeLargura`, `tema/tokens.ts`): compacta, normal (1024), larga (1600), ultralarga (2400) | Gustavo |
| D2 | Editores de campos | O painel do item (inspetor do treino, refeição da dieta, seção da mobilidade) para em `LARGURA_EDITOR_DE_CAMPOS` (1400 px); texto corrido em `LARGURA_TEXTO_CORRIDO`. `tokens.ts` não importa `react-native` | Gustavo |
| D3 | Preferência "Largura do conteúdo" | Automática (padrão, sem teto de 1800 px) ou Limitada (1800 px) | Gustavo |
| D4 | Dieta em 1920 | O painel da refeição termina na borda dos cartões de cima: a coluna da lista cresce (de 280 até 400 px) só quando o painel já parou no teto. Ajuste local no `EditorDeDieta`, sem mexer em token nem peça compartilhada | Gustavo, 19/11 |

## Passos
- [x] Editor de treino e de dieta em 3 colunas na ultralarga, Ajuda em 3 colunas, financeiro, números e tabelas com teto — commits `408a557c`, `1f0132c9`, `6f13d016`, `ef9949f7`, `bb92a760`
- [x] Docs das faixas e da régua única — `b76bb7f2`, `9250719c`
- [x] Limite de 1400 px e constantes de largura — `ebbe2a8b`; `tokens.ts` sem `react-native` — `5e8dd710`
- [x] Capturas finais (claro e 390 de Início, dieta e Ajuda; 1920 com menu recolhido do treino e da dieta) — em 19/11/2026
- [x] Teste de 3440 px sem corrida de layout (`toPass`) — `75e80165`
- [x] Fast-forward da `main` para `75e80165` — 19/11/2026
- [x] Dieta em 1920 alinhada aos cartões de cima (D4) — teste novo em `e2e/tela-larga.spec.ts` (falhava com 104 px, passa com o ajuste); commit: ver `git log`
- Verificação: typecheck, lint (0 erros), jest 9.189 testes, e2e de 22 specs (486 passaram, 6 pulados só de captura do Mural, 0 falhas), `tela-larga.spec` 3 de 3 verdes.

## Fora do escopo
- Migrar os cerca de 63 arquivos que usam `useWindowDimensions` para a régua (critério: migra quem decide layout de conteúdo).

## O que ficou para trás
- Dieta em 390: "Fibras (g)" quebra em duas linhas e a barra do plano ocupa cerca de 25% da tela (README, Pendências soltas).
- Não conferido nas capturas: 1920 no claro, 390 no escuro, estados vazio, erro e carregando, teclado e foco.
