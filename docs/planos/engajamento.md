# Engajamento: retorno imediato, conquistas e mural

Situação: Etapa 0 em andamento · Onde: branch `gamificacao` (worktree `../consultoria-gamificacao`) · Atualizado: 28/10/2026

Explicação completa (opinião sobre a proposta, princípios, onde fica no app): documento "Consultoria: engajamento,
conquistas e comunidade" no Claude (https://claude.ai/artifact/7NuC2i7ycFBvpYSZok3fCT). **Este arquivo é a fonte do status.**

## Objetivo
O aluno sentir o próprio progresso e o acompanhamento do treinador, para seguir o plano e renovar a pasta. Recompensar
constância e esforço feito; nunca corpo, dieta restritiva ou tempo de uso.

## Regras da frente
- Tudo atrás de `TREINOS_RETORNO_HABILITADO` (padrão false). Nada vai para a `main` sem aprovação do Gustavo.
- Branch com merge da `main` antes de cada passo (nunca rebase). Migration da branch é renumerada se a `main` ganhar outra.
- Passa-se de etapa só pelo portão.

## Decisões (provisórias da Etapa 0)
| # | Decisão | Valor |
| --- | --- | --- |
| P1 | Treino cumprido | "Concluir treino" declarado pelo aluno; o app sugere "Fiz tudo" (todas as séries marcadas) ou "Fiz em parte" |
| P2 | Desfazer | "Reabrir treino" = mesmo registro com concluida=false |
| P3 | Recorde pessoal | Três tipos, só em série simples (sem cluster, rest-pause nem etapas): maior carga no exercício, mais repetições com a mesma carga e maior volume da série (carga × repetições). Primeiro registro do exercício não conta. O aluno vê; o treinador vê os da semana |
| P4 | Reação do treinador | Uma só, "Visto", sem texto; permissão `REGISTRO_REAGIR` |
| P5 | Semana completa | Conta do "Sua semana"; plano sem dia fixo não comemora |
| P6 | Chave | `TREINOS_RETORNO_HABILITADO`, 503 `RETORNO_INDISPONIVEL` desligada |
| P7 | 1RM estimado | Não entra: a metodologia do Saraiva não usa 1RM (o % é da WS) e seria uma conta nova. Só se o Saraiva pedir |
| P8 | Cartão para compartilhar | Calendário do mês com os dias treinados, nº do treino e a marca da consultoria. Sem peso corporal, foto, medidas ou dieta; volume só se o aluno ligar |
| P9 | Duração | Começa na primeira série marcada e termina no "Concluir treino"; abaixo de 10 min o app pergunta se quer ajustar |
| P10 | Recordes sem internet | A lista de recordes de cada exercício do plano vem junto do pacote do aluno, então o aviso aparece offline; o servidor confirma depois |

## Decisões abertas
- [ ] Plano sem dia fixo: "treinos por semana" na pasta? (Etapa 1)
- [ ] Copo de 250 ml no Registro do dia? (Etapa 1)
- [ ] Medalhas e nomes (Etapa 2)
- [ ] O Saraiva modera um mural? (Etapa 3)
- [ ] Comunidade como adicional pago na Central? (Etapa 3)
- [ ] Temporada e empate dos desafios (Etapa 4)
- [ ] Push do servidor: serviço e avisos (antes da Etapa 3)

## Etapas e passos
Portões: 0→1 linha de base dos 5 alunos com a chave desligada e 2 semanas com a Etapa 0 ligada · 1→2 registros
confiáveis e números comparados · 2→3 moderação, push e adicional decididos · 3→4 mural em uso e moderação sustentável ·
4→5 só se 3 e 4 provarem valor.

