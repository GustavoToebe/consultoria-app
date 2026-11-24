# Agenda: Criar no lugar certo, barra única e uma janela de criação

Situação: Entregue (commit `fa9f0f53`, só local; sem push) · Onde: main · Atualizado: 23/11/2026

## Objetivo
Pedido do Gustavo (23/11): na Agenda do treinador, o "Criar" vai para o topo da coluna da esquerda com o menu dos dois
tipos; uma barra só acima da grade (Hoje, ‹ ›, período; Filtros e a visão em segmento); a dica da semana vazia dentro da
grade; e uma janela de criação única para compromisso com aluno e evento pessoal. Só `app/`, sem mudança de API nem de
regra (limites, permissões, repetição e avisos continuam os de hoje).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Permissão do Criar | Compromisso e evento pedem a mesma `AGENDA_ALTERAR` (os dois POST da API): o menu sempre tem os dois; o "abre direto quando só há um" não acontece hoje e não foi construído | Claude (lido na API) |
| 2 | Lugar do Criar | Topo da coluna da esquerda (PC com a lateral, conteúdo ≥ 960 px), na largura da coluna, menu alinhado pela esquerda; sem a coluna (celular e PC estreito), no cabeçalho, como antes | Gustavo (pedido) + Claude |
| 3 | Barra única | `BarraDeFiltros` com `antes` (Hoje, setas, período em fonte normal) e `depois` (segmento Dia, Semana, Mês, Ano e o "Agendas" do celular); as etiquetas "Filtrando" ficam embaixo da linha. O menu "Semana ▾" (`MenuDaVisao`) saiu; os atalhos D/W/M/Y ficam | Gustavo (pedido) + Claude |
| 4 | Estado vazio | "Nada neste período." saiu da grade e da lista; a grade (Dia e Semana no PC) mostra no meio "Nenhum compromisso nesta semana/neste dia." e, só quando o clique cria (web + `AGENDA_ALTERAR`), "Clique num horário para criar."; a lista do celular já tem "Nada marcado" por dia; Mês e Ano mantêm a linha | Gustavo (pedido) + Claude |
| 5 | Clique no horário vazio | Já criava (web, grade, `AGENDA_ALTERAR`): agora abre a janela "Criar" no compromisso, com a data e o início do horário | Claude (comportamento de antes) |
| 6 | Janela de criação | `FolhaCriar`, título "Criar", segmento "Compromisso com aluno / Evento pessoal"; os dois formulários ficam montados (`useFormularioDoCompromisso`, `useFormularioDoEvento`, que a edição também usa); trocar leva data, horário, local e observação/descrição e avisa, sem bloquear, o que fica só no outro tipo (`trocarTipoDaCriacao`) | Gustavo (pedido) + Claude |
| 7 | Início e fim | O início vem na próxima meia hora de Brasília (meia hora em ponto fica; depois das 23:30 de hoje, 00:00 de amanhã), o fim com a duração padrão que já existia (`DURACAO_PADRAO` = 60 = 1 h); o fim mostra só a hora e a duração vai ao lado em texto suave ("1 h", "1 h, dia seguinte"); o "Escolha o início para ver o fim." saiu | Claude |
| 8 | Largura | Painel rápido na folha larga (`LARGURA_FOLHA_LARGA`, 800) para Data, Início – Fim e Dia inteiro caberem numa linha; "Mais opções" segue em `LARGURA_EDITOR` | Claude |
| 9 | Agenda do evento | Lista suspensa local (`EscolhaDaAgenda`): "Agenda: ● Pessoal", rádios com a bolinha; o nome da cor no nome acessível | Gustavo (pedido) + Claude |
| 10 | Sair sem salvar | `comunidade/useFecharComAviso` (o mesmo "Sair sem salvar?" do app), só com alteração; salvar fecha sem perguntar | Claude |
| 11 | Aviso de privacidade | Curto: "Só você vê. Evite nome de aluno e dado de saúde: isto não faz parte do cadastro do aluno." | Gustavo (pedido) |

## Passos
- [x] 1. Regras puras `dominio/agendaCriacao.ts` com teste (`agendaCriacao.test.ts`: início sugerido e virada do dia, fim que acompanha, fim antes do início, duração, troca de tipo e perdas, dica do vazio) — commit: —
- [x] 2. Hooks dos formulários, `FolhaCriar`, `EscolhaDaAgenda`, folhas de detalhe/edição enxutas, barra única, Criar e dica — commit: —
- [x] 3. e2e ajustados (`agenda-calendario`, `-composicao`, `-presencial`, `banco-vazio`, `filtros-laterais-fase-c`) e novo `agenda-criar-unificado.spec.ts` (1280 e 390); 23/11, working tree commit `fa9f0f53`: tsc limpo, lint com os 11 avisos antigos, jest 395 suítes, e2e da agenda + banco-vazio + filtros-laterais-fase-c 158/158 — commit: —
- [x] 3b. Retoques (23/11, commit `fa9f0f53`): título curto da semana ("19–25 out. 2026", "26 out.–1 nov. 2026") em `bloco` (16), numa linha em 1280 px; bloco estreito da Semana mostra só o início (`horarioNoBloco`, intervalo a partir de 96 px de bloco, medido); e2e da agenda 159/159 na 8193; capturas em `capturas/23-11/agenda/retoques/` — commit: —
- [ ] 4. Commit e push (sessão principal)

## Fora do escopo
- Agenda do aluno, API, regras de repetição, lembretes e limites.
- Texto da Ajuda (`ajuda/conteudo.ts` fala em "Criar › Evento") e a busca (`dominio/telas.ts`): não são desta frente.

## Capturas (23/11, fora do repositório, scratchpad da sessão)
42 imagens em 1920, 1280 e 390 px, escuro e claro: semana vazia, menu Criar, janela no compromisso, no evento e em "Mais opções",
semana com 3 compromissos e o "Sair sem salvar?". Não conferidos: claro areia, contraste alto, 768–959 px, app nativo e leitor de tela.

## O que ficou para trás
- `useFecharComAviso` mora em `comunidade/`; a Agenda o importa. Sugestão: mover para `ui/`.
- Comentários em `treinador/dieta/CampoDaQuantidade.tsx` e `ui/EscolhaSuspensa.tsx` citam o `MenuDaVisao`, que saiu.
