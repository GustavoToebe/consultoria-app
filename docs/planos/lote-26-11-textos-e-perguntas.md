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

## 2. Pendentes de relatório (completar quando entregarem)
- Início, Dieta, Histórico (aluno web): textos novos, se houver.
- Galeria de modelos do PDF (P5): títulos, descrições dos 6 modelos e os rótulos dos cartões.
- Revisão da atualização pelo treinador (D): todos os textos novos.
- E-app (liberação agendada, treinador): "Liberar agora", "Agendar para uma data", "Avisar o aluno", "Agendado para dd/mm", "Alterar data", "Liberar agora" (painel de confirmação) e mensagens de erro.
- Aviso ao aluno (texto do app): "Seu novo plano está disponível. Abra o app para ver." (aviso no app) e push "Plano liberado" / "Seu novo plano está disponível. Abra o app para ver."
- Editor de questionários (G), folha da pasta (F), espelho do `ITENS_DO_PLANO` no app (C-app): ainda não começaram.

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

## Aprovação
- [ ] Textos da seção 1 e os da seção 2 quando entregues
- [ ] Perguntas da seção 3 (e a lista final gerada pelo C2)
