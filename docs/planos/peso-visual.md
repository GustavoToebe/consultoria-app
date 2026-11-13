# Peso: evolução mais legível

Situação: Planejando (começa depois da Avaliação física) · Onde: `main`, commits locais, sem push · Atualizado: 13/11/2026

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
- [ ] C1. Regras puras novas em `dominio/` (resumo, diferença desde o anterior, escala e margem, intervalos irregulares, registros fora de ordem, um registro, iguais) com Jest — responsável: executor — commit: —
- [ ] C2. Tela: resumo, gráfico, estados, histórico compacto, legenda da meta (`CartaoPeso` na ficha e no Histórico) — responsável: executor-front — commit: —
- [ ] C3. Verificação: e2e `peso-historico-aluno` e `cor-da-variacao-do-peso` atualizados mais os estados novos, 390/1280/1440, texto ampliado, capturas em Escuro, Claro e Areia, tokens nas outras paletas e no alto contraste; reconferir `CartaoEvolucaoRespostas`, `ProgressoDoExercicio`, catálogo do montador e a Avaliação física — responsável: executor-front e sessão principal — commit: —
- [ ] C4. `ajuda/conteudo.ts`, guias em PDF, item do peso no `AGENTS.md`; revisão do `revisor` — commit: —

## Lacunas conhecidas
- Origem da meta (do aluno ou padrão da consultoria): a registrar aqui conforme o que a API já devolve; sem frente de API.

## Fora do escopo
- Filtro de período novo (evolução separada); edição de registro; meta calculada; interpretação de saúde.

## O que ficou para trás
- (preencher ao entregar; cada sobra também vai para "Pendências soltas" no README)
