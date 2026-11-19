# Comunidade: playlists de vídeos e ajustes

Situação: Em andamento em 18/11/2026: passos 4 a 10 feitos (commits `57c01924` a `c9364b2d`); C36 e C25 só a API, sem commit; C39 (abas) sem commit; passo 11 (Ajuda e AGENTS.md) feito por outro agente, sem commit; passo 12 pendente; sem push · Onde: main · Atualizado: 18/11/2026

Fonte: pedidos da reunião de 15/11 (IDs R1115-Cxx) e leitura do código em 16/11/2026. Validade: vale enquanto `ComunidadeAula`, `dominio/comunidade.ts` e `aluno/_layout.tsx` não mudarem; se mudarem, refazer "Conferido no código".

## Objetivo
O treinador do piloto tem um canal de vídeos e quer organizar os aulões do app como playlists: criar a playlist fora do formulário do vídeo (até vazia), ter um botão "Playlists" à vista, pôr vários vídeos de uma vez e, para o aluno, abrir a playlist e ver os vídeos numerados e em ordem. Hoje "categoria" é só um texto dentro de cada aulão.
Ao fim: o treinador cria e organiza playlists numa tela própria, o aluno navega por elas, o cartão sem capa deixa de parecer em branco e a barra do aluno diz "Comunidade" em vez de "Time".
Duas etapas, em PRs separados se convier: a Etapa 1 (passos 1 a 3, pequena) não depende da Etapa 2.

## Conferido no código (16/11/2026)
- Confirmado: `rotuloCurto: 'Time'` em `app/src/app/aluno/_layout.tsx:30`; teste do rótulo em `app/e2e/comunidade.spec.ts:1697-1706`; quadro sem capa com `superficie2` em `app/src/comunidade/CapaDoVideo.tsx:40`; coluna `categoria` em `api/.../comunidade/ComunidadeAula.java:31`; funções de categoria em `app/src/dominio/comunidade.ts:474-475,552` (`AULA_CATEGORIA_MAXIMA`, `SEM_CATEGORIA_DO_AULAO`, `agruparAuloesPorCategoria`); botão "Novo aulão" em `app/src/app/treinador/comunidade.tsx:207` e "Fixar no topo" em `:324`; `aluno/ColecoesDeAuloes.tsx` e `treinador/comunidade/FolhaDoAulao.tsx` existem; não há `expo-updates` em `app/package.json` nem `app/app.json` (grep sem resultado).
- Mudou desde o rascunho: a última migration no repositório é a **V079** (`V079__vitrine_marketplace.sql`; o rascunho dizia V074). O número desta frente é "V080 em diante, em fila", conferido na `main` na hora de escrever.
- **Não conferido** (linhas do rascunho, base antiga): `ComunidadeService.java:116-126,198,538`, `ComunidadeAulaRepository.java:8-9`, `dto/ComunidadeDtos.java:16-37`, `ComunidadeController.java:56-74`, `CapasDaComunidadeService.POR_DIA`, `CapaDoVideo.tsx:74,90`, `FolhaDoAulao.tsx:106-113`, `treinador/comunidade.tsx:233-284,321,344`, `ui/Navegacao.tsx:202`, `dominio/gruposDoMenu.ts:26-28`, `ajuda/conteudo.ts` (linhas citadas), `AGENTS.md` (linhas de Comunidade), `docs/build-celular.md:13-14`, `auth/TurnstileCliente`/`cep/CepCliente` como modelo de cliente de saída, o que `SeedDemo` cria, e a versão do PostgreSQL de produção (`ON DELETE SET NULL (coluna)` pede 15 ou mais).

