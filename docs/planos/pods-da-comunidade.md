# Pods da comunidade

Situação: Em andamento (API feita e revisada em 16/11/2026; telas em andamento) · Onde: main · Atualizado: 16/11/2026

Fonte: plano-trio (Arquiteto, Guardião e Enxuto) e mapa do explorador, leitura do código em 16/11/2026, base 1f33299d (HEAD atual b4b66332). Validade: vale enquanto `comunidade/` (`ComunidadeService.exigirPostVisivel`, `ReacoesDoMuralService`, `EnquetesDoMuralService`, `DenunciasDoMuralService`, `CapasDaComunidadeService`, `FotosDoMuralService`) e a anonimização/exportação não mudarem. A migration usa **V080 em diante** (V078 é da N2, V079 é a F3; Flyway sem out-of-order, então não anda em paralelo com outra frente de migration).

## Objetivo
Grupos pequenos ("pods") dentro da comunidade de uma consultoria: um mural próprio do grupo, que só os membros e a equipe veem. Quem cria e atribui é a equipe; a moderação é a de sempre (`COMUNIDADE_MODERAR`). Sem mensagem direta, sem convite por código, sem ranking do pod.

## O que existe hoje (conferido)
- Mural: `comunidade_mural_post` (V065/V068/V071), listagem em `ComunidadeService.listarMural` (`:228-265`) pela consulta `mural` (`ComunidadeMuralPostRepository.java:19-23`, tipo com sentinela `''`), criação em `criarPostMural` (`:285-369`, o post nasce sem pod).
- Guarda: `exigirPostVisivel` (`ComunidadeService.java:431`) só confere tenant e `oculto`. Quem passa por ela: listar e criar comentário (`:382`, `:396`) e fixar (`:418`).
- **Quem NÃO passa por ela** (usa `findById`/`travar`/`existsById` direto), todos com `postId`:
  - `ComunidadeService.moderarPost` (`:409`, só equipe), `moderarComentarioMural` (`:424`);
  - `ReacoesDoMuralService.reagir` e `desfazer` (`:38`, `:67`, via `exigir()` em `:74`);
  - `EnquetesDoMuralService.votar` (`:128`, `travar`, que nem olha `oculto`), `votos` (`:217`), `criarOpcoes` (`:112`, sem checagem; chamador não confirmado);
  - `DenunciasDoMuralService.denunciar` (`:42`) e `dispensar` (`:64`, só equipe);
  - `CapasDaComunidadeService.ligarAoPost`/`apagarDoPost` (`:114`, `:120`, sem checagem; chamador não confirmado) e `GET /capas/{id}` (checa o post dono só por `!oculto`, `:83-86`).
  - Foto do mural (`GET /mural/fotos/{id}`, `FotosDoMuralService.java:59-79`) usa o id da foto: **não conferido** se ela olha o post.
- Fila de moderação `soDenunciados` (`ComunidadeService:223-232`, `Repository:17-23`): lê a listagem do mural, só equipe.
- Exportação: `ExportacaoService:163-170` chama `comunidade.exportarDoAluno` só com `TREINO_LER`; DTOs em `ComunidadeDtos.java:294-310` (`PostExportado` sem `podId`).
- Anonimização: `AnonimizacaoService.java:189-194` (treinador) e `:128` (`anonimizarPeloProprioAluno`, usada por "Excluir minha conta", `ExclusaoDeContaService:70`) → `AnonimizacaoRepositorio.anonimizarComunidade` (`:49-61`, só recebe `usuarioId`).
- Inativar o aluno (`AlunoService.aplicarSituacao`, `:366-381`) **não toca a comunidade**: o que esconde o inativo é o filtro de colegas e o 401 da sessão.
- O app **não tem** `expo-updates`/EAS Update (`app.json`/`package.json`, grep; `eas.json` não localizado): mudança de tela no celular só chega com APK/build novo; a web chega no deploy.
- `app/src/comunidade/` tem 25 arquivos; rotas `app/src/app/aluno/comunidade.tsx` e `treinador/comunidade.tsx`.

