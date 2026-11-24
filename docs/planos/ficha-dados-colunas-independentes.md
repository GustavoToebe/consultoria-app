# Ficha › Dados: colunas independentes

Situação: Em andamento (código e verificações locais feitos, sem commit) · Onde: branch `ficha-24-11` · Atualizado: 24/11/2026

Fonte: pedido do Gustavo para a noite de 24/11 (item 1), passado pela sessão principal. Base: `82202480` mais o estado local
da worktree `ficha-24-11` (outros agentes mexendo em `DadosDoAluno`, `CartaoLesoes`, `ui/Tabela` e `ficha-dados.spec.ts` ao
mesmo tempo). Validade: refazer "Passos" se `DadosDoAluno`, `BlocosDaFicha`, `ui/Tela` (`useFaixaDaTela`) ou as faixas de
`tema/tokens.ts` mudarem.

## Objetivo
Tirar os vãos entre os cartões da aba Ficha do aluno › Dados: em vez de linhas com proporções diferentes (1:1 em cima, 2:1
embaixo), duas colunas independentes, cada uma uma pilha com o mesmo vão, numa proporção só para a página (3:2).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Colunas | Esquerda: Identificação › Contato e endereço › Plano contratado › Histórico de lesões. Direita: Configuração do acompanhamento › Objetivo e observações › Acesso ao app › Anamnese. Proporção 3:2, vão `espaco(3)` dentro de cada pilha; a diferença de altura fica no fim da mais curta | Gustavo (pedido) |
| D2 | Faixa que decide | `useFaixaDaTela()` (a faixa que a `Tela` mede, 4.10), não o `useFaixaDeLargura` medido dentro do recuo: em 1280 com o menu aberto a área tem 1040 px (`normal`) e o recuo deixa 1008 (`compacta`). O pedido pede duas colunas em 1280; o `useFaixaDeLargura` só continua como "já mediu" para não montar numa coluna e remontar em duas | Executor-front (noite; 4.10 do documento de design) |
| D3 | Ultralarga | A aba inteira (título "Dados do aluno", formulário de edição e as colunas) com teto `LARGURA_EDITOR_DE_CAMPOS` (1400), alinhada à esquerda; nas outras faixas, sem teto. Há salto na passagem de `larga` para `ultralarga` (a aba encolhe de ~2370 para 1400 px), o mesmo tipo de corte da regra do editor. **Substituída em 24/11 pela revisão de tela larga** (`tela-larga-revisao-ficha.md`, D1): o teto de 1400 vale sempre que há duas colunas, sem o salto | Executor-front (noite; leitura literal do pedido) |
| D4 | Onde moram as seções | As quatro seções continuam do `DadosDoAluno`; ele ganhou a prop `colunas` (os blocos que seguem cada coluna) e, com ela, põe as seções no topo de cada pilha (`ColunasDaFicha`, exportada do `BlocosDaFicha`). Sem `colunas` (faixa compacta) o arranjo antigo fica igual | Executor-front (noite) |
| D5 | Edição | Editando, o formulário fica em cima (as colunas 1:1 do `FormAluno`, sem mudança) e as colunas 3:2 seguem embaixo só com os blocos, no mesmo lugar da árvore: plano, acesso, anamnese e lesões não remontam nem buscam de novo ao abrir e fechar a edição | Executor-front (noite) |
| D6 | Celular e compacta | Coluna única em toda a faixa compacta: as quatro seções empilhadas (antes ficavam 1:1 com a aba entre ~864 e 1024 px), depois Lesões ativas › Plano › Acesso › Anamnese › Histórico (recuperadas) | Gustavo (pedido) |
| D7 | Títulos | Em duas colunas as quatro seções são `h2`, como os outros cartões (a ordem do DOM fica coerente); na compacta seguem `h3` sob "Dados do aluno" | Executor-front (noite) |

## Passos
- [x] 1. Regra pura `app/src/dominio/colunasDaFicha.ts` (colunas, proporção, faixa, ordem numa coluna, teto) com `colunasDaFicha.test.ts` (6 testes) — commit: —
- [x] 2. `treinador/BlocosDaFicha.tsx` (duas colunas pela `useFaixaDaTela`, `ColunasDaFicha`, teto da ultralarga), `treinador/DadosDoAluno.tsx` (prop `colunas`, só o embrulho do `Leitura`) e `app/treinador/alunos/[id].tsx` (repassa `colunas`) — commit: —
- [x] 3. E2e: `ficha-dados.spec.ts` (1280 e 1920: mesmo topo, ordem, vão de 24 px em cada coluna, razão 3:2, anamnese buscada uma vez; 390: coluna única na ordem do celular; lesões escolhem linha ou cartão pela presença da tabela) e `acesso-aluno.spec.ts` (largura das lesões comparada ao Contato, mesma coluna) — commit: —
- [x] 4. Capturas em `capturas/24-11/item-1-colunas/` (fora do git): 1920, 1280 e 390 em escuro, claro e Areia (aluno com plano, cobrança e lesão); aluno sem plano e sem lesões em 1920, 1280 e 390; texto grande em 1280 e 1920; ultralarga (2700); compacta larga (1200); erro no plano; edição em 1280. Rodada final com build limpa (TEMP próprio e `--clear`): 204 e2e ok e 8 falhas, todas do `CartaoAcesso` do agente A, gravado depois da exportação; o e2e também cobre a coluna única em 1200 — commit: —

## Fora do escopo
- Tabela das lesões na coluna da esquerda: em 1280 a coluna tem ~580 px e a tabela (colunas a partir de 800 px, `CartaoLesoes`, do agente B) vira cartões; em 1920 (~965 px) é tabela. O spec `ficha-lesoes-tabela.spec.ts` do agente B espera tabela em 1280 e precisa olhar 1920 (ou menu recolhido).

## O que ficou para trás
- Texto para o `AGENTS.md` e a 4.10 do `docs/design-e-front.md` (a sessão principal aplica): ver o relatório `capturas/24-11/item-1-relatorio.md`.