## Itens da reunião cobertos
| ID | Pedido | Situação hoje | Tipo de mudança | Passo |
| --- | --- | --- | --- | --- |
| R1115-C24 | Cartão do aulão aparece em branco para o aluno | Parcial (causa é hipótese, não confirmada) | apresentação | 2 |
| R1115-C25 | Capa do vídeo que é link do YouTube | Para decidir | contrato leve + segurança (se opção a) | 14 |
| R1115-C27 | Filtro por categoria "estilo playlist" | Feito como playlist (o filtro do treinador fica, agora por playlist) | apresentação | 7, 8 |
| R1115-C28 | Criar playlist fora do formulário, inclusive vazia | Falta | contrato (migration, API) | 4 a 8 |
| R1115-C29 | Botão "Playlists" bem visível na aba de aulões | Falta | apresentação | 8 |
| R1115-C30 | O aluno vê e navega pelas playlists | Parcial (hoje só coleções por texto e busca) | apresentação | 10 |
| R1115-C31 | Pôr vários vídeos numa playlist de uma vez | Falta | contrato (rota de lote) + apresentação | 4, 9 |
| R1115-C32 | Playlist aberta com vídeos numerados e em ordem | Falta | contrato (ordem por playlist) + apresentação | 4, 7, 9, 10 |
| R1115-C33 | Novo nome para "Aulão" (e "Playlists" × "Categorias") | Para decidir | texto | 13 |
| R1115-C35 | "Ver como aluno" na Comunidade | Para decidir | apresentação | 15 |
| R1115-C36 | Imagem no mural (hoje só do aluno) | Parcial | contrato leve | 17 |
| R1115-C38 | Fixar publicação do treinador no mural | Feito (⋯ da publicação > "Fixar no topo") | — | 3 |
| R1115-C39 | Separar mural do treinador e dos alunos | Feito sem commit (D22: abas Avisos e Alunos, 17/11) | apresentação | 16 |
| R1115-C40 | "Time" por "Comunidade" na barra do aluno | Falta | texto | 1 |

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Etapa 1 pode sair sozinha, antes da Etapa 2 | C40, C24 e o aviso do C38 num PR pequeno | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D2 | A playlist **substitui** a categoria de texto, sem conviver | Coluna `categoria` sai de `comunidade_aula`; aulões já cadastrados ficam "Sem playlist"; sem migração de texto | Regra do projeto (`AGENTS.md`: sem compatibilidade até o primeiro cliente real) |
| D3 | Modelo | Tabela própria com nome e ordem, CRUD, aula ligada por `playlist_id` | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D4 | Ordem dos vídeos | **Dentro da playlist**, definida pelo treinador (Subir/Descer); `comunidade_aula.ordem` passa a valer por playlist | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D5 | Lote | Rota para pôr vários aulões numa playlist de uma vez, modo "selecionar" na tela do treinador | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D6 | Botão "Playlists" na aba de aulões do treinador, ao lado de "Novo aulão"; o aluno vê a lista de playlists e os vídeos numerados | Sem botão "Próximo" (não foi pedido) | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D7 | Aluno navega por playlists (cartões) e mantém a busca; botão "Filtros" para o aluno só se o pedido voltar | Sem Filtros do aluno nesta frente | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D8 | Permissão e isolamento | Escrever com `COMUNIDADE_MODERAR`, ler com `TREINO_LER`; aluno só lê; 404 uniforme quando a aula é de outra consultoria | Regra do projeto (`AGENTS.md`, regras de isolamento e item da Comunidade) |
| D9 | C38 | Nada a construir; só avisar o treinador onde fica | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D10 | C40 | Troca só o rótulo da aba; os textos "do time" (equipe) ficam | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D11 | C25, capa do link do YouTube: opção **(b)**, manter só capa por arquivo (custo zero; o quadro do passo 2 já cobre) e `img-src` da CSP não muda. A (servidor baixa a miniatura) obriga a emendar "nunca imagem de fora" do `AGENTS.md` e do javadoc de `CapasDaComunidadeService`; C (relaxar `img-src`) faz o aluno falar com o Google | Passo 14 só entra se o Gustavo escolher (a) | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D12 | C33, nome novo: "Vídeos" no lugar de "Aulão" e "Playlists" no lugar de "Categorias", num commit só de texto, depois da Etapa 2 | Passo 13; o nome final é do Gustavo com o treinador. O `AGENTS.md` não tem regra de "PR próprio" para rótulo de funcionalidade (só nome do produto e Ajuda/PDF) | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D13 | C36, imagem no mural pela equipe: **não liberar agora**; avisar que a imagem é do aluno adulto com a chave ligada | Passo 17 não entra | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D14 | C35, "Ver como o aluno" na Comunidade: só se o pedido voltar (o botão já existe no editor de treino e dieta) | Passo 15 não entra | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D15 | C39, filtro de autor no mural: só se o pedido voltar (sem resposta na reunião) | Passo 16 não entra | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D16 | Playlist vazia não aparece para o aluno (nunca abre um cartão vazio); trocar é uma linha no passo 4 | `totalAulas` só de aulões publicados | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D17 | O formulário do aulão só **escolhe** playlist existente (não cria); criar é só na tela de playlists | O pedido é criar fora do formulário | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D18 | Deploy: API e web saem juntas (sem compatibilidade); um APK antigo contra a API nova é hipótese, não conferida, de mostrar tudo "Sem playlist" | Sem `expo-updates`: APK novo para o teste | Regra do projeto (sem legado) |
| D19 | **Revisão de 17/11/2026 (Saraiva e Gustavo), valem sobre D11, D12, D13 e D15:** C33/C86, na tela "Aulão" vira **"Vídeos"** e "Playlists" vira **"Coleções"**; identificadores no código não mudam (passo 13, `executor-rapido`, Onda 4 da sessão de 17/11, depois do C24 e do C36/C39) | Saraiva, 17/11 |
| D20 | C25 (substitui D11): botão "Usar a capa do YouTube" só quando o link é do YouTube; o servidor extrai o id (11 caracteres `[A-Za-z0-9_-]`, recusa o resto) e baixa só de `https://i.ytimg.com/vi/<id>/hqdefault.jpg` (host fixo, nunca URL do cliente); 3 s de conexão, 4 s de resposta, sem redirecionamento, até 300 KB; passa por `JpegSemMetadados` e vira `comunidade_capa` normal, no mesmo teto diário; falha = 503 neutro; só o id do vídeo sai do servidor. Revisão independente de SSRF, tamanho e tempo | Gustavo, 17/11 |
| D21 | C36 (substitui D13): a equipe (`COMUNIDADE_MODERAR`) anexa de 0 a 4 fotos no post do mural, mesmas regras da foto do aluno (JPEG regravado, 1600 px, 300 KB, teto diário, limpeza das órfãs); se `comunidade_mural_foto` não aceitar autor da equipe, migration **V085** e a N2 do contato vai para V086; exportação e anonimização não mudam | Gustavo, 17/11 |
| D22 | C39 (substitui D15): o mural ganha duas abas, **Avisos** (AVISO, VIDEO, ENQUETE) e **Alunos** (CONVERSA, DUVIDA, RESULTADO), para equipe e aluno; só o filtro por tipo que a API já aceita, sem migration; fixados aparecem na aba do tipo; aba no endereço (`?mural=avisos\|alunos`); aluno com grupo mantém Geral/Meu grupo e as abas valem dentro de cada um | Gustavo, 17/11 |
| D23 | C24: reproduzir primeiro com teste (systematic-debugging); se não reproduzir, dizer isso e não inventar correção | Gustavo, 17/11 |
| D24 | **C24 não reproduziu nos testes** (sessão de 17/11/2026, commit `7dd4eb01`: só três testes novos em `CapaDoVideo.test.tsx`, sem correção inventada). O **Gustavo vai conferir à mão no aparelho**; até lá fica em "Pendências soltas" do README, responsável Gustavo | Gustavo, 17/11 |
| D25 | Em aberto (18/11/2026): o número do vídeo do treinador conta os não publicados? Os grupos do treinador ficam sempre abertos? | Sem valor até o Gustavo decidir | Gustavo, a decidir |