## Desenho (síntese)
- **Pertencimento: `aluno.pod_id` (Enxuto) em vez de tabela `pod_membro` (Arquiteto, Guardião).** Tabela nova `comunidade_pod (id, consultoria_id, nome, criado_em)` com `UNIQUE (consultoria_id, id)`, nome único por consultoria. `aluno.pod_id uuid` com FK composta `(consultoria_id, pod_id) → comunidade_pod(consultoria_id, id)` e `ON DELETE SET NULL (pod_id)` (lista de colunas obrigatória: sem ela o SET NULL tentaria anular `consultoria_id`; exige PG 15+, o projeto usa o 18). **Um aluno em um pod só** (a unicidade vem de graça; virar N:N depois é uma migration simples, e não há legado a manter).
- **Mural do pod:** `comunidade_mural_post.pod_id uuid` nulo (nulo = mural geral), FK composta com **`ON DELETE RESTRICT`** (nunca SET NULL: o post privado do pod vazaria para o geral). Índice `(consultoria_id, pod_id, fixado, criado_em)`. Sem excluir pod na v1.
- **Quem cria e atribui:** só a equipe, com `COMUNIDADE_MODERAR` (sem permissão nova): `GET/POST/PUT /comunidade/pods` e `PUT /alunos/{id}/pod {podId|null}`. Só aluno com acesso (`usuario_id`) entra. Teto de 12 ativos por pod, travando a linha do pod antes de contar (409 `POD_CHEIO`).
- **Funil único por post (o ponto crítico):** `exigirPostVisivel(postId, eu)` passa a conferir o pod (equipe vê tudo; aluno só o geral ou o próprio pod, lido do banco a cada requisição; fora do pod = o mesmo 404 de post inexistente). A versão antiga **é apagada** para o compilador listar todos os chamadores, e **todo** serviço da lista acima (reação, enquete, votos, denúncia, capa, foto, fixar, moderação) passa a chamar o helper. Teste de matriz, um caminho por vez.
- **Mural em dois modos:** o geral filtra `pod_id is null`; o do pod filtra pelo pod do membro (aba "Meu grupo" no mural que já existe). A fila `soDenunciados` da equipe enxerga **todos** os pods e a resposta leva `podId`/`podNome` (senão a denúncia de pod some da moderação). JPQL com sentinela, não UUID nulo (o mesmo problema da consulta `mural`).
- **`criarPostMural`:** aceita `podId`; para o aluno ele tem de ser igual ao `aluno.pod_id` lido do banco, senão 404. `exigirQueAlunosPublicam` continua valendo.
- **Inativar e anonimizar:** inativar zera `aluno.pod_id` (libera a vaga; reativar não devolve, a equipe atribui de novo); anonimizar e "Excluir minha conta" também (no UPDATE do aluno que já existe, fora do "se tem usuário"; `anonimizarComunidade` só conhece o usuário).
- **Exportação:** `podId` em `PostExportado` e `comunidade.pod {nome}` (só o pod do próprio aluno; **nunca** a lista dos outros membros, que é dado de terceiro). Posts do aluno removido do pod continuam dele e continuam na exportação.
- **Lista de membros:** fica de fora da v1 (os nomes já aparecem nos posts; perfil reservado pesa contra). Se entrar, só nome e apelido, e nível/foto só de quem não reservou (`reservadoEfetivo`/`mostraTudo`, `ColegasDaComunidadeService:79-80,113-114`).
- **Auditoria** com resumo fixo, nunca o nome do pod nem do aluno: `POD_CRIADO`, `POD_ALTERADO`, `ALUNO_POD_ALTERADO` (espelho em `acoesAuditoria.ts`).
- **Nome do pod:** texto livre da equipe, strip, 2 a 40 caracteres, nunca em log nem em auditoria.

