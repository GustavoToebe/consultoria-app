# Ajustes do vídeo de 30/10 (Análise 4: lotes A e B)

Situação: Em andamento · Onde: branch `ajustes-video-30-10` (PR para a `main`) · Atualizado: 31/10/2026

## Objetivo
Ajustar o que já existe no editor de treino, na tela do aluno e no caminho do treinador, sem funcionalidade nova, como
combinado com o Saraiva em 31/10. O corpo enviado à API não muda (Lote A); o Lote B investiga a carga do aluno, liga a
atualização ao editor, a volta à pasta e o peso na finalização. O que pede decisão de produto (Lote C) fica só escrito,
em "Pendências soltas" do README, com o contrato proposto.

A análise (Codex, sobre o vídeo da reunião) foi feita no commit 7d4693e; esta frente parte da `main` f383bcf8 e cada
referência foi conferida no código atual. A análise em si fica fora do git.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Sem funcionalidade nova agora; só ajustar o que existe | Lotes A e B entram em código; Lote C, N16, N20 e N06 viram texto | Gustavo e Saraiva (31/10) |
| 2 | Corpo salvo e contrato da API não mudam no Lote A | Teste de domínio compara o JSON das séries antes e depois | Gustavo |
| 3 | Percentual sempre da carga de trabalho (WS), nunca do 1RM; o app não converte percentual em RIR | Texto "Percentual da carga de trabalho" mantendo o nome configurado do tipo | Análise 4, seção 6 |
| 4 | Fórmula da carga do aluno não muda (40/42/80%/0,5 = 33,5; Cluster em CARGA_TRABALHO sai da base do dia) | Só o texto da origem; B1 reproduz antes de mexer | Gustavo |
| 5 | Variação de peso: valor com sinal, seta e data de comparação; cor só de direção, sem "aumentou = ruim" | Mesma função para treinador e aluno | Análise 4, seção 12 |
| 6 | Finalizar a pasta sem peso novo continua possível; nunca copiar o peso antigo com a data de hoje | Só mostra o peso já registrado na data da atualização | Análise 4, seção 11 |
| 7 | Push só na `ajustes-video-30-10`, um push, PR para a `main` | Push na `main` publica em produção | Gustavo |
| 8 | Sem rota nova na API. Se o B4 precisar de uma, para e pergunta | Data da atualização + `GET /alunos/{id}/pesos` bastam | Plano |

## Itens da análise (N01 a N25)
| Item | Assunto | Decisão |
| --- | --- | --- |
| N01 | Cores de variação de peso e gráfico de medidas | Variação de peso: Lote A 11. Gráfico de medidas: pendência (Lote C) |
| N02 | Modelo de semana confundido com treino completo | Lote A 6 ("Estrutura de semana · sem exercícios") |
| N03 | "% da WS" e muitas opções de carga | Lote A 3 e 2 (rótulo, principais e "Outras formas de carga", percentuais legíveis) |
| N04 | Retirar modalidade; acrescentar libras | Modalidade: Lote A 4 (resumo com edição explícita). Libras: pendência (Lote C) |
| N05 | Reduzir opções por tipo e permitir carga definida | Opções: Lote A 3. Carga fixa: pendência (Lote C) |
| N06 | RIR individual, limite maior, RPE e 1RM | RPE/1RM: sem mudança (pendência escrita). RIR maior que 5 e esforço por série: pendência (Lote C) |
| N07 | "Alvo extra", observações e percentuais | Lote A 3 e 2 ("Observação desta série"; campo e limite de 120 ficam) |
| N08 | Exercício e série, setas e títulos numéricos | Lote A 1 (cabeçalho, mover exercício e mover grupo) |
| N09 | Receitas aceleram; agrupamento e busca | Fora (evolução do fluxo). A busca nas receitas de séries entra por A 7 |
| N10 | Total de séries lido como dia ou período | Lote A 5 (contadores com escopo) |
| N11 | Finalizar, copiar, publicar e atualizar se misturam | Lote A 13 (texto da ordem sugerida). "Publicar os três" e ciclo novo na mesma pasta: pendências (Lote C) |
| N12 | Ler a atualização enquanto edita | Lote B 2 |
| N13 | Voltar não leva ao contexto; publicar um a um | Lote B 3 (voltar à pasta). Publicar junto: pendência (Lote C) |
| N14 | Tipo e meta da série pouco visíveis no aluno | Lote A 8 |
| N15 | Alterar a WS não parece atualizar o Back off | Lote B 1 (reproduzir primeiro) e Lote A 9 (texto da origem) |
| N16 | Carga e repetições anteriores; sugestão de progressão | Pendência (as definições em aberto) |
| N17 | Resumo comemorativo ao marcar as séries | Lote B 5 (concluir treino descoberto) |
| N18 | Dieta, compras, histórico e impressão; contraste | Lote A 12, Lote B 6 e 7 |
| N19 | Atualização enviada, feedback, peso e nova pasta | Lote B 4 e Lote A 13 |
| N20 | Entrada de muitos alunos e planos | Pendência: [importar-plano-de-documento.md](importar-plano-de-documento.md) e importação por planilha |
| N21 | Agenda: a cor ocupa pouco do evento | Lote A 14 (por último; pode escorregar para pendência) |
| N22 | Formulário público, CRM, proposta, aceite | Lote B 8 (cadastro "sumiu": reproduzir e relatar) |
| N23 | Gráfico e contraste confundidos com web/app | Lote B 6 |
| N24 | "Outros" muito junto; editar a mesma pasta | Lote A 10 e 13 |
| N25 | Comunidade, aulas e supervisão da equipe | Fora (frente futura) |

