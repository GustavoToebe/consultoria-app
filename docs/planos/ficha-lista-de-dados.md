# Ficha › Dados: lista de dados com divisões (peça `ui/ListaDeDados`)

Situação: Em andamento (código pronto, sem commit) · Onde: branch `ficha-24-11` · Atualizado: 24/11/2026

## Objetivo
Os pares rótulo–valor da ficha do aluno passam a ser uma lista de verdade: rótulo numa coluna fixa, valor ao lado, ações
sempre no mesmo lugar à direita e um fio entre as linhas, para o treinador achar cada dado e cada ação sem caçar.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Peça compartilhada | `ui/ListaDeDados` (`ListaDeDados`, `LinhaDeDado`, `SubtituloDeDados`); regra pura em `dominio/listaDeDados.ts` | Pedido de 24/11 |
| D2 | Coluna do rótulo | 200 px × tamanho do texto (`larguraDoRotulo`); "Questionário de atualização" numa linha | Pedido de 24/11 |
| D3 | Quando empilha | A lista mede a própria largura: empilha abaixo de rótulo + 16 + 200 (× texto); a lista inteira junta, ações à direita do valor | Executor (padrão 4.10: medir a área, não a janela) |
| D4 | Linha | 48 px mínimos, respiro 8 em cima e embaixo, a ação de 44 px entra sem esticar a linha; fio `divisor` só entre as linhas | Pedido de 24/11 |
| D5 | Vazio | Prop `vazio`: "Não informado" nos Dados do aluno (regra do AGENTS.md), "—" no resto | Executor |
| D6 | Fonte numérica | Só nos números do valor (`partesNumericas`): data, CPF, telefone, o "15" de "15 dias" | Pedido de 24/11 |
| D7 | Acessibilidade | Cada grupo `role="list"`, cada linha `listitem` com `term` + `definition` (o react-native-web 0.21.3 não gera `dl`/`dt`/`dd`; os papéis saem como atributo `role`); o par mantém o nome "Rótulo: valor" e as ações ficam fora dele | Executor (lido em `node_modules/react-native-web`) |
| D8 | Configuração do acompanhamento | Subtítulos ACOMPANHAMENTO, PLANO e COMUNIDADE; PLANO e COMUNIDADE só com a linha deles | Pedido de 24/11 |

## Passos
- [x] 1. Regra pura e teste (`dominio/listaDeDados.ts`, `listaDeDados.test.ts`) — commit/run: —
- [x] 2. Peça `ui/ListaDeDados.tsx` — commit/run: —
- [x] 3. Dados do aluno (os quatro cartões), linha do ciclo, linha do grupo, Plano contratado e Conta › Meus dados — commit/run: —
- [x] 4. e2e ajustados (rótulos novos) e capturas em `capturas/24-11/item-4-lista-de-dados/` (fora do git) — commit/run: —

## Fora do escopo
- Os outros usos de `CampoLeitura` (Interessados, Vitrine, Agenda, Financeiro › folha da cobrança, Equipe) não migraram: são
  formulários e folhas com rótulo em cima, sem a coluna de ações; ficam para quando cada tela for mexida.
- A largura das colunas da aba (3fr/2fr) é do item 1 (`ficha-dados-colunas-independentes.md`, outro agente).

## O que ficou para trás
- `dominio/fichaDados.ultimoAcessoNaFicha` fica sem uso depois do item 5 (o arquivo é do item 1); apagar junto do próximo
  ajuste daquele arquivo.
