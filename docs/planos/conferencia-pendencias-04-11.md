# Conferência de pendências de 04/11

Situação: Concluída em 04/11/2026 (só documentação) · Onde: branch `docs-conferencia` · Atualizado: 04/11/2026

## Objetivo
Conferir no código e nos testes o que o README ainda mostrava como pendente e riscar com a prova. O que faltou ficou anotado, sem implementar.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Commit citado | O da `main` (squash do PR). Os hashes de branch dos planos antigos (`8a00dd86`, `797b9751`, `0c334f6b`...) não estão na história da `main` | conferência de 04/11 |
| 2 | Linhas do README e de planos de outras frentes | Não editadas aqui; a coluna "Linha para o coordenador" traz o que trocar | pedido da frente H |

## Passos
- [x] 1. Conferir os 9 itens abaixo no código e nos testes — commit: —

| Item | Prova (código e teste) | Commit na `main` | Lacuna |
| --- | --- | --- | --- |
| RIR de 0 a 10 | `Esforco.RIR_MAXIMO = 10` (`ConteudoTreino.java:425`, recusa em `:442`); `RIR_MAXIMO` em `app/src/dominio/validacaoDeSerie.ts:20` e `LeitorDePrescricao.java:40`. Testes: `ValidadorTreinoTest.esforcoRirDeZeroADezRpeDeMeioEmMeioNuncaOsDois` (0, 5, 10 passam; 11 e -1 recusados) e `:608-609`; `cargaFixaERirPorSerie.test.ts` ("as opções vão de 0 (até a falha) a 10"); e2e `series-metodologia.spec.ts` | `4cc855e6` (#39) | Nenhuma de código. Passo 5b do plano (APK novo e app antigo) segue do Gustavo |
| RIR por série | `alterarEsforcoDaSerie` e agrupamento só pela forma do esforço (`dominio/agrupamento`); `cargaFixaERirPorSerie.test.ts`: "quatro séries iguais com RIR diferentes continuam um grupo", "o texto do grupo lista o RIR de cada série", "alterarEsforcoDaSerie muda só o número daquela série"; e2e `editor-series.spec.ts` | `4cc855e6` (#39) | "Repetir" some entre séries de RIR diferente; trocar o tipo do grupo perde os RIR por série (já em "O que ficou para trás" do plano) |
| Carga fixa | `CARGA_FIXA`/`valorKg` em `ConteudoTreino` e `Carga.problemas`; `ValidadorTreinoTest.cargaFixaExigeValorEmKgAteOTetoSemPercentualNemReferencia`, `cargaFixaNaoESerieDeTrabalhoNemServeDeReferencia`, `cargaFixaSoEmExercicioComCargaEFicaForaDoCardio`; `CargaJsonTest`; `cargaFixaERirPorSerie.test.ts` (validação, texto, meta, editor, pacote offline); `ExercicioAluno.cargaDesconhecida.test.tsx`; `formatoDoPacote.test.ts`; `pdf.test.ts` | `4cc855e6` (#39) | Passo 5b: gerar APK novo e conferir num app antigo de verdade (Gustavo). Leitor da planilha ("12 kg") ficou fora por decisão (D6) |
| "Publicar tudo" | `PastaController`/`PastaService`; `app/src/treinador/PublicarTudoDaPasta.tsx`, `dominio/publicarPasta.ts`. Testes: `PastaPublicarCopiarPesoIntegrationTest` (tudo ou nada, versões, 409, permissões, concorrência), `publicarPasta.test.ts` (inclui `versoesDasListas`), e2e `pasta-e-atualizacao.spec.ts` ("publicar tudo: ..." nos dois tamanhos). Correção do `/eu` velho (mobilidade fora de `versoes`): `versoesDasListas` | `c7a2f673` (#40); correção do `/eu` em `78e07269` (#93, passo B) | Nenhuma. O passo B de `pendencias-04-11.md` (também BotaoMarcar, etapas, inscrição, agenda, cupom no PDF) segue sem commit escrito: este item é o que está provado aqui |
| Voltar à pasta (C22) | `treinador/plano/VoltarParaAPasta.tsx` (`router.dismissTo`, sem empilhar segunda ficha); `app/src/app/treinador/alunos/[id].tsx:73-90` (`router.setParams({ pastaId: undefined })`: o `?pastaId=` sai do endereço); e2e `pasta-e-atualizacao.spec.ts:576` ("C22: o ?pastaId= sai do endereço, recarregar não reabre e Voltar à pasta volta à mesma ficha", 2 larguras) | `c7a2f673` (#40) | `dismissTo` só provado na web; conferir no celular (item d do plano da pasta, Gustavo) |
| Gráfico de medidas | `dominio/avaliacaoFisica.ts` (opções, pontos sem interpolar), `treinador/CartaoAvaliacaoFisica.tsx` com `GraficoLinha`, `app/aluno/historico.tsx`; `avaliacaoFisica.test.ts` ("gráfico por medida": opções e pontos); e2e `avaliacao-fisica.spec.ts` (treinador e aluno, 2 larguras); eixo pela data em `58a315c0` | `2320c1e8` (#41); eixo em `58a315c0` | Uniformizar os textos de "gráficos desligados" (sem código, decisão de 02/11) |
| Foto de perfil pela equipe | `FotoPerfilController` (`PUT`/`DELETE /alunos/{id}/foto-perfil`, `ALUNO_ALTERAR`); `FotoPerfilPelaEquipeIntegrationTest` (troca, apaga, auditoria de resumo fixo, 403, 404 de outra consultoria, 409 anonimizado, 422); app `FotoDePerfilEditavel` no círculo do topo da ficha; e2e `foto-perfil-equipe.spec.ts` (1280 e 390 px, sem permissão, 422/409, anonimizado) | API e tela `2320c1e8` (#41); no círculo `78e07269` (#93) | Nenhuma |
| "Menos opções" da agenda | `FolhaCompromisso.tsx:202` e `FolhaEvento.tsx:225` (só no item novo, sem apagar o digitado); aviso "Também preenchido em Mais opções" em `agendaEvento.ts`/`agendaPresencial.ts` com jest (`agendaEvento.test.ts:215-235`, `agendaPresencial.test.ts`) | `396881d5` (#62) | Nenhum teste de tela clica em "Menos opções" (`agenda-calendario.spec.ts` e `agenda-presencial.spec.ts` só conferem "Mais opções"). Falta um e2e: abrir o completo, digitar, voltar e ver o digitado |
| `psql` de 26/10 (~12:20) | Só existe a linha do README ("Lembrar o que era a alteração revertida no `psql` de 26/10"), criada em `184d88a9` (27/10). Nenhum arquivo do repositório, nem a nota de passagem de 26/10 (commit `9da28016`, depois removida), diz o que era. O que o repositório documenta de 26/10 é outra coisa: a sessão `psql` esquecida "idle in transaction" que travou a V033 (`docs/papeis-banco.md`, "Travas"; commit `865b9ca9`) | — | Pode riscar como "encerrada": a transação foi desfeita e nada ficou gravado (informação do pedido desta frente; o repositório não prova). Não dá para provar com o código; sem banco consultado |

## Linhas para o coordenador (README e planos de outras frentes)
Ver o relatório desta frente. Resumo: linhas 53/54/56 do README já estão certas; trocar as linhas 109, 135 a 139, 141, 142 e 152 conforme o relatório.

## Fora do escopo
- Implementar o que faltou (e2e de "Menos opções", conferência no celular, APK novo).
- Consultar banco ou produção.

## O que ficou para trás
- e2e de "Menos opções" (agenda, compromisso e evento novos).
- Conferir no celular o `dismissTo` do "Voltar à pasta".
- Passo 5b do editor de séries: APK novo e app antigo com carga fixa (Gustavo).
