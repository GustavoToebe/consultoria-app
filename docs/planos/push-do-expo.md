# Push do Expo para compromisso marcado, remarcado ou cancelado

Situação: Em andamento · Onde: branch `push-do-expo` (frente 6) · Atualizado: 03/11/2026

## Objetivo
O aluno que ligar "Avisar no celular quando um compromisso mudar" recebe uma notificação do celular quando um compromisso dele é marcado, remarcado ou cancelado, além do aviso que já existe dentro do app. A notificação nunca leva dado pessoal: só diz que algo mudou e pede para abrir o app. Tudo nasce DESLIGADO (`TREINOS_PUSH_HABILITADO=false`).

## Decisões
Tudo marcado "Claude" foi decidido pelo Claude em 03/11 e precisa ser conferido com o Gustavo.

| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Chave | `TREINOS_PUSH_HABILITADO` (padrão `false`). Desligada: rotas de token 503 `PUSH_INDISPONIVEL` (`@ExigePush`, molde do `@ExigeRetorno`), nada entra na fila nem é enviado, `GET /eu` traz `pushHabilitado=false` e o app não pede permissão nem registra token. `application-test.yml` liga | Gustavo |
| 2 | Quem recebe | SÓ os alunos do compromisso (mesma regra do aviso interno: `AgendaService.registrarAvisos`; o treinador não é avisado hoje e não recebe push). O aviso interno não tem "desligar"; o push só vai a quem registrou token (opt-in no aparelho) | Gustavo + Claude |
| 3 | Texto | Fixo: título e corpo "Seu compromisso mudou. Abra o app para ver." Sem nome, horário, local nem tipo. `data` = `{tipo:'compromisso'}`, sem id nenhum (o aviso interno já mostra o detalhe depois do login) | Gustavo |
| 4 | Token do aparelho (`ExponentPushToken[...]`) | Tabela própria `push_token` (`@TenantId`), até 5 por usuário (o 6º troca o mais antigo), único por (consultoria, usuário, token); o mesmo token registrado por outro usuário da consultoria sai do anterior. Nunca em log, auditoria, mensagem de erro nem `toString`. A exportação mostra só metadado (plataforma e data) | Gustavo + Claude |
| 5 | Fila | Tabela `push_envio` (`consultoria_id` explícito, SQL nativo em `PushRepositorio`, molde do `LembretesRepositorio`): PENDENTE/ENVIADO/FALHOU/CANCELADO, lease (`reservado_por`/`reserva_ate`, `for update skip locked`), 3 tentativas. Guarda só usuário e andamento: nem texto, nem token, nem compromisso. A linha nasce na MESMA transação que grava o aviso interno, e só se o aluno já tem token | Gustavo + Claude |
| 6 | Não duplica | No máximo um PENDENTE sem reserva por usuário: várias mudanças seguidas viram uma notificação só ("seu compromisso mudou"). Mudança durante um envio em curso gera outro (nada se perde) | Claude |
| 7 | Envio | Job `@Scheduled` a cada 30 s (`TREINOS_PUSH_ENVIO_AGENDADO`, `false` nos testes, que chamam `PushDoExpo.rodar()` à mão). HTTP FORA de transação, timeout de 5 s, sem redirecionamento, lotes de até 100 mensagens, resposta lida só por status e `status`/`details.error` dos tickets. `DeviceNotRegistered` apaga o token. Falha (HTTP != 2xx, timeout) só conta tentativa (volta em 1 min; na 3ª, FALHOU) e NUNCA desfaz o compromisso | Gustavo |
| 8 | Conferência antes de enviar | Usuário ativo e aluno não anonimizado; senão apaga os tokens dele e a linha vira CANCELADO (`USUARIO_INATIVO`). Tokens de usuário inativo ou anonimizado nunca ficam órfãos. Sem token: CANCELADO (`SEM_TOKEN`). Linha pendente com mais de 6 h: CANCELADO (`EXPIRADO`); linhas concluídas somem em 7 dias | Claude |
| 9 | Fim da sessão | O app chama `DELETE /aluno/push-token` ANTES de encerrar a sessão local (se falhar offline, o "Sair" segue). A API apaga todos os tokens do usuário onde hoje chama `Autenticador.encerrarSessoes` para aluno: inativar, senha provisória do treinador, troca da própria senha/MFA (`reabrirSessao`), anonimização e "Excluir minha conta" (passa pela anonimização). Refresh/sessão recusada (401 definitivo): o token órfão cai no envio (decisão 8) | Gustavo + Claude |
| 10 | Segredo | `TREINOS_PUSH_EXPO_TOKEN` (EXPO_ACCESS_TOKEN, "enhanced security") SEM valor padrão; no `.env.example` só o nome. Ligada sem ele, o envio vai SEM `Authorization` (o Expo permite sem enhanced security). Em produção entraria pelo `gravar-segredo.sh`; esta frente não mexe na VPS | Gustavo + Claude |
| 11 | URL | `TREINOS_PUSH_EXPO_URL`, padrão `https://exp.host/--/api/v2/push/send` | Gustavo |
| 12 | Rotas | `PUT /aluno/push-token {token, plataforma}` (204) e `DELETE /aluno/push-token {token}` (204, idempotente), `hasRole('ALUNO')`, sempre o aluno da sessão. Formato `ExponentPushToken[...]` ou `ExpoPushToken[...]`, até 200 caracteres; plataforma `ANDROID`/`IOS` | Gustavo |
| 13 | Migration | `V056__push_do_expo.sql` (total de migrations: 56 com a V056, hoje a `main` está na V054). A V055 fica de reserva para outra branch (paletas) que também quer a próxima; **na hora do merge o Claude da nuvem renumera se preciso** (arquivo, os totais em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` e a lista do `AGENTS.md`) | Gustavo + Claude |
| 14 | App | Só no celular nativo (nunca web) e com `pushHabilitado`. Interruptor "Avisar no celular quando um compromisso mudar" na Conta do aluno, com a explicação na tela; ligar pede a permissão e registra, desligar remove. Nunca pede permissão no login | Gustavo |

## Passos
- [x] 1. Plano — commit: este
- [ ] 2. API: chave, migration, token (rotas, exportação, apagar), fila e job, gancho no `AgendaService`, testes
- [ ] 3. App: `dominio/pushDoAluno.ts` com teste, interruptor na Conta, "Sair" remove o token, jest
- [ ] 4. AGENTS.md (API e app) e verificação (typecheck, lint, jest, `mvn verify`)

## Fora do escopo
- Push para o treinador (a equipe não recebe nesta fase).
- Push para outros eventos (cobrança, treino, conquistas).
- Mostrar o detalhe do compromisso na notificação (por LGPD/segurança o texto é fixo) e abrir a tela do aviso ao tocar (o toque só abre o app).
- Receipts do Expo (segunda consulta, `getReceipts`): só os tickets da resposta imediata.
- Web push.

## O que ficou para trás
- Conferir no aparelho (APK) e com o Expo real; esta frente só testa com servidor de mentira.
- Ligar `TREINOS_PUSH_HABILITADO` em produção só depois de um APK com `expo-notifications` e do `TREINOS_PUSH_EXPO_TOKEN`, se o Gustavo quiser enhanced security.
