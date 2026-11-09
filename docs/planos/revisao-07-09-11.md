# Revisão geral de 07 a 09/11 (correção de back, banco e front)

Situação: Publicada em 09/11/2026 (`133d6cc6`, run 42716103970); sobras abaixo · Onde: `main` · Atualizado: 09/11/2026

## Objetivo
Corrigir o que as entregas de 07 a 09/11 (V061 a V066) deixaram fora do padrão do sistema, com ênfase no front: link
público e formulários, comunidade, importação assistida, Biblioteca › Alimentos, Financeiro e Editor de séries. Preservar
os dados reais do Saraiva (consultoria `2acdd04a-…`); sem camada de compatibilidade (ele é o único cliente).

Base: HEAD `5d4c8cc4` (em produção). Corrigido em migrations novas, porque V061 a V066 já estão publicadas.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Sem código de transição nem legado; dados do Saraiva preservados nas migrations | V067 e V068 | Gustavo (09/11) |
| 2 | Link público mora só no questionário de finalidade INSCRICAO; `inscricao_configuracao` sai | V067 | revisão (C1/C2) |
| 3 | Comunidade: 404 entre consultorias, ranking só do próprio aluno, sem opt-in de força | V068 | revisão (A1 a A5) |
| 4 | IA externa da importação assistida fail-closed atrás de `TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR` | padrão `false` | revisão (C3) |
| 5 | Tela nova ou redesenho vai ao `executor-front`; só o que ele tocou foi padronizado | lotes A, B e C | Gustavo |
| 6 | Subir à produção só com testes verdes, num push na `main` | autorizado em 09/11 | Gustavo |

## Passos
- [x] 1. Auditoria do que foi feito e correções de front (lotes A, B e C) — evidência: `typecheck` e `lint` sem erro, `jest` 6088/6088, e2e das 18 specs das telas mexidas 295/295.
- [x] 2. Link e formulários (V067), `LinkDoFormularioIntegrationTest` 11/11 e `LinkPublicoNoQuestionarioMigrationTest` 1/1.
- [x] 3. Comunidade (V068), `ComunidadeServiceTest` 10/10 e `ComunidadeIntegrationTest` 12/12.
- [x] 4. Importação assistida, `ImportacaoAssistidaIntegrationTest` 8/8 e `ImportacaoAssistidaServiceTest` 13/13.
- [x] 5. Totais de migrations em 68 e lista do Flyway com as duas novas — `FlywayMigrationIntegrationTest` 4/4, `PapeisBancoIntegrationTest` 6/6.
- [x] 6. `mvn verify` completo com JaCoCo — evidência: BUILD SUCCESS em 09/11/2026, 2229 testes sem falha, ArchUnit 17/17, "All coverage checks have been met" (Postgres 18 via Testcontainers; o 17 não foi rodado).
- [x] 7. Commit e push na `main` — commit/run: `133d6cc6`, run 42716103970 (todos os jobs verdes, inclusive `publicar`); `/api/actuator/health` UP e site 200 em 09/11/2026.

## Fora do escopo
- IA externa (Gemini/Claude) segue desligada até decisão do Gustavo.
- Auditoria da VPS (somente leitura) e o operador Central N19: não conferidos nesta sessão.

## O que ficou para trás
Cada item também está em "Pendências soltas" do README.
- Mural mostra nome civil e `autorId`, inclusive de menores (LGPD): primeiro nome ou apelido? (Gustavo)
- Moderação usa `TREINO_ALTERAR`; o plano cita `MURAL_MODERAR`, que não existe (Gustavo decide).
- Página pública de inscrição guarda dados no `sessionStorage`; o comentário "nada vai ao aparelho" ficou falso (executor).
- Reversões do lote C (barra de 6 px, rótulo "Pausa (s)", sugestão no campo de peso): confirmar se vieram da reunião de 08/11 (Gustavo).
- API deveria mandar `terminoVigencia` e `alertaRenovacao` no `PlanoDoAluno`; hoje o app do aluno usa um `shortcut:` de 40 dias (executor).
- Segundo envio encadeado do formulário público cria outra inscrição e pede nome e WhatsApp de novo (executor).
- Importação assistida: tela sem saída após erro permanente, `Retry-After` não exposto pelo `requisicao`, `ExtratorPdf` quase não lê PDF real (executor).
- `objetivo` sem CHECK, D4 da anamnese pública encadeada, tabela `inscricao_configuracao` a remover em migration futura, contrato 5.4 de suporte da Central ausente no app (executor).
- Front: `/aluno/entrar` sem uso, escolha aluno/treinador em `entrar.tsx` só muda texto, selos sem ícone em `AbaCobrancas` e `FolhaDaCobranca`, `classificarCoccao` a mover para `dominio/`, janela de 40 dias duplicada, API calcula dias de vigência em UTC (executor-front).
