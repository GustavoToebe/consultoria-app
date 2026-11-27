# Regras de atenção do treinador (B+C)

Situação: Planejando (plano feito, implementação depois da rodada de 28/11) · Onde: branch regras-de-atencao (worktree consultoria-app-regras-atencao) · Atualizado: 27/11/2026

## Objetivo
O treinador define as próprias regras ("me avise quando…") e o servidor só aplica a regra dele quando o aluno envia a atualização. O app nunca inventa limite nem sugere valor (D5 de atualizacao-pasta-e-questionarios.md: o app não opina sobre saúde). O "O que mudou" continua só com fatos; a regra apenas destaca o fato (neutro, de atenção; sem verde nem vermelho) e mostra de onde veio ("sua regra: sono ≤ 5").

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| R1 | Modelos de regra, todos desligados e sem número: NOTA_ABAIXO (nota de uma pergunta abaixo de N), NOTA_CAIU (qualquer nota caiu N pontos ou mais desde a anterior), SIM (Sim numa pergunta Sim/Não), PESO_MUDOU (mais de N kg desde a anterior), POUCOS_TREINOS (menos de N treinos no período), ITEM_MARCADO (marcou item numa pergunta ITENS_DO_PLANO) | pedido | Gustavo |
| R2 | Vale para todos os alunos da consultoria; exceção por aluno na etapa 2 | pedido | Gustavo |
| R3 | A regra é avaliada no servidor, dentro da transação do envio (`AtualizacaoService.enviar`), e o resultado é gravado com o tipo, a pergunta e o número vigentes naquele envio; mudar a regra depois não reescreve atualizações antigas | pedido | Gustavo |
| R4 | O servidor só marca e guarda o fato que bateu; o "O que mudou" segue montado no app (`dominio/mudancasDaAtualizacao.ts`) e o app só casa o destaque pela chave do fato (id da pergunta, `peso`, `treinos`); o app nunca reavalia regra | proposta | sessão (a confirmar) |
| R5 | Linhas, não colunas: tabela `regra_de_atencao` com uma linha por regra ligada (duas NOTA_ABAIXO em perguntas diferentes são duas linhas); a tela mostra os 6 modelos e cria a linha ao ligar | proposta | sessão |
| R6 | Permissão nova `REGRA_ATENCAO_ALTERAR` (depende de `ATUALIZACAO_LER`), só o Administrador por padrão; ler os alertas = `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`, como a atualização | proposta | sessão (a confirmar) |
| R7 | Push novo `TipoDePush.ATUALIZACAO_ATENCAO`: "Nova atualização de <primeiro nome> com N pontos de atenção"; nenhum dado de saúde no texto; só com N ≥ 1; depois do commit; reenvio idempotente não repete o push | pedido | Gustavo |
| R8 | Cada membro liga ou desliga o push de atenção para si (padrão ligado), em Aparência e preferências ou Perfil › Notificações; destinatários: o responsável do aluno e, sem responsável, quem tem `ATUALIZACAO_LER` | proposta | sessão (a confirmar) |
| R9 | Chave `TREINOS_REGRAS_ATENCAO_HABILITADO` (padrão `false`): desligada, nada é avaliado, as rotas respondem 503 e o app esconde tudo; `GET /eu` traz `regrasAtencaoHabilitada` | pedido (opcional) | Gustavo |
| R10 | Migration provisória V190, renumerada no merge final para o próximo livre (a rodada de 28/11 pode pegar a V111/V112) | pedido | Gustavo |

## Modelo de dados (migration provisória V190)
- `regra_de_atencao`: `consultoria_id` (@TenantId), `id`, `tipo` (CHECK dos 6 tipos), `pergunta_id` texto nulo (id estável da pergunta no questionário; obrigatório em NOTA_ABAIXO, SIM e ITEM_MARCADO), `limite` numérico nulo (obrigatório em NOTA_ABAIXO, NOTA_CAIU, PESO_MUDOU e POUCOS_TREINOS), `ativa`, `versao`, `criado_em`, `alterado_em`; único `(consultoria_id, id)`; teto de regras por consultoria.
- `regra_de_atencao_aluno` (etapa 2): `consultoria_id`, `regra_id`, `aluno_id`, `ativa` (false = desligada para ele), `limite` nulo (número só dele); FKs compostas com `ON DELETE CASCADE`; única por (regra, aluno).
- `atualizacao_atencao` (resultado congelado): `consultoria_id`, `atualizacao_id` (FK composta, cascade), `regra_id` (nula se a regra for apagada, `ON DELETE SET NULL`), `tipo`, `pergunta_id`, `limite_vigente`, `valor_observado` (numérico; nulo no SIM e no ITEM_MARCADO), `itens_marcados` jsonb nulo (só id e nome de item do plano, que o aluno já tem), `criado_em`. Nada de texto livre do aluno nem motivo digitado.
- Preferência de push do membro: coluna `push_atencao` boolean padrão true em `usuario` (ou tabela própria).
- Sem coluna nova em `atualizacao`: a contagem é `count(*)` de `atualizacao_atencao`.