## Passos
### Etapa 1 (PR pequeno, pode sair antes)
- [ ] 1. C40 "Time" vira "Comunidade" na barra do aluno — executor: sessão principal · tamanho: P · migration: não · APK: sim para conferir no celular (só JS; sem `expo-updates`) · API: nenhuma · commit: —
  - `app/src/app/aluno/_layout.tsx:30`: tirar `rotuloCurto: 'Time'` (sem o campo, rótulo e nome acessível passam a "Comunidade"; `ui/Navegacao.tsx` e `gruposDoMenu.ts` não reconferidos).
  - **Conferir a 390 px com captura**: a barra tem 6 itens e o comentário do rascunho diz que cerca de 10 letras cabem; "Comunidade" tem exatamente 10. Se cortar, ajustar o rótulo da barra inferior em `ui/Navegacao.tsx`, peça compartilhada com o treinador no celular: conferir as duas barras.
  - Reescrever `app/e2e/comunidade.spec.ts:1697-1706` (procura "Time (Comunidade)" e o texto "Time"); ajustar a Ajuda (`ajuda/conteudo.ts`, onde fala "Time"). Conferir se os guias `app/public/guias/*.pdf` citam "Time"; se citarem, `node scripts/guias/gerar.mjs`.
- [ ] 2. C24 quadro visível no cartão sem capa — executor: executor-front · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `app/src/comunidade/CapaDoVideo.tsx:40`: o quadro sem capa usa `superficie2`, quase igual ao cartão branco no tema claro. Dar fundo de superfície mais forte (token existente, sem token novo), borda visível, ícone de play maior no centro e título em até 2 linhas; a pílula "Assistir aqui" fica. Neutro, sem cor de marca.
  - A falha ao baixar a capa também cai em quadro vazio: levantar o estado "capa carregou" (linhas do rascunho não reconferidas).
  - **Peça compartilhada**: o quadro muda nos 3 usos (`aluno/ColecoesDeAuloes.tsx`, `app/treinador/comunidade.tsx`, `comunidade/CartaoDoPost.tsx`); conferir os três, claro e escuro, 390 e 1280 px. Testes: `CapaDoVideo.test.tsx` e capturas no `comunidade.spec.ts`.
  - **Causa por confirmar (hipótese)**: o aulão visto estava sem capa. Confirmar na conta de aluno de teste, tema claro, com um aulão sem capa e outro com capa, conferindo se `capaId` vem vazio em `GET /aluno/comunidade/aulas`.
