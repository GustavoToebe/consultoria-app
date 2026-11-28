# Avaliação física: evolução primeiro, comparação organizada e PDF

Situação: Publicada (`5272d286`, `d5664cab`, `33d9a434`, `b75c1d54`, `705dc9aa`, 13/11/2026); leva 3 na árvore, sem commit (seção "Leva 3") · Onde: `main`, publicado (13/11/2026); leva 3 na branch `leva-3` · Atualizado: 28/11/2026

## Objetivo
O treinador abre a Avaliação física e vê a medida atual, a mudança no período e as datas usadas; alterna entre Evolução e Comparar sem percorrer cartões longos; compara direita × esquerda; exporta um PDF igual ao que vê na tela. Fonte: `guia-avaliacao-fisica-visual-e-comparativos.pdf` (13/11/2026, 6 páginas) e pedido do Gustavo de 13/11. Só reorganiza tela e relatório: nenhuma mudança de API, de permissão, de cálculo gravado ou de salvamento.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Sem API nem migration. Se a tela precisar de dado que o contrato não traz, a parte para e a lacuna entra aqui | Pedido do Gustavo; AGENTS.md ("Avaliação física") | Gustavo |
| D2 | Grupos fixos: **Tronco** (peitoral, cintura, abdômen, quadril), **Braços** (direito, esquerdo), **Pernas** (coxa e panturrilha, direita e esquerda). Sem somar medidas, sem "progresso total", sem classificação de assimetria, sem meta | Guia p. 3–5 | Gustavo |
| D3 | (Substituída na leva 3 pelo L1: o Comparar tem duas datas só.) Variação = última data selecionada − primeira, em ordem cronológica. Com 3 ou 4 datas a tela diz qual referência usou. Falta uma das duas pontas: "Indisponível" (nunca a partir de zero). Valor ausente: "Não registrada". Sem mudança: "0,0 cm" | Guia p. 3 | Gustavo |
| D4 | (Na leva 3 vale só na "Evolução por medida"; no histórico e no Comparar, o L2.) Cor informa, não julga: **azul informativo** no valor atual, na linha principal e na variação; títulos e estrutura neutros; vermelho só para erro de preenchimento e exclusão; nada da regra verde/vermelho do peso. Token (corrigido em 13/11 pelo agente do `GraficoLinha`: as chaves de `identificacao` são maiúsculas e não são esse azul): o azul de indicador é `useDestaques().azul.cor` (`PALETA_DE_DESTAQUE.azul`; claro `#1D4ED8`, escuro `#60A5FA`), o mesmo "azul" dos cartões de destaque (cores-de-destaque D3/D4) e do `CartaoPeso`. Não existe outro token chamado "informativo" em `tema/tokens.ts`; nenhum token é criado nem muda de valor | Guia p. 4; pedido de 13/11 | Sessão principal (decisão de rotina) |
| D5 | Segunda série (esquerdo) em **violeta** (`useTema().identificacao.VIOLETA.cor`, 4,5:1 nas superfícies; o `useDestaques().violeta` é quase igual ao azul e não serve), tracejada com ponto vazado e com legenda em texto; no máximo duas séries | Guia p. 4 | Gustavo |
| D6 | Seleção do Comparar tem estado próprio (fundo tingido, contorno e caixa marcada), distinto do anel de foco; a linha do histórico não é seleção e abertura ao mesmo tempo | Guia p. 4–5 | Gustavo |
| D7 | `GraficoLinha` é compartilhado (peso, respostas, progresso do exercício, catálogo do montador): a mudança é aditiva e opcional (segmentos retos, segunda série, dica com referência); os usos antigos mantêm o desenho atual, e cada um é revisado com seu e2e | Guia p. 6 | Sessão principal |
| D8 | Histórico (`CartaoAvaliacaoFisica` sem `alunoId`, no Histórico do aluno) continua só leitura e diz "Sem conexão." sem internet | AGENTS.md | Gustavo |
| D9 | (Na leva 3: o PDF leva as duas datas do Comparar, com a variação desde a anterior embaixo de cada valor pela regra do L2, ▲/▼ e as mesmas cores; a coluna "Variação" última − primeira segue neutra.) PDF: exatamente as datas e medidas da tela; aluno, unidades, grupos, variação e observação por data; gráfico opcional; fundo claro, cor discreta, sinais escritos (lê em preto e branco); linhas e títulos sem corte entre páginas; todo texto com `esc()` | Guia p. 5 | Gustavo |
| D10 | **Gráfico no PDF da web** (Gustavo, 13/11): o sanitizador de `pdf/imprimir.web.ts` libera só o `src` de `<img>` com o prefixo exato `data:image/svg+xml;base64,` (corpo base64 até 500.000 caracteres). Nenhum outro `data:` novo (`data:text/html` e `svg+xml` sem base64 seguem barrados); `<svg>` solto continua removido; `javascript:`, `on*` e `href` continuam bloqueados. O SVG é gerado só por `pdfAvaliacaoFisica.ts` a partir de números e datas; todo texto dele (rótulos, datas, legenda, `<title>`) passa por `esc()` antes do `base64DeTexto`. SVG dentro de `<img>` não executa script nem carrega recurso de fora. `injecao.test.ts` ganhou 4 casos e `imprimir.web.dom.test.ts` prova o `montarCorpo` real. O interruptor do gráfico no PDF aparece em todas as plataformas | Gustavo | Gustavo |
| D11 | Datas no gráfico e na tabela: dd/mm; com ano (dd/mm/aaaa) só quando as datas abrangem mais de um ano; o "valor atual" traz sempre a data completa. Pontas do eixo só rotuladas quando há `escala` (ou `legendaDaEscala`) com os mesmos números da legenda. Alvo de toque do ponto do gráfico: 44 px (`ALVO_TOQUE`), decisão do Gustavo de 15/11/2026; o desenho continua menor e alvos de pontos que se sobreporiam dividem o espaço no meio do caminho entre os centros | Sessão principal (decisão de rotina) | Sessão principal |
| D12 | Parte C (Peso) foi iniciada em paralelo, depois de o `GraficoLinha` (commit `d5664cab`) ficar pronto; nenhum token foi criado nem alterado nas duas frentes | Pedido do Gustavo ("máximo de agentes em paralelo") | Gustavo |

