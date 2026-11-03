# Auditoria de UI/UX, lote 1

Situação: Em andamento · Onde: branch `auditoria-ui-ux-lote-1` (PR A); f a i num PR B, depois · Atualizado: 03/11/2026

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
- Para o Gustavo decidir depois:
  - menu do tablet com rótulos;
  - inscrição em duas partes;
  - C10 (passeio guardado no servidor).

## Passos
- [x] 1. Guardar o relatório em `docs/planos/auditoria-ui-ux-2026-11-03.md`, com a nota do commit auditado e a marca nos dois achados já resolvidos — commit: `e572dbe8`
- [x] 2. PR A: a a e e j a l, com e2e em 390 e 1280 px (inclui o `exercicio-aluno`) — commit: `ebd3ac9d`
- [ ] 3. PR B: f, g, h e i, branch própria saída da `main`, depois do PR A — commit: —

## Fora do escopo
- Lote 2 (só no plano, depois):
  - C3 (foco da Folha);
  - C8 (paginação na Biblioteca e em Atualizações);
  - os erros engolidos.
- C10 fica de fora.
- O resto do relatório.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
- PR A (`ebd3ac9d`): o `IconeBotao` com moldura ficou 4 px maior por fora (alvo de 44) em todas as telas; conferido só na web (e2e), falta olhar no Android e no iOS, e o `IconeBotao` com moldura no tema escuro não teve captura.
- Opcionais da revisão independente do PR A (1.1 a 1.5): em "Pendências soltas" do README; nenhum bloqueava.
