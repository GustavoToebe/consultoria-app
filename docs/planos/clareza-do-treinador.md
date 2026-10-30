# Clareza do treinador: o que a reunião de 29/10 mostrou

Situação: Em andamento · Onde: branch `claude/saraiva-api-direcionamento-treinos-dv10io` · Atualizado: 30/10/2026

## Objetivo
Fazer funcionar bem o que já existe: o treinador precisa ver onde cada bloco começa e termina, entender o que cada
ação faz (aplicar, publicar, finalizar) e conseguir importar a planilha sem ajuda. Base: a análise do vídeo da reunião
de 29/10 (`analise-video-2026-10-29.md`, fora do repositório) e a referência de painel e importação que o Gustavo
mandou (fora do repositório: tem dado de pessoas reais e não entra no git).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo | Lotes A (comportamento e textos), B (hierarquia visual) e C (importação em etapas). O painel novo (D) e a comunidade ficam para depois | Gustavo, 30/10 |
| D2 | Tema claro | Padrão neutro com bordas e níveis mais fortes nos dois temas; "Claro areia" entra como mais uma opção de tema nas Preferências | Gustavo (aceitou a recomendação), 30/10 |
| D3 | Edição de valores na tabela da importação | Fora: a confirmação continua relendo o arquivo e conferindo o hash; o erro aparece na linha e na coluna e a correção é na planilha | Gustavo (aceitou a recomendação), 30/10 |
| D4 | Fim da pasta | Pasta nova: enquanto o fim não for editado à mão, mudar o início recalcula o fim (início + dias do ciclo − 1); fim editado mostra "Fim ajustado à mão" e "Usar a duração do ciclo"; pasta salva abre com as datas gravadas | Análise do vídeo (A05) |
| D5 | Pastas | O filtro "Ativas" passa a "Abertas"; pasta aberta/concluída, plano rascunho/publicado e plano em uso pelo aluno aparecem separados | Análise do vídeo (A10) |
| D6 | Suplemento | O campo vira "Dose prescrita"; a porção da embalagem aparece só como informação; nada é preenchido sozinho | Análise do vídeo (A07) |
| D8 | Início e fim de cada bloco | Todo cartão com título ganha a faixa de cabeçalho (título e ações em `superficie3`, linha embaixo) e o topo de toda Folha também; bordas mais fortes nos temas | Gustavo, 30/10 ("tudo parece uma coisa só, sem início e fim") |
| D9 | Água por dia | O treinador escreve os litros no cartão "Total do dia" do editor da dieta, sempre à vista (estava dentro da "Configuração do plano", que abre fechada). O registro da água bebida pelo aluno segue como o passo 1.2 de `engajamento.md` | Gustavo, 30/10 |
| D10 | Avisos de atenção | Mesma caixa do erro (fundo claro, borda e texto na cor), em âmbar para o que pede cuidado e não impede: aluno ocupado na agenda, avisos da validação do plano, possível duplicidade de interessado, prévia da Minha conta e, na importação, campos obrigatórios faltando | Gustavo, 30/10 ("curti muito essas partes em vermelho… pode usar nos avisos de atenção") |
| D7 | Lista de compras | "Conforme a dieta" quando falta fator e "Estimativa para compra" quando a conta foi feita; "Mês (30 dias)"; uma opção por refeição | Análise do vídeo (A08) |

## Passos
- [x] 1. Lote A: fim automático da pasta, "Abertas", efeito de finalizar, destino explícito ao aplicar modelo e ao copiar plano, "Dose prescrita" (com a porção da embalagem só como referência), períodos "Semana (7 dias)"/"Mês (30 dias)" na lista de compras, aviso do gráfico de peso — commit/run: 79d9d3e (Jest 2552, lint, typecheck, e2e `pasta-periodo` e `lista-de-compras` em 390 e 1280)
- [x] 2. Lote B: tokens dos dois temas e do contraste alto, opção "Claro areia", exercício × grupo de séries, pasta com Treino, Dieta e Mobilidade em blocos próprios; capturas antes e depois em 390 e 1280 — commit/run: f65c800; faixa de cabeçalho em todo cartão com título e no topo das folhas (D8): c114082 (Jest 2556, lint, typecheck, e2e completo 326 de 326)
- [x] 3. Lote C: importação em etapas (lista separada do assistente; destino e arquivo juntos; configuração com ajuda; amostra com a escolha do campo em cada coluna; resumo Total / Com erro / Corretas; "Voltar"; mudar arquivo, aba ou mapeamento invalida a prévia) — commit/run: ea45e8b (`POST /importacoes/{destino}/colunas` traz `linhas` e `amostra` de até 5 linhas, só na resposta; `mvn verify` 1688, e2e `importacao` em 390 e 1280)
- [ ] 4. Ajuda, guias PDF, AGENTS.md, testes (Jest, e2e em 390 e 1280, `mvn verify` se a API mudar), PR, CI verde e merge — commit/run: —

## Fora do escopo
- Painel novo em blocos (lote D) e montagem do painel por usuário.
- Editar valores na tabela da importação (D3).
- Importar plano de PDF ou Google Docs (frente própria).
- Categorias dos suplementos do catálogo (mexe em dado que o treinador pode ter alterado; frente própria).
- Comunidade, ranking e XP (proposta de 27/10; depois do piloto).

## O que ficou para trás
- Itens da análise que não entram nesta frente: A01 (orientação no primeiro uso), A02 (importar plano de PDF ou Google Docs), A06 (dúvidas de modelo e complementos da dieta, só textos), A12 (categorias dos suplementos do catálogo) e o painel novo (seção 11).
- A falha da planilha na reunião (A04) não foi reproduzida: precisa só dos nomes das colunas e das abas, sem dados.
