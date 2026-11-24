# Comunidade › Vídeos: cabeçalho de coleção

Situação: Entregue (commit `a50a7cb1`, só local; sem push) · Onde: main · Atualizado: 23/11/2026

## Objetivo
Separar as playlists na aba Vídeos: o nome da coleção tinha quase o peso do título do vídeo e as seções se emendavam. O
cabeçalho fica mais forte (sobretítulo "COLEÇÃO N", nome de título de seção, contagem em pílula) e um fio separa as seções,
igual no treinador e no aluno.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Sobretítulo | "COLEÇÃO N" pela ordem exibida; "SEM COLEÇÃO" sem número e sem nome; variante `secao` (12 px, caixa alta pelo estilo, `textoSuave`) | Gustavo (pedido de 23/11); 12 px em vez de ~11 para usar a variante do sistema: executor-front |
| D2 | Nome | 20/26 semibold, acima do título do vídeo (16); renomear no título não muda | Gustavo |
| D3 | Contagem | Pílula neutra (`superficie3`, 12 semibold, `textoSuave`), fonte numérica só no número; "1 vídeo", "N vídeos", "0 vídeos" (`resumoDosAuloes`) | Gustavo |
| D4 | Separação | Fio `divisor` de largura total acima de cada seção menos a primeira; 20 px de cada lado (~40 entre seções); 16 px do cabeçalho à grade | Gustavo |
| D5 | Nome acessível | h2 "Coleção 1: Treinos, 1 vídeo" / "Sem coleção, 2 vídeos" (`dominio/cabecalhoDaColecao.textosDoCabecalho`) | Gustavo |
| D6 | Numeração | Igual à do aluno: só numera a coleção que o aluno vê (com ao menos um vídeo publicado, `colecoesQueOAlunoVe`), de 1 em diante na ordem exibida; a vazia (ou só com rascunho) continua no treinador com "COLEÇÃO" sem número e o nome acessível "Coleção: Novidades, 0 vídeos". Filtro e busca não renumeram | Gustavo, 23/11 (aprovada a numeração igual à do aluno) |
| D7 | Arraste da seção | A cópia é só o cabeçalho; a seção inteira continua sendo o alvo (a linha guia cai no fio) | Gustavo (o que se move); executor-front (o alvo) |
| D8 | Aluno | Mesmo cabeçalho, sem cartão em volta; continua abrindo e fechando (4.8): o cabeçalho é o botão dentro do h2 (acordeão do APG), estado só no `aria-expanded`, vídeos viram h3 | executor-front; aprovada pelo Gustavo em 23/11 |
| D9 | Espaço × altura | O espaçamento pedido (fio, ~40 px, sobretítulo) passa o segundo cartão 15 px em 1280×900; o e2e garante só a capa do segundo vídeo à vista sem rolar | executor-front; aprovada pelo Gustavo em 23/11 |

## Passos
- [x] 1. Regra pura `dominio/cabecalhoDaColecao.ts` + teste; `palavraDosAuloes` em `dominio/comunidade.ts` — commit/run: —
- [x] 2. Peça `comunidade/CabecalhoDaColecao.tsx` (cabeçalho e `FioEntreColecoes`), usada por `treinador/comunidade/SecaoDaColecao` e `aluno/ColecoesDeAuloes` — commit/run: —
- [x] 3. e2e ajustados e casos novos (`comunidade-videos-19-11`, `comunidade-colecoes-aluno`, `comunidade`) — commit/run: —
- [x] 4. D6 (Gustavo, 23/11): numeração do treinador igual à do aluno, a vazia sem número (`colecoesQueOAlunoVe`, `ListaDosVideos`, teste e e2e) — commit/run: —

## Fora do escopo
- Atualizar a seção 4.11 do `docs/design-e-front.md` (ainda diz "nome (h2), 'N vídeos'" e o aluno com cartão).
- Pílula de contagem como peça de `ui/` (hoje Abas, menu e esta pílula têm cada um a sua).

## O que ficou para trás
- Arraste da seção e o cabeçalho não conferidos no aparelho nativo nem nos temas Areia e alto contraste.