- [x] 0.1 Chave e "Concluir treino": botão no topo e no rodapé da tela do dia, duração (P9), "Como foi seu treino?" opcional (até 300, sensível, o treinador vê) — API V035, fila offline — commit: `5de8d16` (branch `gamificacao`, 28/10/2026; `mvn verify` 1419 testes, app 2143 testes depois do merge da `main`, e2e `concluir-treino` 8/8; falta só a tela do treinador, que é o 0.5). Ajuste de 28/10 (chave desligada no meio do uso, padrão do ciclo): app 2157 testes em 158 suítes, e2e do aluno 53 passando, `concluir-treino` com o caso do 503
- [ ] 0.2 Recordes pessoais (P3, P10): baixados com o pacote, aviso no topo na hora em que a série é marcada (miniatura do exercício, "Maior carga · 70 kg"), medalha no lugar do número da série, contagem no resumo — commit: —
- [ ] 0.3 Treino ao vivo: faixa no topo com duração, volume e séries feitas; coluna "Anterior" por série (a mesma série da última vez: "40 kg × 10") — commit: —
- [ ] 0.4 Tela "Bom trabalho!": "Este é o seu 12º treino", resumo, recordes do dia e o cartão para compartilhar (P8: Stories, baixar, compartilhar) — commit: —
- [ ] 0.5 Treinador: reação "Visto" (V036, `REGISTRO_REAGIR`) e "Recordes da semana" no Início e na ficha — commit: —
- [ ] 0.6 Semana completa no Início — commit: —
- [ ] 1.1 Meta semanal da pasta
- [ ] 1.2 Registro do dia: água (copos de 250 ml) e "Como foi seguir o plano hoje?" (mensagem já escrita em 27/10)
- [ ] 1.3 Aba Progresso: Meu progresso, 28 dias contra os 28 anteriores
- [ ] 1.4 Ficha: cartão "Acompanhamento" com abas
- [ ] 2.1 Medalhas de constância e retomada
- [ ] 3.1 Push do servidor
- [ ] 3.2 Mural: publicar, reagir, comentar, denunciar, ocultar, bloquear
- [ ] 3.3 Compartilhar conquista com prévia
- [ ] 3.4 Funcionalidade `COMUNIDADE` na Central
- [ ] 4.1 Desafio mensal e ranking opcional
- [ ] 5.1 Feed aberto e avaliações estruturadas

## Referência: Hevy (prints de 27/10)
O que veio dos prints do Hevy e onde entrou:

| No Hevy | Aqui | Passo |
| --- | --- | --- |
| Aviso de recorde no topo ao marcar a série ("Maior peso · 70 kg", "Melhor volume de série") | Aviso de recorde pessoal, offline | 0.2 |
| Medalha no lugar do número da série | Igual | 0.2 |
| "Melhor 1RM" | Não entra (P7) | — |
| Coluna "Anterior" por série | Coluna "Anterior" | 0.3 |
| Duração, volume e séries no topo durante o treino | Faixa do treino ao vivo | 0.3 |
| "Concluir" no topo | "Concluir treino" no topo e no rodapé | 0.1 |
| "Duração de treino incomum" | Aviso abaixo de 10 min (P9) | 0.1 |
| "Salvar treino" com descrição | "Como foi seu treino?" opcional | 0.1 |
| "Bom trabalho! Esse é o seu 4º treino" + cartão com calendário | Tela "Bom trabalho!" + cartão com a marca da consultoria | 0.4 |
| Compartilhar no Stories, baixar, copiar | Compartilhar e baixar o cartão (fora do app, sem moderação) | 0.4 |
| Feed com tempo, volume, recordes, curtir e comentar | Mural (só se o aluno escolher publicar) | 3.2, 3.3 |
| Foto e vídeo no treino, academia, visibilidade | Não entra agora (foto é dado sensível; mural depois) | — |
| Atletas sugeridos, seguir pessoas | Não entra (comunidade só dentro da consultoria) | — |

## Métricas
Treinos com registro e concluídos por semana, semanas seguidas no combinado, atualizações no prazo, pastas renovadas,
retomadas depois de 2 semanas. Antes e depois nas mesmas pessoas, períodos iguais. Tempo de uso não conta.

