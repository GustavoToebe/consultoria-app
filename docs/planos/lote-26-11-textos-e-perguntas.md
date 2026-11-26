# Lote de 26/11: textos novos de interface e perguntas do Saraiva (para aprovação do Gustavo)

Estado: **rascunho consolidado em 26/11/2026, sem aprovação**. Nada vai para produção antes da aprovação do Gustavo.
Fonte: relatórios dos agentes do lote (worktree `consultoria-app-lote-26-11`, branch `lote-tres-frentes-26-11`, base `main`
2e2e8852, nada commitado ainda). Quem ainda não entregou relatório final está em "Pendentes de relatório"; esta lista é
completada quando eles entregarem. Validade: vale para o código do worktree nesta data; qualquer mudança de texto depois
invalida o item correspondente.

## 1. Textos novos de interface já recebidos

| Tela | Texto | Onde aparece |
| --- | --- | --- |
| Editor do PDF (`/treinador/documentos/personalizar`) | Título "Personalizar documentos"; trilha "Documentos (PDF) › Personalizar" | Cabeçalho |
| Editor do PDF | ⓘ: "Ajuste cores, texto, cabeçalho e tabelas do modelo e confira na prévia com dados de exemplo. Nada muda nos PDFs até você salvar." | Descrição do cabeçalho |
| Editor do PDF, celular | "Personalize numa tela maior" · "Ver os modelos" · painel "Usar o modelo X?" · "Usar este modelo" · "As personalizações do modelo atual deixam de valer." | Tela abaixo da área mínima |
| Editor do PDF, painel | "Estilo de todos os documentos" · "Vale para o treino, a dieta e os demais PDFs da consultoria." | Topo do painel |
| Editor do PDF, grupos | Modelo, Cores, Texto, Cabeçalho, Tabelas; resumos "Destaque: Azul", "Sem serifa · texto médio", "Faixa cheia · logo à esquerda · média" (com "· sem o nome"), "Linhas · normal" | Painel de opções |
| Editor do PDF, opções | Fontes "Sem serifa", "Serifada", "Condensada" + nota "Só fontes do sistema: no celular a letra pode sair um pouco diferente."; tamanhos "Pequeno", "Médio", "Grande"; cabeçalho "Faixa cheia", "Linha fina", "Cartão", "À esquerda", "Centralizada", logo "Pequena", "Média", "Grande", "Nome da consultoria"; tabelas "Linhas", "Listrada", "Cartões", "Compacta", "Normal", "Espaçosa" | Painel de opções |
| Editor do PDF, cores | "Cor principal", "Alterar na Marca", "Cor de destaque" | Grupo Cores |
| Editor do PDF, prévia | "Tamanho da prévia", "Ajustar", "100%"; "Dados de exemplo, nenhum é real. A folha é contínua: as quebras de página só aparecem no PDF." | Mesa da prévia |
| Editor do PDF, barra | Selos "Alterações não salvas", "Em uso nos PDFs", "Salvando…", "Falha ao salvar"; botões "Restaurar o modelo", "Salvar"; "Os documentos foram alterados em outro lugar" com "Recarregar" | Barra fixa do topo |
| Editor do PDF, avisos | "Modelo trocado para X." · "Opções do modelo X restauradas." · "Documentos salvos no modelo X. Os próximos PDFs já saem assim." | Faixa Desfazer e aviso de sucesso |
| Treino do dia | "Você está registrando o treino de 21/10/2026 e poderá concluí-lo a partir desse dia." (só em data futura com "Concluir treino" ligado; data passada segue "Você está registrando o treino de DD/MM/AAAA.") | Resumo do treino |
| Exercício (web larga) | Seções "Descanso", "Vídeo", "Como fazer"; região "Sobre o exercício" (nome acessível) | Coluna do exercício |
| Leitura das respostas (aluno e treinador) | "N perguntas" (por seção); "Não respondeu"; "Não se aplica"; "Escala de 1 a 5" (só se não for 0 a 10); chips "Dia 1 · 8"; "Pelo app: média de 0 dias de treino por semana no período." (plural certo); o texto de ajuda da pergunta saiu da leitura | Atualização enviada, anamnese, inscrição |
| Comunidade (aluno, web) | "Publicações" passa a ser rótulo visível; linha de controles com "Nova publicação" (primária) à direita | Mural |

## 2. Textos novos dos agentes que entregaram depois (D, E-app, P5, Dieta, Histórico)

Fonte: relatórios finais dos agentes e literais do código do worktree em 26/11 (noite). Valem para o código desta data.

