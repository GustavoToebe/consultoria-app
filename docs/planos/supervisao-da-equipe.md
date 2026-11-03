# Supervisão da equipe pelo dono da consultoria

Situação: Em andamento · Onde: branch `supervisao-da-equipe` (PR próprio) · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C65, C79

## Objetivo
O treinador do piloto revisa tudo o que a equipe faz (atualizações, dieta, uso de substâncias): "eu tenho que
supervisionar tudo". Hoje isso acontece fora do app. Ele também não quer escalar: no máximo cerca de 50 alunos por
treinador da equipe (1:56 a 1:58).

## O que o código faz hoje (main 19b1fd6)
- Perfis padrão: Administrador, Assistente, Nutricionista e Treinador, editáveis e duplicáveis. O Treinador não altera
  a Marca, e o Financeiro fica só com o Administrador.
- Não há fluxo de revisão ou aprovação antes de publicar.
- O limite de alunos é da consultoria (direitos do plano), não do treinador.

## Decisões (Gustavo, 03/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Supervisão (C65) | versão pequena: em Números, uma tabela por membro da equipe só com contagens (alunos ativos, atualizações atrasadas e para revisar), **sem nome de aluno**; nada de fila de revisão nem aprovação antes de publicar | Gustavo |
| D2 | Limite de alunos (C79) | campo "Limite de alunos" no cadastro de cada membro da equipe, que só o Administrador edita; em branco = sem limite | Gustavo |
| D3 | Acima do limite | pôr alguém como responsável de um aluno acima do limite: a API recusa com 409 e mensagem clara, em todos os caminhos (criar aluno, trocar o responsável, ação em lote, aceite de inscrição e planilha) | Gustavo |
| D4 | Quem já passou | quem já está acima do limite não perde nenhum aluno | Gustavo |
| D5 | Quando | começa em 03/11, na branch `supervisao-da-equipe`, depois do merge dos itens 1 e 2 (PRs #52 e #53) | Gustavo (03/11) |
| D6 | O que o limite conta | só alunos **ativos** (não inativos nem anonimizados) com o membro como responsável, a mesma contagem de "alunos ativos" da D1 | Gustavo (03/11) |
| D7 | Caminhos conferidos | todo caminho que **dá** um aluno ativo a um membro: criar (também o criador gravado direto, `AlunoService.criar`, ~linha 254), editar, lote, aceite de inscrição, importação de uma aba, planilha completa e **reativar** (rota individual e situação pela planilha, nas duas importações). Tudo passa por um ponto só de conferência (o `definirResponsavel` ou um método novo), para nenhum caminho escapar | Gustavo (03/11) |
| D8 | O que nunca é barrado | trocar o responsável para "nenhum"; trocar para um membro que tem vaga (só o membro que **recebe** é conferido); desativar; anonimizar; quem já está acima do limite e só mantém os alunos que tem (D4) | Gustavo (03/11) |
| D9 | Ordem das travas | sempre consultoria → inscrição (no aceite) → alunos. O aceite (B1) e a importação já travam a consultoria; criar, editar e lote passam a travá-la antes de contar | Gustavo (03/11) |
| D10 | Erro | 409 com código próprio (por exemplo `LIMITE_DO_TREINADOR`, diferente de `LIMITE_DO_PLANO`), sem nome nem id de aluno | Gustavo (03/11) |
| D11 | Migration | V054 (a V053, do cupom, já está na `main`); totais 54 em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` | Gustavo (03/11) |
| D12 | Testes antes do código | um teste de integração por caminho (criar, editar, lote, aceite de inscrição, importação de uma aba, planilha completa e reativar), mais um teste com duas threads disputando a última vaga do mesmo membro | Gustavo (03/11) |
| D13 | Onde se grava o limite | rota própria `PUT /usuarios/{id}/limite-de-alunos {limite}` (`null` = sem limite), só para o Administrador, com auditoria de resumo fixo; o `PUT /usuarios/{id}` não muda, para o `null` dele não apagar o limite sem querer | Claude (03/11, recomendação do advisor) |
| D14 | Valores aceitos | inteiro de 0 a 999; 0 = o membro não recebe aluno novo (útil para quem está saindo); fora disso 422 no campo `limite`, sem repetir o valor | Claude (03/11) |
| D15 | Quando a conferência dispara | só quando o aluno termina **ativo** com um responsável **novo** para ele (troca de responsável ou reativação); editar mantendo o mesmo responsável, aluno inativo atribuído a membro cheio e, no lote, os selecionados que já eram do membro não contam | Claude (03/11, recomendação do advisor) |
| D16 | Tabela de Números (D1) | uma linha por membro **ativo** (inativo some), com o limite ao lado; mais a linha "Sem responsável"; atualizações atrasadas e para revisar ficam `null` sem `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`, como o resto de Números; nenhum nome nem id de aluno | Claude (03/11) |

## Mapeamento (03/11, só leitura)
- Responsável gravado em:
  - `AlunoService.criar` (o criador direto, ~254, e depois `definirResponsavel`, ~256);
  - `AlunoService.alterar` (~305);
  - `AlunoLoteService.trocarResponsavel` (~48; hoje trava só os alunos, sem a consultoria);
  - `InscricaoService.aceitar` (~385, pelo `criar`; responsável inativo vira nulo sem erro);
  - `GravadorDaImportacao.gravarAluno` (~201 aluno novo, com o importador como padrão; ~220 existente, com a coluna mapeada);
  - `GravacaoDaPlanilha.confirmar` (~185, sempre o importador).
- Não gravam responsável: o convite do aluno (`ConviteService.aceitar`); `AlunoService.alterarSituacao` reativa, mas não troca o responsável.
- Travas que já existem:
  - `ConsultoriaRepository.travar`;
  - `PlanoDaConsultoria.exigirVagaDeAluno`;
  - `EquipeService.travar`;
  - o aceite trava a consultoria (~371);
  - `ImportacaoService.confirmar` trava a consultoria em alunos e pesos;
  - `GravacaoDaPlanilha` sempre trava a consultoria.
- Equipe: `PUT /usuarios/{id}` (`PERM_USUARIO_ALTERAR`) → `EquipeService.alterarUsuario`. O `UsuarioRequest` tem `{nome, perfilId, ativo}` e ainda não tem limite.
- Números: `GET /numeros` (`PAINEL_VER`), `NumerosService` (`MesNumeros`, `Numeros`). Ainda não há contagem por membro. No app: `treinador/numeros.tsx` e `dominio/numeros.ts`.
- Testes de modelo:
  - `AlunoLoteIntegrationTest`;
  - `ConviteEAlunosIntegrationTest`;
  - `InscricaoAceiteAtomicoIntegrationTest`;
  - `ImportacaoIntegrationTest` (`limiteDoPlanoDeixaALinhaDeFora`, `situacaoPelaPlanilhaSegueAsRegrasDoCadastro`);
  - `PlanilhaCompletaGravacaoIntegrationTest`;
  - `EquipeIntegrationTest`;
  - `NumerosIntegrationTest`.

## Passos
- [ ] 1. Limite de alunos (D2 a D4, D6 a D12): migration V054, API nos sete caminhos com 409 e teste de cada um (e o de duas threads), campo no cadastro da equipe (permissões e tenant: revisão do Opus obrigatória) — executor + executor-front — commit: —
- [ ] 2. Tabela da supervisão em Números (D1), só contagens, com teste de que nenhum nome de aluno sai na rota — executor + executor-front — commit: —

## Fora do escopo
- Fila "para revisar" do dono e aprovação antes de publicar (D1).
- Tirar aluno de quem já passou do limite (D4).

## O que ficou para trás
- —
