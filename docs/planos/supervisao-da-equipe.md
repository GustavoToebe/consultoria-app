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
| D17 | Quem vê a tabela | `equipe` e `semResponsavel` em `GET /numeros` só com `EQUIPE_LER` (na prática, o dono); sem ela saem `null`, não listas vazias, e o resto de Números segue com `PAINEL_VER`. Assistente e Nutricionista têm `PAINEL_VER` desde a V001 e deixam de ver a equipe. Proposta da revisão independente | Gustavo, 03/11: a supervisão é do dono |
| D18 | Decisões que o plano não trazia (estão no código) | responsável que deixou de ser membro ativo conta como "Sem responsável"; `PUT /usuarios/{id}/limite-de-alunos` responde 204; o Administrador também pode ter limite; sem índice novo em `aluno(responsavel_id)`; "atrasadas" na tabela = atualização ainda não enviada com prazo vencido (janela de seis meses), de aluno ativo hoje; "para revisar" = enviada e não revisada, de qualquer data; a porta da rota do limite é `USUARIO_ALTERAR` e o service confere o perfil de acesso total | Claude (03/11) |
| D19 | Como o limite é lido | `LimiteDoTreinador.exigirVaga` **trava a consultoria primeiro** (sempre que há aluno novo para o membro, mesmo sem limite: ler antes da trava deixaria passar uma troca de limite concorrente) e só então lê o limite por consulta escalar JPQL (`UsuarioRepository.limiteDeAlunos(id, consultoriaId)`), que não passa pelo cache do Hibernate e filtra a consultoria (`Usuario` não tem `@TenantId`); nenhuma leitura do limite usa SQL nativo. `vagas()` (importações) devolve `limite - contagem` **sem corte em zero**, que pode ser negativo, para a prévia descontar o saldo das linhas anteriores; a rota do limite confere o Administrador antes de travar e ler o membro; o corpo é lido como `JsonNode`, para `1.5`, `7.0`, `"7"`, `true` e números fora do int darem 422 no campo `limite` (o Jackson arredondava `1.5`) | Claude (03/11), revisão independente |
| D20 | Texto da recusa na importação de uma aba | quando o responsável é o próprio importador (sem a coluna `responsavel`): "Você já atingiu o limite de alunos."; quando a coluna `responsavel` aponta outro membro: "O responsável escolhido já atingiu o limite de alunos."; reativação sem a coluna, que devolve o aluno a outro membro cheio: "O responsável do aluno já atingiu o limite de alunos." | Claude (03/11) |
| D21 | Trava da consultoria e leitura do limite | toda criação, troca de responsável (editar, lote) e reativação com membro de destino trava a consultoria (a fila é só da consultoria; editar mantendo o responsável não passa pela conferência). Todas as leituras do limite são JPQL (`UsuarioRepository.limiteDeAlunos`, `AlunoRepository.contarAtivosDoResponsavel`); conferido por busca que nenhuma consulta nativa lê `usuario.limite_de_alunos`, então não há filtro de `consultoria_id` a acrescentar em SQL nativo | Claude (03/11), pedido do Gustavo |
| D22 | Corpo da rota do limite e gravação do usuário | o campo `limite` é obrigatório no corpo de `PUT /usuarios/{id}/limite-de-alunos`: `{}` ou `{"limites":5}` dão 422 no campo `limite` e nada muda (só `{"limite":null}` apaga, D13); a rota lê o corpo inteiro como `JsonNode` (campo ausente e `null` explícito não se distinguem num `record`). `Usuario` ganhou `@DynamicUpdate`: o login carrega o usuário sem trava e sem `@Version`, e o UPDATE de todas as colunas podia desfazer um limite recém-gravado; a mesma causa existia para `ativo` (login concorrente com a desativação), e o UPDATE só das colunas alteradas resolve os dois | Claude (03/11), achado do revisor |
| D23 | Limite nulo na tabela de Números | "12 / sem limite", não "12 / —": nulo é "sem limite" (D2), não falta de dado; o "—" fica para atrasadas e para revisar nulas. Quem passou do limite leva o selo "Acima do limite" (atenção) e quem bateu nele, "No limite" (neutro), sempre com texto | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D24 | Onde fica o campo do limite | na folha "Editar membro" (não no convite: convite pendente ainda não é usuário), só para o Administrador (`useAtorEquipe().administrador`, o mesmo perfil de acesso total que a API confere); quem edita sem ser Administrador vê o limite só para leitura ("Só um administrador altera o limite de alunos."); o cartão de cada membro mostra "Limite: N alunos" ou "Sem limite de alunos" | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D25 | Como o limite é salvo | o "Salvar membro" grava primeiro `PUT /usuarios/{id}` e só depois a rota do limite, e só se o valor mudou (cada gravação é auditada); se o `PUT /usuarios/{id}` falhar, o limite não é chamado; o campo aceita até 4 caracteres (para "1000" mostrar o erro em vez de virar "100") e só vale inteiro de 0 a 999, vazio = `{"limite": null}`; com valor inválido o botão fica desabilitado com o motivo. Se a rota do limite falhar depois do resto salvo, a folha fica aberta, o erro vai ao campo e o aviso diz "Nome, perfil e situação foram salvos; o limite de alunos não."; a nova tentativa usa o membro que a API devolveu: só repete o `PUT /usuarios/{id}` se nome, perfil ou situação mudaram de novo, e não pede outra vez "Desativar membro?" | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D26 | Texto do `LIMITE_DO_TREINADOR` nas ações de aluno | nenhum texto próprio: criar, editar, lote, reativar e aceite já mostram a mensagem da API ("Este responsável já atingiu o limite de alunos. Escolha outro responsável.", sem nome nem id), e nenhum desses fluxos trata o 409 como conflito de versão; a importação de uma aba mostra o motivo da linha que vem da API (D20). Só a planilha completa ganhou o texto do problema: "Você já atingiu o limite de alunos: o aluno novo não entra." | decidido pelo Claude em 03/11, conferir com o Gustavo |

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
- [x] 1. Limite de alunos (D2 a D4, D6 a D12), parte da API: migration V054, 409 `LIMITE_DO_TREINADOR` nos sete caminhos com teste de cada um e o de duas threads, rota `PUT /usuarios/{id}/limite-de-alunos` — executor — commit: fase 2 da branch `supervisao-da-equipe` (ver `git log`). Falta a tela: campo no cadastro do membro (executor-front) e a revisão do Opus (permissões e tenant).
- [x] 2. Tabela da supervisão em Números (D1), parte da API: `equipe[]` e `semResponsavel` em `GET /numeros`, só contagens, com teste de que nenhum nome nem id de aluno sai — executor — commit: fase 2 da branch `supervisao-da-equipe` (ver `git log`). Falta a tela em `treinador/numeros.tsx` (executor-front).
- [x] 3. Correções da revisão independente (D17, D19 a D22): tabela só com `EQUIPE_LER`; prévia da importação de uma aba sem cortar as vagas em zero; trava da consultoria antes da leitura do limite (consulta escalar com tenant); Administrador conferido antes da trava na rota do limite; limite só inteiro (422); rótulo `USUARIO_LIMITE_DE_ALUNOS_ALTERADO` em `acoesAuditoria.ts`; texto da recusa na importação — executor — commit: fase 2 da branch `supervisao-da-equipe` (ver `git log`).
- [x] 4. Telas (D23 a D26): campo "Limite de alunos" na folha "Editar membro" (só o Administrador), tabela da equipe em `treinador/numeros.tsx` (só quando a API manda `equipe`), regras puras em `dominio/limiteDeAlunos.ts` e `dominio/numeros.ts` com teste, texto do problema `LIMITE_DO_TREINADOR` em `dominio/planilhaCompleta.ts`, e2e `e2e/supervisao-da-equipe.spec.ts` (390 e 1280 px, claro e escuro). O merge da frente Treinador (#67) já tinha entrado na `main` — executor-front — commits: branch `limite-de-alunos-telas` (ver `git log`).

## Fora do escopo
- Fila "para revisar" do dono e aprovação antes de publicar (D1).
- Tirar aluno de quem já passou do limite (D4).

## O que ficou para trás
- Revisão do Opus da parte da API (permissões e tenant), anotada no passo 1.