## O que ficou para trás
Do 0.1 (revisão de 28/10/2026), nada disso bloqueia a branch; confira antes de ligar `TREINOS_RETORNO_HABILITADO`:
- Texto da Ajuda (`ajuda/conteudo.ts` + guias) e o item "Retorno imediato" do `AGENTS.md` (inclui `concluir-treino.spec.ts` na lista de testes de tela): ficam para o último passo da frente.
- Capturas 390/1280, claro e escuro, da Folha "Concluir treino": o tema escuro não foi conferido na tela (só tokens) e o nativo (foco do "Ajustar duração", vibração, Folha) não foi testado no celular.
- Duração: o início vem da primeira série marcada **neste aparelho**; treino marcado em outro aparelho ou só no servidor abre sem duração e o aluno digita (ou deixa em branco).
- Colisão com a `main`: **V035 e SQLite 4 podem colidir com a main. Renumerar no merge para a main.**
- Chave desligada no meio do uso (resolvido em 28/10, padrão da frente do ciclo): um 503 `RETORNO_INDISPONIVEL` de qualquer rota de conclusões avisa a sessão, que põe `retornoHabilitado=false` no estado e no perfil salvo. Com ela falsa, as conclusões da fila ficam `LOCAL` (não viram `FALHOU`) e o Sincronizador não as envia; Selo, Conta, aviso de "Sair" e `CartaoExcluirConta` não as contam. Quando a abertura da sessão regrava o `retornoHabilitado` do `/eu` como verdadeiro, o envio retoma sozinho, com o mesmo id. Itens que já estavam `FALHOU` antes do desligamento ficam escondidos enquanto a chave estiver falsa e voltam a aparecer quando ela volta.
- Revisão do ajuste da chave desligada (28/10), nada bloqueia o push:
  - Chave desligada por mais de 60 dias com uma conclusão `LOCAL` na fila: ao voltar, o servidor recusa por data, o item vira `FALHOU`, "Tentar de novo" falha sempre e só `ENVIADO` é limpo, então o registro (e o comentário) fica no aparelho. Improvável (a produção nasce desligada); a saída é descartar na retomada as conclusões `LOCAL` fora da janela de 60 dias.
  - Falta um teste da retomada sem remontar o provider (sessão aberta offline que fica online: ramo `virouLigada` do `AlunoProvider`); o e2e recarrega a página. As checagens "sem falha" do e2e também passariam com `FALHOU` escondido: o que prova `LOCAL` é o segundo POST com o mesmo id.
  - Com a chave falsa, "Sair" e "Excluir minha conta" apagam as conclusões `LOCAL` (comentário incluído) sem avisar; o aviso de "Sair" não as conta. É o que a decisão pede.
  - A retomada só acontece numa abertura de sessão (`abrir`); app vivo na memória com a chave falsa só volta na próxima abertura (igual ao ciclo).
  - `AGENTS.md` ("Aluno offline": depósitos da fila agora são três, as conclusões só contam com a chave ligada; regra do 503 `RETORNO_INDISPONIVEL` no molde do ciclo): fica com o item "Retorno imediato" do último passo.
- Conclusão ou reabertura de um dia perto do limite de 60 dias, feita offline por mais de um dia: o servidor recusa por data e o item fica com falha (igual à mobilidade; o prazo de 60 dias só limpa o que já foi enviado).
- Reabrir uma conclusão que só existe no servidor, com o relógio do aparelho atrasado: o servidor responde "antigo" e o app mostra reaberto enquanto o treinador vê concluído (o último vence, por desenho).
- `api/rotas.ts` `sessoesConcluidasDoAlunoParaTreinador` ainda não tem tela: é do 0.5.
- `AnonimizacaoService`/`receber` não conferem `aluno.anonimizado` (igual a execuções e mobilidade); só uma requisição que já passou do filtro poderia regravar um comentário depois da anonimização.
- Ambiente: `app/node_modules` do worktree é uma junction para o checkout principal. O `npm run e2e` puro pode abrir em branco por causa do cache do Metro; usar `expo export --clear` antes. Nunca `rm -rf` na junction (usar `cmd /c rmdir`).