- [ ] 3. C38 avisar que fixar já existe — executor: Gustavo · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Mensagem ao treinador: na Comunidade, aba Mural, o ⋯ da publicação tem "Fixar no topo" / "Desafixar" (`treinador/comunidade.tsx:324`).

### Etapa 2 (playlists; duas sessões: passos 4 a 6 e passos 7 a 12)
- [x] 4. Contrato: tabela de playlist, aula ligada a ela, rotas e DTOs — executor: executor · tamanho: G · migration: sim, **V080 em diante, em fila** (confirmar o número livre na `main` antes de criar) · APK: não (mas o APK de teste só vale com o app novo) · API: sim, este passo cria o contrato · commit: 57c01924 (18/11/2026)
  - Tabela `comunidade_playlist` (`id`, `consultoria_id` com `ON DELETE CASCADE`, `nome` até 60, `ordem`, datas), `UNIQUE (consultoria_id, id)` e índice único `(consultoria_id, lower(nome))`. Em `comunidade_aula`: `DROP COLUMN categoria`, `ADD COLUMN playlist_id` e FK **composta** `(consultoria_id, playlist_id)` com `ON DELETE SET NULL (playlist_id)` (só a coluna, a simples anularia `consultoria_id`), no padrão da V068. Excluir a playlist deixa os aulões "Sem playlist", nunca os apaga. O índice de ordem da V065 passa a cobrir `playlist_id`.
  - Entidade `ComunidadePlaylist` com `@TenantId` e repositório (`ArquiteturaTest`); lote usa `findAllById` e compara a contagem. Duas consultas de ordem global no repositório de aulas precisam de revisão, pois `ordem` deixa de ser global.
  - DTOs: `CriarAulaRequest` perde `categoria` e `ordem` e ganha `playlistId`; `AulaResumo` perde `categoria` e ganha `playlistId` (`ordem` vira a posição na playlist). Novos: pedido de playlist (`nome`), resumo (`id`, `nome`, `ordem`, `totalAulas`), pedido de ordem (lista de ids, com teto) e pedido de lote (`aulaIds` de 1 a 100 e `playlistId`, que pode ser nulo para tirar da playlist).
  - Service: aulão novo ou movido vai para o **fim** da playlist (`ordem` = maior + 1); editar sem trocar de playlist mantém a posição. `playlistId` inválido ou de outra consultoria no corpo do aulão = 422 no campo; nas rotas com id na URL e no lote, 404 uniforme (mesma mensagem para "não existe" e "é de outra consultoria").
  - Rotas, todas com `@PreAuthorize` (escrita `PERM_COMUNIDADE_MODERAR`, leitura `PERM_TREINO_LER`): `GET/POST /comunidade/playlists`, `PUT/DELETE /comunidade/playlists/{id}`, `PUT /comunidade/playlists/ordem`, `PUT /comunidade/playlists/{id}/aulas/ordem` e `PUT /comunidade/aulas/playlist` (lote). Aluno: `GET /aluno/comunidade/playlists` (`hasRole('ALUNO')`, só as com vídeo publicado) e `GET /aluno/comunidade/aulas` passa a trazer `playlistId`. Modelo de CRUD de coleção a copiar: `receitas/PastaModeloController` e `PastaModeloService` (não conferidos neste dia).
  - Reordenar e lote travam a(s) linha(s) da playlist (`PESSIMISTIC_WRITE`); `ordem` não é UNIQUE. Fora da exportação e da anonimização do aluno (aulão é conteúdo da equipe; só comentário entra).
  - Testes: `ComunidadeIntegrationTest` (CRUD; duas consultorias com 404 em alterar, excluir, ordenar e lote; 403 sem `COMUNIDADE_MODERAR`; aluno não vê playlist vazia nem aulão não publicado; reescrever o teste de ordenação), `ComunidadeServiceTest` (troca o teste de `categoriaLimpa`), teste de migration no modelo de `migration/ComunidadeEnquetesMigrationTest` (coluna sumiu, FK composta barra playlist de outra consultoria, apagar a playlist zera `playlist_id`).
