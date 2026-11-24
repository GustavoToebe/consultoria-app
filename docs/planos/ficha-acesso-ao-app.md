# Ficha › Acesso ao app na lista de dados

Situação: Em andamento (código pronto, sem commit) · Onde: branch `ficha-24-11` · Atualizado: 24/11/2026

## Objetivo
O cartão "Acesso ao app" da ficha passa a ser a mesma lista de dados dos outros cartões (`ui/ListaDeDados`, plano
`ficha-lista-de-dados.md`): situação, e-mail de acesso, último login e senha numa linha cada, com as ações à direita, para
o treinador ver o estado do acesso e agir sem ler frases.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Cabeçalho | Só o título "Acesso ao app"; as ações vão para a coluna da direita das linhas | Pedido de 24/11 |
| D2 | Linhas | Situação (selo), Convite (só sem conta), E-mail de acesso (+ copiar), Último login, Senha (•••••• + "Definir nova senha") | Pedido de 24/11; Convite pelo executor |
| D3 | Último login | "Hoje, 18:38" / "Ontem, 18:38" / "17/10 18:38" no fuso de Brasília (`dominio/acessoAoApp.ultimoLoginNaLinha`), data completa na dica e no nome acessível, "—" sem login; `ACESSO` diz "Último acesso ao app" | Pedido de 24/11 + regra da ficha (login nunca é acesso) |
| D4 | Sem acesso | Não existe `FolhaDeAcesso` neste código: as duas ações do antigo cabeçalho ficam nas linhas, "Gerar convite" na linha Convite e "Definir e-mail e senha" na linha Senha | Executor |
| D5 | Ações | Todas `secundario` sem ícone (o `Botao` não tem tamanho pequeno; criar seria mudar o design system); "Gerar convite" deixou de ser `primario` | Executor |
| D6 | "Entra com …" | Some; o e-mail está na própria linha | Pedido de 24/11 |

## Passos
- [x] 1. Regra pura e teste (`dominio/acessoAoApp.ts`, `acessoAoApp.test.ts`) — commit/run: —
- [x] 2. `treinador/CartaoAcesso.tsx` na lista de dados, estados mantidos (com acesso, aguardando primeiro acesso, sem acesso com e sem convite, inativo, anonimizado, sem `ALUNO_CONVITE`) — commit/run: —
- [x] 3. e2e ajustados e capturas em `capturas/24-11/item-5-acesso/` (fora do git) — commit/run: —

## Fora do escopo
- `dominio/fichaDados.ultimoAcessoNaFicha` ficou sem uso (o arquivo é do item 1); apagar no próximo ajuste dele.

## O que ficou para trás
- (nada)
