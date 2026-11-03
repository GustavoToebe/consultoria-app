# Auditoria de UI/UX: frente Aluno

Situação: Código e testes prontos na branch; aguardando revisão e PR · Onde: branch `auditoria-aluno` (saída da `main` `3d65e04b`) · Atualizado: 03/11/2026

## Objetivo
Corrigir no app do aluno os achados da 2ª passada da auditoria de UI/UX (N3, N4, N6 a N10, N16) e os itens do aluno da
1ª passada (C.1 e A.4), sem tocar em `app/src/ui`, no PR B nem na API. Relatórios:
[auditoria-ui-ux-2026-11-03.md](auditoria-ui-ux-2026-11-03.md) (1ª passada) e a 2ª passada (com dados lançados, 03/11),
cujos achados N1 a N23 usam os mesmos IDs. Esta é a frente 3 de 5 em paralelo (porta do e2e 8102; nome na trava: `aluno`).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo de arquivos | Só `app/src/aluno`, `app/src/app/aluno` e o `dominio/` deles (com teste jest). Fora: `app/src/ui` (frente 4), os arquivos do PR B (entre eles `app/aluno/sessao/[uid]/index.tsx` e `[exercicio].tsx`, `ajuda/conteudo.ts`, `dominio/telas.ts`) e a API. Quem precisa de arquivo de outra frente fica "espera o merge de …". | Sessão principal, 03/11 |
| D2 | Contratos de props que o PR B usa | Não mudar as props de `ExercicioAluno` e `ConcluirTreino` (o `[exercicio].tsx` e o `sessao/[uid]/index.tsx` do PR B as chamam). Mudança de comportamento sim, de assinatura não. | Claude |
| D3 | N6: série sem kg ou sem reps | Série marcada sem kg ou sem reps conta no progresso só em exercício sem carga. Em exercício com carga, aviso junto da série ao marcar com o campo vazio: "Sem carga registrada: esta série não entra no progresso." Regra pura em `dominio/`, com jest. | Gustavo, 03/11 |
| D4 | Texto de Ajuda e guias | Fica para depois do merge do PR B (`ajuda/conteudo.ts` e os PDFs são dele). Onde a Ajuda cita "✓" ou o cartão HOJE, vira pendência solta. | Sessão principal, 03/11 |
| D5 | N19 (selo "1 AGUARDANDO ENVIO" da mobilidade) | Era Hipótese e não foi conferida; não entra como correção. Vai para as pendências soltas. | Claude |
| D6 | N6, leitura de "progresso" | O aviso só aparece com o kg vazio num exercício com carga. Com reps vazias e kg preenchido, sem aviso: a série entra no progresso (a API olha a carga). O contador "N de M séries" e a API não mudam. | Gustavo, 03/11 (interpretação confirmada; reconfirmado pelo Gustavo em 03/11) |
| D7 | Arquivos de `app/src/ui` que ficam com esta frente | `ui/Passeio.tsx` (o véu também: a frente Peças não mexe nele) e, se a frente Treinador não os pedir, `ui/SeletorDeNota.tsx` e `ui/EscalaDeNota.tsx`. `ui/Estados` só importado, sem edição. Também `treinador/CartaoProgresso.tsx` e `dominio/relatorio.ts` (N4; a frente Treinador não os toca). Exceção ao D1. | Gustavo, 03/11 (N4: sessão principal, 03/11) |
| D8 | "Sem conexão" | Só depois de 2 a 3 s sem rede (2,5 s), no componente do N28 (`aluno/SeloSincronizacao.tsx`); se exigir o AlunoProvider, vira pendência solta. Fica de fora do atraso o "Sem conexão" com envio pendente (já tem o que dizer) e a Conta. **Sem confirmação do Gustavo:** a regra de que o atraso vale só para o "Sem conexão" sem nada pendente (pendente, falha e a Conta aparecem na hora) é interpretação nossa; o Gustavo decidiu apenas "Sem conexão só depois de 2 a 3 s". | Gustavo, 03/11 (a exceção do pendente: Claude, a confirmar) |
| D9 | "Próximo treino" no dia de descanso | Respeita o fim da pasta: `proximoTreino(conteudo, hoje, fim)` em `dominio/inicioDoAluno.ts` (fim inclusivo; depois dele, sem linha). Antes, no último dia a linha apontava para a segunda-feira depois do fim. | Claude, 03/11 (pendência do Gustavo) |

