# Peso, medidas e foto de perfil: Histórico do aluno, gráfico por medida, foto trocada pelo treinador

Situação: Planejando · Onde: branch `peso-medidas-foto` (worktree `wt-peso-medidas`), **leva 2** · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C42, C43, C44, C46 · Frente E da leva 2

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
| D2 | Variação do peso | **sem cor de "bom ou ruim"**: o app não opina | Gustavo |
| D3 | C43 | gráfico por medida na avaliação física: escolher a medida, `GraficoLinha` com 2 pontos ou mais, na ficha e no Histórico do aluno | Gustavo |
| D4 | C44 | o treinador troca e apaga a **foto de perfil** do aluno com `ALUNO_ALTERAR`; mesmas regras da do aluno: JPEG sem metadados, 300 KB, 409 se anonimizado; auditoria com resumo fixo | Gustavo |
| D5 | Foto de corpo | continua só pelo aluno | Gustavo |
| D6 | C46 | conferir se a lesão tem data; se não tiver, acrescentar (migration) | Gustavo |

## Passos
- [ ] 1. Conferir se alguma rota do aluno já entrega os próprios pesos; se não, rota nova com tenant e aluno da sessão e teste de isolamento — executor — commit: —
- [ ] 2. Cartão Peso no Histórico do aluno, reaproveitando o da ficha — executor-front — commit: —
- [ ] 3. Gráfico por medida (seleção da medida, um eixo, sem interpolar ausentes) na ficha e no Histórico — executor-front — commit: —
- [ ] 4. API da foto de perfil pela equipe (`ALUNO_ALTERAR`, 404 de outra consultoria, 409 anonimizado, auditoria) e tela na ficha — executor + executor-front — commit: —
- [ ] 5. Data da lesão, se faltar (migration; subir o total em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`) — executor — commit: —
- [ ] 6. Ajuda, guias regerados, e2e, `AGENTS.md` só nos itens de peso, avaliação, foto e lesão — commit: —
- [ ] 7. Revisão do Opus (LGPD, permissão) antes do PR — advisor/revisor — commit: —

## Critérios de aceite
- O aluno vê só o próprio peso; a variação não tem cor de aprovação.
- Gráfico da medida com 1 ponto mostra o ponto sem linha; com 2 ou mais, a linha.
- Treinador sem `ALUNO_ALTERAR` não vê o botão de trocar a foto; com ela, troca e apaga; aluno anonimizado dá 409.

## Fora do escopo
- Rótulo de escopo por bloco do Histórico e "Por dia" (C45): Frente G.
- Foto de corpo pela equipe.

## O que ficou para trás
- —
