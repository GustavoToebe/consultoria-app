# AGENTS.md — Saraiva-api (plataforma de treinos e dieta)

Plataforma para **vários treinadores**, cada um com sua consultoria isolada, montarem treino e dieta dos alunos.
O aluno vê o plano e registra carga e repetições no celular ou na web, inclusive sem internet. O Saraiva
(Saraiva Team) é o primeiro treinador. Idioma do código, comentários, mensagens de erro, interface e commits:
**português**.

- Plano de execução (fases, rotas, banco, telas): `PLANO-IMPLEMENTACAO.md`. Contexto de negócio:
  `DIRECIONAMENTO-APP-TREINOS.md` (onde conflitar, vale a seção 1.2 do plano).
- Padrões de segurança copiados da Central (`central-api-back`) e do Servirea (`servirea-api-front`,
  `destino-api.ts`). Ler o arquivo de lá antes de reimplementar algo equivalente.

## Manter este arquivo atualizado
Arquivo de instruções compartilhado entre ferramentas de IA; o `CLAUDE.md` só importa este (`@AGENTS.md`).
Edite **só aqui**. Mudança que invalida algo daqui atualiza este arquivo junto com a funcionalidade. Manter curto.

Trabalhar direto na `main` (decisão do Gustavo); não criar branch nova sem ele pedir. A tag `demo-parte-a` é o plano B da demonstração.

## Regras que não podem ser quebradas
- Um treinador **nunca** vê nem altera dado de outra consultoria; um aluno só vê os **próprios** dados. Toda leitura e
  escrita é autorizada no servidor; nunca confiar em id de consultoria ou aluno vindo do cliente. Recurso de outra
  consultoria responde 404.
- Isolamento por `consultoria_id` com `@TenantId` (Hibernate) preenchido do banco, nunca do token nem do corpo.
  `@TenantId` não protege SQL nativo: toda consulta nativa filtra `consultoria_id`/`aluno_id` explicitamente.
- Plano **publicado é imutável**: editar mexe só no rascunho; publicar cria versão nova. Registro do aluno aponta para
  a versão executada.
- Registro do aluno é **idempotente**: reenviar o mesmo registro não duplica.
- Peso, dieta, suplementação e observações são **dados sensíveis (LGPD)**: nunca em log, no git ou em outro serviço.
  Seed e testes só com dados fictícios.
- Segredos só em variável de ambiente, **sem valor padrão**. Nunca no git (`.env` ignorado; `.env.example` sem valores).
- O app anexa token e cookies **somente** à própria API (`destino-api.ts`). Link de vídeo abre fora do app, sem token.
- Nada de `alert()`, `confirm()` ou `Alert.alert`: confirmação é painel na tela.
- Não opinar nem calcular nada sobre saúde, suplementos ou protocolos. Não inventar carga, repetição ou valor
  nutricional: ausência de dado é "—". Recurso que não existe não aparece na tela.

## Stack
- `api/`: Java 21 · Spring Boot 4.1.1 · Hibernate 7 · Jackson 3 · PostgreSQL 17 · Flyway · Testcontainers · Maven.
  DTOs `record`, `ApiException` com `codigo`, `@Transactional` no service, `@PreAuthorize` em toda rota.
- `app/`: Expo SDK 57 (web, Android e iOS num app só, treinador e aluno), Expo Router, Node 24.21.0 (`app/.nvmrc`).
  Dependência só com `npx expo install`; React Native é o que o SDK fixa.
- Local: `docker-compose.yml` (Postgres + API + Caddy servindo a web em `:8088`, API em `/api`).

