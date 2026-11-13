# Avaliação física: evolução primeiro, comparação organizada e PDF

Situação: Em andamento · Onde: `main`, commits locais, sem push · Atualizado: 13/11/2026

## Objetivo
O treinador abre a Avaliação física e vê a medida atual, a mudança no período e as datas usadas; alterna entre Evolução e Comparar sem percorrer cartões longos; compara direita × esquerda; exporta um PDF igual ao que vê na tela. Fonte: `guia-avaliacao-fisica-visual-e-comparativos.pdf` (13/11/2026, 6 páginas) e pedido do Gustavo de 13/11. Só reorganiza tela e relatório: nenhuma mudança de API, de permissão, de cálculo gravado ou de salvamento.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Sem API nem migration. Se a tela precisar de dado que o contrato não traz, a parte para e a lacuna entra aqui | Pedido do Gustavo; AGENTS.md ("Avaliação física") | Gustavo |
| D2 | Grupos fixos: **Tronco** (peitoral, cintura, abdômen, quadril), **Braços** (direito, esquerdo), **Pernas** (coxa e panturrilha, direita e esquerda). Sem somar medidas, sem "progresso total", sem classificação de assimetria, sem meta | Guia p. 3–5 | Gustavo |
| D3 | Variação = última data selecionada − primeira, em ordem cronológica. Com 3 ou 4 datas a tela diz qual referência usou. Falta uma das duas pontas: "Indisponível" (nunca a partir de zero). Valor ausente: "Não registrada". Sem mudança: "0,0 cm" | Guia p. 3 | Gustavo |
| D4 | Cor informa, não julga: **azul informativo** no valor atual, na linha principal e na variação; títulos e estrutura neutros; vermelho só para erro de preenchimento e exclusão; nada da regra verde/vermelho do peso. Token: o azul de indicador `PALETA_DE_DESTAQUE.azul` (claro `#1D4ED8`, escuro `#60A5FA`) que `useTema().identificacao.azul` já entrega por tema, o mesmo "azul" dos cartões de destaque (cores-de-destaque D3/D4). Não existe outro token chamado "informativo" em `tema/tokens.ts`; nenhum token é criado nem muda de valor | Guia p. 4; pedido de 13/11 | Sessão principal (decisão de rotina) |
| D5 | Segunda série (esquerdo) em **violeta** (`identificacao.violeta`), tracejada e com legenda em texto; no máximo duas séries | Guia p. 4 | Gustavo |
| D6 | Seleção do Comparar tem estado próprio (fundo tingido, contorno e caixa marcada), distinto do anel de foco; a linha do histórico não é seleção e abertura ao mesmo tempo | Guia p. 4–5 | Gustavo |
| D7 | `GraficoLinha` é compartilhado (peso, respostas, progresso do exercício, catálogo do montador): a mudança é aditiva e opcional (segmentos retos, segunda série, dica com referência); os usos antigos mantêm o desenho atual, e cada um é revisado com seu e2e | Guia p. 6 | Sessão principal |
| D8 | Histórico (`CartaoAvaliacaoFisica` sem `alunoId`, no Histórico do aluno) continua só leitura e diz "Sem conexão." sem internet | AGENTS.md | Gustavo |
| D9 | PDF: exatamente as datas e medidas da tela; aluno, unidades, grupos, variação e observação por data; gráfico opcional; fundo claro, cor discreta, sinais escritos (lê em preto e branco); linhas e títulos sem corte entre páginas; todo texto com `esc()` | Guia p. 5 | Gustavo |

## Passos
- [ ] B1. Regras puras em `dominio/` (grupos, comparação de 2 a 4 datas, variação, "Não registrada", "Indisponível", frase da referência, resumo, "Comparar as duas últimas", "N de M selecionadas", "Mais recente", pares direita/esquerda) com Jest — responsável: executor — commit: —
- [ ] B2. Tela (1ª entrega): abas Evolução | Comparar, seletor de medida (menu no PC, Folha no celular), resumo, gráfico com dica por mouse/toque/teclado e limites da escala visíveis, histórico compacto, seleção do Comparar, tabela agrupada (um bloco por medida no celular) — responsável: executor-front — commit: —
- [ ] B3. 2ª entrega: direita × esquerda no mesmo gráfico; PDF novo; revisão dos demais usos do `GraficoLinha` — responsável: executor-front (gráfico) e executor (PDF) — commit: —
- [ ] B4. Conferência: 390/1280/1440, texto ampliado e nome longo, Escuro/Claro/Areia renderizados, tokens nas outras paletas e no alto contraste, estados (nenhum, 1, 2 e 4 datas, iguais, aumento, redução, ausente), foco/teclado/toque, PDF contra a tela; `e2e/avaliacao-fisica.spec.ts` estendido; `ajuda/conteudo.ts`, guias (`node scripts/guias/gerar.mjs`) e item do `AGENTS.md` — responsável: executor-front e sessão principal — commit: —
- [ ] B5. Revisão independente (`revisor`, somente leitura) e correções — commit: —

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

## O que ficou para trás
- (preencher ao entregar; cada sobra também vai para "Pendências soltas" no README)