## Passos
Cada passo é um item; o executor de cada um é o `executor` (Sonnet), salvo o que mexe só em texto. Aceite entre parênteses.
Código e testes prontos na branch; falta o item que espera o PR B (se `LinhaDaLista` não for usada, ver "O que ficou para trás").

- [x] N3. Cartão HOJE do início depois do treino concluído (Fiz tudo ou Fiz em parte); a ação vira "Ver resumo" (abre o "Bom trabalho!" do dia). Aceite: concluído o treino do dia, o cartão diz que foi concluído com o resultado e o botão é "Ver resumo"; com o retorno desligado nada muda. — feito na branch `auditoria-aluno`
- [x] N4. Histórico: com registros que não entram no progresso, o texto diz o motivo: "Nenhuma série completa, com carga e repetições, neste período". Aceite: o "Progresso por exercício" não diz "Nenhum registro neste período" quando há registro. Mexe em `treinador/CartaoProgresso.tsx` e `dominio/relatorio.ts` (D7). — feito na branch `auditoria-aluno`
- [x] N6. Regra do D3 lida pelo D6. Aceite: exercício com carga, série marcada com o kg vazio mostra o aviso junto da série; reps vazias com kg preenchido, sem aviso; exercício sem carga, sem aviso; contador e API iguais; jest da regra. — feito na branch `auditoria-aluno`
- [x] Rótulos "Vídeo" e "Descanso" visíveis nos dois botões de ícone do cabeçalho do exercício. Aceite: texto visível em 390 px. — feito na branch `auditoria-aluno`
- [x] "Não fiz" com borda (secundário), alvo de 44 px ou mais. — feito na branch `auditoria-aluno`
- [x] Selo "Ainda não registrado" some; só a série registrada tem selo ("Feita" / "Não feita"). Aceite: série sem registro não tem selo. — feito na branch `auditoria-aluno`
- [x] N7. Carga ou repetição inválida mostra texto visível junto do campo ("Use só números"). Aceite: o motivo está na tela, não só no `aria-label`. — feito na branch `auditoria-aluno`
- [x] N8. Avisos "Novo compromisso" agrupados num item ("4 compromissos novos"); remarcado e cancelado seguem separados; o contador de pendências conta o grupo como 1. Aceite: 4 novos viram 1 item e a contagem cai de acordo; tocar marca todos como vistos. — feito na branch `auditoria-aluno`
- [x] N9. No "Bom trabalho!", o aviso "Treino concluído." não cobre o cartão (some, porque a tela já diz). Aceite: depois de concluir não há aviso sobreposto. — feito na branch `auditoria-aluno`
- [x] N10. Todo rótulo de pergunta da atualização com a mesma cor e o mesmo peso. Aceite: rótulos de nota, fotos, grupo e escolha iguais ao de "Peso (em jejum)". `ui/SeletorDeNota.tsx` e `ui/EscalaDeNota.tsx` (rótulo suave) ficam com esta frente pelo D7. — feito na branch `auditoria-aluno`
- [x] N16. O contador da anamnese não conta resposta inválida. Aceite: data de nascimento inválida não entra em "N de M respondidas". — feito na branch `auditoria-aluno`
- [ ] Histórico: linha inteira tocável (sem link sublinhado dentro de cartão). **Espera o merge do PR B** (`LinhaDaLista`). — commit/run: —
- [x] Conta: um e-mail principal (o de acesso) e, se o do cadastro for diferente, a nota "Seu treinador usa outro e-mail no seu cadastro." Aceite: a tela mostra um único e-mail como principal. — feito na branch `auditoria-aluno`
- [x] Treino e Mobilidade: estado de carregamento e de erro quando o pacote ainda não chegou. Aceite: a tela não fica em branco. — feito na branch `auditoria-aluno`
- [x] "Ver vídeo" da Mobilidade abre o link como a Dieta (`abrirLinkExterno`). — feito na branch `auditoria-aluno`
- [x] "✓" dentro de texto vira "feito" na execução do aluno (a Ajuda espera o PR B). — feito na branch `auditoria-aluno`
- [x] Passeio sem cobrir o selo de sincronização (`ui/Passeio.tsx`, D7). — feito na branch `auditoria-aluno`
- [x] N28. Selo de sincronização do rodapé só aparece com algo a dizer (pendente, enviando, sem conexão ou falha); com tudo enviado o "Sincronizado" some do rodapé. A Conta (cartão Sincronização) segue com o estado completo. Aceite: fila vazia, rodapé sem selo; um registro pendente, selo; falha, selo. `aluno/SeloSincronizacao.tsx` e `app/aluno/_layout.tsx`. Decisão: Gustavo, 03/11. — feito na branch `auditoria-aluno`
- [x] N28, atraso do "Sem conexão" (D8): temporizador de 2,5 s dentro de `SeloSincronizacao.tsx` (`ATRASO_SEM_CONEXAO_MS`), jest com timers falsos em `SeloSincronizacao.test.tsx`. Aceite: sem rede por menos de 2,5 s, nada; depois, aparece; a rede volta antes, nada; pendente e falha, na hora. — feito na branch `auditoria-aluno`
- [x] N27 (vindo da frente 5): nota com a escala no `textoDaNota`/`textoDaResposta` e `diasComTreino` no `resumoDoTreinador` (`dominio/atualizacaoQuestionario.ts`, teste dele e `e2e/anamnese.spec.ts`: "7/10", ou "7 de 0 a 10" quando a escala começa em 0). — feito na branch `auditoria-aluno`
- [x] "Próximo treino" no dia de descanso respeita o fim da pasta (D9; teste em `dominio/inicioDoAluno.test.ts`).
- [x] e2e novo `app/e2e/auditoria-aluno.spec.ts` (390 e 1280 px, porta 8102, pela trava) e ajuste dos e2e e testes existentes que conferem os textos que mudam. — feito na branch `auditoria-aluno`

## Limites e pendências soltas
- N6 no cartão por etapas (Cluster, Rest-pause): o aviso de série sem carga só vale no cartão comum; as etapas não têm esse aviso.
- N28 oculta só o "Sincronizado"; "Sem conexão" continua no rodapé, mas só aparece depois de 2,5 s sem rede (Gustavo, 03/11). O atraso vale para o "Sem conexão" sem nada pendente; pendente e falha aparecem na hora.
- Histórico com linha tocável: espera o merge do PR B (`LinhaDaLista`).
- N19, remover foto com 28 px e os textos da Ajuda: seguem como pendência solta.

## Fora do escopo
- `app/src/ui` inteiro (frente 4) e os arquivos do PR B; a API e migrations.
- N19 (mobilidade "aguardando envio"): Hipótese não conferida; pendência solta.
- Botão de remover foto com 28 px (`CampoFotos.tsx`, E.6 da 1ª passada): Hipótese que depende de ver o aluno com foto; pendência solta.
- Texto de Ajuda e guias (PR B).
- Cartão "Próximo treino" no início em dia de descanso: já existe na `main`; só o limite do fim da pasta entra aqui (D9).

## O que ficou para trás
- (preencher ao fim; cada sobra também vai para "Pendências soltas" no README)