| Tela | Texto | Onde aparece |
| --- | --- | --- |
| Revisão da atualização (D), cartão | Título **"Prescrição atual"** (a versão de hoje, não a que valia na resposta); abas Treino, Dieta, Suplementos, Outros; link "Abrir no editor"; "Carregando o que está prescrito…"; "Esta atualização não tem pasta."; "A pasta desta atualização não tem treino publicado." / "…dieta publicada."; "Versão agendada: o aluno ainda não a vê."; "Nenhum suplemento na dieta publicada."; "Nenhuma medicação ou ergogênico na dieta publicada."; "Mais N opção(ões) para o aluno escolher."; "Total do dia (opção A)"; "Água: X L por dia"; "O treino publicado não tem divisões."; "Sem exercícios."; "Sem refeições."; "Sem itens." | Apoio fixo à direita (a partir de 952 de área) ou empilhado |
| Revisão (D), "O que mudou" | "O que mudou" com "desde a atualização de DD/MM"; "Primeira atualização deste aluno."; "Nenhuma resposta comparável mudou desde a atualização anterior."; "Comparando com a atualização anterior…"; "Dias com treino registrado"; rótulo "Variação (kg)" no resumo; fotos vazias = "Não respondeu"; abas Respostas \| Evolução | Resumo e principal |
| Liberação agendada (E-app), publicar | Escolha "Quando o aluno vê": "Liberar agora" / "Agendar para uma data"; campo "Liberar em"; faixa "A partir de amanhã (dd/mm/aaaa) até dd/mm/aaaa. Até lá, o aluno continua com o que já via."; caixa "Avisar o aluno" (agora) ou "Avisar o aluno quando liberar" (agendado), ajuda "O aviso só diz que há um plano novo."; botões "Publicar agora" / "Publicar e agendar"; "Agendado para dd/mm. Publicar de novo substitui esse agendamento." | Folha de publicar (plano e "Publicar tudo") |
| Liberação agendada (E-app), depois | Selo "Agendado para dd/mm"; painel "Alterar data de liberação" (campo "Liberar em", "Salvar data", "Até a nova data, o aluno continua com o que já via."); painel "Liberar agora?" (botão "Liberar agora", "A liberação marcada para dd/mm é antecipada e o aluno passa a ver esta versão já." e a caixa "Avisar o aluno"); avisos "Publicado vN. O aluno já vê esta versão." e "Publicado vN, agendado para dd/mm. Até lá, o aluno continua com o que já via." | Cartão do plano, pasta e aviso de sucesso |
| Liberação agendada (E-app), erros | "Informe o dia em que o aluno passa a ver o plano."; "Data inválida."; "Escolha um dia a partir de amanhã (…) até …"; "Este plano não está mais agendado: já foi liberado ao aluno." | Campo de data e aviso |
| Aviso ao aluno (API) | Aviso no app e push "Plano liberado" / "Seu novo plano está disponível. Abra o app para ver." A tela do aluno que mostra o aviso **não entrou** neste lote (próximo lote) | Push e aviso interno |
| Galeria de modelos (P5) | Nomes e descrições dos 6 modelos vêm de `MODELOS_PDF` (Clássico, Minimalista, Marcante, Compacto, Elegante, Esportivo); cartão "Usar o modelo <Nome>[, em uso]. <descrição>" com selo "Em uso"; acima da grade "Em uso: <Nome> · personalizado (N alterações: …)", link "Personalizar este modelo" e o botão existente "Baixar PDF de exemplo"; faixa compacta "Para personalizar cores, texto, cabeçalho e tabelas, abra esta tela no computador, numa janela larga."; painel "Usar o modelo <Nome>?" com "Os PDFs de treino, dieta e demais documentos passam a sair neste modelo." (e "As personalizações do <atual> (…) deixam de valer." se houver) e botão "Usar este modelo"; avisos "Modelo <Nome> em uso nos PDFs." e "Recarregue a tela: outra pessoa alterou os documentos."; descrição "Escolha o modelo dos PDFs de treino, dieta e demais documentos da consultoria. As miniaturas usam a sua marca e dados de exemplo."; hub "Modelo dos PDFs de treino, dieta e demais documentos, com miniaturas de exemplo." | Documentos (PDF) |
| Dieta do aluno | **Nenhum texto novo.** O cabeçalho voltou à A12: nome da refeição como título e "Horário: 07:00" embaixo, em todas as larguras (a variante "07:00 · Café da manhã" foi retirada) | Cartão da refeição |
| Início do aluno | **Nenhum texto visível novo.** Só o nome da região de apoio lido pelo leitor de tela: "Pendências e água de hoje" | Região de apoio (web larga) |
| Histórico do aluno | Abas "Treinos", "Corpo", "Atualizações" (`?aba=`), sem texto novo além dos rótulos das abas | Topo do Histórico |
| Leitura das respostas | A média de dias de treino aparece uma vez, no topo da leitura ("Pelo app: média de N dias de treino por semana no período."), e só na tela do aluno; nas do treinador ela já está no cartão "Resumo do período" | Leitura da atualização |

Todos os relatórios de frente já chegaram. Editor de questionários (G), folha da pasta (F) e a UI do `ITENS_DO_PLANO` não começaram (escopo congelado).

## 3. Perguntas do questionário de atualização do Saraiva (lista do plano, sem gravar)

