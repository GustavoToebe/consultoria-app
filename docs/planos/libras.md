# Libras (lb) na carga: fase 1 (aluno) e fase 2 (treinador) (N04)

Situação: Fase 1 em produção, chave ligada em produção em 04/11; fase 2 no PR #97 (branch `libras-fase-2`) · Onde: `main` (PRs #77 e #82) e `libras-fase-2` · Atualizado: 04/11/2026

## Objetivo
O aluno que pensa em libras escolhe `lb` em Perfil › Preferências e passa a digitar e ler as cargas em libras, sem que
nada do que está guardado mude: a carga continua em **kg** no aparelho, na fila offline, na API e no banco. Entra
**desligado** (`TREINOS_UNIDADE_CARGA_HABILITADA`, padrão `false`); desligado, a escolha não aparece e o app inteiro segue em kg.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Unidade canônica | A carga é guardada SEMPRE em kg. Libra só na exibição e na digitação (borda da tela). O que vai à fila offline e à API é kg | Gustavo, 03/11 |
| 2 | Preferência | `unidadeDeCarga: 'kg' \| 'lb'` em `app/src/dominio/preferencias.ts`, padrão `kg`, só no aparelho (como tema e contraste). Não vai a servidor, sem migration | Gustavo, 03/11 |
| 3 | Regra pura | `dominio/unidadeDeCarga.ts`: kg↔lb, arredondar para exibir sem trocar o valor guardado, ida e volta sem derivar (digitar 100 lb e ler de volta em lb dá 100), com teste | Gustavo, 03/11 |
| 4 | Plano publicado | É imutável: trocar a unidade nunca reescreve plano nem registro | Gustavo, 03/11 |
| 5 | Progressão | Nunca é automática por consequência da conversão | Gustavo, 03/11 |
| 6 | Quem vê | Histórico, PDF, exportação, sincronização offline e relatório leem kg e mostram na unidade de QUEM VÊ: o aluno na dele; o PDF e o relatório do treinador na do treinador | Gustavo, 03/11 |
| 7 | Fases | Fase 1 = plano, regra pura e lado do aluno. Fase 2 (treinador) vem depois (feita em 04/11, ver decisões 15 a 17) | Gustavo, 03/11 |
| 8 | Chave | `TREINOS_UNIDADE_CARGA_HABILITADA` (padrão `false`), no padrão de `TREINOS_RETORNO_HABILITADO`: propriedade, `GET /eu` traz `unidadeDeCargaHabilitada`, `application-test.yml` liga, teste do desligado. Desligada, a escolha some e toda carga fica em kg | Gustavo, 03/11 |
| 9 | Precisão | A gravação mantém 2 casas em kg (`numeric(7,2)` no banco). Em libra, mostra e digita **1 casa** (máscara do campo). `lb → kg`: entre os kg que exibem o mesmo número em lb (janela de 0,1 lb, cerca de 0,045 kg) grava o **múltiplo de 0,05 kg**, que é o que a metodologia produz (`arredondamentoKg`); sem múltiplo na janela, arredonda a 2 casas. Assim lb → kg → lb devolve o mesmo número e kg → lb → kg não deriva (60 kg mostra 132,3 lb e grava 60, nunca 60,01, que criaria recorde falso). Efeito: 100 lb grava 45,35 kg (não 45,36) | confirmado pelo Gustavo em 04/11 |
| 10 | Fator | 1 lb = 0,45359237 kg (definição legal), sem aproximar para 0,4536 | confirmado pelo Gustavo em 04/11 |
| 11 | Botões −/+ | Em kg nada muda (o passo é o `arredondamentoKg` da metodologia). Em libra, o passo é o `arredondamentoKg` convertido e arredondado ao múltiplo de 2,5 lb mais próximo, no mínimo 2,5 lb (2,5 kg = 5 lb; 1 kg = 2,5 lb; 1,25 kg = 2,5 lb; 5 kg = 10 lb). O −/+ soma ou subtrai esse passo sobre o número em lb que está NA TELA (`kgParaTela(base, 'lb')`, base = atual ?? sugestão ?? 0), nunca abaixo de 0, e grava o equivalente em kg com `telaParaKg(..., 'lb')`: 100 lb + 5 lb = 105 lb na tela, exato, e o guardado continua em kg. Substitui a regra de 03/11 (passo em kg, só o rótulo convertido: 100 → 105,5 → 111 lb) | decisão do Gustavo em 04/11 |
| 12 | "Sim, X?" do painel do ✓ | Mostra a sugestão em libras e grava a sugestão **em kg, sem passar por libra** (o valor do plano não muda) | confirmado pelo Gustavo em 04/11 |
| 13 | Quem escolhe | Fase 1: só o aluno vê a escolha e o treinador fica em kg em todas as telas. **Fase 2 (decisão 15) troca isto: o treinador também escolhe** | confirmado pelo Gustavo em 04/11 |
| 14 | Peso corporal | Fora: peso do aluno (atualização, avaliação, fotos, dieta) segue em kg. "Libras" aqui é só carga de exercício | confirmado pelo Gustavo em 04/11 |
| 15 | Treinador escolhe a própria unidade (fase 2) | A preferência `unidadeDeCarga` é a mesma, no aparelho e por usuário (`treinos:<usuarioId>:preferencias`), e agora aparece em Ajustes também para o treinador, com a mesma chave da plataforma (`GET /eu` traz `unidadeDeCargaHabilitada` para todos os papéis). Sem servidor, sem migration, sem rota nova. A regra é uma só: `unidadeEfetiva({ chaveLigada, preferida })` (chave ligada e `lb` escolhido = libra; qualquer outro caso = kg). O contexto `ProvedorDaUnidadeDeCarga` passa a estar também no layout do treinador | decisão 6 (cada um na sua unidade), aplicada em 04/11 |
| 16 | Metodologia e receitas ficam em kg | O arredondamento da metodologia ("arredondar a sugestão ... para N kg"), o `CartaoMetodologia` e as receitas de séries não mudam de unidade nesta fase: são configuração da consultoria, lida por todos, e o valor guardado é o `arredondamentoKg` | Gustavo, 04/11 |
| 17 | "Ver como aluno" | A prévia mostra a carga em kg (`FolhaVerComoAluno` provê `kg`): a unidade do aluno vive no aparelho dele e a prévia nunca a conhece | Gustavo, 04/11 |

