# PDFs menores e mais rápidos

Situação: Em andamento · Onde: `main` · Atualizado: 28/10/2026

## Objetivo
Os PDFs do app (treino, dieta, mobilidade, cargas e lista de compras, do aluno e do treinador) saem menores e abrem mais
rápido: a logo entra reduzida, é baixada uma vez por sessão e o PDF do treinador deixa de esperar chamadas em fila.

## Conferência no código atual (cb69d23 → HEAD)
Os quatro pontos do pedido ainda valiam:
- **1. Tamanho:** `pdf/logo.ts` baixava a logo e embutia o original (até 2048 px e 512 KB) em `.topo img` (48×200 pt) e `.capa img` (110×280 pt).
- **2. Download repetido:** 8 chamadores de `logoComoDataUri`: `app/aluno/` treino, dieta, mobilidade, lista-de-compras e histórico; `treinador/gerarPdf.ts` (2 funções); `treinador/dieta/FolhaListaDeCompras`. Todos baixavam a logo a cada PDF.
- **3. Fila no treinador:** `gerarPdfDoPlano` fazia consultoria+aluno → `versaoPlano` → logo → (dieta) `pesosDoAluno`.
- **4. Base64 no celular:** `pdf/imprimir.ts` pede `base64: true` ao `expo-print` e regrava o arquivo no cache.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Lado maior da logo no PDF | 800 px, PNG (mantém transparência), nunca amplia; a conta fica em `dominio/logoDoPdf.ts` | Gustavo |
| D2 | Redução pelo `expo-image-manipulator` (`saveAsync` com `base64`), sem `fetch` de `blob:`/`data:` (CSP `connect-src 'self'`) | `pdf/logo.ts` | Gustavo |
| D3 | Falhou ao reduzir → logo original; sem internet → sem logo, como antes; só entra no PDF a redução que ficou menor que o original | `pdf/logo.ts` | Gustavo / Claude |
| D4 | Cache só em memória, chave = `logoUrl` (já leva `?v=`), guarda só sucesso e junta downloads simultâneos; limpo no "Sair" e na sessão recusada (`SessaoProvider`) | `pdf/logo.ts` | Gustavo |
| D5 | Treinador: `aluno`, `versaoPlano` e `pesosDoAluno` (só dieta, com `.catch(() => [])`) saem junto com `consultoria`; a logo encadeia só na `consultoria`. Regra rascunho × publicado intacta | `treinador/gerarPdf.ts` | Gustavo |
| D6 | Item 4 (copiar o arquivo do `expo-print` em vez de base64) só se for provado no aparelho (Android e iPhone, no APK). Não há aparelho nesta sessão: **não mexido** | — | Gustavo |

## Passos
- [x] 1. Medir o "antes" (tamanho com logo fictícia de 2048 px; idas à rede em fila do PDF do treinador) — números abaixo
- [x] 2. Conta do tamanho da logo (`dominio/logoDoPdf`) + redução e cache (`pdf/logo`, `pdf/logoEmMemoria`), com testes — commit `a35a9ae`; run 40714486714: testes verdes, **Trivy reprovou a imagem da web** (go-jose do `caddy:2-alpine`), `publicar` não rodou
- [x] 3. Limpar o cache no "Sair" e na sessão recusada (`SessaoProvider`) — commit `a35a9ae`
- [x] 4. Paralelizar `gerarPdfDoPlano` (`treinador/gerarPdf.test.ts` cobre a ordem e a regra rascunho × publicado) — commit `a35a9ae`
- [x] 5. Medir o "depois" e registrar os números abaixo
- [ ] 6. Item 4 do pedido (base64 no celular) — pendência: só se prova no aparelho (Android e iPhone, no APK)

## Medições (dados fictícios, Chromium `page.pdf` sobre o mesmo HTML)
Logo fictícia gerada na hora (nunca a real): PNG de 2048 x 1024, **494,6 KB** (no teto de 512 KB do servidor); reduzida a
800 x 400: **184,9 KB**. Treino de 5 dias com 2 exercícios cada; dieta com capa e 6 refeições; A4.

| PDF | Sem logo | Logo original | Logo reduzida | Ganho com a redução |
| --- | --- | --- | --- | --- |
| Treino | 59,2 KB | 354,1 KB | 170,7 KB | -183,4 KB (-52%) |
| Dieta (com capa) | 93,0 KB | 395,7 KB | 212,3 KB | -183,4 KB (-46%) |

O HTML que o `expo-print` recebe também encolhe: 666 KB → 253 KB (treino) e 667 KB → 254 KB (dieta).

Limites da medição: a redução foi feita no canvas do Chromium (`drawImage` com suavização alta), parecida com a da web do
`expo-image-manipulator` mas não idêntica (ele reamostra por Hermite), e o `page.pdf` não é o `expo-print` do celular. Os
KB do celular podem diferir; o sentido é o mesmo. A redução real no aparelho não foi medida.

**Idas à rede em fila no PDF do treinador** (cada linha é uma espera):

| Caso | Antes | Depois |
| --- | --- | --- |
| Treino ou mobilidade publicado | 3 (consultoria+aluno → versão → logo) | 2 (consultoria → logo; aluno e versão no meio) |
| Dieta publicada | 4 (+ pesos) | 2 |
| Treino ou mobilidade em rascunho | 2 | 2 |
| Dieta em rascunho | 3 | 2 |
| Cargas | 2 (consultoria → logo) | 2 |
| Qualquer um, 2º PDF da sessão com a mesma logo | igual ao acima | 1 a menos (a logo vem da memória) |

O número de downloads da logo por sessão cai de "um por PDF" para um por `logoUrl`.

## Fora do escopo
- Item 4 do pedido: ver D6 e "Pendências soltas" do README. A cópia do arquivo do `expo-print` (em vez de base64) só pode
  ser aceita depois de um teste no APK, em Android e de preferência em iPhone: o compartilhar já recusou esse arquivo no
  Expo Go ("Not allowed to read file under given URL"). Sem aparelho, `pdf/imprimir.ts` não foi mexido.
- A redução da logo no celular (leitura de `data:` pelo `ImageManipulator` nativo) não foi vista no aparelho. Se o redutor
  recusar, a logo vai como veio (D3), igual a antes: o pior caso é "sem ganho", nunca PDF quebrado.

## O que ficou para trás
- Item 4 (base64 no celular): provar no aparelho antes de mexer.
- Conferir no APK que a logo grande realmente sai reduzida (o PDF de um aluno com logo de 2048 px deve pesar bem menos).
