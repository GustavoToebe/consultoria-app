# Auditoria de UI/UX, lote 1

Situação: Em andamento · Onde: PR A mesclado (#54, squash `3d65e04b`); PR B na branch `auditoria-ui-ux-lote-1-b` · Atualizado: 03/11/2026

## Objetivo
Aplicar o lote 1 da auditoria de UI/UX de 03/11 (relatório em [auditoria-ui-ux-2026-11-03.md](auditoria-ui-ux-2026-11-03.md)).
O escopo foi definido pelo Gustavo em 03/11 e só mexe no app; nada muda na API.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo do lote 1 | Os passos 1 a 6 da mensagem do Gustavo de 03/11, copiados abaixo. A primeira versão deste plano tinha lido "itens 1 a 6" como os seis quick wins da E.2; estava errado e foi corrigida. | Gustavo |
| D2 | Já resolvidos na `main` | Não entram no lote. No relatório estão marcados "Resolvido depois da auditoria": ordem dos campos no Cluster (Frente G, D12; o lote só confirma com o e2e `exercicio-aluno`) e "Hoje" desabilitado na Agenda (saiu com a agenda no estilo Google). | Gustavo |
| D3 | Divisão em dois PRs | PR A = a a e, mais j a l. PR B = f, g, h e i, numa branch própria saída da `main`, depois do PR A, porque os textos do i e o C4 do e mexem nas mesmas telas de estado. | Claude, pela regra do Gustavo para lote grande |
| D4 | Arquivos compartilhados com o item 3 (`supervisao-da-equipe`) | Este lote é dono do `FormAluno` e do `AcoesEmLote`. O item 3 trata o 409 novo por `dominio/erroDoPlano.ts`/`ui/useAvisoDoPlano` e não mexe nesses dois. | Claude |
| D5 | Metodologias | Continuam dentro da aba Treino do Planejamento, sem aba própria. | Gustavo, 03/11 |
| D6 | "Quero ser aluno" | Continua numa página só. Reavaliar depois do teste com 5 alunos, olhando os Indicadores de Interessados. | Gustavo, 03/11 |
| D7 | Saídas de dentro da ficha em edição (revisão do PR A, 1.1) | Entram no item b (C7), no PR B: todo botão que navega de dentro da ficha com o formulário aberto passa pela guarda (`useSaidaGuardada().confirmar`): Revisar atualização (resumo e pastas), editar plano, Publicar tudo, recordes e qualquer outro achado. e2e: editar o nome na ficha, tocar em "Revisar" e ver o "Sair sem salvar?". | Gustavo, 03/11 |
| D8 | "Cancelar" da edição na ficha (revisão do PR A, 1.2) | Pergunta só se algum campo mudou, igual ao aluno novo; sem alteração, cancela direto. No PR B. | Gustavo, 03/11 |
| D9 | C10 (passeio guardado no servidor) | Não agora. Sem código. | Gustavo, 03/11 |
| D10 | Chave do retorno (`TREINOS_RETORNO_HABILITADO`) | Ligada na produção em 03/11 às 12:39 (antes ausente, valia `false`); health `UP` depois. Falta conferir na tela com um aluno fictício. Registro em `engajamento.md`. | Gustavo, 03/11 |
| D11 | Menu do tablet | De 768 a 1024 px, um rótulo curto embaixo de cada ícone, como na barra inferior, sem mudar o PC nem o celular; e2e em 900 px. Vai na frente 6 (`auditoria-ficha`), depois do merge do PR B. | Gustavo, 03/11 |
| D12 | Ícones dos blocos do Início e lápis da linha de alunos | Ficam, só com o alvo de 44 px. | Gustavo, 03/11 |

### Escopo em código (passo 4 da mensagem)
- **a.** "Concluir treino" com a chave do retorno desligada vira "Voltar à lista do dia", botão secundário (`[exercicio].tsx`).
  - Com a chave ligada, nada muda.
  - Aceite: com a chave desligada, o último botão da tela diz "Voltar à lista do dia" e não é primário.
- **b.** C7: `useGuardaDeSaida` no `FormAluno`, no aluno novo e na edição pela ficha.
  - O passo 3 de `telas-do-aluno-visual.md` ganha a nota de que a guarda foi feita aqui.
  - Aceite: sair com alteração não salva abre o painel de confirmação; sem alteração, sai direto.
- **c.** C1: a trilha do `Cabecalho` perde o papel de título.
  - Aceite: cada tela tem um h1 só.
- **d.** C2: `IconeBotao` com moldura e o compacto ocupam 44×44 de verdade na web, com o mesmo desenho (a moldura de 40 fica centralizada).
  - Se couber, o filtro Todos/Meus dos blocos do Início ganha um rótulo acessível mais claro.
  - Aceite: a área de toque mede 44×44 no editor, na ficha, na linha de alunos e nos blocos do Início, sem mudar o desenho.
- **e.** C4: separar "sem permissão" de "módulo desligado" (por exemplo, Financeiro com os pagamentos desligados), cada estado com o seu h1.
  - Aceite: cada estado tem texto próprio e um h1.
- **f.** (PR B) C6: o erro aparece junto do campo nas telas públicas, copiando o padrão da inscrição. São elas: entrar, convite, convite de equipe, esqueci a senha e redefinir senha.
  - O alerta do topo fica só para erro do servidor.
- **g.** (PR B) C5: as Abas cortadas no celular ganham o mesmo degradê das faixas de chips, e a aba ativa é rolada para a vista.
- **h.** (PR B) C9: a rosca do Início com 12 px.
- **i.** (PR B) Textos:
  - "Ver meu treino" na sessão inexistente;
  - "Importar da sua planilha" e "Copiar do catálogo pronto" na Biblioteca;
  - "Minha conta" vira "Assinatura e faturas" (`dominio/telas.ts`, busca, Ajuda e guias);
  - "Pedir um link novo" no redefinir sem token;
  - texto único na inscrição inválida;
  - "Voltar à lista" nos endereços inválidos;
  - "Seu envio" na atualização do aluno;
  - sai "central de contratação" de Minha conta.
  - O "Treinar mesmo assim" fica só no j.
- **j.** Início do aluno, no dia de descanso: embaixo de "Hoje é dia de descanso." entram a linha "Próximo treino: <dia> · <nome da divisão>" e o link secundário "Treinar mesmo assim", que abre `/aluno/treino`.
  - O próximo treino é a próxima sessão com dia fixo, pela mesma regra de semana que o cartão já usa.
  - Plano sem dia fixo não mostra a linha.
  - A regra fica em `dominio/inicioDoAluno.ts`, com teste jest.
  - Aceite: o jest cobre o próximo dia na mesma semana, a virada da semana e o plano sem dia fixo. O e2e, em 390 e 1280 px, mostra a linha e confere que o link abre `/aluno/treino`.
- **k.** Sessão do aluno (`/aluno/sessao/[uid]`): "Começar treino" logo abaixo do cartão HOJE, e "Outras datas" desce para depois dele, sem outra mudança.
  - Aceite: em 390×844, "Começar treino" aparece sem rolar. O e2e confere em 390 e 1280 px.
- **l.** Primeiros passos do Início do treinador: "Abrir Metodologias" abre o Planejamento já com o chip Metodologias selecionado.
  - Aceite: o toque leva a `/treinador/planejamento?tipo=…` com o chip ativo.
  - A pendência do README sobre isso é riscada com o commit.

### Decisões pendentes (passo 3 da mensagem: contrariam decisões já tomadas, não entram como correção)
- **Folha da pasta**: "Finalizar" como primário, treinos no topo e "Renovar" em destaque perto do fim. A pergunta foi mandada ao Saraiva e ainda não tem resposta; não mexer até a resposta.
- **Ícones dos blocos do Início**: ficam. Só ganham os 44 px do d e, se couber, um rótulo acessível mais claro no filtro.
- **Lápis da linha de alunos**: fica. Só ganha os 44 px do d.
- Decididas em 03/11 (antes estavam aqui como "para o Gustavo decidir depois"):
  - menu do tablet com rótulos: D11, na frente 6;
  - inscrição em duas partes: não agora (D6), reavaliar depois do teste com 5 alunos pelos Indicadores de Interessados;
  - C10 (passeio guardado no servidor): não agora (D9).

## Passos
- [x] 1. Guardar o relatório em `docs/planos/auditoria-ui-ux-2026-11-03.md`, com a nota do commit auditado e a marca nos dois achados já resolvidos — commit: `e572dbe8`
- [x] 2. PR A: a a e e j a l, com e2e em 390 e 1280 px (inclui o `exercicio-aluno`) — commit: `ebd3ac9d`
- [x] 2b. PR A mesclado na `main` (#54, squash `3d65e04b`)
- [x] 3. PR B: f, g, h e i, mais D7 e D8, na branch `auditoria-ui-ux-lote-1-b` saída da `main` em `3d65e04b` — commit: `60074116`

## Fora do escopo
- O lote 2 virou as frentes paralelas de 03/11 (aluno, peças, treinador e, depois do merge do PR B, `auditoria-ficha`), cada uma com plano próprio em `docs/planos/`. C3 ficou com a frente 4 (`auditoria-pecas`); C8 (paginação da Biblioteca) e os cinco erros engolidos, com a frente 5 (treinador).
- Achados novos da 2ª passada (Gustavo, 03/11): N26 e N27 entraram na frente 5 (o N27 passou para a frente 3 por patch, porque mexe em `dominio/atualizacaoQuestionario.ts`); N30 ("Hoje já está na tela" da Agenda) já estava resolvido na `main`; N28, na frente 3; N29 vai para a frente 6 com o D11; N24/N25 (cores) viram uma frente própria depois do merge da frente 4. Os dois últimos e as verificações manuais estão em "Pendências soltas" do README.
- C10 fica de fora (D9).
- O resto do relatório.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
- PR A (`ebd3ac9d`): o `IconeBotao` com moldura ficou 4 px maior por fora (alvo de 44) em todas as telas; conferido só na web (e2e), falta olhar no Android e no iOS, e o `IconeBotao` com moldura no tema escuro não teve captura.
- Opcionais da revisão independente do PR A: 1.1 e 1.2 entram no PR B (D7, D8); 1.3 a 1.5 ficam em "Pendências soltas" do README.
- PR B: "Seu envio" na atualização do aluno ficou de fora: o texto vem do seed da V001 na API (questionário padrão), não do app; trocar pede migration nova.
- PR B, e2e completo (03/11): 673 passaram, 8 pulados e 1 falha intermitente em `links-do-menu.spec.ts:36` (o `expect.poll` não viu a guia nova do Ctrl+clique em 10 s, com a máquina carregada por outras frentes); o spec sozinho pela trava, `--repeat-each=3`, passou 6 de 6. O PR B não mexe nesse caminho (o `LinkTexto` deixa o Ctrl+clique para o navegador).
- PR B: a guarda de saída agora vale em todo `ItemDeLista`/`LinhaDaLista`/`LinkTexto` que abre tela (D7). No celular, "Criar e abrir" e "Replicar e abrir" marcavam a pergunta dentro da Folha que estava fechando: a Folha marca o fechamento e o diálogo vai para a de baixo, ou para a raiz. Coberto por teste jest (`Platform.OS` `android`); ainda precisa ser conferido no APK. Falta olhar no celular o `history.go(-1)` com uma Folha aberta e o tema escuro das telas públicas com erro no campo.
- PR B, conferências que já existiam na `main`: aluno sem responsável no `FormAluno` passa a ser de quem editou ao salvar sem mexer; a inscrição (foco no primeiro erro e erro da `Escolha`) não coube no padrão das telas públicas. As duas estão em "Pendências soltas". O assistente da importação pergunta depois de escolher um destino entre vários; a lista do histórico não pergunta sem nada pendente.
