# Alertas de troca de exercício

Situação: Planejando (depende do Lote B, `trocar-exercicio.md`; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: leitura do código em 16/11/2026 (mapa do explorador), base 1f33299d. Validade: vale enquanto não existir push para treinador e o Lote B não mudar o formato da troca.

## Objetivo
O treinador fica sabendo que o aluno trocou um exercício, pelo canal que já existe, com texto fixo e sem dado de saúde.

## O que já existe (conferido)
- **Não existe push para treinador.** `PushService.enfileirarParaAlunos` só envia ao aluno (V056, `push_token` de usuário ALUNO, texto fixo "Compromisso atualizado").
- Aviso dentro do app existente é do aluno: `AgendaService.registrarAvisos` → `AvisoCompromisso`.
- O Início do treinador usa pendências calculadas em `app/src/dominio/painelDoInicio.ts`; o Lote B já prevê "Trocado por X neste dia" na ficha e no histórico do aluno (rota `GET /alunos/{id}/trocas-de-exercicio`, `REGISTRO_LER`).

## Proposta (recomendada)
1. **Sem canal novo.** Alerta = pendência "Trocas de exercício" no Início do treinador e na ficha, calculada pelo GET que o Lote B já cria (trocas dos últimos 7 dias, com `visto` opcional). Sem push, sem e-mail e sem tabela de aviso.
2. **"Visto" reaproveita o molde da V040** (`sessao_concluida_visto`: uma linha por conclusão, quem e quando, permissão `REGISTRO_REAGIR`): a troca vista some da pendência. Isso pede uma migration pequena (`troca_exercicio_visto`), depois da do Lote B.
3. **Texto fixo**: "Fulano trocou um exercício" (nome do aluno e do exercício, que o treinador já pode ver pela permissão `REGISTRO_LER`; nunca motivo digitado, peso, dor ou lesão; o aluno não digita texto na troca).
4. **Push ao treinador fica de fora** até haver decisão de infra: o token de push hoje é só do aluno e o app do treinador é principalmente web.

## Decisões para o Gustavo
| # | Pergunta | Opções |
| --- | --- | --- |
| 1 | Canal | **(a) Pendência no Início e na ficha, sem push (recomendada)**; (b) também e-mail ao treinador (precisa de configuração de e-mail ligada); (c) push ao treinador (exige construir token e rota para treinador, plano à parte) |
| 2 | Quem é avisado | **(a) Só o responsável do aluno (o mesmo critério de "Meus alunos") (recomendada)**; (b) toda a equipe com `REGISTRO_LER` |
| 3 | "Visto" | **(a) Sim, com `REGISTRO_REAGIR` como no treino concluído (recomendada)**; (b) a pendência some sozinha em 7 dias, sem migration |
| 4 | Aviso ao aluno de que o treinador viu | **(a) Não (recomendada)**; (b) sim, selo "Visto pelo treinador" como no treino |
| 5 | Janela | **(a) 7 dias (recomendada)**; (b) 14 dias |

## Passos (depois do Lote B e das respostas)
- [x] 1. API: leitura das trocas pendentes do escopo (JPQL) e, se decisão 3a, migration `troca_exercicio_visto` com o próximo número livre depois da do Lote B (executor) — feito (16/11, NÃO compilado até o commit): V080 `troca_exercicio_visto`, `GET /trocas-de-exercicio/pendentes?meus=`, `vistoEm` na lista do aluno, `PUT`/`DELETE /alunos/{id}/trocas-de-exercicio/visto` (corpo com a chave; DELETE com corpo: conferir proxy e cliente web); `TrocasVistasIntegrationTest`; decisões do executor: visto aceito até 31 dias, chave inclui a alternativa — commit: ver `git log` ("V080: visto da troca de exercício")
- [x] 2. App: pendência no Início (`dominio/painelDoInicio.ts`), cartão na ficha (executor; tela pequena no executor-front se precisar) — feito em 16/11 pelo `executor-front`: cartão `treinos.trocas` no bloco Treinos do Início, Folha "Trocas para ver", `CartaoTrocasDeExercicio` na aba Acompanhamento da ficha (`?aba=acompanhamento&secao=trocas`), "Marcar como visto"/"Desfazer" sem atualização otimista; e2e `alertas-de-troca` 10/10 e os 6 specs vizinhos do Início passam (117 + o foco do painel, que falhou uma vez sem relação e passou na repetição); dúvidas: rolagem até a seção só na web, ordem no Próximo passo, texto "Não vista" para quem só lê, DELETE com corpo não conferido no proxy de produção — commit: ver `git log` ("Alertas de troca: telas")
- [ ] 3. Ajuda e `AGENTS.md` — commit: —

## Riscos
- Migration depende da fila: só depois da do Lote B (Flyway sem out-of-order).
- Ruído: aluno que troca todo dia gera pendência diária; a janela e o "Visto" controlam.
- LGPD: nome do exercício é dado de treino, não de saúde; mesmo assim nada vai a log, auditoria nem push.

## Fora do escopo
Push, e-mail e WhatsApp ao treinador; alerta de qualquer outro evento.

## O que ficou para trás
- (nada ainda)