- [x] 5. Totais de migration e espelhos do `AGENTS.md` — executor: executor-rapido (sessão principal revisa o diff) · tamanho: P · migration: não (só contagem) · APK: não · API: nenhuma · commit: 57c01924 (18/11/2026)
  - `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` (total e comentário), lista de migrations e o item da Comunidade no `AGENTS.md` (passa a falar de playlist, não de categoria).
- [x] 6. Revisão independente do contrato — executor: advisor ou `revisor` (um revisor só, risco concentrado) · tamanho: P · migration: não · APK: não · API: revisão do passo 4 · commit: 97662fcf (18/11/2026)
  - Entregar migration, DTOs, service, controllers e testes. Pontos: isolamento por consultoria (FK composta, 404 uniforme, lote), permissão por rota, `ON DELETE SET NULL (coluna)` na versão do PostgreSQL usada, corrida de ordem. Só segue para o app com o ok.
- [x] 7. Regra pura, tipos e chamadas da API no app — executor: executor · tamanho: M · migration: não · APK: não · API: depende do passo 4 (contrato já revisado) · commit: c025f395 (18/11/2026)
  - `app/src/dominio/comunidade.ts`: saem as funções de categoria (`:474-556`); entram aulões de uma playlist em ordem, número de cada vídeo, mover para cima ou para baixo (devolve a nova lista de ids; nos extremos não muda), opções do filtro do treinador por playlist (Todas, cada playlist com contagem, Sem playlist). `rascunhoDaAula` e `corpoDaAula` trocam categoria por `playlistId` e deixam de mandar `ordem`.
  - Tipos espelhados em `app/src/api/comunidadeTipos.ts` (mais o tipo da playlist) e chamadas novas em `app/src/api/comunidade.ts`. Regra e teste vêm antes das telas. Reescrever `dominio/comunidade.test.ts` e o helper `aula(...)` de `app/e2e/filtros-laterais-fase-c.spec.ts`.
- [x] 8. Treinador: botão "Playlists", tela das playlists e formulário do aulão — executor: executor-front · tamanho: G · migration: não · APK: não · API: depende do passo 4 · commit: 0d17a2b2 (18/11/2026)
  - Na aba Aulões (`treinador/comunidade.tsx:207`), "Playlists" (secundário, ícone da lucide) ao lado de "Novo aulão" (primário), como a aba Mural já faz com dois botões. Conferir a 390 px.
  - Folha ou tela das playlists em `ListaDeLinhas`/`LinhaDaLista`: criar (nome até 60, vazia é válida), renomear, excluir (`PainelConfirmacao`, dizendo quantos vídeos ficam "Sem playlist"), Subir/Descer das playlists e abrir uma para ver os vídeos em ordem, com Subir/Descer por vídeo (nome acessível "Subir {título}"). Estados vazio, carregando, erro e 404. Nada de `alert`/`confirm`.
  - `FolhaDoAulao.tsx`: o campo de categoria vira escolha de playlist existente (ou "Sem playlist"); sem nenhuma, texto "Crie em Playlists". Filtro e selo do cartão passam a usar a playlist. Reescrever os trechos de categoria de `app/e2e/comunidade.spec.ts`.