## Divergências do trio (resolvidas ou levadas às decisões)
- **`pod_membro` (Arquiteto, Guardião: N:N possível, `arquivado_em`, "sair do pod", seção `pods` na exportação, auditoria própria) × `aluno.pod_id` (Enxuto):** recomendo o do Enxuto. Cai de 8 para 4 passos e 2 commits de código; o custo é um pod por aluno, que o Arquiteto e o Guardião já recomendavam para a v1 (índice único). Arquivar pod, sair do pod e lista de membros ficam fora da v1; tirar o aluno é da equipe. Decisão 1.
- **Arquivar/excluir pod:** o Guardião previa arquivar apagando membros; o Enxuto deixa fora (com `RESTRICT` não há risco e pod vazio não faz mal). Recomendo deixar fora. Decisão 5.
- **Revisão:** o Gustavo pediu `revisao-trio` e o Guardião concorda (tenant, LGPD com menores, migration, autorização espalhada); o Enxuto não se opõe. Mantida.

## Riscos
**Bloqueantes** (o plano só vale com eles resolvidos):
- R1. Post de pod aparecer no mural geral (consulta sem filtro): filtro `pod_id is null` e teste.
- R2. Não-membro agir sobre o post pelo id que já viu: o funil único acima, e o teste de matriz cobrindo comentar, reagir, votar, ver votos, denunciar, foto, capa e fixar.
- R3. Aluno publicar no pod de outro: `podId` do corpo conferido contra o banco.
- R4. A fila de moderação deixar de ver os pods, ou vê-los sem saber de qual: `soDenunciados` sem filtro de pod e com `podNome`.
- R5. Corrida no teto de 12: travar o pod antes de contar.
- R6. Aluno que sai/inativa continuar ocupando vaga ou voltar sozinho ao pod: zerar `pod_id` nos dois caminhos.
- R7. Anonimização deixar o vínculo: zerar no UPDATE do aluno, fora do "se tem usuário".
- R8. Exportação expor outros membros ou omitir o pod do aluno.
- R9. `ON DELETE SET NULL` no post (vazaria o privado para o geral): usar `RESTRICT`.

**Aceitáveis:**
- Menor misturado com adultos: a decisão de 10/11 é que o menor reserva o perfil pelo botão, sem trava jurídica; não há mensagem direta; a equipe lê tudo e a denúncia cai na fila.
- Membro com perfil reservado dentro do pod: o post dele já mostra o nome; mitigado por não ter lista de membros na v1.
- Não conferido: foto do mural (`FotosDoMuralService`) e os chamadores de `criarOpcoes`/`ligarAoPost` (o passo 1 do executor os confere antes de editar); apelido do aluno na exportação da comunidade (`AGENTS.md` diz que sim, não vi no código).

## Decisões para o Gustavo
Recomendada primeiro.

| # | Pergunta | Opções |
| --- | --- | --- |
| 1 | Um aluno em quantos pods? | **(a) Um só, coluna `aluno.pod_id`, a equipe atribui (recomendada: 4 passos em vez de 8)**; (b) vários (tabela `pod_membro`, mais caro e mais um caminho a proteger) |
| 2 | Teto de membros por pod | **(a) 12 (recomendada, uma constante e uma contagem)**; (b) outro número; (c) sem teto |
| 3 | Pod com menor de idade e adulto no mesmo grupo | **(a) Permitir, com um aviso na tela de atribuir ("este grupo tem menor de idade"), sem bloquear (recomendada)**; (b) bloquear mistura; (c) pods separados por faixa |
| 4 | Os posts do pod aparecem também no mural geral? | **(a) Não, só na aba do grupo (recomendada)**; (b) sim, como resumo |
| 5 | Arquivar/excluir pod e o aluno sair sozinho | **(a) Fora da v1: quem tira é a equipe (recomendada)**; (b) arquivar pod e botão "Sair do grupo" para o aluno |
| 6 | O que inativar e reativar fazem com o pod | **(a) Inativar tira o aluno do pod; reativar não devolve, a equipe atribui (recomendada)**; (b) manter o vínculo |
| 7 | O que mais acontece dentro do pod | **(a) Só o mural: posts, comentários, reações, enquete e denúncia pelo mesmo funil (recomendada)**; (b) também aulões e ranking do pod |
| 8 | Lista de membros visível ao aluno | **(a) Fora da v1 (recomendada: perfil reservado)**; (b) só nome e apelido |