## Servidor
- `AvaliadorDeAtencao` (classe pura, testada sem banco): entrada = respostas, tipos das perguntas, atualização anterior (mesma regra do app: a anterior enviada ou revisada de data menor), peso atual e anterior (`RegistroPeso`), treinos do período (`ResumoPeriodoService`), regras vigentes e exceções do aluno; saída = lista de fatos (`tipo`, `perguntaId`, `limiteVigente`, `valorObservado`). Nunca devolve juízo.
- `AtualizacaoService.enviar` (`:90-121`): depois de `saveAndFlush` e `gravarPeso`, avalia e grava `atualizacao_atencao`; o push entra na fila `push_envio` depois do commit. Reenvio idempotente (`:95-97`) não reavalia nem notifica de novo. Hoje não há push ao treinador nem rota de token do treinador (só `AlunoPushTokenController`; `PushService.registrar` já é por `usuarioId`).
- Rotas (atrás de `@ExigeRegrasAtencao`; outra consultoria = 404):
  - `GET /regras-de-atencao` (`ATUALIZACAO_LER`); `POST`, `PUT /{id}` e `DELETE /{id}` (`REGRA_ATENCAO_ALTERAR`, `versao`, 409 `CONFLITO_EDICAO`, 422 `REGRA_INVALIDA` por campo com mensagens fixas); auditoria de resumo fixo `REGRA_ATENCAO_CRIADA`, `_ALTERADA`, `_REMOVIDA` (espelho em `acoesAuditoria.ts`).
  - Etapa 2: `GET|PUT|DELETE /alunos/{id}/regras-de-atencao/{regraId}` (`REGRA_ATENCAO_ALTERAR` + `ALUNO_ALTERAR`); `GET /regras-de-atencao` traz `alunosComExcecao` por regra.
  - Lista de atualizações (`GET /atualizacoes`): `pontosDeAtencao` por item e filtro `?comAtencao=true`; detalhe (`GET /atualizacoes/{id}`): `atencao: [{tipo, perguntaId, limiteVigente, valorObservado, itensMarcados}]`.
  - Preferência do membro: `GET|PUT /eu/preferencias-de-push` (campo `atencao`) e o registro de token do treinador.
- Testes de integração mínimos: isolamento por consultoria; regra aplicada no envio e congelada depois de mudar a regra; exceção do aluno vale só no próximo envio; sem regra = nenhum ponto; permissão (403 sem a permissão nova; leitura com `ATUALIZACAO_LER`); push sem dado de saúde, só com N ≥ 1 e respeitando a preferência; chave desligada = 503 e nada avaliado; reenvio idempotente.

## App (telas pelo plano-front antes do executor-front)
- Configurações › "Regras de atenção" (grupo "Alunos e atendimento", cartão novo com chave e permissão): os 6 modelos, desligados e sem número; ligar abre os campos do modelo (pergunta escolhida entre as do questionário; número digitado pelo treinador, nunca sugerido); salvar com a guarda de saída; contagem "N alunos com exceção" (etapa 2).
- Lista de atualizações: selo neutro "N pontos de atenção" e o filtro "Ver primeiro as com atenção".
- Revisão da atualização: dentro do "O que mudou", o fato que bateu ganha destaque neutro (superfície pintada de atenção, sem verde nem vermelho) e a legenda da regra ("sua regra: sono ≤ 5", montada com o rótulo da pergunta e o limiteVigente gravado).
- Preferências: interruptor "Avisar quando a atualização de um aluno tiver pontos de atenção", fácil de achar.
- Ficha do aluno (etapa 2): em Dados do aluno › Configuração do acompanhamento, "Regras de atenção deste aluno": desligar uma regra ou trocar o número só para ele.
- Ajuda e guias: seção da Ajuda e guias em PDF atualizados.

## Passos
- [x] 0. Plano (este arquivo) e mapas de API e app — commit: local na branch regras-de-atencao
- [ ] 0b. plano-front das telas e revisão do plano (API, migration, permissões) pelo revisor — commit: —
- [ ] 1. Etapa 1 API: migration provisória V190, entidades, avaliador, envio, rotas, permissão, auditoria, push, chave — commit/run: —
- [ ] 2. Etapa 1 app: Configurações, lista, revisão, preferências, Ajuda e guias — commit/run: —
- [ ] 3. Etapa 2: exceção por aluno (API e ficha) — commit/run: —

## Decisões em aberto
- R4: o servidor devolve só o fato que bateu e o app o casa pela chave, ou devolve também a legenda pronta?
- R6: permissão nova `REGRA_ATENCAO_ALTERAR` (recomendado) ou reaproveitar `MARCA_ALTERAR`?
- R8: destinatários do push e onde mora o interruptor.
- Limite máximo de regras por consultoria e de exceções por aluno.

## Fora do escopo
- Sugerir limite, texto de saúde no push, regra por grupo de alunos, regra retroativa sobre atualizações já enviadas.

## O que ficou para trás
- (preencher na entrega)