- [x] 9. Treinador: lote e ordem dos vídeos — executor: executor-front · tamanho: M · migration: não · APK: não · API: depende do passo 4 (rota de lote e de ordem) · commit: 0d17a2b2 (18/11/2026)
  - Modo "Selecionar" na aba Aulões (caixa em cada vídeo, contador, barra "Mover para playlist…" e "Tirar da playlist"); padrão a copiar: `treinador/AcoesEmLote.tsx` e o modo selecionar de `app/treinador/alunos/index.tsx` (não reconferidos). Dentro de uma playlist aberta, "Adicionar vídeos" (selecionar entre os que estão fora dela) usa a mesma rota de lote. Falha de rede volta a ordem anterior na tela.
- [x] 10. Aluno: playlists e playlist aberta numerada — executor: executor-front · tamanho: M · migration: não · APK: não · API: depende de `GET /aluno/comunidade/playlists` (passo 4) · commit: c9364b2d (18/11/2026)
  - Substitui `aluno/ColecoesDeAuloes.tsx`. A aba Aulões mostra a busca (mantida) e um cartão por playlist (nome e "N vídeos"; "Sem playlist" por último, só se houver). Tocar abre a playlist com os vídeos **numerados e em ordem** ("1. Título"), cada um com `CapaDoVideo` e comentários como hoje. O voltar do aparelho fecha a playlist sem sair da Comunidade. A busca procura em todos os vídeos e mostra o nome da playlist de cada um. Comunidade do aluno é online: sem fila offline. Claro e escuro, 390 e 1280 px.
- [ ] 11. Ajuda, guias em PDF, e2e que sobrou e `AGENTS.md` — executor: sessão principal (texto) com executor-rapido para o gerador · tamanho: P · migration: não · APK: não · API: nenhuma · commit: — (sem commit, estado local em 18/11/2026; Ajuda e AGENTS.md feitos agora por outro agente)
  - `app/src/ajuda/conteudo.ts`: trocar "categoria" por "playlist" e explicar o botão Playlists, o lote e a ordem; `ajuda/conteudo.test.ts` e `e2e/ajuda.spec.ts` se travarem termos. Gerar os guias uma vez no fim: `node scripts/guias/gerar.mjs`.
  - `AGENTS.md` (item da Comunidade ou de vídeo) diz que a CSP de produção ainda não tem o `frame-src` do YouTube, mas o `docs/planos/README.md` registra que já está em produção desde 13/11: corrigir a frase junto (linha não reconferida).
- [ ] 12. Revisão do diff e conferência final — executor: revisor (diff) e Gustavo (teste) · tamanho: P · migration: não · APK: sim (APK novo para conferir) · API: `mvn verify` · commit: —
  - `mvn verify` em `api/`, `npm run typecheck && npm run lint && npm test` em `app/`, e2e de `comunidade.spec.ts`, `filtros-laterais-fase-c.spec.ts` e `ajuda.spec.ts` (saída grande ao executor-rapido filtrar).

