# Peso: evolução mais legível

Situação: Publicada (`5e46fad6`, `3998c635`, `b0ca7f98`, 13/11/2026) · Onde: `main`, publicado (13/11/2026) · Atualizado: 15/11/2026

## Objetivo
O treinador lê o último registro de peso com a data, a diferença desde o anterior (com a referência), um gráfico fiel às medições e um histórico compacto, sem julgar saúde. Fonte: `guia-peso-visual-grafico-e-historico.pdf` (13/11/2026, 5 páginas) e pedido do Gustavo de 13/11. Depende do `GraficoLinha` já alterado em `avaliacao-fisica-visual.md`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Sem API nem migration; nada de peso guardado no aparelho; o Histórico do aluno continua só leitura e diz "Sem conexão." sem internet; a preferência `graficos` continua valendo (desligada, só a lista); permissões `ALUNO_SENSIVEL_LER/ALTERAR`; observação só para a equipe | Pedido do Gustavo | Gustavo |
| D2 | **Cor pela meta fica** (V052): a linha do gráfico é azul informativa; a variação na tabela e no resumo segue `dominio/corDaVariacaoDoPeso` (REDUZIR, AUMENTAR, SEM_META) com sinal e seta sempre visíveis. A meta é escrita perto do resumo ("Cores pela meta: reduzir o peso"); a origem (do aluno ou padrão da consultoria) só aparece se já vier da API, senão fica como lacuna aqui. Nunca "saudável", "ruim" ou "bom". Datas, contexto e dados ausentes em neutro; vermelho só para erro de entrada e excluir | Gustavo ("DECISÃO: manter a cor pela meta") | Gustavo |
| D3 | Resumo acima de Lista/Gráfico: "Último registro" (peso e data; nunca "peso atual" nem a data de hoje) e "Desde o registro anterior" (diferença + "51,0 kg em 19/08/2026"). "No período" só se já houver filtro, com as datas da primeira e da última medição do filtro | Guia p. 2–3 | Gustavo |
| D4 | Gráfico: segmentos retos, distância proporcional entre datas (conferir se hoje é por data ou por índice), escala ajustada com limites visíveis e margem pequena, último ponto com destaque discreto, dica (mouse, toque, teclado) com data, peso e referência da diferença; os valores continuam lidos pela tabela. Legenda: "Escala vertical: X a Y kg · pontos = registros" | Guia p. 3 | Gustavo |
| D5 | Estados: vazio compacto e "Registrar peso" (só para quem já pode registrar); um registro = só o ponto; iguais = linha horizontal e "0,0 kg · sem alteração"; falha = mensagem e "Tentar de novo", nunca 0 kg; sem anterior = "Sem registro anterior"; mesmo dia = regra que já existe | Guia p. 3 | Gustavo |
| D6 | Histórico (Lista): Data, Peso, Variação ("desde dd/mm" embaixo) e Ações; casas padronizadas, números alinhados; destaque suave na linha mais recente; sem coluna de observação cheia de "—" (a observação, só da equipe, vira detalhe do registro); celular com bloco por registro e alvos de 44 px; edição não é criada; excluir com `PainelConfirmacao` (data e valor), e depois atualiza gráfico, resumo e diferenças; a visão escolhida (Lista ou Gráfico) se mantém | Guia p. 4 | Gustavo |
| D7 | Se o guia e a regra de segurança do projeto divergirem, vale a regra do projeto (peso é dado sensível, e2e e capturas só com dados fictícios) | Pedido do Gustavo | Gustavo |

## Passos
- [x] C1. Regras puras novas em `dominio/` (resumo, diferença desde o anterior, escala e margem, intervalos irregulares, registros fora de ordem, um registro, iguais) com Jest — responsável: executor — commit: `5e46fad6` (`resumoDoPeso.ts`, 19 testes)
- [x] C2. Tela: resumo, gráfico, estados, histórico compacto, legenda da meta (`CartaoPeso` na ficha e no Histórico) — responsável: executor-front — commit: `3998c635`
- [x] C3. Verificação: e2e `peso-historico-aluno` e `cor-da-variacao-do-peso` atualizados mais os estados novos, 390/1280/1440, texto ampliado, capturas em Escuro, Claro e Areia, tokens nas outras paletas e no alto contraste; reconferir `CartaoEvolucaoRespostas`, `ProgressoDoExercicio`, catálogo do montador e a Avaliação física — responsável: executor-front e sessão principal — commit: `3998c635` (e2e); correções da revisão em `b0ca7f98` (erro antigo, `key` do gráfico, foco após excluir, código morto, e2e da visão que se mantém)
- [x] C4. `ajuda/conteudo.ts`, guias em PDF, item do peso no `AGENTS.md`; revisão do `revisor` — commit: "Docs: Avaliação física e Peso" (13/11); revisão corrigida em `b0ca7f98`

## Lacunas conhecidas
- Origem da meta (do aluno ou padrão da consultoria): **a API só devolve a meta efetiva** (não há `metaDoPesoOrigem` em `AlunoDetalhe`), então a tela escreve só "Cores pela meta: reduzir o peso", sem a origem. Sem frente de API; fica para quando o Gustavo pedir.

## Decisões da execução (13/11, sessão principal e `executor-front`)
- Casas do peso: `pesoComCasas` (de `dominio/resumoDoPeso.ts`; renomeado de `pesoParaTela` para não colidir com o de `avaliacaoFisica.ts`, que mostra "80,5 kg"/"—") dá casas fixas (80 → "80,0 kg").
- Aba Gráfico aparece com 1 registro (só o ponto); a legenda das setas saiu; a frase da meta aparece uma vez, abaixo do resumo, e só com 2+ registros; a linha mais recente leva o texto "Mais recente"; a observação vira `detalhe` da `Tabela`; coluna Ações com 64 px; resumo empilhado em 390 px.
- Azul informativo: `useDestaques().azul.cor` na linha do gráfico e no peso registrado (número do "Último registro" e coluna Peso, como no guia p. 1 e na D12 de `cores-de-destaque.md`); a variação (tabela e resumo) nunca é azul: segue a cor pela meta (V052) com sinal e seta. Atenção: o pedido de 13/11 dizia "só a linha do gráfico azul"; se o Gustavo quiser os números do peso neutros, mudar `CartaoPeso.tsx` (coluna Peso), `peso/ResumoDoPeso.tsx` e o e2e `peso-historico-aluno.spec.ts:67`.
- Casas da variação: a tela mostra "+1,0 kg" (`pesoComCasas`) e o PDF da dieta ainda mostra "+1 kg" (`dominio/variacaoDoPeso.formatar`, `pdfDieta.ts:75`); fica como pendência, fora da tela.
- Sugestões de design system para depois: `Tabela` sem destaque por linha; `GraficoLinha` arredonda a 1 casa o nome acessível do ponto (79,85 lido como 79,9); Variação alinhada à direita no modo empilhado.

## Fora do escopo
- Filtro de período novo (evolução separada); edição de registro; meta calculada; interpretação de saúde.

## O que ficou para trás (13/11; cada item também está em "Pendências soltas" do README)
- Origem da meta (do aluno ou padrão da consultoria) não aparece: a API só devolve a meta efetiva.
- Casas da variação: tela "+1,0 kg", PDF da dieta ainda "+1 kg" (`pdfDieta.ts:75`).
- Azul no número do peso registrado (guia p.1) em vez de só na linha do gráfico: decisão do Gustavo (onde mudar está nas Decisões da execução).
- Foco após excluir só conferido na web; sem e2e de "exclusão que falha e depois abrir Registrar peso".