## Passos
- [x] 1. Plano e índice (este arquivo) — commit a652f128
- [x] 2. (8554281b) Regra pura `dominio/unidadeDeCarga.ts` com teste (ida e volta de 0,1 em 0,1 lb até o teto do banco, arredondamento, passo, zero e vazio, enormes, negativos, "62,5") e preferência em `preferencias.ts`
- [x] 3. (2454f4e9 e 8554281b) API: `TREINOS_UNIDADE_CARGA_HABILITADA` (propriedade, `GET /eu`, `application-test.yml`, testes do desligado e do ligado); app lê `unidadeDeCargaHabilitada` no perfil
- [x] 4. (8554281b) Aluno: escolha em Preferências (só com a chave ligada) e carga na execução, dica, Anterior, recordes, histórico, relatório e PDF de cargas do aluno
- [x] 5. (8554281b) e2e `unidade-de-carga.spec.ts` (390 e 1280 px): digitar em lb, ver, recarregar, o corpo enviado à API está em kg; chave desligada = sem a escolha
- [x] 6. (este commit) Lista final dos lugares de "kg" tratados e dos que ficam para a fase 2 (abaixo) e `AGENTS.md`
- [x] 7. (b033687b) Correções da revisão independente: ida e volta kg → lb → kg sem deriva (grade de 0,05 kg, decisão 9), teste do `CampoDeCarga`, rótulo "em libras" também na carga de trabalho do dia, PDF do treino do aluno na unidade dele, e2e com contagem de envios e controle da chave

- [x] 8. (commit: 1ac69c19) Botões −/+ em libra pela decisão 11 nova (04/11): `passoNaTela` e `textoDoPasso` em `dominio/unidadeDeCarga.ts`, `ajustarCarga(..., unidade = 'kg')` em `dominio/cargas.ts`, `ExercicioAluno` passa a unidade do contexto; testes jest (regra, varredura de ida e volta, componente em kg e lb) e e2e `unidade-de-carga.spec.ts`; `AGENTS.md` ajustado