## Passos
- [x] 0. Plano no repositório, capturas "antes" e `dominio/percentuais.ts` (formatador único, com teste) — commits `0fa8eb8e`, `2f645fab`
- [ ] 1. Editor, Lote A 1 a 7 (cabeçalho do exercício e do grupo, percentuais, rótulos, modalidade, contadores, estrutura de semana, receitas de séries) — commit `e52f7802`
- [ ] 2. Aluno, Lote B 1 (reproduzir a carga, estado por estado; sem erro na fórmula, achado de digitação assíncrona corrigido com `valorPendente`) — commit `42c90b4c`
- [ ] 3. Aluno, Lote A 8 a 12 (série, origem da carga, "Outros", variação de peso, dieta e contraste) — commits `42c90b4c`, `a477abdb`
- [ ] 4. Aluno, Lote B 5 e 6 (concluir treino, histórico vazio) — commits `42c90b4c`, `a477abdb`
- [ ] 5. Caminho do treinador, Lote A 13 e Lote B 2 a 4 (ordem da renovação, atualização ao lado, voltar à pasta, peso na finalização) — commit `186e49cf`
- [ ] 6. Lote B 8 (CRM: reproduzir e relatar; achado real: busca por WhatsApp com +55) — commit `5a88e46f`
- [ ] 7. Lote A 14 (Agenda) — commit `27590a0c`
- [ ] 8. Ajuda, guias em PDF, `AGENTS.md`, ligação das peças no `EditorDeTreino` — commits `601d19d5`, `a1300447` (merge da `main`: `b4f5baba`)
- [ ] 9. Lote B 7 (impressão, só relatório), e2e completo, capturas "depois", revisão, PR — commit: —

## Fora do escopo
- Lote C, cada um com o contrato proposto e os impactos em "Pendências soltas" do README: carga fixa, libras, RIR acima
  de 5, esforço por série, publicar os três planos juntos, ciclo novo na mesma pasta, gráfico de medidas, fotos enviadas
  pela equipe. As perguntas próprias no formulário público não são pendência solta: ficam em
  [inscricao-com-perguntas-proprias.md](inscricao-com-perguntas-proprias.md).
- N16 (sugestão de progressão), N20 (migração) e N06 (RPE/1RM): só texto.
- N09 (como evolução do fluxo) e N25 (comunidade, aulas, supervisão).
- Criar tipo Cluster, reescrever séries antigas, mudar padrões globais de FS/WS, mudar a base de carga sozinho, inferir
  RIR a partir de percentual, calcular doses, apagar dado clínico, migrar ou publicar em produção.

## O que ficou para trás
- Cada sobra também está em "Pendências soltas" do README:
  - CRM: avisar na busca vazia quando há resultado em outro filtro ("Encontrada em: Aceitas (1). Ver Todas"); mensagem
    própria para o limite de envio (429) no link público; inscrição reaberta mantém a data original de criação.
  - Agenda: fundo tingido na lista do celular (precisa de `fundo` em `ui/LinhaDaLista`), status na visão do mês e nome
    acessível só com o horário de início.
  - Aluno: editar outra etapa com um salvamento em voo ainda monta o registro a partir do dado antigo (pede mudança em
    `aplicarAcao`); `avisoDoGrafico` pode reaproveitar o texto de domínio do B6.
  - Impressão (B7): só o relatório; o diálogo real de impressão não é automatizável aqui.
