# Planos ativos do aluno, vindos do plano comercial

Situação: Concluída (23/11/2026): passos 1 a 3 na `main` (commit `812448ff`, V091); conferido em 23/11 que os testes de integração, o `AGENTS.md` e a Ajuda já estavam entregues · Onde: main · Atualizado: 23/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa); faz parte de [financeiro-em-fases.md](financeiro-em-fases.md) (D13). Validade: vale enquanto `plano_comercial`, `ContratacaoAluno*` e o cabeçalho/Dados do aluno da ficha não mudarem de forma incompatível; ao começar, refazer "Conferido no código".

## Objetivo
O plano comercial diz o que inclui (Treino e/ou Dieta). A ficha mostra os "Planos ativos" do aluno só para leitura, a partir da contratação ATIVA. Item não incluído é só informação no editor do plano do aluno; nada é bloqueado nem escondido.

## Conferido no código (18/11/2026)
- Migração desta frente: V091 (a numeração mudou em relação ao texto de 18/11; ver `financeiro-em-fases.md`). Os pontos a conferir foram tratados na implementação, sem commit.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Plano comercial | Ganha "O que inclui: Treino / Dieta", dois booleanos `NOT NULL DEFAULT true` (os planos que já existem ficam "inclui tudo"); pelo menos um ligado, senão 422 no campo | Gustavo, 18/11 |
| D2 | Ficha | Mostra "Planos ativos: Treino · Dieta" só para leitura, tirado da contratação ATIVA; sem interruptor; o link "Ver no Financeiro" só com `FINANCEIRO_LER` | Gustavo, 18/11 |
| D3 | Quando some | Sem contratação ativa, pausada, ou com o Financeiro desligado (`TREINOS_PAGAMENTOS_HABILITADO=false`): a linha não aparece e nada muda; nunca "não contratou" por falta de dado | Gustavo, 18/11 |
| D4 | Dados | A ficha recebe só os dois booleanos, com `ALUNO_LER` (nunca o valor nem o nome do plano); a leitura fica dentro de `pagamentos/` (o `ArquiteturaTest` proíbe ler `ContratacaoAluno` fora dali): um método do pacote devolve só isso | Gustavo, 18/11 |
| D5 | Item não incluído | Só informação: no editor do plano do aluno (treino ou dieta), um Alerta de atenção "Este aluno não contratou dieta no plano atual."; nada é bloqueado nem escondido, nem do treinador nem do aluno | Gustavo, 18/11 |
| D6 | Mobilidade | Fora (segue com o treino) | Gustavo, 18/11 |
| D7 | Esconder do aluno o que ele não contratou | Não faz parte; vai para Pendências soltas para o Gustavo decidir | Gustavo, 18/11 |

## Passos
- [x] 1. Migration (próximo número livre na fila: D11 vem antes) e API: colunas em `plano_comercial`, 422 no campo, método do pacote `pagamentos/` que devolve os dois booleanos da contratação ATIVA, `AlunoDetalhe` com o resultado — executor — commit: 812448ff
- [x] 2. App: "O que inclui" no formulário do plano (Financeiro › Planos), linha "Planos ativos" na ficha (só depois da frente "ficha do aluno"), alerta nos editores de treino e dieta; regra pura em `dominio/` com teste — executor-front — commit: 812448ff
- [x] 3. Teste de integração com o Financeiro ligado e desligado; `AGENTS.md` e Ajuda — executor e sessão principal — commit: 812448ff (testes) · evidência de 23/11/2026: `PlanosAtivosDoAlunoIntegrationTest` (6, Financeiro ligado), `PlanosAtivosFinanceiroDesligadoIntegrationTest` (1, desligado) e `PlanosAtivosMigrationTest` (1) rodados com `mvn verify -Dtest=...`: 8 testes, 0 falhas (o `jacoco:check` falha só porque o subconjunto cobre 33%); `mvn verify` completo de 23/11/2026 (HEAD `d003c28e`): BUILD SUCCESS, 3.214 testes, 0 falhas, JaCoCo atendido. `AGENTS.md` (item Financeiro Fase 1, \"Planos ativos (D13, V091)\") e Ajuda (`app/src/ajuda/conteudo.ts`, Planos comerciais, \"O que inclui\") já estavam na `main`.

## Critérios de aceite
- Plano comercial novo e antigo: "inclui tudo" por padrão; desligar os dois = 422 no campo.
- Ficha: a linha aparece só com contratação ATIVA e Financeiro ligado; some (sem texto de "não contratou") nos outros casos; sem `FINANCEIRO_LER` não há link.
- Editor do plano do aluno: alerta informativo quando o item não é incluído; nada bloqueado.

## Fora do escopo
- Esconder do aluno o que não contratou; mobilidade como item separado.

## O que ficou para trás
- Escolhas para o Gustavo confirmar (feitas na execução de 18/11): a linha "Planos ativos" ficou em Dados do aluno › Configuração do acompanhamento; a mobilidade não tem alerta; a segunda leitura do aluno fica no editor do plano.
- Esconder do aluno o que ele não contratou (D7): em Pendências soltas do README.