### Fase 2: treinador (04/11, PR #97, branch `libras-fase-2`)
- [x] 9. Regra: `unidadeEfetiva` sem `ehAluno` (decisão 15) e teste; `ProvedorDaUnidadeDeCarga` vale para quem vê, e entra também no layout do treinador (`app/treinador/_layout.tsx`)
- [x] 10. Ajustes: o cartão "Unidade da carga" aparece também para o treinador (só com a chave ligada), com o texto de quem vê e digita a carga fixa, lê recordes, relatórios e PDFs
- [x] 11. Editor de carga fixa: `CampoDaCargaFixa` em lb (máscara de 1 casa, `kgParaTela`/`telaParaKg`, rótulo acessível "em libras", erro "até 2204,6 lb"), opção "Carga fixa (lb)", ajuda e resumo da série ("3x12 com 100 lb") na unidade do treinador (`dominio/agrupamento`, `resumoDaSerie`, `validacaoDeSerie.mensagemDaCargaFixa`, `editorTreino.modosDeCarga`, `treinador/treino/*`); o plano grava kg
- [x] 12. PDF do treino e PDF de cargas do treinador (`gerarPdf.ts`: `gerarPdfDoPlano`, `gerarPdfDeCargas` recebem a unidade; chamadas em `CartaoPlanos`, `TopoPlano` e `CartaoRegistros`)
- [x] 13. Recordes da semana (`textoDaSerieComRecorde`, `folhaRecordes`, `CartaoRecordesDaSemana`, Início do treinador); progresso do exercício, "Por semana" e "Por divisão" já liam o contexto e passaram a vir em lb sozinhos
- [x] 14. Testes: `unidadeDoTreinador.test.ts` (regra e textos), `CampoDaCargaFixa.test.tsx`, caso novo em `gerarPdf.test.ts`, e2e `unidade-de-carga-treinador.spec.ts` (390 e 1280), asserção do `GET /eu` do treinador em `UnidadeDeCargaLigadaIntegrationTest`

## Lugares de "kg" de carga
Como funciona: o contexto `ContextoDaUnidadeDeCarga` (`ui/unidadeDeCargaEmUso`, padrão kg) é provido nos layouts do aluno e do
treinador (`ui/ProvedorDaUnidadeDeCarga`: chave ligada + preferência `lb` de quem vê). Os testes que não o provêm ficam em kg
sem mudar nada. As funções de texto da carga ganharam `unidade` como último parâmetro opcional (padrão `kg`).

**Tratados na fase 1 (aluno):**
- Campo de peso da série e das etapas (`ui/CampoDeCarga`), rótulo acessível "em libras"/"em quilos", botões −/+ (`ui/AjusteDeCarga`, rótulo do passo).
- Dica "Sugestão / Última vez / Primeira vez" (`dominio/dicaDeCarga`), "Anterior" (`dominio/seriesAnteriores`, `aluno/LinhaDoAnterior`), "Repetir 40 kg × 6" (`dominio/repetirSerie`).
- Painel "Fez com X?" e suas três opções (`dominio/painelDoCheck`, `aluno/PainelDoCheck`): "Sim" grava a sugestão em kg.
- Etapas (Cluster, Rest-pause): referência, "Feito até agora", peso das etapas (`dominio/etapas`, `dominio/pesoDasEtapas`, `aluno/CartaoSerieComEtapas`).
- Recordes: aviso ao marcar, medalha, "Bom trabalho!" (`dominio/recordesPessoais`, `aluno/AvisoDeRecorde`, `PartesDaSerie`, `app/aluno/sessao/[uid]/concluido`).
- Treino ao vivo (`dominio/treinoAoVivo`, `aluno/FaixaDoTreino`): volume; carga fixa e meta da série (`dominio/agrupamento`, `dominio/cargas.metaDaSerie`, `aluno/CartaoExercicioDoDia`).
- Histórico do aluno: "Ainda não enviados", Por dia, Por divisão, progresso do exercício (resumo, gráfico, tabela) o PDF de cargas e o PDF do treino baixado pelo aluno (`app/aluno/treino` → `pdf/pdfTreino`, carga fixa na unidade dele; o PDF do treinador segue em kg) (`app/aluno/historico`, `dominio/relatorio`, `dominio/progresso`, `pdf/pdfCargas`, `treinador/CargasPorDivisao|HistoricoPorSemana|ProgressoDoExercicio`, que leem a unidade do contexto e no treinador seguem em kg).