### Etapa 3 (opcionais, só com a decisão correspondente)
- [ ] 13. C33 trocar "Aulão" e "Categorias" pelo nome escolhido — executor: executor-rapido · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Só depois do passo 12 e do nome decidido (D12), num commit de texto à parte. Telas do aluno e do treinador, `FolhaDoAulao`, `FolhaComentarios`, `CampoDaCapa`, `CapaDoVideo`, `dominio/comunidade.ts` (`resumoDosAuloes`), Ajuda, e2e (seletores por texto) e guias PDF. Identificadores (`auloes`, `aula` da API) não aparecem ao usuário e ficam.
- [ ] 14. C25 capa automática do YouTube, só se o Gustavo escolher (a) — executor: executor (com o revisor do passo 6 de novo, por ser saída de rede) · tamanho: M · migration: não · APK: não · API: contrato leve (sem DTO novo) · commit: —
  - Ao criar ou editar aulão com link do YouTube e sem capa, o servidor baixa a miniatura e a grava como capa no mesmo armazenamento, pela mesma limpeza do envio manual. Host fixo (hipótese `i.ytimg.com`, conferir na hora), sem seguir redirecionamento, 3 s de conexão e de leitura, teto de bytes, só `image/jpeg`; o id do YouTube precisa de versão no servidor (hoje a regra mora só no app). Falha de rede = aulão salva sem capa. Buscar antes de abrir a escrita no banco. Emendar `AGENTS.md` ("nunca imagem de fora"), o javadoc de `CapasDaComunidadeService` e a D7 de `docs/planos/comunidade-enquetes-reacoes-video.md`. Cota diária de capas não deve ser gasta pela capa automática. Testes com cliente falso (nada de rede real no CI).
  - **C25 API feito (sem commit)** (17/11/2026, D20 substitui o texto acima): `POST /comunidade/capas/youtube` `{videoUrl}` → 200 `{id}` (`CapaDoYoutubeController`, `PERM_COMUNIDADE_MODERAR`), no lugar de buscar ao criar o aulão; o app liga o `capaId` como já faz. Id por `IdDoYoutube` (mesma regra de `idDoYoutube` do app; 422 `CAPA_INVALIDA` em `videoUrl`), download só de `https://i.ytimg.com/vi/<id>/hqdefault.jpg` por `YoutubeCapaCliente` (3 s/4 s, sem redirecionamento, sem proxy, 300 KB lidos com limite, 200 + `image/jpeg` + assinatura), falha = 503 `CAPA_YOUTUBE_INDISPONIVEL` neutro. **Cota: no mesmo teto de 100/dia, gasta ANTES do download e não devolvida se ele falhar** (`CapasDaComunidadeService.reservarVaga` e `gravarComVagaReservada`; a capa automática, ao contrário do que o parágrafo acima dizia, gasta cota, por decisão do pedido de 17/11). Testes: `IdDoYoutubeTest`, `YoutubeCapaClienteTest`, `CapaDoYoutubeIntegrationTest`. Falta: app (outro agente), revisão independente de SSRF/tamanho/tempo e o texto do `AGENTS.md` (item da Comunidade e da regra de "nunca imagem de fora").
- [ ] 15. C35 "Ver como o aluno" na Comunidade do treinador — executor: executor-front · tamanho: P a M · migration: não · APK: não · API: nenhuma · commit: — (só se D14 mudar)
- [x] 16. C39 filtro de autor no mural — executor: executor (parâmetro) + executor-front (chips "Do treinador | Dos alunos") · tamanho: P a M · migration: não · APK: não · API: parâmetro de consulta `autor` em `GET /mural` (contrato leve) · commit: — (não entra: a D22 substituiu a D15 com as abas Avisos e Alunos, feitas em 17/11 e ainda sem commit; o filtro `autor` não foi feito)
  - **C39 feito (sem commit)**, 17/11/2026, pela D22 (executor-front), sem API nem migration: abas **Avisos | Alunos** (`Escolha` segmentada, `descricao` "Publicações", na largura da coluna) no mural da equipe e do aluno; regra pura em `app/src/dominio/muralEmAbas.ts` (+ `muralEmAbas.test.ts`). A API aceita **um** `tipo` por chamada (`ComunidadeService.filtroDeTipo`), então cada aba faz uma chamada por tipo e junta por `fixado desc, criadoEm desc, id desc`, cortando em 50 (`carregarMuralDaAba`, `shortcut:` até a API aceitar `tipo` repetível); o chip de tipo faz uma chamada só e lista só os tipos da aba. Endereço: `?mural=avisos|alunos` (padrão e valor desconhecido = Avisos); o grupo do aluno saiu de `?mural=grupo` para `?grupo=meu` (sem compatibilidade com o endereço antigo). A folha da equipe abre em Aviso na aba Avisos e em Conversa na Alunos (só com o rascunho intocado); publicar um tipo da outra aba leva a tela para ela. Vazio por aba ("Nenhum aviso, vídeo ou enquete ainda." / "Nenhuma conversa, dúvida ou resultado ainda.", com o grupo; "Só denunciadas" diz a aba). Equipe com `comFotos` ligado (a regra é do App-1). E2e ajustados (não rodados, Onda 5): `comunidade.spec.ts`, `pods-da-comunidade.spec.ts`, `filtros-laterais-fase-c.spec.ts`.