## API: convenções
- Equipe: `TREINADOR` é membro com perfil; autoridades `PERM_...` vêm do banco a cada requisição
  (`equipe/PermissoesDoUsuario`), nunca do JWT. Rotas de equipe declaram `hasAuthority` (ArchUnit).
  Dado sensível exige `ALUNO_SENSIVEL_LER`; a ficha omite objetivo e observações sem acesso. Escrita
  desses campos exige `ALUNO_SENSIVEL_ALTERAR`. O cadastro cria os quatro perfis na mesma transação
  por trigger da V018; o usuário nasce com Administrador obrigatório. Aluno continua sem perfil.
  `AcessoAtual.pode` nega sem usuário autenticado; o seed de demonstração roda dentro de `AcessoAtual.comoSistema` (só dados sensíveis).
  Administrador do sistema não pode ser editado/apagado; mutações de membros travam a consultoria
  para manter ao menos um administrador ativo. Trocar perfil ou desativar encerra sessões e sobe `cv`.
  Teto de permissões (`EquipeService.ator`/`exigirPodeAtribuir`, lido do banco): perfil criado, editado, duplicado ou
  atribuído cabe nas permissões de quem age; Administrador só administrador atribui; não administrador não mexe em
  administrador, no próprio perfil nem no perfil que usa (403 `PERMISSAO_NEGADA`).
  Convite de equipe tem hash, 7 dias e aceite único, com a transação dentro de `TenantContext.executarComo`.
  `/responsaveis` só lista id/nome dos membros ativos com `ALUNO_LER`; gestão completa exige `EQUIPE_LER`.
- Auditoria: `auditoria/Auditoria.registrar` usa resumos fixos, sem valores clínicos ou códigos.
  `@Auditar` roda dentro da transação (advisor 1, transação 0); `AuditoriaGravacao` usa JDBC com
  consultoria explícita porque o login começa global. A ação e seu evento sofrem o mesmo rollback.
  Retenção de um ano, limpeza diária; leitura paginada exige `AUDITORIA_LER`.
  `/auditoria/pessoas` traz só id/nome para o filtro, com a mesma permissão, sem exigir gestão da equipe.
- `web/` erros (`ApiError` com `codigo`), `RequestIdFilter`, corpo até 1 MiB (`LimiteCorpoFilter`, 413 `CORPO_EXCEDIDO`).
- `security/` JWT de 15 min com `cv`; refresh opaco com rotação (reuso derruba todas as sessões); web = cookie
  `TREINOS_REFRESH` + CSRF `TREINOS-XSRF-TOKEN`, nativo = refresh no corpo (`X-Treinos-Cliente: nativo`).
- `tenant/` `TenantContext` preenchido só pelo `JwtAuthenticationFilter` (ou `TenantContext.executarComo` em rota
  pública/seed, com a transação aberta **dentro** do bloco). Sem contexto = UUID zero (leitura vazia, escrita falha).
- `auth/LimiteTentativas`: `login_tentativa` igual à V016 da Central (uma linha por chave), não o esboço da seção 6
  do plano. No profile `test` os limites por IP são altos (a suíte toda sai de 127.0.0.1).
- Qualidade: Error Prone na compilação, `ArquiteturaTest` (`@TenantId`, `@PreAuthorize`, SQL nativo, Jackson 3) e
  JaCoCo ≥ 70% de linhas no `mvn verify`. Exceção nova entra na lista do teste com o porquê.
- Migration nova: subir o total em `FlywayMigrationIntegrationTest`. Coluna `char(n)` pede `@JdbcTypeCode(SqlTypes.CHAR)`.
- Rota pública que grava em tabela com `@TenantId` (cadastro de treinador, aceitar convite, seed) não abre transação no
  topo: cria o global numa transação e roda o resto em `TenantContext.executarComo(...)`, com a transação **dentro**.
  O convite descobre a consultoria pelo hash (`ConviteBusca`, SQL nativo mínimo) antes de entrar nela.
- Catálogo público (exercícios e alimentos) vem de `dados/fontes/` pelos scripts de `scripts/catalogo/`; o SQL gerado
  (`V007`, `V008`) não se edita à mão, e fonte nova ou corrigida = migration nova. Valor ausente nunca vira zero
  (`Tr`/`NA` → 0 com marca em `tracos`). A busca usa `nome_busca` (sem acento), calculada igual no Python e em
  `Buscas.semAcento`; teste: `python -m unittest scripts/catalogo/test_catalogo.py`.
- Aplicar modelo (`POST /receitas/{id}/aplicar`) exige `MODELO_APLICAR` + `ALUNO_LER` e, no serviço e antes de qualquer efeito, `TREINO_ALTERAR` (treino, sessão, mobilidade), `DIETA_ALTERAR` (dieta, refeição) ou as do que o pacote traz; salvar pasta como modelo exige também `TREINO_LER` e `DIETA_LER`.
- Modelos do Planejamento (`receitas/`): tipo `MOBILIDADE` (alongamento/mobilidade: seções com itens nome, prescrição em texto e
  vídeo) é modelo reutilizável e também "Aplicar ao aluno" (cria o plano de mobilidade na pasta). Pasta de plano pode ser finalizada
  (`POST /pastas/{id}/finalizar`, `concluida_em`); peso e observação opcionais vão para o registro de peso na mesma
  transação. Aluno tem `dias_atualizacao` (1 a 365): "Nova pasta" sugere início hoje e fim = início + dias - 1.
