# Importar a planilha completa (alunos, pesos, treinos e dietas)

Situação: Em andamento (fase 1 pronta na branch, falta a CI e a conferência do Gustavo) · Onde: branch `worktree-agent-a070c42710311d84b` · Atualizado: 31/10/2026

## Objetivo
O treinador que vem de outra plataforma manda a planilha inteira (várias abas ligadas entre si) e o app traz de uma vez
os alunos, os pesos, os exercícios que faltam na biblioteca e, por aluno, uma pasta com treino e dieta em rascunho. Antes
era preciso converter aba por aba com os scripts de `scripts/importacao/`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Sem IA | Só regras fixas: reconhecer a aba pelos títulos das colunas, ligar as abas por código (ou nome), ler a prescrição por padrões e casar nomes por semelhança. O que não for entendido vai para a observação e para a lista de problemas | Gustavo |
| 2 | Nada inventado | Carga, repetição e valor nutricional nunca são inventados: ausente fica nulo ("—"), série só nasce com a quantidade escrita, carga em kg e técnica escritas vão para a observação | Gustavo |
| 3 | Fase 1 | A planilha em tabela: análise (abas reconhecidas e ligadas), respostas do treinador (tipo de cada aba, ligações ambíguas, nomes de exercício e alimento, destino de cada suplemento), prévia e confirmação | Gustavo |
| 4 | Rascunho | Treinos e dietas entram sempre em rascunho, numa pasta "Importada da planilha (rascunho)" por aluno. Nada é publicado | Gustavo |
| 5 | Desfazer | `POST /importacoes/{id}/desfazer` apaga só o que ninguém mexeu e diz o que ficou e por quê | Gustavo |
| 6 | LGPD | Nenhum dado de aluno em log, auditoria ou mensagem de erro: o problema cita aba, linha, campo e código, nunca o valor. A tela só recebe contagens e nomes de aba, exercício, alimento e suplemento | Gustavo |
| 7 | Revisão do d37fcb5 | TACO e tabelas de terceiros só reconhecidas, nunca importadas; sem apelidos do Saraiva no reconhecimento; código repetido liga à primeira linha | Gustavo |

### Decisões confirmadas (Gustavo, 31/10)
Tomadas na implementação e confirmadas pelo Gustavo em 31/10: exercício novo como Máquina, alimento nunca criado, suplemento sem classificação em "Medicação e ergogênicos" e responsável = quem importa (pode ser trocado depois, na ficha ou em lote na lista de alunos: Selecionar → Trocar responsável).
- Exercício novo nasce com a modalidade `MAQUINA` (a coluna é obrigatória no banco; é o mesmo padrão da importação de uma aba).
- Alimento nunca é criado: o item sem par na biblioteca fica manual, com o nome e os valores da planilha.
- Suplemento sem resposta e sem par em nenhuma biblioteca vai para "Medicação e ergogênicos" (o lado conservador, como o script) e conta como pendência.
- O responsável pelos alunos novos é quem importa. O aluno que já existe é reaproveitado pelo e-mail ou pelo nome (só quando há um com esse nome); anonimizado é pulado.
- Confirmar duas vezes a mesma planilha cria outra pasta com novos rascunhos para os mesmos alunos (alunos e pesos não duplicam). O desfazer cobre.
- O desfazer procura o id do exercício nos JSON de rascunhos, versões publicadas e modelos em Java (sem `LIKE` em coluna JSON, que não roda por JPQL no Postgres). Consultoria muito grande pesa, mas a operação é rara.
- Os nomes da aba de suplementos (que podem ser de medicação) só voltam na análise a quem pode gravar a dieta (`PASTA_ALTERAR` + `DIETA_ALTERAR`).
- A linha ambígua mostra só números de linha ("linha 6 de Exercícios liga à linha 3 de Rotinas"): a API não manda o nome que se repete.

## Passos
- [x] 1. Regras de reconhecimento, ligação, prescrição e nomes, e a análise só leitura (`POST /importacoes/planilha-completa/analisar`) — commit: d37fcb5
- [x] 2. Prévia, confirmação em rascunho, desfazer e V049 (`importacao_id`) — commits: 51a1f24, ef0cca2
- [x] 3. Análise com as linhas ambíguas e os nomes de suplemento com a sugestão — commit: 47f1b48
- [x] 4. Tela: cartão "Planilha completa" entre os destinos, página inteira `/treinador/importacao/planilha-completa` (arquivo, abas, nomes, prévia, resultado), "Desfazer importação" no histórico, Ajuda e e2e — commit: 2aae19d
- [ ] 5. CI verde (`mvn verify` com os testes de integração, que precisam de Docker) e conferência do Gustavo com uma planilha fictícia
- [ ] 6. Fase 2: o que o Gustavo decidir depois da conferência

## Fora do escopo
- Importar de PDF ou Google Docs: frente própria, [importar-plano-de-documento.md](importar-plano-de-documento.md).
- Criar alimento na biblioteca a partir da planilha.
- Publicar treino ou dieta na importação.

## O que ficou para trás
- (nada ainda)