Fonte: `atualizacao-pasta-e-questionarios.md`, bloco C. O script `scripts/questionario/atualizacao-saraiva.mjs` (C2) ainda NÃO existe e
**nada foi gravado em produção**. Quando o C2 existir, a lista final (inclusive as perguntas que ficam como estão: notas 0 a
10, peso, fotos) é gerada pela simulação do próprio script e substitui esta tabela.

| # | Pergunta de hoje | Como fica |
| --- | --- | --- |
| 1 | Momento que mais ficou com fome | Múltipla escolha: Manhã, Tarde, Noite, Madrugada, "Não senti mais fome que o normal" |
| 2 | Algum alimento que enjoou ou gostaria de substituir? | Sim/Não; se Sim, lista dos alimentos da dieta (um item por nome), motivo opcional |
| 3 | Quantos dias por semana está conseguindo treinar? | Escolha única: "Todos os prescritos", "Faltei 1 dia", "Faltei 2 ou mais" (o app segue mostrando os treinos registrados no período) |
| 4 | Sentiu dores ou dificuldades? Em quais exercícios? | Sim/Não; se Sim, lista dos exercícios do treino, motivo opcional "Onde e como doeu?" |
| 5 | Precisou fazer descanso no meio da semana? Qual dia? | Sim/Não; se Sim, múltipla escolha seg a dom |
| 6 | Qual dia foi mais desgastante? | Escolha de um dia treinado no período (data + sessão), com motivo; o treinador marca se o motivo é obrigatório ou opcional (decisão a confirmar) |
| 7 | Teve algum exercício que substituiu por não ter o maquinário? Quais? | Sim/Não; se Sim, lista dos exercícios, motivo "O que usou no lugar?" e foto opcional do aparelho (até 2) |
| 8 | Seu músculo recuperou até a próxima sessão? | Sim/Não; se Não, "Em quais treinos você ainda estava dolorido?" (vários dias treinados), motivo opcional |

Perguntas em aberto para o Gustavo ao aprovar: (a) o motivo da pergunta 6 é obrigatório ou opcional; (b) confirmar os rótulos
dos itens acima antes de gravar.


## 3b. Lista final gerada pela simulação do script (C2, `scripts/questionario/atualizacao-saraiva.mjs`)

Nada foi gravado em produção. Padrão = simular; só `--gravar` salva, valida e publica. Hoje são 26 perguntas; saem 8, entram 14, ficam 18 (notas, peso, fotos e o resto intactos): 32 no total. Todas as novas têm `obrigatoria: false`.
Os rótulos das perguntas de acompanhamento são escolha do agente (o plano não os define): **confirmar**.

- Alimentar: "Momento que mais ficou com fome" (múltipla: Manhã, Tarde, Noite, Madrugada, Não senti mais fome que o normal); "Algum alimento que enjoou ou gostaria de substituir?" (Sim/Não) e, se Sim, "Quais alimentos você quer substituir?" (alimentos da dieta, até 10, motivo opcional).
- Treino: "Quantos dias por semana está conseguindo treinar?" (Todos os prescritos, Faltei 1 dia, Faltei 2 ou mais); "Sentiu dores ou dificuldades?" (Sim/Não) e, se Sim, "Em quais exercícios?" (exercícios do treino, até 10, motivo opcional "Onde e como doeu?"); "Precisou fazer descanso no meio da semana?" (Sim/Não) e, se Sim, "Qual dia?" (segunda a domingo).
- Feedbacks: "Qual dia foi mais desgastante?" (dias treinados, escolha única, motivo OBRIGATÓRIO por padrão); "Teve algum exercício que substituiu por não ter o maquinário?" (Sim/Não) e, se Sim, "Quais exercícios você substituiu?" (exercícios, até 10, motivo opcional "O que usou no lugar?") e "Foto do aparelho que você usou" (até 2); "Seu músculo recuperou até a próxima sessão?" (Sim/Não) e, se Não, "Em quais treinos você ainda estava dolorido?" (dias treinados, até 10, motivo opcional).

Decisões do agente: ids novos para cada pergunta (a API recusa publicar id que muda de tipo; respostas antigas seguem legíveis pela versão em que foram dadas); `max` 10 (1 no dia desgastante) para caber na capacidade de texto (32.800 de 40.000).

**Conflito devolvido ao Gustavo:** o plano manda manter a média de dias de treino que o app mostra embaixo de "Quantos dias por semana...". Essa média é o campo `ajudaAutomatica: MEDIA_DIAS_TREINO`, que a API só aceita em TEXTO e NUMERO; em ESCOLHA_UNICA seria recusado, então o script a retirou e a média deixa de aparecer nessa pergunta. Para mantê-la é preciso mudar o `ValidadorQuestionario` e o espelho `dominio/questionario.ts` (contrato de API) ou mostrar a média por outro caminho. **Decisão pendente.**

## Aprovação
- [ ] Textos da seção 1 e os da seção 2 quando entregues
- [ ] Perguntas da seção 3 e a lista final da seção 3b (rótulos de acompanhamento; motivo da pergunta 6; média de dias de treino)