- Plano do aluno × modelo do Planejamento: o modelo é só o molde e aplicar cria uma cópia sem ligação. Os editores avisam isso (`plano/FaixaDoPlano`, textos em `dominio/planoDoAluno.ts`): título "Treino de <nome>" no aluno, "Modelo: <tipo>" no molde.
- Planos: treino e dieta compartilham `planos/PlanoServiceBase` (rascunho com lock otimista, validar, publicar versão
  imutável, replicar com uids novos). Erro de validação = 422 `PLANO_INVALIDO`/`CONFIRMAR_AVISOS` com a lista em
  `fieldErrors` (`field` = caminho no conteúdo).
- Mobilidade (`mobilidade/`): plano de mobilidade da pasta no padrão da dieta (`PlanoServiceBase`, rascunho + versão imutável, um ativo por aluno), em `/planos-mobilidade`, com as permissões do **treino** (`TREINO_LER/ALTERAR/PUBLICAR`; a Nutricionista também lê, pois tem `TREINO_LER`). Conteúdo = `receitas/ConteudoMobilidade` (mesmo do modelo `MOBILIDADE`); regras de publicação no `ValidadorMobilidade`. Auditoria: `MOBILIDADE_PUBLICADA`. Aluno: `GET /aluno/mobilidade` (404 sem plano publicado). Sem registro de execução e sem PDF.
- Pastas (`pastas/`): agrupam treinos, dietas e mobilidades do aluno e dão o período a todos. Plano criado/replicado com `pastaId`
  usa o período da pasta (o do corpo é ignorado, também ao salvar o rascunho); mudar a pasta altera o **rascunho** dos planos (publicado segue imutável);
  replicar a pasta copia todos. Pasta de outro aluno/consultoria = 404. A V011 moveu os planos anteriores à V009 para pastas (por aluno e período); a ficha não mostra mais “sem pasta”.
- Troca de plano do aluno: `GET /aluno/pastas` (pastas com plano **publicado**; status Ativa/Concluída vem de `concluida_em`; `atual` = pasta do plano vigente) e `GET /aluno/pastas/{id}` (treino e dieta publicados da pasta, 404 se de outro aluno ou só rascunho). Trocar só muda o que o aluno consulta, nunca o `ativo`; plano de outra pasta é só leitura no app (`AlunoProvider.escolhida`, `aluno/SeletorPlano`).
- Lesões (`lesoes/`): histórico estruturado do aluno, dado sensível (LGPD), só treinador; o sistema não interpreta.
- Atualização (`atualizacoes/`): uma por pasta, data no `fim` (a linha já gravada acompanha o `fim` da pasta enquanto ABERTA; enviada/revisada não muda), sem agendador; modelo global versionado e respostas
  validadas pela versão. Estados ABERTA/ENVIADA/REVISADA; atraso calculado e "vou atrasar" só avisa. Envio grava peso
  na mesma transação; feedback editável.
  `RegrasAtualizacao` (igual a `dominio/atualizacao.ts`): abre pela data original, "atrasada" só após
  max(data, atrasoAte); nova data entre a data e +15 dias. Enviar/atraso levam `pastaId` (fora da vigente = 409
  `ATUALIZACAO_NAO_ATUAL`); reenvio do já enviado = 200 sem alterar (checado antes da pasta). Envio mantém a observação
  do peso; corrida no peso do dia = 409. "Visto" do feedback é UPDATE sem `versioned`. Dado sensível, sem log, 404 fora do dono e da consultoria. Fotos ainda não implementadas.
  Painel e listas (`GET /atualizacoes?situacao=&meus=`) saem de `AtualizacaoService.listar/contar` (uma consulta JPQL, `linhasDoPainel`; a fase vem de `RegrasAtualizacao`, não de SQL), com o mesmo filtro "Meus alunos" (`AlunoRepository.ativosDoEscopo`); o item da lista não leva modelo, respostas nem resumo (só o detalhe).