**Tratados na fase 2 (treinador, na unidade dele):**
- Editor do plano: "Carga fixa (lb|kg)", campo e máscara, `validacaoDeSerie.mensagemDaCargaFixa`, resumo da série e do grupo (`dominio/agrupamento`, `resumoDaSerie`), `ajudaDaCarga`, `CartaoExercicio` ("Em lb").
- PDF do treino e PDF de cargas (`treinador/gerarPdf`), relatório e progresso do exercício, recordes da semana (`dominio/retornoDoTreinador`, `dominio/painelDoInicio`, `CartaoRecordesDaSemana`) e o Início do treinador.
- A prévia "Ver como aluno" (os componentes do aluno) mostra em kg (decisão 17).

**Ficam para depois ou fora, de propósito:**
- Metodologia e receitas: `edicaoMetodologia` ("arredondamento ... kg"), `CartaoMetodologia`, `receitasDeSeries` (decisão 16).
- "Treinos concluídos" não mostra carga; o `inspetorDoTreino` só trata cardio.
- Peso corporal em qualquer tela (atualização, avaliação física, fotos, dieta, lista de compras): é kg, decisão 14.
- Textos de ajuda (`ajuda/conteudo.ts`) e a descrição do arredondamento na Marca: citam "kg" como exemplo.
- Importação de planilha e exportação LGPD: kg, são do treinador.

## Riscos
- Esquecer um lugar e o aluno ver "kg" onde esperava "lb": a lista acima é a garantia; o que sobrar de aluno vira correção.
- Valor em kg com mais de 2 casas vindo de importação: em libra aparece arredondado a 1 casa; o guardado não muda.
- Aluno que troca de aparelho: a preferência é do aparelho, ele escolhe de novo (como tema e contraste). O treinador também.
- Fase 2: treinador em lb que monta o plano e aluno em kg veem a mesma carga em unidades diferentes; o guardado é o mesmo (kg). Texto digitado pelo treinador ("use 45 kg") não é convertido.
- Fase 2: a carga fixa em lb passa por `telaParaKg`: 100 lb grava 45,35 kg; o aluno em kg vê 45,35 kg (não 45 kg), e o treinador reabrindo vê 100 lb.

## Roteiro de conferência para o Gustavo
1. Com a chave ligada no local, entrar como aluno fictício e abrir Perfil › Preferências: aparece "Unidade da carga" (kg / lb). Desligada, não aparece.
2. Escolher lb, abrir um exercício: o campo de peso diz "lb", os botões −/+ dizem "5 lb" (para 2,5 kg; "2,5 lb" para 0,5 kg ou 1 kg) e 100 lb + 5 lb dá 105 lb, "Sugestão" e "Última vez" saem em lb.
3. Digitar 100 lb, marcar a série, recarregar: continua 100 lb; no histórico também. Voltar para kg: a mesma série mostra 45,35 kg.
4. Conferir que o plano (visto pelo treinador) não mudou.
5. "Restaurar padrão" em Preferências volta a carga para kg.
6. Fase 2: com a chave ligada, entrar como treinador fictício e abrir Ajustes: aparece "Unidade da carga". Escolher lb, abrir um plano, um exercício e "Outras formas de carga": a opção é "Carga fixa (lb)"; digitar 100 grava 45,35 kg, o resumo da série mostra "100 lb" e o PDF do treino sai em lb. No progresso do exercício e nos recordes da semana a carga aparece em lb.

## Fora do escopo
- Unidade `lb` por exercício no plano (a unidade do exercício continua `kg` ou `nenhuma`).
- Treino ao vivo do treinador: não existe tela real; a única parecida é a prévia "Ver como aluno" (decisão 17).

## O que ficou para trás
- Metodologia e receitas em lb (decisão 16), se o Gustavo quiser.
- Textos de ajuda (`ajuda/conteudo.ts`) citam "kg" como exemplo.