## Passos (depois das respostas)
- [ ] 0. Este plano e a entrada no README — commit: este plano já existia em `docs/planos` (ver `git log`)
- [x] 1. API (`executor`, PR próprio por causa da migration; revisão `revisao-trio`): V080 (`comunidade_pod`, `aluno.pod_id`, `comunidade_mural_post.pod_id`, índice e FKs), entidades, `exigirPostVisivel(postId, eu)` único e todos os serviços da lista passando por ele (confere antes `criarOpcoes`, `ligarAoPost` e `FotosDoMuralService`), mural em dois modos, `soDenunciados` sem filtro de pod, `criarPostMural` com `podId` conferido, gestão `GET/POST/PUT /comunidade/pods` e `PUT /alunos/{id}/pod` com teto travado, inativar/anonimizar zerando o pod, exportação (`podId` e `comunidade.pod`), auditoria, totais de migrations em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`, `AGENTS.md`. Testes (`PodsIntegrationTest`): matriz de 404 para não-membro em cada caminho com `postId`; membro lê e publica, `podId` alheio dá 404; outra consultoria 404; 13º membro 409 também com duas transações; 403 sem `COMUNIDADE_MODERAR`; denúncia de pod aparece na fila; inativar e anonimizar zeram o pod; exportação traz `podId` e nenhum outro membro; post do pod não aparece no mural geral — commit: — — FEITO em 16/11: V082 (não V080), `PodsIntegrationTest` 20 testes, lote `comunidade.*` 186 testes, `ArquiteturaTest`, Flyway e Papéis verdes; revisão independente (revisor único, sem bloqueante): corrigidos o 404 de foto/capa sem oráculo, trava e ordem em `PodsService.atribuir`/voto de enquete, dispensar denúncia de oculto 204 e `NO ACTION` no post do pod; decisões do Gustavo abertas: `ALUNO_LER` em `PUT /alunos/{id}/pod` e collation do nome — commit: ver `git log` ("Pods da comunidade: API")
- [ ] 2. App, regra pura (`executor`): `podId` em `FiltroDoMural`/`filtrosParaApi`/`chipsDoMural` e em `CriarPostRequest`/`postParaEnviar` (`dominio/comunidade.ts`), com teste; `acoesAuditoria.ts` — commit: —
- [ ] 3. Telas (`executor-front`): aluno com aba "Meu grupo" (só se tiver pod, sem tela nova); treinador com filtro "Grupo" no mural e Folha "Grupos" para criar, renomear e atribuir, com o aviso de menor; um e2e em 390 e 1280 — commit: —
- [ ] 4. Revisão independente (`revisao-trio`), Ajuda e `AGENTS.md` — commit: —
- APK: o app não tem EAS Update; a aba do aluno só chega ao celular com build novo (a web, no deploy).

## Fora do escopo
Aluno criar pod, pod com a equipe como membro, convite por código, mensagem direta, push do pod, ranking do pod, aulões dentro do pod, excluir/arquivar pod, lista de membros, aluno em vários pods.

## O que ficou para trás
- Não conferido: `FotosDoMuralService` (se a foto olha o post), chamadores de `criarOpcoes` e `ligarAoPost`, corpo dos controllers, componentes de tela, testes existentes da comunidade.