- Histórico do aluno para o treinador (`GET /alunos/{id}/execucoes`): a `observacao` da série é dado sensível e sai nula sem `ALUNO_SENSIVEL_LER`; o aluno vê a própria.
- Execuções: `execucao_serie.serie_trabalho` (fora do esboço do plano) e `exercicio_id` vêm da versão publicada, nunca
  do cliente. Gravação só pelo upsert do `ExecucaoUpsert`; registro ruim vira `RECUSADO` com motivo, sem derrubar o lote.

## App: convenções
- Equipe: `useSessao().pode(codigo)` usa `/eu` só para apresentação; menu, ações e cartões seguem
  as permissões. `GuardaDePermissao` não monta telas sem acesso. A API continua autorizando pelo banco.
  Responsável é salvo junto ao cadastro (mesma transação); `meus=true` em `/alunos` e `/painel`
  filtra pelo usuário autenticado. É preferência de listagem, sem restringir acesso a outros alunos da consultoria.
- Rotas em `app/src/app/` (Expo Router). Áreas em pastas reais `treinador/` e `aluno/` (URLs `/treinador` e `/aluno`):
  grupos `(treinador)`/`(aluno)` do esboço do plano colidiriam os dois `index` em `/`.
- `api/cliente.ts` é o único lugar que fala HTTP; `api/rotas.ts` tem uma função por rota. Credencial só vai para a
  própria API (`caminhoDaApi`). Web: access em memória + cookie; nativo: SecureStore (`sessao/armazenamentoSeguro.ts`,
  com `.web.ts` vazio). Nunca `localStorage` para token.
- Na web, o cookie XSRF é de sessão do navegador: antes do refresh o cliente faz `GET /actuator/health` para ganhar
  um novo. Sem conexão na abertura, a sessão abre offline com o último perfil salvo.
- Design: tokens em `tema/tokens.ts`; status com `Selo` (nunca a cor da marca); confirmação com `PainelConfirmacao`;
  aviso com `useAviso()`; link de texto com `LinkTexto`. Fontes importadas por subcaminho (só os pesos usados).
- **Níveis:** fundo → `Cartao` (`superficie` + borda) → faixa `CabecalhoDeGrupo` (`superficie2`) → item (`superficie2` + borda); campo
  = `campo` + `bordaCampo`; pressionado ou hover = `superficie3` (`ui/sobre`). 24 px entre blocos. `Tela` respeita `largura`
  (`LARGURA_EDITOR` 1040, `LARGURA_LISTA` 1800 = `LARGURA_MAXIMA`, aluno 720). Listas de itens usam `ui/Grade` (1 coluna abaixo de 760 px, 2 a partir de 760, 3 a partir de 1240, pela largura da própria grade; regra em `dominio/grade.ts`).
- **Tipografia** (`ui/tipografia.ts`, escala 12/13/14/15/16/24/28): `titulo` 24/30, `bloco` (título de cartão e folha), `rotulo`
  (campo); `secao` só subtítulo dentro de bloco. `Texto numerico` e campos numéricos usam números tabulares.
- **Botões:** um `primario` por área; botão não estica sem `cheio`; destrutivo = `perigoTexto` + `PainelConfirmacao`.
- **Seleção** é invertida (`texto`/`fundo`: `Escolha`, chips, calendário); a marca só em ação principal, menu e aba ativos,
  "Treino de hoje" e título.
- **Preferências pessoais** em `dominio/preferencias.ts` (AsyncStorage `treinos:<usuarioId>:preferencias`, um JSON; migra a
  chave antiga `...:tema`): tema (consultoria/escuro/claro/sistema), contraste, tamanho do texto (o `Texto` e os campos
  multiplicam a fonte), animações e vibração. `useTema()` expõe `preferencias`, `fatorTexto` e `escolherPreferencia`. A marca
  da consultoria usa as paletas de `dominio/paletas.ts` (`avaliarMarca` bloqueia cor que não segura texto branco com 4,5:1).
  Fontes do nome: PADRAO, METAL, ESPORTIVA, CONDENSADA (migration V016).
  Movimento usa Reanimated 4 com `sv.get()`/`sv.set()` (React Compiler) e `useMovimentoReduzido`; vibração só pelo `ui/vibrar` (sem chamadas na web).
- Lint do React 19 recusa `setState` síncrono dentro de `useEffect`: atualizar estado só em callback de promessa.
  Dados de tela com `ui/useCarregar` (chave → busca; `definir` depois de alterar). Painel lateral/folha: `ui/Folha`.