## Passos
- [x] B1. Regras puras em `dominio/` (grupos, comparação de 2 a 4 datas, variação, "Não registrada", "Indisponível", frase da referência, resumo, "Comparar as duas últimas", "N de M selecionadas", "Mais recente", pares direita/esquerda) com Jest — responsável: executor — commit: `5272d286` (39 testes, `tsc` e `eslint` limpos; `comparacaoDeAvaliacoes.ts`, `valorDaMedida` exportado)
- [x] B2. Tela (1ª entrega): abas Evolução | Comparar, seletor de medida (menu no PC, Folha no celular), resumo, gráfico com dica por mouse/toque/teclado e limites da escala visíveis, histórico compacto, seleção do Comparar, tabela agrupada (um bloco por medida no celular) — responsável: executor-front — commit: `33d9a434`
- [x] B3. 2ª entrega: direita × esquerda no mesmo gráfico; PDF novo; revisão dos demais usos do `GraficoLinha` — responsável: executor-front (gráfico) e executor (PDF) — commit: `b75c1d54` (PDF e gráfico), `a036142e` (sanitizador, D10)
- [x] B4. Conferência: 390/1280/1440, texto ampliado e nome longo, Escuro/Claro/Areia renderizados, tokens nas outras paletas e no alto contraste, estados (nenhum, 1, 2 e 4 datas, iguais, aumento, redução, ausente), foco/teclado/toque, PDF contra a tela; `e2e/avaliacao-fisica.spec.ts` estendido; `ajuda/conteudo.ts`, guias (`node scripts/guias/gerar.mjs`) e item do `AGENTS.md` — responsável: executor-front e sessão principal — commit: `33d9a434`, `b75c1d54` (e2e); Ajuda, guias, `AGENTS.md` e planos no commit "Docs: Avaliação física e Peso" (13/11)
- [x] B5. Revisão independente (`revisor`, somente leitura) e correções — commit: `705dc9aa` (datas D11, gráfico do PDF só com datas marcadas, 409, histórico ordenado, e2e sem caminho fixo)

## Aceitação (página 6 do guia)
- 390, 1280 e 1440 px com texto ampliado e nomes longos, sem corte nem rolagem horizontal da página.
- Escuro, Claro e Areia renderizados; tokens conferidos nas demais paletas e no alto contraste (teste de contraste).
- Nenhum registro, uma avaliação, 2 e 4 datas, valores iguais, aumento, redução, medida ausente.
- Dados fictícios representativos e extremos; nenhum número dos prints do guia é interpretado.
- Foco, teclado, toque, seleção e leitura das séries sem depender só da cor.
- PDF conferido contra a comparação da tela, todas as páginas revisadas.

## Fora do escopo
- API, migration e novas permissões; meta, interpretação de saúde, soma de medidas e classificação de assimetria.
- Peso (frente `peso-visual.md`, que reaproveita o `GraficoLinha` depois desta).

