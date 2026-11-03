# Auditoria de UI/UX: frente Aluno

Situação: Planejando (só o plano; sem código) · Onde: branch `auditoria-aluno` (saída da `main` `3d65e04b`) · Atualizado: 03/11/2026

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
| D6 | N6, leitura de "progresso" | O aviso só aparece com o kg vazio num exercício com carga. Com reps vazias e kg preenchido, sem aviso: a série entra no progresso (a API olha a carga). O contador "N de M séries" e a API não mudam. | Gustavo, 03/11 (interpretação confirmada) |
| D7 | Arquivos de `app/src/ui` que ficam com esta frente | `ui/Passeio.tsx` (o véu também: a frente Peças não mexe nele) e, se a frente Treinador não os pedir, `ui/SeletorDeNota.tsx` e `ui/EscalaDeNota.tsx`. `ui/Estados` só importado, sem edição. Também `treinador/CartaoProgresso.tsx` e `dominio/relatorio.ts` (N4; a frente Treinador não os toca). Exceção ao D1. | Gustavo, 03/11 (N4: sessão principal, 03/11) |

## Passos
Cada passo é um item; o executor de cada um é o `executor` (Sonnet), salvo o que mexe só em texto. Aceite entre parênteses.
Nada foi feito ainda.

- [ ] N3. Cartão HOJE do início depois do treino concluído (Fiz tudo ou Fiz em parte); a ação vira "Ver resumo" (abre o "Bom trabalho!" do dia). Aceite: concluído o treino do dia, o cartão diz que foi concluído com o resultado e o botão é "Ver resumo"; com o retorno desligado nada muda. — commit/run: —
- [ ] N4. Histórico: com registros que não entram no progresso, o texto diz o motivo: "Nenhuma série completa, com carga e repetições, neste período". Aceite: o "Progresso por exercício" não diz "Nenhum registro neste período" quando há registro. Mexe em `treinador/CartaoProgresso.tsx` e `dominio/relatorio.ts` (D7). — commit/run: —
- [ ] N6. Regra do D3 lida pelo D6. Aceite: exercício com carga, série marcada com o kg vazio mostra o aviso junto da série; reps vazias com kg preenchido, sem aviso; exercício sem carga, sem aviso; contador e API iguais; jest da regra. — commit/run: —
- [ ] Rótulos "Vídeo" e "Descanso" visíveis nos dois botões de ícone do cabeçalho do exercício. Aceite: texto visível em 390 px. — commit/run: —
- [ ] "Não fiz" com borda (secundário), alvo de 44 px ou mais. — commit/run: —
- [ ] Selo "Ainda não registrado" some; só a série registrada tem selo ("Feita" / "Não feita"). Aceite: série sem registro não tem selo. — commit/run: —
- [ ] N7. Carga ou repetição inválida mostra texto visível junto do campo ("Use só números"). Aceite: o motivo está na tela, não só no `aria-label`. — commit/run: —
- [ ] N8. Avisos "Novo compromisso" agrupados num item ("4 compromissos novos"); remarcado e cancelado seguem separados; o contador de pendências conta o grupo como 1. Aceite: 4 novos viram 1 item e a contagem cai de acordo; tocar marca todos como vistos. — commit/run: —
- [ ] N9. No "Bom trabalho!", o aviso "Treino concluído." não cobre o cartão (some, porque a tela já diz). Aceite: depois de concluir não há aviso sobreposto. — commit/run: —
- [ ] N10. Todo rótulo de pergunta da atualização com a mesma cor e o mesmo peso. Aceite: rótulos de nota, fotos, grupo e escolha iguais ao de "Peso (em jejum)". `ui/SeletorDeNota.tsx` e `ui/EscalaDeNota.tsx` (rótulo suave) ficam com esta frente pelo D7. — commit/run: —
- [ ] N16. O contador da anamnese não conta resposta inválida. Aceite: data de nascimento inválida não entra em "N de M respondidas". — commit/run: —
- [ ] Histórico: linha inteira tocável (sem link sublinhado dentro de cartão). **Espera o merge do PR B** (`LinhaDaLista`). — commit/run: —
- [ ] Conta: um e-mail principal (o de acesso) e, se o do cadastro for diferente, a nota "Seu treinador usa outro e-mail no seu cadastro." Aceite: a tela mostra um único e-mail como principal. — commit/run: —
- [ ] Treino e Mobilidade: estado de carregamento e de erro quando o pacote ainda não chegou. Aceite: a tela não fica em branco. — commit/run: —
- [ ] "Ver vídeo" da Mobilidade abre o link como a Dieta (`abrirLinkExterno`). — commit/run: —
- [ ] "✓" dentro de texto vira "feito" na execução do aluno (a Ajuda espera o PR B). — commit/run: —
- [ ] Passeio sem cobrir o selo de sincronização (`ui/Passeio.tsx`, D7). — commit/run: —
- [ ] e2e novo `app/e2e/auditoria-aluno.spec.ts` (390 e 1280 px, porta 8102, pela trava) e ajuste dos e2e e testes existentes que conferem os textos que mudam. — commit/run: —

## Fora do escopo
- `app/src/ui` inteiro (frente 4) e os arquivos do PR B; a API e migrations.
- N19 (mobilidade "aguardando envio"): Hipótese não conferida; pendência solta.
- Botão de remover foto com 28 px (`CampoFotos.tsx`, E.6 da 1ª passada): Hipótese que depende de ver o aluno com foto; pendência solta.
- Texto de Ajuda e guias (PR B).
- Cartão "Próximo treino" no início em dia de descanso: já existe na `main`; nada a fazer.

## O que ficou para trás
- (preencher ao fim; cada sobra também vai para "Pendências soltas" no README)