- Pastas: `src/app/` só rotas; peças das telas do treinador em `src/treinador/`; regras puras (com teste) em
  `src/dominio/` (formatos BR, agrupamento "3x3 - FS", operações do editor, contas da dieta). `novoUid()` em todo item novo.
- Editor de treino: uma sessão por vez (`SeletorDeSessoes`, chips) e os modelos numa `Folha` "Modelos"; dieta: refeições em
  `CabecalhoDeGrupo`, recolhidas por padrão. Configuração do plano (título, período, metodologia) é um cartão recolhível.
- Editores de plano: `treinador/plano/usePlanoEditor` (rascunho do aluno salvo 1,5 s depois; modelo só salva no botão e descarta ao sair; 409 → recarregar, validar e
  publicar com erros/avisos da API) + `TopoPlano`. Mudança grande (receita, remoção) passa pelo `BarraDesfazer`.
- Verificar: `npm run typecheck && npm run lint && npm test`; bundle nativo com `npx expo export --platform android`.
- Atrás do Caddy o Tomcat recebe `X-Forwarded-Port` (porta do `Host`): sem isso a web em `:8088` parecia outra origem
  e o CORS recusava o login.

- Aluno offline: `offline/AlunoProvider` (pacote salvo, registros, gatilhos de envio) sobre a interface
  `RepositorioLocal` (uma operação por vez) e `Sincronizador`. `abrirRepositorio` escolhe: celular =
  `RepositorioSqlite` (expo-sqlite, um banco `treinos-<usuarioId>.db` por usuário, esquema versionado por
  `user_version` em `offline/banco.ts`: versão nova = bloco novo, nunca editar o v1; migra o AsyncStorage antigo);
  web = `RepositorioChaveValor` (prefixo `treinos:<usuarioId>:`). Mudou o contrato? A bateria do `offline.test.ts`
  roda nas duas (SQLite do Node em `bancoNode.apoioTeste.ts`, nunca importado pelo app). Série marcada grava no aparelho na hora;
  a carga sugerida vem de `dominio/cargas.ts` (seção 8) e o que o aluno digita é gravado como digitou.
- Mobilidade do aluno: aba "Mobilidade" (antes do Histórico) só com mobilidade publicada; o `AlunoProvider` guarda a última vista no `RepositorioLocal` (documento `kv` `mobilidade`, sem mudar `VERSAO_ESQUEMA`) e limpa no 404. Tela só de consulta; vídeo abre fora do app.
- Telas do aluno no estilo do protótipo: "Treino de hoje" na cor da marca, divisões com chips de data do período
  (`datasDaSessao`; registro até 60 dias para trás ou para frente, `podeRegistrarEm`), dia em `sessao/[uid]?data=` e um
  exercício por tela em `sessao/[uid]/[exercicio]` (`aluno/useSessaoDoDia`). Nome da sessão com `nomeComDia`.
- Cargas por divisão (`dominio/relatorio.ts` + `treinador/CargasPorDivisao`) no histórico do aluno e na ficha do
  treinador; o mesmo dado sai no PDF de cargas (`pdf/pdfCargas.ts`).

- Ficha do aluno (treinador): `CartaoPastas` (lista com a situação da atualização de cada pasta; tocar abre a `Folha` larga
  — `largura={LARGURA_EDITOR}` — com ações, `CartaoPlanos` de treino e dieta, `CartaoRegistros` só com o período e os treinos
  da pasta e `AtualizacaoDaPasta`), `CartaoLesoes`, `CartaoProgresso` e `CartaoPeso` (lista ou `GraficoLinha`, SVG sem biblioteca). Registros
  não ficam mais soltos na ficha. "Progresso por exercício" fica na ficha (fora da pasta), com o histórico de todas as
  pastas e seleção múltipla de exercícios numa `Folha` (a lista vem do último ano; no máximo `LIMITE_PROGRESSO` = 10 marcados, regra em `dominio/selecaoMultipla.ts`); filtra por grupo muscular (`ExercicioFeito.grupoMuscular`, da
  biblioteca; nulo fora dela = "Sem grupo") e exercício (`dominio/relatorio.opcoesDeProgresso`), com busca sem acento na folha. Cada exercício marcado é um bloco
  (`ProgressoDoExercicio`: resumo do primeiro e do último registro com carga, `GraficoLinha` com 2 pontos ou mais, 5 datas mais recentes e "Ver todos"); regras em `dominio/progresso.ts`, sem cálculo novo.
