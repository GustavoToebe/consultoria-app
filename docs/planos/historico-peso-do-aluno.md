# Peso, medidas e foto de perfil: Histórico do aluno, gráfico por medida, foto trocada pelo treinador

Situação: Concluída em 02/11/2026 (PR #41, `2320c1e`, deploy verde às 22h27) · Onde: `main`, **leva 2** · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C42, C43, C44, C46 · Frente E da leva 2

## Objetivo
O Histórico do aluno não tem o peso nem o gráfico (1:40 da reunião); a avaliação física só compara datas em tabela; o
treinador não troca a foto de perfil do aluno; e falta conferir se a lesão tem data.

## O que o código faz hoje (main 19b1fd6)
- O Histórico do aluno tem Fotos, Atualizações, Avaliação física e Registros e cargas, sem peso.
- A ficha do treinador tem `CartaoPeso` (lista e gráfico) e `CartaoAvaliacaoFisica` (comparar 2 a 4 datas, sem gráfico).
- A foto de perfil é trocada só pelo aluno (`PUT`/`DELETE /aluno/foto-perfil`); a equipe só vê (`ALUNO_LER`).
- `CartaoLesoes` existe na ficha (`ALUNO_SENSIVEL_LER`); falta conferir se há data.

## Decisões (Gustavo, 02/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | C42 | cartão Peso no Histórico do aluno (lista + gráfico), respeitando a preferência `graficos`; rota só do aluno da sessão, se ainda não existir | Gustavo |
| D2 | Variação do peso | **neutra na E (seta e sinal, sem cor)**; a cor vem na Frente F ([cor-da-variacao-do-peso.md](cor-da-variacao-do-peso.md)), decidida pelo treinador | Gustavo |
| D3 | C43 | gráfico por medida na avaliação física: escolher a medida, `GraficoLinha` com 2 pontos ou mais, na ficha e no Histórico do aluno | Gustavo |
| D4 | C44 | o treinador troca e apaga a **foto de perfil** do aluno com `ALUNO_ALTERAR`; mesmas regras da do aluno: JPEG sem metadados, 300 KB, 409 se anonimizado; auditoria com resumo fixo | Gustavo |
| D5 | Foto de corpo | continua só pelo aluno | Gustavo |
| D6 | C46 | conferir se a lesão tem data; se não tiver, acrescentar (migration) | Gustavo |

Resolvido em 02/11/2026 (Gustavo: "fecha sem código novo"): `lesao_aluno.data_inicio` e `data_fim` existem desde a V001
(com a regra de fim não anterior ao início) e a API as valida pela `FaixaDeData.REGISTRO`; não há migration nova e os
totais de `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` não mudam (V051 segue a última).

### Observações: quem lê (Gustavo, 02/11/2026, depois da revisão do Opus)
- A observação do **peso** é só da equipe: `GET /aluno/pesos` devolve `observacao` nula (a rota da equipe segue igual). Os
  formulários de registro de peso e de Finalizar pasta dizem, abaixo do campo: "Só a equipe vê esta observação."
- A observação da **avaliação física** continua visível ao aluno (lista e PDF), como sempre foi. O formulário diz, abaixo
  do campo: "O aluno vê esta observação."

## Passos
- [x] 1. Conferir se alguma rota do aluno já entrega os próprios pesos; se não, rota nova com tenant e aluno da sessão e teste de isolamento — executor — `GET /aluno/pesos` já existia; só o teste de isolamento é novo (`PesosDoAlunoIntegrationTest`); commit: `6d1486a4`
- [x] 2. Cartão Peso no Histórico do aluno, reaproveitando o da ficha — executor-front — commit: `0c334f6b`
- [x] 3. Gráfico por medida (seleção da medida, um eixo, sem interpolar ausentes) na ficha e no Histórico — executor-front — commit: `0c334f6b`
- [x] 4. API da foto de perfil pela equipe (`ALUNO_ALTERAR`, 404 de outra consultoria, 409 anonimizado, auditoria) e tela na ficha — executor + executor-front — commit: `6d1486a4` (API), `0c334f6b` (tela), `b913ba08` (trava antes de limpar)
- [x] 5. Data da lesão, se faltar (migration; subir o total em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`) — executor — resolvido sem código novo: a data já existe desde a V001 (D6); commit: —
- [x] 6. Ajuda, guias regerados, e2e, `AGENTS.md` só nos itens de peso, avaliação, foto e lesão — commit: `0c334f6b` (Ajuda, e2e), `b913ba08` (guias, `AGENTS.md`)
- [x] 7. Revisão do Opus (LGPD, permissão) antes do PR — advisor/revisor — commit: `b913ba08` — apontou a pré-leitura sem trava na foto pela equipe (anonimização no meio passaria); corrigido travando e conferindo antes de limpar o JPEG

## Critérios de aceite
- O aluno vê só o próprio peso; a variação não tem cor de aprovação.
- Gráfico da medida com 1 ponto mostra o ponto sem linha; com 2 ou mais, a linha.
- Treinador sem `ALUNO_ALTERAR` não vê o botão de trocar a foto; com ela, troca e apaga; aluno anonimizado dá 409.

## Fora do escopo
- Rótulo de escopo por bloco do Histórico e "Por dia" (C45): Frente G.
- Foto de corpo pela equipe.

## Achado no caminho: anel de foco das `Abas` (Gustavo, 03/11)
- Corrigido em commit à parte (`9fe65b20`, `ui/Abas`, `components/ui/tabs.tsx`, e2e `abas-foco.spec.ts`): o anel de 2 px do
  `:focus-visible` saía cortado pela rolagem horizontal; agora fica inteiro com folga de 2 px, só no teclado (o clique não
  acende o anel: o `@rn-primitives/tabs` chama `focus()` no `mousedown`). Conferido em 390 e 1280 px, claro e escuro.
- As abas usam tabindex móvel: só a aba ativa é parada do Tab; as outras se alcançam com as setas.


## Encontro com a Frente D (merge da main c7a2f67)
- A D escreveu no Finalizar "O aluno vê esta observação no histórico de peso e no PDF da dieta", verdade sem a E. Com a E,
  `GET /aluno/pesos` devolve a observação nula e o PDF da dieta só é gerado pelo aluno com esses pesos: o texto voltou a
  "Só a equipe vê esta observação." (decisão de 02/11) e a coluna "Obs" do "Acompanhamento de peso" saiu do PDF.

## Eixo do gráfico pela data
O eixo do `GraficoLinha` passou a acompanhar a data (`fracaoNoEixo` em `dominio/grafico.ts`): datas próximas ficam próximas. Rótulos e o mínimo de 2 pontos não mudaram. Peso e medidas já mandavam a data; progresso e evolução das respostas passaram a mandar. Lote pendencias-app-03-11-b, commit `58a315c0`.

## O que ficou para trás
- Conferido em 04/11/2026 (provas em [conferencia-pendencias-04-11.md](conferencia-pendencias-04-11.md)): o gráfico por medida (`dominio/avaliacaoFisica.ts`, `CartaoAvaliacaoFisica`, e2e `avaliacao-fisica.spec.ts`) e a foto de perfil pela equipe (`FotoPerfilController`, `FotoPerfilPelaEquipeIntegrationTest`) estão na `main` pelo squash `2320c1e8` (#41); os hashes dos passos acima são da branch. A troca passou a ser no próprio círculo do topo da ficha (`FotoDePerfilEditavel`, e2e `foto-perfil-equipe.spec.ts`) no lote #93, `78e07269`.
- O botão "Registrar peso" (`CartaoPeso`) aparece para aluno anonimizado e a API responde 409; esconder como a avaliação
  física faz (já era assim antes da frente). Sem código agora (Gustavo, 02/11).
- Com uma data só, o Peso mostra o texto "O gráfico aparece com pelo menos duas datas" e a Evolução por medida mostra o
  ponto; e há dois textos de "gráficos desligados" nos cartões vizinhos (`progresso.ts` e `relatorio.ts`). Uniformizar.
  Sem código agora (Gustavo, 02/11).
