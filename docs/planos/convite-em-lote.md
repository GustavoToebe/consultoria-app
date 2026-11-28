# Convite de acesso em lote (links e WhatsApp)

Situação: Em andamento (verificação final da leva 2) · Onde: branch `leva-2` · Atualizado: 29/11/2026

## Objetivo
O treinador gera, de uma vez, o link de acesso ao app de todos os alunos que ainda não entraram e envia cada um pelo WhatsApp, copia a mensagem ou baixa um CSV. Sem e-mail de convite ao aluno (`TREINOS_EMAIL_HABILITADO` segue desligado até o Resend estar configurado). Pedido do Gustavo em 28/11 como exceção ao congelamento: os alunos do Saraiva já estão no app como cadastro, sem acesso, e entram em 01/12.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Rota | `POST /alunos/lote/convites` `{alunoIds}` (1 a 100 distintos), `PERM_ALUNO_CONVITE`, resposta `no-store`, na ordem do pedido | Gustavo, 28/11 |
| D2 | Situações por aluno | `GERADO`, `JA_TEM_ACESSO`, `INATIVO`, `ANONIMIZADO`, `NAO_ENCONTRADO` (outra consultoria vira `NAO_ENCONTRADO`); só `GERADO` traz `link` e `validoAte` (7 dias) | Gustavo, 28/11 (contrato aprovado em 29/11) |
| D3 | Renovar | Gerar de novo troca o hash na mesma linha: o link anterior deixa de valer | Gustavo, 28/11 |
| D4 | Auditoria | Um evento por chamada, `ALUNOS_CONVITES_GERADOS`, resumo fixo, sem evento quando nenhum convite é gerado; link e código nunca em log ou auditoria | Sessão |
| D5 | Transação | Um lote numa transação só (trava dos alunos em ordem de id); recusa de um aluno vira a situação do item e não derruba os outros; erro de banco desfaz a chamada | Sessão |
| D6 | App | Atalho "Sem acesso ao app"; "Marcar todos do filtro" (mais de 100: o app divide em chamadas de 100, com progresso e "Tentar de novo" só do que falhou); confirmação "Gera um link de acesso para N alunos. Links anteriores deixam de valer." | Gustavo, 28/11 |
| D7 | Mensagem | "Oi, <primeiro nome>! Seu acesso ao app da <consultoria> está pronto: <link>. Válido até <data>."; sem o nome da consultoria usa "sua consultoria"; sem telefone o botão do WhatsApp fica desligado com o motivo | Gustavo, 28/11 e 29/11 |
| D8 | "Enviado" | Marca só visual, só pelo toque do treinador; abrir o WhatsApp não marca; não vai à API nem ao armazenamento | Gustavo, 29/11 |
| D9 | CSV | `nome;telefone;link;validade`, só dos gerados, com o aviso "O arquivo tem links de acesso: não compartilhe."; os links só vivem na memória da folha | Gustavo, 28/11 |

## Passos
- [x] 1. API: `ConvitesEmLote`, rota no `AlunoLoteController`, `ConviteService.impedimento/emitir` compartilhados com o convite individual, `ConvitesEmLoteIntegrationTest` (6 casos) — commit/run: —
- [x] 2. App: `dominio/convitesEmLote.ts`, `api/convitesEmLote.ts`, `treinador/convites/ConvitesEmLote.tsx`, lista de Alunos, `acoesAuditoria.ts` (65 ações em Alunos) — commit/run: —
- [x] 3. Ajuda: "Convidar vários alunos de uma vez" — commit/run: —
- [x] 4. e2e `convites-em-lote.spec.ts` (390 e 1280) rodado e verde (8 de 8; o nome acessível do "Baixar CSV" só leva o aviso quando há convite gerado) — commit/run: —
- [x] 5. `mvn verify` (3857 testes, 0 falhas) e e2e completa da leva 2 (3940 passaram; as falhas que sobraram eram specs defasados pelo lote de 27/11 ou corridas nos testes, corrigidos; `ficha-folha-de-lesao` ainda oscila com 2 workers e passa isolada 68 de 68, intermitência por carga) — commit/run: —

## Fora do escopo
- E-mail de convite ao aluno: depois do Resend (fila pós-01/12, [fila-pos-01-12.md](fila-pos-01-12.md)).
- Lista virtualizada para mais de 500 convites e limite de requisições específico da rota.
- Exceção ao "um modo só de filtrar" (`docs/design-e-front.md` registra os atalhos dentro do painel de filtros): o atalho "Sem acesso ao app" fica fora do painel por pedido do Gustavo.

## O que ficou para trás
- Linha em `docs/design-e-front.md` registrando a exceção do atalho (o arquivo tem edições de outras frentes na leva 3; entra no merge).