- PDFs: `pdf/pdfTreino.ts`/`pdfDieta.ts` montam HTML (todo texto com `esc()`); `pdf/imprimir.ts` no celular gera o
  arquivo e abre o compartilhar; `imprimir.web.ts` usa um bloco só de impressão na própria página + `window.print()`
  (a CSP tem `frame-src 'none'`, então nada de iframe). Logo entra como data URI (`pdf/logo.ts`).

- Ajuda: `app/src/ajuda/conteudo.ts` é o texto único (primeiros passos, tutorial guiado, seções, perguntas) das telas
  `/treinador/ajuda` e `/aluno/ajuda` e dos PDFs `app/public/guias/*.pdf` (web serve em `/guias/`). Mudou funcionalidade
  que o guia descreve? Edite o `conteudo.ts` e rode `node scripts/guias/gerar.mjs` (precisa de Edge/Chrome), versionando os PDFs.
- `ui/RolagemComTopo` (usado por `Tela` e `Folha`) mostra o botão "voltar ao início da página" depois de 400 px de rolagem. Lema da marca saiu da interface e do PDF
  (o campo saiu da tela; salvar a Marca mantém o lema que já estava gravado). Marca aparece a quem tem `MARCA_ALTERAR` (nos perfis
  padrão, só o Administrador); tema claro/escuro é preferência pessoal em Perfil, para qualquer um.

## Onde está cada coisa
- `api/` — backend novo. `app/` — app Expo novo.
- `backend/` e `mobile/` — protótipo antigo: **não mexer, não apagar**. `mobile/src/database/pdf_plan_parser.ts` e
  `mobile/src/constants/exerciseVideos.ts` são fontes do seed.
- `docs/` — planilhas e CSVs antigos: não copiar dados pessoais deles.

## Comandos
- API: `cd api && mvn verify` (precisa de Docker para o Testcontainers). Maven usa o JDK do `JAVA_HOME` (21).
- App: `cd app && npm run typecheck && npm run lint && npm test`; `npx expo install --check` e `npx expo-doctor`.
- Tudo local: `cp .env.example .env` (preencher), `docker compose up -d --build`, abrir `http://localhost:8088`.
- Base de estilo: Uniwind 1.12.2 + Tailwind 4, sem preset de Babel; Metro estende `getDefaultConfig` do Expo.
  RNR copiado em `app/src/components/ui/`, adaptadores compatíveis em `app/src/ui/`. `tokens.ts` é a fonte;
  `global.css` espelha os tokens (teste obrigatório). Marca/tema mudam via `Uniwind.updateCSSVariables` no TemaProvider.
- Movimento: respeitar `ui/useMovimentoReduzido`; Reanimated usa `.get()`/`.set()` para manter o React Compiler.
  Descanso pertence ao `AlunoProvider` e guarda instante de término, nunca contador decrementado; só inicia
  automaticamente ao marcar uma série cujo plano define descanso. `dominio/descanso.ts` contém as contas testáveis.
  `dominio/progressoSemana.ts` combina histórico e registros locais da versão ativa; cache de uma semana no
  repositório isolado por usuário, apagado no logout. Descanso não usa notificações com o app fechado.
  Atualização usa lembretes locais (3 dias antes, no dia e 1 dia depois, às 9h), sem respostas nem medidas,
  cancelados ao enviar e sair; web usa só cartão e ponto na aba. O rascunho por pasta fica no `RepositorioLocal`.
  No Expo Go do Android o `expo-notifications` lança ao importar: `aluno/atualizacao/lembretes.ts` o carrega sob demanda e lá os lembretes ficam desligados.
  `Folha` usa mola e arraste no cabeçalho; web mantém Esc e clique fora. Bases RNR incluem licença MIT local.

- Importação de conteúdo do Saraiva (vídeos, semanas de treino e mobilidade): `node scripts/importacao/importar.mjs`
  (`--simular` só lê; `--substituir` troca modelos que já existem; `--trocar-videos` troca vídeo já gravado). Usa a API
  como treinador (`DEMO_SENHA` do ambiente, sem imprimir) e é idempotente. Dados em `scripts/importacao/dados/`, sem
  dado de aluno. Depois de `docker compose down -v`, rodar de novo.