- [ ] 17. C36 imagem no mural pela equipe — executor: executor (regra) + sessão principal (flag) · tamanho: P a M · migration: não · APK: não · API: contrato leve · commit: — (só se D13 mudar; a regra que protege o menor de idade não pode afrouxar)
  - **C36 API feito (sem commit), 17/11/2026, sem migration** (`autor_id` tem FK para `usuario`, que já aceita a equipe): `POST` e `DELETE /comunidade/mural/fotos` (`COMUNIDADE_MODERAR`), `fotoIds` (0 a 4) no `POST /comunidade/mural`, `GET /comunidade/mural/fotos/{id}` lê também a própria pendente (prévia); fotos do mural não dependem de `TREINOS_FOTOS_HABILITADO` (moram no banco, como as do aluno); enquete não leva foto. Testes: `FotosDoMuralDaEquipeIntegrationTest`. **Falta o app** (`dominio/comunidade.ts` ainda diz "A equipe não anexa fotos.") e a Ajuda.

## Critérios de aceite
- Barra do aluno diz "Comunidade" em 390 e 1280 px, sem corte; a barra do treinador no celular continua inteira.
- Cartão de aulão sem capa mostra quadro visível (borda, fundo, ícone e título) no claro e no escuro, nos 3 usos; vídeo com capa não mudou.
- O treinador cria uma playlist **vazia**, renomeia, reordena, exclui (os vídeos ficam "Sem playlist") e escolhe a playlist no formulário do aulão.
- O treinador marca vários vídeos de uma vez e os move para uma playlist (ou tira de uma), sem recarregar a página.
- O treinador reordena os vídeos dentro da playlist e o aluno vê a **mesma ordem**, numerada; a playlist sem vídeo publicado não aparece para o aluno (D16).
- Outra consultoria nunca vê nem altera playlist ou aulão (404 uniforme, teste de integração); sem `COMUNIDADE_MODERAR` ninguém escreve.
- Conferido a 390 px e a 1280 px, web e APK novo, claro e escuro, com capturas e dados fictícios.
- `mvn verify` e testes do app verdes; e2e de comunidade, filtros e ajuda verdes; guias em PDF regerados.
- O treinador diz "resolvido" quando cria uma playlist sem vídeo, põe vários vídeos nela de uma vez, vê na conta de aluno de teste os vídeos numerados e em ordem, e a barra diz "Comunidade".

## Riscos e revisão
- **Pede revisão independente (passo 6)**: migration que troca coluna, contrato novo com isolamento por consultoria, lote com ids do cliente e permissão por rota. Um revisor basta; trio só se o passo 14 entrar (saída de rede). O restante, só revisão do diff.
- **APK novo**: sem `expo-updates`, quem usa o APK precisa de build novo; a web atualiza com o deploy. O banco do piloto pode ser reposto.
- **Ordem de deploy**: API e web saem juntas (D18).
- **Corrida de ordem** entre duas pessoas da equipe: coberta pelo bloqueio da linha da playlist.
- **Peças compartilhadas**: `CapaDoVideo` (3 usos) e `Navegacao` (barra de todos os papéis).
- **Dado**: aulões já cadastrados perdem o texto da categoria (D2).
- **Não conferido**: CSP de produção para `img-src` (só importa se for a opção C), se os PDFs de guia citam "Time" ou "Aulão", versão do PostgreSQL de produção.

## Fora do escopo
- C34 anexar PDF na aula: depende de onde guardar o arquivo; plano à parte.
- Gamificação (C42 a C47, ver `xp-e-niveis.md`) e chat interno (decidido não fazer).
- Botão "Filtros" para o aluno (C30), botão "Próximo vídeo" e playlist com capa própria ou pastas dentro dela (C27 descartado na reunião).
- Criar playlist de dentro do formulário do aulão (D17).
- Trocar os textos "do time" (equipe) por "da equipe": só se o Gustavo pedir (D10).
- Chat ou conversa separada do mural (C39, parte do chat): produto novo.

## O que ficou para trás
- (nada ainda)
