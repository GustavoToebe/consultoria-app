# Importar a planilha completa (alunos, pesos, treinos e dietas)

Situação: Em andamento (fase 1 pronta; fase 2 pronta na branch `importacao-fase2`, falta a revisão, a CI e a conferência do Gustavo) · Atualizado: 01/11/2026

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

### Fase 2 (escopo combinado com o Gustavo)
"Segunda versão: uma aba por aluno, blocos, o leitor de prescrição mais completo e as respostas salvas por consultoria."
Continua sem IA e sem nada inventado.

### Decisões da fase 2 (Claude, 01/11, para o Gustavo conferir)
- Aba de um aluno: só a aba de treino, dieta ou suplementos **sem** coluna que diga o aluno (código, nome, rotina, plano) e
  cujo nome parece nome de pessoa (só letras, até 8 palavras, nenhuma palavra genérica de treino, dieta, grupo muscular,
  refeição ou dia da semana; "Treino - Ana" e "Dieta da Ana" valem). Aba que tem a coluna continua tabela, como na fase 1.
  Nome de aba que não é de aluno mas passa na regra (ex.: um nome de método fora da lista) vira aluno novo: a análise
  mostra "aluno novo" e o treinador ignora a aba.
- Blocos: só com o cabeçalho repetido em cima de cada tabela (o título fica na linha logo acima, até três linhas). Um
  cabeçalho só com nomes no meio da tabela **não** é separado: seria confundido com o título de um treino ("Treino A").
  Título com "Aluno:" ou "Nome:" é sempre aluno; título que parece nome de pessoa também; o resto é o nome da divisão ou
  da refeição. O aluno de um bloco vale para os seguintes até aparecer outro nome.
- Aluno do bloco: o da aba de alunos da planilha com o mesmo nome; senão o aluno da consultoria com o mesmo nome (só um);
  senão um aluno novo **só com o nome** (ativo, sem convite, conta a vaga do plano). Nome repetido = o bloco não entra
  (um problema só, na linha do cabeçalho).
- LGPD: o nome do aluno que está no nome da aba ou no bloco volta só ao próprio treinador, na análise (é a planilha dele),
  e nunca é guardado; o histórico guarda "Aba N" no lugar do nome da aba que é nome de aluno.
- Prescrição: pirâmide (3 a 10 números de 1 a 500, ao menos dois diferentes) e "4x12/10/8" só quando as séries batem com os números;
  "60s" solto **não** é descanso (pode ser tempo de outra coisa), só "desc 60s", "intervalo 1min" e 90"; a coluna
  Descanso só com unidade ("60" sem unidade fica na observação); RIR e RPE só de um valor, e com os dois juntos (ou com
  "falha" e RIR diferente de 0) nada é lido; série por tempo nasce sem repetições e a duração vai para a observação.
- Técnica escrita: só quando há **uma** técnica estruturada na célula (rest pause, cluster ou drop-set) e ela está na
  metodologia da consultoria; o que não foi escrito (pausa, pausas, quedas) vem do padrão da técnica na metodologia, o
  mesmo que o editor preenche ao escolher a técnica; cluster só com os blocos escritos ("4+4+2", "3 blocos de 4") e
  repetições que somam os blocos. Vale para todas as séries da linha, ou só para a última com "na última". O texto da
  planilha **sempre** fica na observação quando a técnica entra, para o treinador conferir o padrão usado.
- Respostas salvas: guardadas só ao **confirmar**, na mesma transação; a aba pela assinatura dos títulos (sha256, nunca o
  texto); os nomes pela chave comparável. Voltam marcadas (a prévia e a confirmação usam só o que a tela manda). "Aceitar"
  só volta com sugestão e "biblioteca" só com o item ainda ativo. Tirar a resposta de um nome na tela não apaga a
  guardada (só trocar por outra, ou "Esquecer" todas). Teto de 10.000 por consultoria. Suplemento só é guardado e só volta
  a quem pode alterar dietas.

## Passos
- [x] 1. Regras de reconhecimento, ligação, prescrição e nomes, e a análise só leitura (`POST /importacoes/planilha-completa/analisar`) — commit: d37fcb5
- [x] 2. Prévia, confirmação em rascunho, desfazer e V049 (`importacao_id`) — commits: 51a1f24, ef0cca2
- [x] 3. Análise com as linhas ambíguas e os nomes de suplemento com a sugestão — commit: 47f1b48
- [x] 4. Tela: cartão "Planilha completa" entre os destinos, página inteira `/treinador/importacao/planilha-completa` (arquivo, abas, nomes, prévia, resultado), "Desfazer importação" no histórico, Ajuda e e2e — commit: 2aae19d
- [ ] 5. CI verde (`mvn verify` com os testes de integração, que precisam de Docker) e conferência do Gustavo com uma planilha fictícia
- [x] 6. Fase 2: leitor de prescrição mais completo — commit: df89d9d
- [x] 7. Fase 2: uma aba por aluno e alunos em blocos — commit: 5a49288
- [x] 8. Fase 2: respostas salvas por consultoria (V051) e "Esquecer" — commit: b6c184b
- [x] 9. Fase 2: tela (formato e aluno de cada aba, respostas marcadas, esquecer), jest e e2e — commit: 2ee16d0
- [ ] 10. Fase 2: CI verde (os testes de integração novos precisam de Docker), junção com a V050 e conferência do Gustavo

## Fora do escopo
- Importar de PDF ou Google Docs: frente própria, [importar-plano-de-documento.md](importar-plano-de-documento.md).
- Criar alimento na biblioteca a partir da planilha.
- Publicar treino ou dieta na importação.

## O que ficou para trás
- Blocos sem cabeçalho repetido (um cabeçalho só e os nomes no meio da tabela): fora da fase 2, ambíguo com o título de um
  treino.
- Responder na tela qual é o aluno de uma aba ou bloco (hoje só dá para ignorar a aba).
- Tirar uma resposta salva sozinha (hoje só trocar ou esquecer todas).