## Leva 3 (27/11/2026, branch `leva-3`, sem commit)
Fonte: briefing da leva 3 (B-007 do [serie-aberta-e-tela-completa-27-11.md](serie-aberta-e-tela-completa-27-11.md)). Só app, sem API nem migration (D1 continua). Validade: lido na árvore em 27/11/2026, ~23:10, sobre `4dc1cbc9`, e de novo em 28/11 (L2 e L-6, por grep no código, sem teste); vence no primeiro commit da leva ou se os arquivos abaixo mudarem.

| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| L1 | Comparar | Duas datas só (`treinador/avaliacao/CompararAvaliacoes`, `FolhaComparar`, folha média): a mais nova menos a mais antiga, medida por medida, com os dois valores embaixo; abre nas duas últimas; o PDF leva essas duas. Perdeu a comparação de 3 a 4 datas (D3) | briefing da leva 3; **decisão aberta** (Gustavo: manter duas ou voltar a 3 a 4) |
| L2 | Cor da variação | Uma regra só (`dominio/avaliacaoFisica.variacaoCurta`, `tipo` `mudou`/`igual`/`primeira`/`semValor`) para histórico, Comparar, folha Nova/Editar e PDF: só a diferença com ▲/▼, colorida só em Peso, Cintura, Abdômen e Quadril (`COLUNAS_COM_META`) pela meta do peso do aluno (`tomDaVariacaoDoPeso`); sem meta ou nas outras medidas, neutra; zero = "0,0" neutro sem seta; sem anterior = "Primeira" (pequeno, secundário); "—" só para medida não preenchida. Troca o azul do D4 fora da "Evolução por medida", que segue azul | briefing da leva 3; **decisão aberta** (Gustavo: confirmar a troca do D4, que veio do guia dele) |

Passos (situação real da árvore; nenhum teste rodado por este registro; commit/run: —):
- [ ] L-1. Histórico em tabela comparativa (`HistoricoDeAvaliacoes`: mais recente em cima, colunas Peso · Braço · Tronco · Coxa · Panturrilha com a unidade no grupo, variação desde a anterior, "Mais recente" como selo, observação no ⓘ `ui/DicaDeTexto`; sem largura, um cartão por avaliação em grade 2 × 5) — na árvore, `apresentacao.test.ts` e `avaliacaoFisica.test.ts` alterados — commit: —
- [ ] L-2. Sem abas: "Evolução por medida" em cima e o histórico embaixo (`CartaoAvaliacaoFisica`) — na árvore — commit: —
- [ ] L-3. "Comparar" de duas datas (L1) — na árvore, `comparacaoDeAvaliacoes.test.ts` alterado — commit: —
- [ ] L-4. Folha Nova/Editar de 800 px (`FolhaAvaliacao`, `LARGURA_FOLHA_LARGA`, observação em `ui/CampoQueCresce`) com o peso da data (`PesoDaData`: "Peso nesta data", ou "Registrar peso" ali mesmo por `POST /pesos`; lista que não carregou não mostra nada) — na árvore, sem teste unitário — commit: —
- [ ] L-5. e2e `e2e/avaliacao-fisica.spec.ts` alterado — a rodar pela sessão principal; capturas 1280 e 390 pedidas — commit/run: —
- [ ] L-6. Variação numa regra só (L2: `variacaoCurta` com `tipo`; zero "0,0" sem seta, "Primeira", "—" só sem medida) na tela, na folha e no PDF (▲/▼ embaixo de cada valor, mesmas cores; coluna "Variação" neutra) — em 28/11, SEM commit (leva-3); código lido em 28/11, nenhum teste rodado por este registro — commit: —

## O que ficou para trás (13/11; cada item também está em "Pendências soltas" do README)
- Alvo de toque do ponto do gráfico: resolvido em 15/11/2026 (44 px, `ALVO_TOQUE`; pontos próximos dividem o espaço; testes em `ui/GraficoLinha.test.tsx`; commit `86a09407`).
- Interruptor do gráfico no PDF aparece mesmo com a preferência `graficos` desligada, e o rótulo dele cita os dois lados mesmo se as datas marcadas deixam um sem ponto: decidir se a preferência o esconde.
- Rótulos do eixo do gráfico do PDF: resolvido em 15/11/2026 (o eixo omite o rótulo que colidiria com o anterior ou com o último, mantendo primeiro e último; marca e ponto de cada data continuam; teste em `pdf/pdfAvaliacaoFisica.test.ts`; sem commit ainda). Segue aberto: `srcset` com vários candidatos no sanitizador não é tratado.
- O SVG em `<img>` só foi conferido no Chromium (web); WebView do `expo-print` (iOS e Android) e o app nativo não foram verificados. Os PDFs dos guias não foram conferidos visualmente.
- Nome acessível do ponto do `GraficoLinha` arredondado a 1 casa; `Tabela` sem destaque por linha e `LinhaDaLista` sem controle de linhas (sugestões de design system).
