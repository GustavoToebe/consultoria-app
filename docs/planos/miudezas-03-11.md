# Miudezas de 03/11

Situação: Em revisão (PR aberto) · Onde: branch `miudezas-03-11` · Atualizado: 03/11/2026

## Objetivo
Fechar pendências pequenas soltas: a data de início da dieta, o separador do CSV da importação, o `.gitattributes` dos CSV, o 429 da inscrição, o atalho dos Primeiros passos, o aviso de `accessible={false}` na web e os e2e intermitentes.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Data de início da dieta | Segue `FaixaDeData.PLANEJAMENTO`; data em texto inválida (ex.: "2026-02-31") também dá erro em `dataInicio` | Claude (executor), a confirmar com o Gustavo |
| D2 | Destino do passo "Metodologia" dos Primeiros passos | Planejamento no chip Metodologias (`/treinador/planejamento?aba=treino&tipo=metodologia`), não a Biblioteca | Claude (executor), a confirmar com o Gustavo |
| D3 | Separador do CSV | Decidido pela linha do cabeçalho escolhida (`linhaDoCabecalho`), não pela primeira linha do arquivo | pendência do README (linha 83) |

## Passos
- [x] 1. Data de início da dieta na faixa de planejamento (`ValidadorDieta`, teste `dataDeInicioSegueAFaixaDePlanejamento`) — commit: `ba824985`
- [x] 2. `AGENTS.md`: `formatoDoPacote` tolera forma de carga desconhecida — commit: `d7723a9e`
- [x] 3. Separador do CSV pela linha do cabeçalho (`LeitorCsv.lerLivre`, `LeitorDePlanilha.ler`, `ImportacaoService`, testes) — commit: `28f011cf`
- [x] 4. `*.csv text eol=lf` no `.gitattributes` (`node --test` de `scripts/importacao`: 7 de 7) — commit: `6df49feb`
- [x] 5. 429 da inscrição com texto próprio (`TEXTO_LIMITE_DA_INSCRICAO`, `[codigo].tsx`, e2e `inscricao`) — commit: `5e1b3c25`
- [x] 6. Primeiros passos abre o Planejamento em Metodologias (`tipoDoPlanejamento` em `modelos.ts`, `?tipo=` em `planejamento/index.tsx`, e2e novo em `planejamento-colecoes`) — commit: `7afe1c45` (e2e novo verde no e2e completo de 03/11)
- [x] 7. Ícones lucide com `aria-hidden` em vez de `accessible={false}` (`Estados.tsx`, `CartaoAguaDoDia`, `CartaoDietaDoInicio`, `CartaoHoje`, `FolhaDoPainel`) — commit: `94c0e1a3`
- [x] 8. e2e intermitentes: esperas em `series-metodologia`, `comparacao-de-fotos`, `pasta-e-atualizacao`, `links-do-menu`, `lista-alunos-grupos` — commits: `6030076d`, `00fff3c0` ("hoje" em Brasília), `96471004` (esperas pela condição real)

## Passagem (03/11, noite)

**Prontos:** passos 1 a 5 e 7 (hashes acima).

**Pela metade:**
- Passo 6: o código está pronto; o e2e novo de `app/e2e/planejamento-colecoes.spec.ts` não rodou.
- Passo 8: não há causa comum.
  - `series-metodologia:498`: causa confirmada (o reload vinha antes da resposta do PUT e o `beforeunload` abortava); o conserto espera "Modelo salvo.".
  - `comparacao-de-fotos:39`, `pasta-e-atualizacao` (aba nova), `links-do-menu:20`, `lista-alunos-grupos:128`: a causa é hipótese; os consertos são esperas.
  - `agenda-calendario:866`: sem diagnóstico e nada alterado.
- Passo 7: conferido em dev em 7 telas do treinador; não conferido em `/entrar`, `/inscricao/x` nem nas telas do aluno.

**Últimas verificações (antes dos consertos do passo 8, salvo onde dito):**
- `mvn verify`: passou (exit 0) na versão final da API.
- typecheck e lint: passaram.
- jest: 223 suítes, 3539 testes, 0 falhas.
- e2e completo na 8101, 3 rodadas: 534/0, depois 535/1 (`lista-alunos-grupos.spec.ts:128`, 1280 px), depois 536/0.
- Estresse dos intermitentes: 1 falha em 120 antes dos consertos (`series-metodologia:498`); 132 de 132 depois.
- Não rodaram: o e2e completo depois dos consertos; o e2e novo de `planejamento-colecoes`; `inscricao` e `primeirosPassos` na versão final; a revisão do Opus.
- Não feito: `git merge origin/main` e PR (ficam com o Gustavo).

**Falta:** rodar o e2e completo na 8101; a revisão do Opus; o diagnóstico de `agenda-calendario:866`; conferir o passo 7 em `/entrar`, `/inscricao/x` e no aluno; confirmar D1 e D2 com o Gustavo; o merge da main e o PR.

## Fechamento (03/11, nuvem)
- `git merge origin/main` duas vezes (C e depois F), sem conflito.
- Na nuvem, as esperas de `links-do-menu` (evento de requisição) e `comparacao-de-fotos` (`networkidle`) não seguravam: 5 de 5 e 3 de 5 falhas. Trocadas por condições reais (endereços da guia nova desde que nasce; a entrada da Folha sai do histórico antes do reload): 54 de 54 em 6 repetições.
- O "hoje" do `pasta-e-atualizacao` passou a ser contado em Brasília (falhava das 21h à meia-noite em máquina UTC).
- Revisão independente: nada bloqueia. Aplicados: texto neutro no 429 da inscrição (o teto diário da consultoria também dá 429 e "deste endereço"/"alguns minutos" era falso), ordem dos comentários em `inscricoes.ts`, `AGENTS.md` com o separador do CSV e o `?tipo=`.
- Verificação depois do último merge: `mvn verify` verde; typecheck e lint verdes; jest 230 suítes, 3588 testes; e2e completo 601 passaram, 0 falharam, 8 pulados (com `TZ=America/Sao_Paulo`); `inscricao` de novo com o texto novo, 11 de 11.
- Fica para o Gustavo: confirmar D1 e D2; conferir o passo 7 em `/entrar`, `/inscricao/x` e nas telas do aluno (a revisão confirmou que o lucide já põe `aria-hidden` e que nada muda no visual).

## Fora do escopo
- `agenda-calendario.spec.ts:866` intermitente: sem diagnóstico (Pendências soltas).
- O `expo start` reescreve o `app/tsconfig.json` (Pendências soltas).

## O que ficou para trás
- As duas linhas acima, também em "Pendências soltas" do README.
