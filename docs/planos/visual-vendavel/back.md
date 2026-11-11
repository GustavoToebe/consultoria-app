# Sugestões para o back (`api/`), 10/11/2026

Não fazem parte da frente visual. Saíram de uma leitura do código (base `6dca4d9f`) pelo revisor, **sem rodar nada**:
sem EXPLAIN, sem medir tempo, sem dado de produção. Cada item diz o que não foi confirmado. Caminhos relativos a
`api/src/main/java/br/com/treinos/api/`. Segurança, auth e LGPD ficaram fora do pedido.

Resumo: não há N+1 nem índice faltando nas rotas lidas. O custo está no volume de linhas de histórico e em desserializar
o JSON das versões de plano várias vezes por requisição.

| # | O quê | Onde | Tamanho | Ganho |
| --- | --- | --- | --- | --- |
| 1 | **Erro:** atividade recente do Início some com "Meus alunos" | `painel/PainelService.java` (`ultimasExecucoes`) | P | lista correta |
| 2 | `/painel` roda a mesma consulta de quatro joins duas vezes | `painel/PainelService.java` (`atualizacoes.contar` e `alunosComPastaVigente`) | P | metade do custo dessa parte |
| 3 | `GET /aluno/painel` lê o histórico inteiro e desserializa as mesmas versões mais de uma vez | `execucao/AlunoAppService.java`, `HistoricoService.java`, `recordes/RecordesService.java`, `anteriores/SeriesAnterioresService.java` | M | abertura do app do aluno deixa de crescer com o histórico |
| 4 | Recordes da semana carregam quase todo o histórico da consultoria | `recordes/RecordesDaSemanaService.java:80-91` | M | Início do treinador estável |
| 5 | Cache do `IndiceVersao` (versão publicada é imutável) | `execucao/IndicesDeVersao.java:36-52` | P a M | corta o parse de JSON dos itens 3 e 4 |
| 6 | Manutenção: `AlunoService` mistura lista e cadastro; duplicações pequenas | `alunos/AlunoService.java`, `recordes/` | P a M | revisão mais fácil |
| 7 | Lista de atualizações classifica tudo duas vezes e busca nome em Java | `atualizacoes/AtualizacaoService.java:273-328` | M | só acima de algumas centenas de alunos |
| 8 | Dividir o `AGENTS.md` (315 KB) | raiz | M | menos contexto por sessão, menos informação velha |

## 1. Atividade recente com "Meus alunos" (conferido no código pela sessão principal)
`ultimasExecucoes` busca `findTop300ByOrderByRecebidoEmDesc()`, as 300 séries mais recentes da consultoria inteira, e
só depois descarta as de quem não está no escopo (`porId`). O app manda `meus` para o painel
(`app/src/treinador/painel/useFontesDoPainel.ts:29`). Com vários treinadores, se os alunos dos outros registraram mais
de 300 séries depois dos alunos deste, a lista dele vem vazia ou incompleta.
Como corrigir: filtrar na consulta (`alunoId in :ids`, com o mesmo teto de 300); o índice `ix_exec_aluno_data` cobre.
Teste: integração com dois responsáveis, o segundo com mais de 300 séries recentes.
Hoje o Saraiva é um treinador só, então ninguém viu. Aparece no primeiro cliente com equipe.

## 2. Consulta repetida no `/painel`
`atualizacoes.contar(responsavelId)` e `alunosComPastaVigente(responsavelId)` chamam `linhasDoPainel` com o mesmo
parâmetro. Ler uma vez e tirar as duas respostas da mesma lista.
Não confirmado: se a tela ainda chama `/atualizacoes/contagens` em paralelo (seriam três leituras).

## 3. Pacote do aluno (`GET /aluno/painel`)
- `ultimasCargas` usa uma busca sem limite de data: traz todas as séries de trabalho de todos os exercícios do plano
  desde sempre e usa só o último dia de cada um. Usar o padrão que `SeriesAnterioresService` já usa: primeiro
  `max(data)` por exercício (`ExecucaoSerieRepository.java:54-57`), depois só as séries dessas datas.
- `recordes.doPacote` e `anteriores.doPacote` chamam `indices.carregar` cada um, para versões em boa parte iguais.
  Carregar uma vez no `painel` e passar o mapa.
- Os testes `RecordesNoPacoteIntegrationTest` e `AnterioresNoPacoteIntegrationTest` têm de continuar verdes.
É a rota que todo aluno chama ao abrir o app e ao sincronizar: é onde o ganho mais aparece para o usuário final.

## 4. Recordes da semana
A consulta dos "anteriores" pega alunos ativos do escopo × exercícios feitos na semana × todas as séries antigas, como
entidade, a cada leitura, e depois desserializa as versões. Os ids vão num `in` só, sem lotes.
Passo 1 (M): projeção agregada por (aluno, exercício, versão, série, carga) com `max(repeticoes)`; isso basta para a
maior carga, o maior volume e as repetições por carga que `RecordesPessoais.melhores` usa. Quebrar os ids em lotes, como
`AlunoService.lotesDeIds`. Passo 2 (G, só se precisar): guardar os melhores por aluno e exercício na sincronização.
O mesmo agregado serve ao perfil do colega (`comunidade/ColegasDaComunidadeService.java:164`), que tem um `shortcut:`
anotado. Reconferir a regra de empate com o `RecordesDaSemanaTest`.

## 5. Cache do `IndiceVersao`
Mapa limitado em memória, no estilo do cache do `CepService`. **A chave tem de ser (consultoriaId, versaoId)**, nunca
só a versão, e o cache só é preenchido depois da leitura feita dentro do tenant. Mexe em isolamento: pede revisão
independente antes de entrar. Fazer só depois dos itens 3 e 4, se ainda pesar.

## 6. Manutenção
- `AlunoService` (569 linhas): as linhas ~97 a 260 são o modelo de leitura da lista; o resto é cadastro. Corte por
  responsabilidade: `ListaDeAlunosService` ao lado de `FiltrosDaListaDeAlunos`.
- `simples(IndiceVersao, ExecucaoSerie, boolean)` está igual em `RecordesService.java:92` e
  `RecordesDaSemanaService.java:130`: levar para `IndiceVersao` ou `RecordesPessoais`.
- `dietaDe` e `mobilidadeDe` em `AlunoAppService.java:163-175` são quase iguais.
- `AgendaService` (819 linhas) parece juntar CRUD, recorrência, conflito de horário e o aviso de mudança; o corpo não
  foi lido, então o corte (`ConflitosDaAgenda`) é hipótese.
- Os serviços de plano em cima do `PlanoServiceBase` estão enxutos. Não mexer.

## 7. Pode esperar
Lista e contagens de atualizações (já têm `shortcut:`), e a lista de colegas da comunidade. Levar a busca e o
responsável para a consulta quando passar de algumas centenas de alunos ativos.

## 8. `AGENTS.md`
Com 315 KB, o arquivo não cabe numa leitura e já tem informação que se contradiz (a contagem de migrations aparece como
70 num trecho e 38 em outro). Proposta:
- **Raiz:** produto, "Regras que não podem ser quebradas", stack curta, fluxo (main, minutos do Actions, lote, push
  publica) e um índice "módulo → doc" com uma linha por módulo (chave de liga/desliga e caminho).
- **`api/AGENTS.md` novo** (o `app/AGENTS.md` já existe): equipe e permissões, auditoria, sessão, tenant, limites,
  qualidade, regra de migration.
- **Um doc por funcionalidade em `docs/`**, reaproveitando os que existem (`fotos.md`, `pagamentos-infinitepay.md`,
  `turnstile.md`, `integracao-central.md`). Histórico com data vai para `docs/planos/`.
- A lista de migrations sai do arquivo: a fonte é a pasta e o `FlywayMigrationIntegrationTest`.
- A regra "edite só aqui" vira "mudou a funcionalidade, atualize o doc do módulo", e o índice da raiz aponta para todos.
É mexer na instrução que o Codex e o Claude leem: fazer num PR só de documentação, com conferência de que nada sumiu.

## Ordem sugerida
1 e 2 juntos (só no `PainelService`, sem migration). Depois 3. Depois 4. O 5 só com revisão. O 8 quando houver uma
tarde livre: é o que mais barateia as próximas sessões.
