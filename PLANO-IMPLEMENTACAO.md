# Plano de implementação — plataforma de treinos e dieta (demonstração de domingo)

Documento de trabalho para quem for implementar (pessoa ou agente de IA, por exemplo Sonnet 5.5).
Escrito em 07/10/2026 a partir de toda a conversa com o Gustavo, dos PDFs do Saraiva e do código existente.
Leia **inteiro** antes de começar. Siga as fases na ordem. Cada fase termina com verificação e commit.

- Repositório: `GustavoToebe/Saraiva-api`
- Branch: `claude/saraiva-api-direcionamento-treinos-dv10io` (nunca commitar na `main`)
- Prazo: demonstração para o Saraiva **domingo, 11/10/2026, 16:30**
- Rodar tudo **local** (Docker no PC do Gustavo). Sem VPS, sem lojas, sem cobrança por enquanto.
- Idioma de código, comentários, mensagens de erro, interface e commits: **português**.

---

## Índice

0. Como usar este documento
1. O produto e o que foi decidido
2. Regras que não podem ser quebradas
3. Versões (fixas)
4. Estrutura do repositório
5. Segurança (padrões da Central e do Servirea)
6. Banco de dados (migrations)
7. Formatos JSON dos planos (treino e dieta)
8. Regras de cálculo de carga
9. API: rotas, permissões e comportamento
10. App Expo (treinador e aluno): estrutura, design, telas
11. Offline e sincronização do aluno
12. PDFs (treino e dieta)
13. Dados de demonstração (seed)
14. Docker local e Caddy
15. Testes obrigatórios
16. Fases, passo a passo, com critérios de pronto
17. Prioridade se faltar tempo
18. Roteiro da demonstração de domingo
19. Fora do escopo agora / pendências para conversar com o Saraiva
20. Armadilhas conhecidas

---

## 0. Como usar este documento

1. Ler este arquivo inteiro, depois `DIRECIONAMENTO-APP-TREINOS.md` (contexto de negócio).
2. Ler, como **referência de padrão** (não copiar às cegas), estes arquivos do repositório irmão `central-api-back`
   (se não estiver no ambiente, pedir para adicionar o repositório `gustavotoebe/central-api-back`):
   - `src/main/java/br/com/central/api/security/` (JwtService, JwtAuthenticationFilter, SecurityConfig,
     SecurityProperties, OpaqueTokenGenerator, RestAuthenticationEntryPoint, RestAccessDeniedHandler)
   - `src/main/java/br/com/central/api/operador/` (AuthController, AuthService, RefreshToken*,
     LimiteLogin, ContadorBanco, ContadorJanelas, RevogacaoDeSessao)
   - `src/main/java/br/com/central/api/web/` (ApiError, ApiException e filhas, GlobalExceptionHandler,
     RequestIdFilter, Fuso, Exigir)
   - `src/test/java/br/com/central/api/AbstractIntegrationTest.java` e o teste de arquitetura em `arquitetura/`
   - `docs/login-limites.md`, `docs/desenvolvimento/qualidade.md`, `deploy/Caddyfile`
   - No front do Servirea (`servire-api-front`): `src/app/core/auth/destino-api.ts`.
3. Seguir as fases da seção 16. Ao fim de cada fase: rodar as verificações da fase, commitar e dar push.
4. Não inventar regra de negócio. Se algo não estiver aqui, escolher o mais simples, anotar na seção
   "Pendências" do `README.md` e seguir.
5. **Não apagar** `backend/` nem `mobile/`: são o protótipo antigo e ficam como referência
   (`mobile/src/database/pdf_plan_parser.ts` e `mobile/src/constants/exerciseVideos.ts` são fontes do seed).
6. Já existe `api/pom.xml` criado como ponto de partida (Spring Boot 4.1.1). Conferir se compila; ajustar se preciso.

---

## 1. O produto e o que foi decidido

### 1.1 Visão

Plataforma para **vários treinadores** (cada um com sua consultoria isolada) montarem **treino e dieta** dos
alunos. O aluno vê o plano no celular (Android/iOS) ou na web, registra cargas e repetições, inclusive sem
internet. O Saraiva é o primeiro treinador (piloto) e quer algo "estilo Treino.io, porém simples": o Treino.io
é difícil de mexer e cobra caro para pôr a logo da consultoria.

### 1.2 Decisões do Gustavo (documento "Saraiva 1", 07/10/2026)

| # | Tema | Decisão |
|---|---|---|
| 1 | Arquitetura | Monolito modular (uma API) + um PostgreSQL. Sem microsserviços. |
| 2 | Isolamento entre treinadores | Igual ao Servirea: `consultoria_id` em toda tabela de negócio, aplicado pelo framework (`@TenantId`). |
| 3 | Metodologia | Saraiva vem **todo configurado**. Igual ao Servirea (layouts de escala): **receitas** prontas (pontos de partida editáveis), **importar**, e **replicar o plano para o próximo ciclo** editando só o necessário. Meio-termo: série genérica com tipo nomeado pelo treinador, poucas formas de intensidade, nada de linguagem de fórmulas. |
| 4 | White label | **App único**; a marca do treinador (logo, cor, nome, fonte) é carregada **depois do login** (ou ao abrir o convite). App próprio nas lojas fica para depois. |
| 5 | Base pré-cadastrada | Catálogo **público** de exercícios e alimentos; o treinador **importa** o que quiser para a biblioteca dele. Base oficial: TACO e exercicios-bd-ptbr já importadas (ver `PLANO-CATALOGO-PUBLICO.md`). |
| 6 | Offline | O aluno vê o plano **só leitura**, mas registra/edita a carga e as repetições para o cálculo; ao voltar Wi-Fi/4G, sincroniza e salva. |
| 7 | Cobrança / Central | **Fica para depois.** Nada de Central, gateway ou split agora. |
| — | Front | **Um único app Expo** (web + Android + iOS) para treinador e aluno; o papel vem do login. O treinador usa no PC e no celular. |
| — | Infra da demo | Tudo local em Docker, como o teste local do Servirea. |
| — | Design | Flat utilitário, cartões (card-based), minimalista, **tema escuro e claro à escolha do usuário**. Cores fortes só para status/ação (verde confirma, vermelho alerta). |
| — | Marca do Saraiva | Ele gosta de logo estilo **death/black metal**. Usar fonte gótica/metal (ex.: *Metal Mania*, licença OFL) para o nome da consultoria quando a marca escolher a fonte "Metal", e permitir **upload da logo** dele (PNG/JPEG). |

### 1.3 O que o Saraiva disse (conversa de 07/10/2026), e que vira requisito

- "Fazer só pra mim não compensa" → plataforma para **outros treinadores** (cadastro de treinador incluso).
- "Precisa ser um app fácil de mexer tanto no PC quanto no celular" → app único responsivo.
- "Eu não acho um app prático pro aluno, acho confuso" → tela do aluno mínima: treino do dia, séries, registrar.
- "Plataforma de montagem de treino e dieta e baixar em PDF" + "tem aluno que prefere PDF" → **PDF obrigatório**.
- "A dieta queria manter no estilo que faço" → PDF e tela da dieta no formato dos PDFs dele (seção 12).
- "Fundo branco e fundo preto, a pessoa escolhe" → tema claro/escuro por usuário.
- "Preciso de um app de clientes da consultoria, faço tudo no Sheets" → **lista de alunos** com situação; importar
  dados de planilha (CSV) ajuda. Financeiro dos alunos fica para depois.

### 1.4 O que NÃO fazer

- Não opinar, validar, sugerir nem calcular nada sobre saúde, suplementos, medicamentos ou protocolos. A tabela de
  suplementação/protocolo é **campo livre** do treinador; o app só guarda e mostra.
- Não inventar carga, repetição ou valor nutricional. Ausência de dado é "—", nunca zero nem estimativa.
- Não usar IA, não publicar nas lojas, não subir em VPS, não integrar a Central nesta entrega.
- Não fingir funcionalidade (o protótipo antigo dizia "Importar PDF — converte automaticamente" e não fazia).
  Recurso que não existe não aparece na tela.

---

## 2. Regras que não podem ser quebradas

1. Um treinador **nunca** vê nem altera dado de outra consultoria. Um aluno só vê os **próprios** dados.
   Toda leitura/escrita é autorizada no servidor; nunca confiar em id de consultoria/aluno vindo no corpo.
2. Plano **publicado é imutável**. Editar mexe só no rascunho; publicar cria versão nova. Registro do aluno aponta
   para a versão que ele executou.
3. Registro do aluno é **idempotente**: reenviar o mesmo registro não duplica.
4. Dados de saúde (peso, dieta, suplementação, observações) são **dados sensíveis (LGPD)**: nunca em log,
   nunca no git, nunca enviados para outro serviço.
5. Segredos só em variável de ambiente, **sem valor padrão** no código/yml de produção. Nunca no git
   (`.env` já está no `.gitignore`; criar `.env.example` sem valores reais).
6. O app anexa token/cookies **somente** a requisições para a própria API (checagem de origem e caminho,
   igual `destino-api.ts`). Link de vídeo abre fora do app (`Linking.openURL`), sem token.
7. Nada de `alert()`/`confirm()` do navegador nem `Alert.alert` (não funciona na web): confirmação é painel na tela.

---

## 3. Versões (fixas)

Usar sempre a última **estável**, não beta/canary/next. Verificado em 07/10/2026 no npm e no Maven Central.

| Componente | Versão | Observação |
|---|---|---|
| Java | **21** (Temurin) | LTS. Escolha do Gustavo. |
| Spring Boot | **4.1.1** | Mesma da Central. Traz Hibernate 7, Jackson 3 (`tools.jackson`), Spring Security 7. |
| Maven | 3.9.x | Imagem `maven:3.9-eclipse-temurin-21`. |
| jjwt | **0.13.0** | Igual à Central. |
| PostgreSQL | **17** | Imagem `postgres:17-alpine` (última suportada pelo Supabase). Testcontainers também 17. |
| Flyway | o do Boot 4.1.1 | `spring-boot-starter-flyway` + `flyway-database-postgresql`. |
| Node.js | **24.21.0** | Fixar em `app/.nvmrc` (`24.21.0`), `"engines": {"node": ">=24.21.0 <25"}` e imagem `node:24.21.0-alpine`. |
| Expo SDK | **57** (`expo@57.0.27`) | `latest` estável no npm. |
| React Native / React / TypeScript | **as que o SDK 57 fixa** | Instalar com `npx expo install`. **Não** forçar `react-native@0.87.x` (é mais nova que o SDK 57; quebra módulos nativos). O protótipo usa RN 0.86.3 / React 19.2.3 com o SDK 57. |
| expo-router | 57.x | Via `npx expo install expo-router`. |
| Caddy | `caddy:2-alpine` | Servidor da web + proxy da API, igual ao ecossistema. |

Regra: dependência do app só com `npx expo install <pacote>` (resolve versão compatível com o SDK).
Depois: `npx expo install --check` e `npx expo-doctor` precisam passar.

---

## 4. Estrutura do repositório

```
Saraiva-api/
  AGENTS.md                 # NOVO: regras curtas do repo (ver 16, fase 0)
  CLAUDE.md                 # NOVO: só "@AGENTS.md"
  PLANO-IMPLEMENTACAO.md    # este arquivo
  DIRECIONAMENTO-APP-TREINOS.md
  README.md                 # atualizar: como rodar, contas de demo, pendências
  docker-compose.yml        # NOVO: db + api + web (Caddy)
  .env.example              # NOVO
  deploy-local/Caddyfile    # NOVO
  api/                      # NOVO backend (Spring Boot 4.1.1). pom.xml já existe.
  app/                      # NOVO app Expo (web/Android/iOS), treinador + aluno
  backend/                  # protótipo antigo (não mexer, não apagar)
  mobile/                   # protótipo antigo (não mexer, não apagar)
  docs/                     # planilhas/CSVs antigos (não usar dados pessoais deles)
```

### 4.1 Pacotes da API (`api/src/main/java/br/com/treinos/api/`)

```
TreinosApiApplication.java
web/          ApiError, ApiException (+ BadRequest, NaoEncontrado, Conflito, Proibido, NaoAutorizado,
              MuitasRequisicoes, CorpoExcedido), GlobalExceptionHandler, RequestIdFilter, Fuso, Exigir
security/     JwtService, JwtAuthenticationFilter, SecurityConfig, SecurityProperties, UsuarioAutenticado,
              OpaqueTokenGenerator, RestAuthenticationEntryPoint, RestAccessDeniedHandler, DestinoCliente
tenant/       TenantContext (ThreadLocal), TenantIdentifierResolver (Hibernate), TenantFilter
auth/         Usuario, RefreshToken, AuthController, AuthService, RefreshTokenService, LimiteLogin,
              ContadorBanco, CadastroTreinadorService, ConviteController/Service
consultoria/  Consultoria, MarcaController/Service (marca, logo, configuração da metodologia)
alunos/       Aluno, AlunoController/Service/Repository
biblioteca/   Exercicio, Alimento, CatalogoExercicio, CatalogoAlimento, controllers/services, ImportacaoCsv
receitas/     Receita, ReceitaController/Service, ReceitasPadrao (receitas do sistema)
treino/       PlanoTreino, PlanoTreinoVersao, ConteudoTreino (records), ValidadorTreino, controllers/services
dieta/        PlanoDieta, PlanoDietaVersao, ConteudoDieta (records), ValidadorDieta, controllers/services
execucao/     ExecucaoSerie, RegistroPeso, AlunoAppController (rotas /aluno/**), SincronizacaoService
painel/       PainelTreinadorController/Service (início do treinador)
demo/         SeedDemo (só com treinos.demo.seed=true)
```

---

## 5. Segurança (padrões da Central e do Servirea)

Tudo abaixo é obrigatório. Onde diz "como a Central", abrir o arquivo citado na seção 0 e seguir o mesmo desenho.

### 5.1 Senhas e usuários

- `PasswordEncoderFactories.createDelegatingPasswordEncoder()` (BCrypt), como a Central.
- Senha: mínimo 8 caracteres, máximo 72 **bytes** (limite do BCrypt), diferente do e-mail. Mensagem clara no 400.
- E-mail normalizado: `trim()` + `toLowerCase(Locale.ROOT)`; único globalmente (índice em `lower(email)`).
- `usuario.credenciais_versao` (long): vai no JWT (claim `cv`). Trocar senha, desativar usuário ou desativar aluno
  incrementa a versão e revoga todos os refresh tokens → Bearer antigo recusado na hora (como a Central).
- Resposta de login com e-mail inexistente ou senha errada: **mesma** mensagem e mesmo tempo aproximado
  (executar o BCrypt mesmo quando o usuário não existe, contra um hash fixo).

### 5.2 Tokens e sessão

- **Access token**: JWT HS256, 15 minutos, claims `sub` (usuarioId), `purpose=access`, `cv`, `papel`. Sem dado pessoal.
  Segredo `TREINOS_JWT_SEGREDO` (Base64, ≥ 32 bytes decodificados; falha na inicialização se faltar ou for curto —
  copiar a validação do `JwtService` da Central).
- **Refresh token**: opaco de 256 bits (`OpaqueTokenGenerator`), banco guarda **só o SHA-256**, validade 30 dias,
  **rotação a cada uso** (o antigo é marcado `usado_em`). Se um refresh já usado for apresentado de novo →
  revogar todas as sessões do usuário e responder 401 (detecção de roubo).
- **Dois tipos de cliente**, decididos pelo header `X-Treinos-Cliente`:
  - `web` (padrão): refresh em **cookie** `TREINOS_REFRESH` `HttpOnly`, `Secure`, `SameSite=Strict`, `Path`
    configurável (`treinos.security.refresh-cookie-path`, padrão `/auth`; no Docker `/api/auth`), como a Central
    (lá é `SameSite=None` porque o painel fica em outro subdomínio; aqui a web é mesma origem, então `Strict`).
    `Secure` configurável **só** para o ambiente local por IP da rede (`treinos.security.refresh-cookie-secure`,
    padrão `true`; o `docker-compose.yml` local põe `false` com comentário explicando).
  - `nativo` (Android/iOS): o refresh vem no **corpo** da resposta e o app guarda no `expo-secure-store`
    (Keychain/Keystore). `POST /auth/refresh` recebe `{ "refreshToken": "..." }` no corpo. Sem cookie.
- **CSRF** (só para o cliente web, igual à Central): `CookieCsrfTokenRepository.withHttpOnlyFalse()` com nome
  próprio `TREINOS-XSRF-TOKEN`, header `X-XSRF-TOKEN`. Exigir em `/auth/refresh` e `/auth/logout` quando vier o
  cookie de refresh, e em requisição sem Bearer que carregue o cookie. Requisição com Bearer dispensa CSRF.
  Login e rotas públicas de convite/cadastro ignoram CSRF (como `/auth/login` na Central).
- No app web, o access token fica **só em memória**; o refresh fica no cookie HttpOnly (o JS não lê).
  No nativo, access em memória e refresh no SecureStore. **Nunca** `localStorage` para token.

### 5.3 Limite de tentativas (copiar o desenho da Central — `docs/login-limites.md`)

- Tabela global `login_tentativa`, contador por **IP** (60) e por **conta/e-mail normalizado** (10) em janela fixa
  de 600 s, instrução SQL atômica (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`). Chave = SHA-256 com sal
  derivado do segredo JWT; IP e e-mail **nunca** gravados em claro nem logados.
- Excesso: HTTP 429, código `LOGIN_LIMITADO`, header `Retry-After`. Limpeza de linhas vencidas no máximo 1×/min.
- Aplicar o mesmo contador (com prefixos de chave diferentes) em: `POST /auth/login`, `POST /auth/cadastro-treinador`,
  `GET/POST /publico/convites/{codigo}` (por IP), `POST /auth/refresh` (por IP, limite mais alto: 120).
- Não usar `X-Forwarded-For` diretamente. No Docker o Caddy é o único proxy: configurar
  `server.forward-headers-strategy=native` só no profile `docker`, confiando apenas na rede interna.

### 5.4 Autorização e isolamento

- `SessionCreationPolicy.STATELESS`, `@EnableMethodSecurity`. Papéis: `ROLE_TREINADOR`, `ROLE_ALUNO`.
- **Toda rota nova tem `@PreAuthorize`** (`hasRole('TREINADOR')` ou `hasRole('ALUNO')`). Públicas só:
  `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/cadastro-treinador`, `/publico/**`, `/actuator/health`, `/error`.
- `JwtAuthenticationFilter`: valida JWT, carrega usuário ativo com `credenciais_versao` igual, monta
  `UsuarioAutenticado(usuarioId, consultoriaId, papel, alunoId)` e preenche o `TenantContext` com o `consultoriaId`
  **do banco** (nunca do token nem do corpo). Limpar o `TenantContext` no `finally`.
- Hibernate 7 `@TenantId` (tipo `UUID`, coluna `consultoria_id`) em todas as entidades de negócio. Resolver
  (`CurrentTenantIdentifierResolver<UUID>`) devolve o `TenantContext`; sem contexto devolve o UUID zero
  (`00000000-...`), que não existe → consultas voltam vazias e inserts falham por FK (falha segura).
  Registrar o resolver por `HibernatePropertiesCustomizer` (`hibernate.tenant_identifier_resolver`).
- Exceções sem `@TenantId` (documentar no ArchUnit com o porquê): `Consultoria`, `Usuario` (login global),
  `RefreshToken`, `CatalogoExercicio`, `CatalogoAlimento`, contador de login.
- Mesmo com `@TenantId`, buscar por id sempre com consulta que também filtra pelo dono quando há aluno:
  ex.: aluno lendo plano → `findByAlunoIdAndAtivoTrue(alunoDoToken)`; nunca aceitar `alunoId` do cliente.
- Recurso de outra consultoria responde **404** (não 403), para não revelar existência.
- Aluno chamando rota de treinador → 403. Aluno inativo → login recusado e sessões revogadas.

### 5.5 Entrada, saída e erros

- `ApiError` igual à Central (`timestamp, status, error, message, codigo, path, requestId, fieldErrors`).
  Nada de stack trace, SQL ou nome de classe na resposta. `RequestIdFilter` com `X-Request-Id` e MDC.
- DTOs `record` com Bean Validation (`@NotBlank`, `@Size`, `@Email`, `@DecimalMin`...). Strings com limite de tamanho.
- Corpo JSON até **1 MiB** (`server.tomcat.max-swallow-size` + filtro que recusa > 1 MiB com 413 `CORPO_EXCEDIDO`,
  como `/integracao/**` da Central). Upload de logo até **512 KiB**.
- **Logo**: aceitar só PNG e JPEG conferindo os **bytes mágicos** (não confiar no Content-Type). Recusar SVG
  (risco de script). Servir com `Content-Type` correto, `X-Content-Type-Options: nosniff`,
  `Content-Disposition: inline`, cache com versão na URL (`?v=logo_versao`).
- **URL de vídeo**: só `https://` e hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`
  (lista configurável). Recusar `javascript:`, `data:` e qualquer outro host. Validar no back **e** no app.
- Log: SLF4J, sem e-mail, senha, token, código de convite, peso, dieta ou observação. Logar ids.
- CORS: lista explícita `CORS_ALLOWED_ORIGINS` (dev: `http://localhost:8081`). No Docker a web é mesma origem.
- Actuator: expor só `health` (sem detalhes).
- Datas de domínio com `Fuso.BRASILIA` (`America/Sao_Paulo`), como a Central.

### 5.6 Configuração de produção

- `application.yml` com `${VAR}` **sem padrão** para segredos (`TREINOS_JWT_SEGREDO`, `DB_URL`, `DB_USUARIO`, `DB_SENHA`).
- Profile `demo` liga o seed e exige `DEMO_SENHA` (sem padrão). Profile `test` tem segredo próprio de teste.
- Teste `ConfiguracaoProducaoTest`: subir o contexto no profile padrão sem as variáveis deve **falhar**.

### 5.7 Qualidade automática (como a Central, `docs/desenvolvimento/qualidade.md`)

- Error Prone na compilação (copiar o bloco do `maven-compiler-plugin` e `.mvn/jvm.config` da Central; manter as
  mesmas regras como erro). Se atrasar demais a fase 1, deixar para a fase 8, mas **não** remover depois.
- ArchUnit (`ArquiteturaTest`): controller não usa repositório/EntityManager/JdbcTemplate nem abre transação;
  service/repositório não dependem de controller; entidades fora da lista de exceções têm `@TenantId`;
  só Jackson 3 (`tools.jackson`; de `com.fasterxml` só anotações e o motor do jjwt); injeção por construtor;
  nada de `System.out`; SQL nativo só nas classes listadas (contador de login, upsert de execuções).
- JaCoCo: relatório no `mvn verify`; mínimo inicial 0.70 de linhas (subir depois).

### 5.8 App (cliente)

- `destino-api.ts`: mesma função do Servirea (`caminhoDaApi`) — compara origem e fronteira do caminho antes de
  anexar `Authorization`, cookies (`credentials: 'include'` só para a API na web) e `X-XSRF-TOKEN`.
  Não usar `startsWith` na URL inteira.
- `fetch` nativo: `credentials: 'omit'` (o refresh vai no corpo).
- Troca de conta/logout: apagar SecureStore, cache local e fila **daquele usuário**. Se houver registros não
  enviados, avisar no painel de confirmação ("Há N registros não enviados. Sair mesmo assim?").
- Nada de segredo de servidor no app. `EXPO_PUBLIC_*` só para URL da API.

### 5.8.1 Caddy (web + proxy)

Cabeçalhos iguais ao `deploy/Caddyfile` da Central/Servirea: `Strict-Transport-Security` (só quando houver HTTPS),
`X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `X-Frame-Options DENY`,
`-Server`, e CSP:
`default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; worker-src 'self' blob:`.
Conferir no navegador se o bundle do Expo web roda com essa CSP; se precisar relaxar algo, documentar o porquê.
`request_body max_size 6MB` como o ecossistema. `/actuator/*` (exceto health) não é exposto.

---

## 6. Banco de dados (migrations Flyway em `api/src/main/resources/db/migration`)

Convenções: `uuid` gerado pela aplicação (`UUID.randomUUID()`), `timestamptz`, `numeric` para carga/peso/macros,
`varchar` com `CHECK` para enums, coluna `versao bigint` para lock otimista (`@Version`) onde há edição concorrente.
Toda tabela de negócio tem `consultoria_id uuid not null references consultoria(id)` e índice começando por ele.

### V001__identidade.sql

```sql
create table consultoria (
  id uuid primary key,
  nome varchar(120) not null,
  slug varchar(60) not null unique,
  lema varchar(160),
  cor_primaria varchar(7) not null default '#C62828' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  fonte_titulo varchar(20) not null default 'PADRAO' check (fonte_titulo in ('PADRAO','METAL')),
  tema_padrao varchar(10) not null default 'ESCURO' check (tema_padrao in ('ESCURO','CLARO')),
  logo bytea,
  logo_tipo varchar(20) check (logo_tipo in ('image/png','image/jpeg')),
  logo_versao int not null default 0,
  configuracao jsonb not null default '{}'::jsonb,   -- ver 7.3
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);

create table usuario (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  email varchar(254) not null,
  nome varchar(120) not null,
  senha_hash varchar(100) not null,
  papel varchar(20) not null check (papel in ('TREINADOR','ALUNO')),
  aluno_id uuid,                               -- FK adicionada na V002
  ativo boolean not null default true,
  credenciais_versao bigint not null default 0,
  criado_em timestamptz not null default now(),
  ultimo_login_em timestamptz
);
create unique index ux_usuario_email on usuario (lower(email));

create table refresh_token (
  id uuid primary key,
  usuario_id uuid not null references usuario(id) on delete cascade,
  token_hash char(64) not null unique,
  cliente varchar(10) not null check (cliente in ('WEB','NATIVO')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  revogado_em timestamptz
);
create index ix_refresh_usuario on refresh_token (usuario_id);

create table login_tentativa (            -- igual à Central (V016)
  chave_hash char(64) not null,
  janela_inicio timestamptz not null,
  quantidade int not null,
  primary key (chave_hash, janela_inicio)
);
```

### V002__alunos.sql

```sql
create table aluno (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(120) not null,
  email varchar(254),
  objetivo varchar(200),
  observacoes text,
  ativo boolean not null default true,
  inativado_em timestamptz,
  convite_hash char(64) unique,
  convite_expira_em timestamptz,
  usuario_id uuid unique references usuario(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create index ix_aluno_consultoria on aluno (consultoria_id, ativo, nome);
alter table usuario add constraint fk_usuario_aluno foreign key (aluno_id) references aluno(id);
```

"Aluno ativo" (base da futura cobrança) = `aluno.ativo = true`, controlado pelo treinador. **Não** depende de login.

### V003__biblioteca.sql

```sql
create table exercicio (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(120) not null,
  grupo_muscular varchar(60),
  equipamento varchar(60),
  modalidade varchar(20) not null default 'MAQUINA'
    check (modalidade in ('LIVRE','MAQUINA','ELASTICO','PESO_CORPORAL','CARDIO','OUTRO')),
  video_url varchar(500),
  observacoes text,
  ativo boolean not null default true,
  origem varchar(20) not null default 'MANUAL' check (origem in ('MANUAL','CATALOGO','IMPORTACAO')),
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create unique index ux_exercicio_nome on exercicio (consultoria_id, lower(nome)) where ativo;

create table alimento (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(160) not null,
  base_quantidade numeric(8,2) not null default 100,
  base_unidade varchar(10) not null default 'g' check (base_unidade in ('g','ml','un')),
  kcal numeric(8,2) not null,
  proteina numeric(8,2) not null,
  carboidrato numeric(8,2) not null,
  gordura numeric(8,2) not null,
  gramas_por_unidade numeric(8,2),
  fonte varchar(200),
  ativo boolean not null default true,
  origem varchar(20) not null default 'MANUAL' check (origem in ('MANUAL','CATALOGO','IMPORTACAO')),
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create unique index ux_alimento_nome on alimento (consultoria_id, lower(nome)) where ativo;

create table catalogo_exercicio (     -- global, sem consultoria
  id uuid primary key,
  nome varchar(120) not null unique,
  grupo_muscular varchar(60),
  equipamento varchar(60),
  modalidade varchar(20) not null
);
create table catalogo_alimento (      -- global, sem consultoria
  id uuid primary key,
  nome varchar(160) not null unique,
  base_quantidade numeric(8,2) not null default 100,
  base_unidade varchar(10) not null default 'g',
  kcal numeric(8,2) not null, proteina numeric(8,2) not null,
  carboidrato numeric(8,2) not null, gordura numeric(8,2) not null,
  gramas_por_unidade numeric(8,2),
  fonte varchar(200) not null
);

create table receita (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  tipo varchar(20) not null check (tipo in ('SERIES','PLANO_TREINO','PLANO_DIETA')),
  nome varchar(120) not null,
  descricao varchar(400),
  conteudo jsonb not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
```

### V004__planos.sql

```sql
create table plano_treino (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid references aluno(id),          -- null = modelo reutilizável
  titulo varchar(120) not null,
  inicio date,
  fim date,
  ativo boolean not null default false,        -- plano vigente do aluno
  rascunho jsonb not null,
  rascunho_alterado_em timestamptz not null default now(),
  versao_publicada int not null default 0,     -- 0 = nunca publicado
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create unique index ux_plano_treino_ativo on plano_treino (aluno_id) where ativo;
create index ix_plano_treino_aluno on plano_treino (consultoria_id, aluno_id, criado_em desc);

create table plano_treino_versao (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  plano_id uuid not null references plano_treino(id),
  numero int not null,
  titulo varchar(120) not null,
  inicio date, fim date,
  conteudo jsonb not null,
  publicado_em timestamptz not null default now(),
  publicado_por uuid not null references usuario(id),
  unique (plano_id, numero)
);
-- plano_dieta e plano_dieta_versao: mesmas colunas (trocar "treino" por "dieta").
```

### V005__execucoes.sql

```sql
create table execucao_serie (
  id uuid primary key,                         -- gerado no aparelho
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid not null references aluno(id),
  plano_versao_id uuid not null references plano_treino_versao(id),
  sessao_uid uuid not null,
  exercicio_uid uuid not null,
  serie_uid uuid not null,
  exercicio_id uuid,                           -- biblioteca (histórico entre planos)
  data date not null,
  carga numeric(7,2) check (carga is null or (carga >= 0 and carga <= 2000)),
  unidade varchar(10) not null default 'kg',
  repeticoes int check (repeticoes is null or (repeticoes between 0 and 500)),
  concluida boolean not null default false,
  observacao varchar(500),
  alterado_no_aparelho_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  unique (aluno_id, plano_versao_id, serie_uid, data)
);
create index ix_exec_aluno_data on execucao_serie (consultoria_id, aluno_id, data desc);
create index ix_exec_aluno_exercicio on execucao_serie (aluno_id, exercicio_id, data desc);

create table registro_peso (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid not null references aluno(id),
  data date not null,
  peso_kg numeric(5,2) not null check (peso_kg > 0 and peso_kg < 500),
  observacao varchar(300),
  registrado_por uuid not null references usuario(id),
  criado_em timestamptz not null default now(),
  unique (aluno_id, data)
);
```

### V006__catalogo_publico.sql

Inserir o catálogo público de exercícios (lista da seção 13.4) e de alimentos (13.5). UUIDs fixos.

Toda migration nova: subir o total esperado no teste de migrations (como a Central faz em `FlywayMigrationIntegrationTest`).

---

## 7. Formatos JSON dos planos

Guardados em `jsonb` (rascunho e versões). Em Java, `record`s em `treino/ConteudoTreino.java` e
`dieta/ConteudoDieta.java`, (de)serializados com o `JsonMapper` do Jackson 3 **no service** (coluna mapeada como
`String` com `@JdbcTypeCode(SqlTypes.JSON)` — evita depender do FormatMapper do Hibernate com Jackson 3).
Todo `uid` é UUID gerado no cliente ao criar o item e **preservado** ao editar (é o que liga o registro do aluno).
No app, os mesmos tipos em `app/src/api/tipos.ts`.

### 7.1 ConteudoTreino

```json
{
  "objetivo": "Melhorar o físico (secar e crescer)",
  "orientacoes": "Texto livre do treinador (notas gerais do plano)",
  "sessoes": [
    {
      "uid": "uuid",
      "nome": "Segunda - Costas",
      "diaSemana": 1,                         // 1=segunda ... 7=domingo; null = sem dia fixo
      "tipo": "TREINO",                       // TREINO | DESCANSO_ATIVO | DESCANSO | ACESSORIOS
      "frequenciaSemanal": null,              // só ACESSORIOS (ex.: 2)
      "observacao": "Faça todos os treinos sem errar",
      "cardio": null,                         // texto livre, ex.: "Cardio 50 min ou HIIT de 25 min"
      "exercicios": [
        {
          "uid": "uuid",
          "exercicioId": "uuid da biblioteca ou null",
          "nome": "Remada baixa na polia unilateral",   // cópia (snapshot)
          "modalidade": "MAQUINA",                      // cópia
          "videoUrl": "https://youtube.com/...",        // cópia, validada
          "observacao": "Tronco levemente inclinado para o lado",
          "progressao": true,                 // false = "objetivo não é progressão de carga"
          "unidade": "kg",                    // "kg" ou "nenhuma" (elástico, peso corporal)
          "series": [
            {
              "uid": "uuid",
              "tipo": "FS",                   // texto da lista de tipos da consultoria (7.3)
              "repsMin": 3, "repsMax": 3,     // inteiros; repsMax >= repsMin; ambos null se for por tempo
              "alvoTexto": null,              // ex.: "50 min", "até a falha", "20-30 s de pausa"
              "intensidade": { "modo": "PERCENTUAL_WS", "percentual": 50 },
              "descansoSegundos": null
            }
          ]
        }
      ]
    }
  ]
}
```

`intensidade.modo`:
- `CARGA_TRABALHO`: é a série de trabalho (WS). Carga = carga de trabalho do dia.
- `PERCENTUAL_WS`: `percentual` (1–200) da referência (seção 8).
- `RIR`: `rir` (0–10). `RPE`: `rpe` (1–10, passo 0,5).
- `LIVRE`: `texto` (até 120). `NENHUMA`: sem intensidade (ex.: elástico, cardio).

Exibição agrupada: séries consecutivas com mesmo `tipo`, `repsMin`, `repsMax` aparecem como "3x3 - FS" (igual ao PDF
do Saraiva); "1x3 a 6 - WS" quando `repsMin != repsMax`. No banco ficam **individuais** (cada uma com seu `uid`).

### 7.2 ConteudoDieta

```json
{
  "objetivo": "Construção muscular",
  "dataInicio": "2026-10-05",
  "profissional": "Saraiva Team",
  "refeicoes": [
    {
      "uid": "uuid", "nome": "Café da manhã", "horario": "07:00", "observacao": null,
      "opcoes": [
        {
          "uid": "uuid", "rotulo": "A",
          "itens": [
            {
              "uid": "uuid", "alimentoId": "uuid ou null", "nome": "Pão de forma branco",
              "quantidade": 50, "unidade": "g",          // g | ml | un
              "kcal": 133, "proteina": 4.2, "carboidrato": 24.8, "gordura": 1.6,
              "manual": false                            // true = valores digitados pelo treinador
            }
          ]
        }
      ]
    }
  ],
  "orientacoes": [ { "titulo": "Hidratação", "texto": "3 a 4 litros de água" } ],
  "observacoes": "texto livre",
  "suplementacao": [ { "uid": "uuid", "nome": "", "dose": "", "horario": "", "observacao": "" } ]
}
```

- Valor do item: se `alimentoId` e não `manual`, o app calcula ao **editar** (`valor_base × quantidade_em_base /
  base_quantidade`) e grava o resultado no item. A versão publicada guarda os números, não recalcula depois.
- Arredondamento de exibição: kcal inteiro; macros 1 casa. Totais somam os valores **não arredondados** e arredondam
  no fim (explica 2.236 × 2.237 do PDF do Saraiva).
- **Total do dia** = soma da **primeira opção** de cada refeição, com o texto "Total do dia (opção A de cada
  refeição)". Nunca somar alternativas como se todas fossem consumidas.
- `suplementacao`: campo livre. Sem validação de conteúdo, sem sugestão, sem cálculo.

### 7.3 `consultoria.configuracao`

```json
{
  "tiposSerie": ["Aquecimento", "FS", "WS", "Back off", "Top set", "Rest pause", "Cluster"],
  "tipoTrabalho": "WS",
  "tipoPreparacao": "FS",
  "regraPreparacao": { "1": [85], "2": [70, 85], "3": [50, 70, 85] },
  "arredondamentoKg": 0.5,
  "instrucoesTreino": "texto livre impresso no fim do PDF do treino",
  "rodapePdf": "texto opcional"
}
```

`regraPreparacao` é a regra de FS do Saraiva (PDF: 3 FS = 50/70/85~90; 2 FS = 70/85~90; 1 FS = 85). O editor
usa para **preencher** os percentuais quando o treinador muda a quantidade de FS; depois cada série pode ser editada.

---

## 8. Regras de cálculo de carga (app do aluno)

Função pura `calcularCargasDoExercicio(exercicio, cargaTrabalho, registrosDoDia, config)` em
`app/src/dominio/cargas.ts`, com testes. Regras:

1. **Carga de trabalho do dia** (base): o aluno digita no topo do exercício. Valor sugerido = última carga registrada
   em série `CARGA_TRABALHO` para o mesmo `exercicioId` (vem de `ultimasCargas`). Sem histórico → campo vazio
   (não inventar).
2. Série `CARGA_TRABALHO` → sugestão = base.
3. Série `PERCENTUAL_WS` → referência = **maior carga já registrada hoje nas séries `CARGA_TRABALHO` desse
   exercício**; se nenhuma registrada, a base. Sugestão = referência × percentual / 100, arredondada ao múltiplo de
   `arredondamentoKg` mais próximo. Isso cobre "FS: % da WS a ser feita" e "Back off: % do maior peso feito na WS"
   (o PDF usa as duas frases).
4. `RIR`/`RPE`/`LIVRE`/`NENHUMA` → sem sugestão numérica; mostrar o texto ("1 RIR", "RPE 8").
5. Sugestão é só sugestão: o campo de carga de cada série é editável; o valor digitado é salvo **exatamente**
   (aceitar vírgula; 2 casas). Nunca arredondar o que o aluno digitou.
6. **Repetições nunca são presumidas.** Marcar a série como feita com repetições vazias grava `repeticoes = null` e
   mostra "—". Não existe parse de "3 a 6" (o modelo tem `repsMin`/`repsMax` numéricos).
7. `progressao = false` → não mostrar dica de aumento; mostrar "Foco em controle, não em carga".
8. `unidade = "nenhuma"` → esconder o campo de carga (só repetições/feito).
9. Dica informativa (opcional): se no último treino a WS teve `repeticoes > repsMax`, mostrar "Passou da faixa no
   último treino". Só texto; não altera valores.

Testes mínimos: FS 50/70/85 com base 30 → 15/21/25,5 (arredondamento 0,5); back off 90% depois de WS registrada
em 32 → 29 (28,8 arredondado); WS não registrada → back off usa a base; arredondamento 0,25; reps vazias → null.

---

## 9. API: rotas, permissões e comportamento

Prefixo: nenhum na API (`/auth/...`). No Docker o Caddy publica em `/api/*` e remove o prefixo.
Respostas de erro sempre `ApiError`. Listas paginadas onde indicado (`?pagina=0&tamanho=30`, máx. 100).

### 9.1 Públicas

| Método e rota | Corpo / resposta | Regras |
|---|---|---|
| `POST /auth/login` | `{email, senha}` → `{accessToken, expiresIn, refreshToken?, usuario, marca}` | Limite (5.3). `refreshToken` só no cliente nativo; web recebe cookie. |
| `POST /auth/refresh` | nativo: `{refreshToken}`; web: cookie + CSRF → igual ao login | Rotação; reuso revoga tudo. |
| `POST /auth/logout` | nativo: `{refreshToken}`; web: cookie + CSRF → 204 | Revoga o token; limpa cookie. |
| `POST /auth/cadastro-treinador` | `{nomeConsultoria, nome, email, senha}` → igual ao login | Cria consultoria (slug a partir do nome, único), usuário TREINADOR, configuração padrão (7.3) e receitas padrão (9.6). Limite por IP. |
| `GET /publico/convites/{codigo}` | → `{consultoria: marca pública, primeiroNomeAluno}` | Código inválido/expirado/usado → 404 genérico. Limite por IP. |
| `POST /publico/convites/{codigo}/aceitar` | `{email, senha}` → igual ao login | Cria usuário ALUNO ligado ao aluno; consome o convite (atômico); e-mail já usado → 409 `EMAIL_EM_USO`. |
| `GET /publico/marcas/{consultoriaId}/logo` | imagem | Pública (UUID não adivinhável); `nosniff`; cache longo com `?v=`. 404 se não houver. |

Marca pública = `{id, nome, lema, corPrimaria, fonteTitulo, temaPadrao, logoUrl}`. Sem dado de aluno.

### 9.2 Comuns (qualquer autenticado)

- `GET /eu` → `{usuario: {id, nome, email, papel}, marca, aluno?: {id, nome}}`
- `PUT /eu/senha` `{senhaAtual, senhaNova}` → incrementa `credenciais_versao`, revoga outras sessões, devolve sessão nova.

### 9.3 Treinador (`hasRole('TREINADOR')`)

**Marca e configuração**
- `GET /consultoria` → marca + configuração.
- `PUT /consultoria/marca` `{nome, lema, corPrimaria, fonteTitulo, temaPadrao}` (lock otimista `versao`).
- `PUT /consultoria/marca/logo` multipart `arquivo` (PNG/JPEG ≤ 512 KiB, bytes mágicos) → incrementa `logo_versao`.
- `DELETE /consultoria/marca/logo`.
- `PUT /consultoria/configuracao` (7.3, validar: percentuais 1–200, arredondamento ∈ {0.25, 0.5, 1, 2.5}).

**Início**
- `GET /painel` → `{alunosAtivos, alunosSemRegistro7Dias: [{id,nome,ultimoRegistro}], ultimasExecucoes: [{aluno, data, sessao, series}], planosTerminando: [{plano, aluno, fim}]}`.
  "Sem registro" é informação, **não** inativa ninguém.

**Alunos**
- `GET /alunos?busca=&situacao=ATIVO|INATIVO|TODOS&pagina=` → `{itens:[{id,nome,ativo,temAcesso,planoAtivo?,ultimoRegistro?}], total}`.
- `POST /alunos` `{nome, email?, objetivo?, observacoes?}` → aluno.
- `GET /alunos/{id}`, `PUT /alunos/{id}` (lock otimista), `PATCH /alunos/{id}/situacao` `{ativo}`
  (inativar: revoga sessões do usuário do aluno e incrementa `credenciais_versao`).
- `POST /alunos/{id}/convite` → `{codigo, link, expiraEm}` (código de 10 caracteres do alfabeto
  `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, banco guarda SHA-256, validade 7 dias, gerar outro invalida o anterior;
  o código só aparece nesta resposta). `link` = `{APP_URL}/convite?codigo=...`.
- `GET /alunos/{id}/execucoes?de=&ate=` → registros agrupados por data/sessão/exercício.
- `GET /alunos/{id}/progresso?exercicioId=` → `[{data, maiorCargaTrabalho, repeticoes}]`.
- `GET /alunos/{id}/pesos`, `POST /alunos/{id}/pesos` `{data, pesoKg, observacao?}`, `DELETE /alunos/{id}/pesos/{pesoId}`.
  Resposta com `variacao` calculada pela diferença para o registro anterior (por data).

**Biblioteca**
- `GET/POST /exercicios`, `PUT/DELETE /exercicios/{id}` (DELETE = inativar).
- `GET/POST /alimentos`, `PUT/DELETE /alimentos/{id}`.
- `GET /catalogo/exercicios?busca=`, `GET /catalogo/alimentos?busca=` (globais, só leitura).
- `POST /exercicios/importar-catalogo` `{ids:[...]}` e `POST /alimentos/importar-catalogo` → ignora os que já
  existem pelo nome; responde `{importados, ignorados}`.
- `POST /exercicios/importar-csv?confirmar=false|true` corpo texto CSV (`;` ou `,`, cabeçalho
  `nome;grupo;equipamento;modalidade;video`), até 1.000 linhas. `confirmar=false` → prévia
  `{validas:[...], erros:[{linha, motivo}], hash}`; `confirmar=true` exige o mesmo `hash` da prévia e grava tudo
  numa transação (como a importação do Servirea: prévia, hash, confirmação atômica). Mesmo para alimentos
  (`nome;quantidade_base;unidade;kcal;proteina;carboidrato;gordura;fonte`).

**Receitas** (pontos de partida editáveis, como as receitas de layout do Servirea)
- `GET /receitas?tipo=SERIES|PLANO_TREINO|PLANO_DIETA`, `POST /receitas`, `PUT/DELETE /receitas/{id}`.
- `POST /planos-treino/{id}/salvar-como-receita` `{nome, descricao}` (copia o rascunho, novos uids ao aplicar).

**Planos de treino**
- `GET /alunos/{alunoId}/planos-treino` → `[{id, titulo, inicio, fim, ativo, versaoPublicada, rascunhoAlteradoDepoisDePublicar}]`.
- `POST /alunos/{alunoId}/planos-treino` `{titulo, inicio?, fim?, receitaId?, copiarDoPlanoId?}` → rascunho vazio,
  da receita ou cópia (sempre com **uids novos**).
- `GET /planos-treino/{id}` → `{plano, rascunho, versoes:[{id, numero, publicadoEm}]}`.
- `PUT /planos-treino/{id}/rascunho` `{titulo, inicio, fim, conteudo, versao}` → 409 `CONFLITO_EDICAO` se `versao`
  antiga (outra aba salvou antes).
- `POST /planos-treino/{id}/validar` → `{erros:[{caminho, mensagem}], avisos:[...]}`.
- `POST /planos-treino/{id}/publicar` `{versao, confirmarAvisos}` → valida; com erro → 422 `PLANO_INVALIDO` com a lista;
  com aviso e sem `confirmarAvisos` → 422 `CONFIRMAR_AVISOS`; senão cria `plano_treino_versao` n+1 (cópia do
  rascunho), marca este plano `ativo` e desmarca o anterior do mesmo aluno (mesma transação).
- `POST /planos-treino/{id}/replicar` `{titulo, inicio, fim}` → novo plano (rascunho = última versão publicada,
  uids novos, mesmo aluno). É o "replicar para o próximo mês" do Servirea.
- `GET /planos-treino/{id}/versoes/{numero}` → conteúdo publicado (para PDF e consulta).

**Validação do treino** (`ValidadorTreino`, também usada no app para mostrar antes de publicar):
- Erros: sessão sem nome; sessão `TREINO` sem exercício; exercício sem série; `repsMax < repsMin`; percentual fora de
  1–200; `PERCENTUAL_WS` num exercício sem série `CARGA_TRABALHO` **e** sem base possível (avisar); URL de vídeo
  inválida; uid repetido.
- Avisos: duas sessões no mesmo `diaSemana`; exercício com `progressao=false` e série `CARGA_TRABALHO`;
  plano sem dia de descanso; `fim < inicio`.

**Planos de dieta**: mesmas rotas trocando `planos-treino` por `planos-dieta`. Validação: refeição sem opção, opção sem
item, item com quantidade ≤ 0, item manual sem kcal; aviso: nomes de refeição repetidos, total do dia com 0 kcal.

### 9.4 Aluno (`hasRole('ALUNO')`, sempre o aluno do token)

- `GET /aluno/painel` → pacote para uso offline:
  `{marca, aluno:{nome}, treino: {planoId, versaoId, numero, titulo, inicio, fim, publicadoEm, conteudo} | null,
   ultimasCargas: {exercicioId: {carga, repeticoes, data}}, configuracao: {arredondamentoKg, tipoTrabalho}, geradoEm}`.
- `GET /aluno/dieta` → versão publicada do plano de dieta ativo (online; o app pode guardar em cache só para leitura).
- `POST /aluno/execucoes/lote` `{registros:[{id, planoVersaoId, sessaoUid, exercicioUid, serieUid, data, carga,
  repeticoes, concluida, observacao, alteradoNoAparelhoEm}]}` (máx. 300) → `{resultados:[{id, situacao: ACEITO |
  IGNORADO_ANTIGO | RECUSADO, motivo?}]}`.
  - Conferir: versão pertence a plano **deste aluno** (qualquer versão já publicada dele, inclusive antiga);
    `serieUid` existe naquela versão (e no `exercicioUid`/`sessaoUid` informados); data entre hoje −60 e hoje +1.
  - Upsert pela chave `(aluno_id, plano_versao_id, serie_uid, data)`: se existe e `alteradoNoAparelhoEm` recebido é
    mais novo → atualiza; mais antigo/igual → `IGNORADO_ANTIGO`. `id` existente de **outro aluno** → `RECUSADO`.
  - SQL nativo `INSERT ... ON CONFLICT (aluno_id, plano_versao_id, serie_uid, data) DO UPDATE ... WHERE
    excluded.alterado_no_aparelho_em > execucao_serie.alterado_no_aparelho_em` (classe na lista do ArchUnit).
  - Preencher `exercicio_id` a partir do conteúdo da versão (não do cliente).
- `GET /aluno/execucoes?de=&ate=` → histórico do próprio aluno.
- `GET /aluno/pesos` → registros de peso (só leitura nesta entrega).

### 9.5 Respostas de erro com código (para o app tratar)

`DADOS_INVALIDOS`, `LOGIN_LIMITADO`, `CREDENCIAIS_INVALIDAS`, `SESSAO_EXPIRADA`, `EMAIL_EM_USO`, `CONFLITO_EDICAO`,
`PLANO_INVALIDO`, `CONFIRMAR_AVISOS`, `CORPO_EXCEDIDO`, `ARQUIVO_INVALIDO`, `NAO_ENCONTRADO`.

### 9.6 Receitas padrão criadas em toda consultoria nova

`SERIES` (o conteúdo é uma lista de séries no formato 7.1, sem uids; uids nascem ao aplicar):
1. "Aquecimento + 3 FS + WS + 2 Back off 85%": Aquecimento 1x10-15 (NENHUMA), FS 3x3 (50/70/85), WS 1x3-6, Back off 2x6-8 (85%).
2. "3 FS + WS + 2 Back off 85%".
3. "2 FS + WS + 2 Back off 85%": FS 2x3 (70/85).
4. "2 FS + 2 WS" (sem back off).
5. "1 FS + 2 WS": FS 1x3-5 (85).
6. "Séries simples 3x8-12" (tipo "Série", RIR 2) — para treinadores que não usam FS/WS.
7. "Cardio" (tipo "Cardio", alvoTexto "50 min ou HIIT 25 min", NENHUMA).

`PLANO_TREINO`: "Semana Saraiva (Seg Costas, Ter Peito+Ombros, Qua Pernas, Qui Off ativo, Sex Upper, Sáb Pernas,
Dom Off ativo)" — só as sessões vazias com nome, dia e tipo; "Semana ABC" e "Semana ABCD" (sessões vazias).

`PLANO_DIETA`: "5 refeições (café, lanche, almoço, lanche/ceia, janta)", "3 refeições + 2 lanches".

No editor: painel "Receitas" ao lado (como o Servirea) com "Usar esta receita"; aplicar cria uids novos e é
desfazível ("Desfazer" volta ao estado anterior do rascunho, em memória).

---

## 10. App Expo (treinador e aluno)

### 10.1 Criação

```bash
cd Saraiva-api
nvm use 24.21.0              # ou instalar o Node 24.21.0
npx create-expo-app@latest app --template default@sdk-57
cd app
npm run reset-project        # remove as telas de exemplo (se o template tiver o script)
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants \
  expo-status-bar expo-secure-store @react-native-async-storage/async-storage @react-native-community/netinfo \
  expo-sqlite expo-print expo-sharing expo-image-picker expo-crypto expo-font @expo-google-fonts/metal-mania \
  @expo-google-fonts/inter react-native-svg react-native-web react-dom @expo/metro-runtime
npm i lucide-react-native
npx expo install --check && npx expo-doctor
```

Ler o `AGENTS.md` do `mobile/` (instruções do Expo): usar Expo Router com rotas em `src/app/`, nada de editar
`ios/`/`android/` à mão, ler a documentação **versionada do SDK 57** (`https://docs.expo.dev/versions/v57.0.0/`)
antes de usar qualquer API do Expo.

`app.json`: `name` "Treinos" (nome técnico neutro — a marca vem do treinador), `slug` "treinos",
`scheme` "treinos", `userInterfaceStyle` "automatic", `web.output` "single", `web.bundler` "metro",
`ios.bundleIdentifier`/`android.package` `br.com.treinos.app`. Scripts: `start`, `web`, `android`, `ios`,
`lint` (`expo lint`), `typecheck` (`tsc --noEmit`), `test` (`jest` com `jest-expo`), `export:web`
(`expo export --platform web`).

### 10.2 Estrutura (`app/src/`)

```
app/                          # rotas (Expo Router)
  _layout.tsx                 # SafeAreaProvider, TemaProvider, SessaoProvider, fontes, Stack sem header
  index.tsx                   # redireciona: sem sessão → /entrar; TREINADOR → /(treinador); ALUNO → /(aluno)
  entrar.tsx                  # login (marca neutra) + links "Tenho um convite" e "Sou treinador, criar conta"
  convite.tsx                 # ?codigo= → mostra a marca do treinador e cria a conta do aluno
  cadastro.tsx                # cadastro de treinador
  (treinador)/_layout.tsx     # menu lateral (largura ≥ 900) ou barra inferior (celular); guarda de papel
  (treinador)/index.tsx       # Início (painel)
  (treinador)/alunos/index.tsx, novo.tsx, [id].tsx
  (treinador)/treinos/[id].tsx   # editor de plano de treino
  (treinador)/dietas/[id].tsx    # editor de plano de dieta
  (treinador)/biblioteca.tsx     # abas Exercícios | Alimentos | Catálogo | Importar CSV
  (treinador)/receitas.tsx
  (treinador)/marca.tsx          # marca, logo, tema padrão, regra FS, arredondamento, instruções do PDF
  (treinador)/perfil.tsx         # senha, tema do usuário, sair
  (aluno)/_layout.tsx            # barra inferior: Treino | Dieta | Histórico | Conta
  (aluno)/index.tsx              # treino: semana + "Treino de hoje"
  (aluno)/sessao/[uid].tsx       # exercícios da sessão, registro por série
  (aluno)/dieta.tsx
  (aluno)/historico.tsx
  (aluno)/conta.tsx              # tema, sincronização, sair
api/        cliente.ts (fetch + refresh compartilhado + destino), destino-api.ts, tipos.ts, rotas.ts (uma função por rota)
sessao/     SessaoProvider.tsx, armazenamentoSeguro.ts (SecureStore nativo / memória na web)
tema/       tokens.ts, TemaProvider.tsx (claro/escuro + cor da marca)
ui/         Botao, Campo, CampoNumero, Cartao, Selo (badge), Abas, Cabecalho, Vazio, Carregando,
            PainelConfirmacao, Aviso (toast), ListaSelecao, MarcaTitulo (nome com fonte da marca), IconeBotao
dominio/    cargas.ts, agrupamento.ts (3x3 - FS), totaisDieta.ts, validacaoTreino.ts, validacaoDieta.ts, uid.ts
offline/    repositorioLocal.ts (interface), sqlite.ts (nativo), webStorage.ts (web), sincronizacao.ts
pdf/        pdfTreino.ts, pdfDieta.ts, imprimir.ts
```

### 10.3 Design (flat utilitário em cartões)

Regras: cores sólidas, **sem sombra, sem gradiente, sem 3D**, cantos 4 px, bordas de 1 px, grade de 8 px,
cartões separando seções/dias/exercícios, alto contraste só em status e ação. Ícones lineares (lucide), 18–20 px.
Fonte da interface: Inter (400/600/700). Títulos de seção em caixa alta pequena (12 px, letter-spacing 0.6).

`tema/tokens.ts`:

| Token | Escuro | Claro |
|---|---|---|
| `fundo` | `#0E0E10` | `#F4F4F5` |
| `superficie` | `#17171A` | `#FFFFFF` |
| `superficie2` | `#1F1F23` | `#F0F0F2` |
| `borda` | `#2A2A2F` | `#DCDCE0` |
| `texto` | `#F2F2F3` | `#111114` |
| `textoSuave` | `#9A9AA2` | `#5F5F67` |
| `sucesso` | `#1F9D55` | `#1A7F45` |
| `atencao` | `#B7791F` | `#9A6412` |
| `perigo` | `#E5484D` | `#C62828` |
| `neutro` | `#6B6B73` | `#8A8A92` |
| `marca` | `consultoria.corPrimaria` | idem |

- Cor da **marca** só em ação principal, item de menu ativo e título da marca. **Status nunca usa a cor da marca**
  (regra do design do ecossistema): verde = feito/sincronizado/ativo; âmbar = aguardando envio/rascunho/pendente;
  vermelho = erro/excluir; cinza = inativo/encerrado. Status sempre com **texto** (selo 11 px, caixa alta, fundo
  translúcido e borda fina).
- Texto sobre a cor da marca: calcular contraste (branco ou preto, o que der maior contraste WCAG).
- Tema: padrão = `consultoria.temaPadrao`; o usuário troca em Perfil/Conta (guardar escolha por usuário no
  armazenamento local; preferência visual, não é dado sensível).
- `MarcaTitulo`: logo (se houver) ou nome da consultoria; com `fonteTitulo = METAL` usa `MetalMania_400Regular`.
- Alvos de toque ≥ 44 px. Campos numéricos com teclado numérico (`keyboardType="decimal-pad"`).
- Usar `SafeAreaView` de `react-native-safe-area-context` (o do `react-native` está obsoleto e quebrou o topo no
  protótipo). Nada de botão flutuante cobrindo conteúdo.
- Responsivo: web/PC com menu lateral fixo e conteúdo até 1100 px; celular com barra inferior.
- Acessibilidade: `accessibilityLabel` em ícones, foco visível na web, contraste AA.

### 10.4 Telas do treinador (o que cada uma faz)

1. **Início**: cartões "Alunos ativos" (número), "Sem registro há 7 dias" (lista, com texto "pode ter treinado sem
   registrar"), "Últimos registros", "Planos terminando em 7 dias" (botão "Replicar").
2. **Alunos**: busca (debounce 300 ms), filtro situação, lista em cartões (nome, selo ATIVO/INATIVO, "tem acesso",
   plano ativo). Botão "Novo aluno".
3. **Ficha do aluno** (blocos/cartões, cada um com seus botões): Dados (editar), Acesso (gerar convite → mostra código
   e link com botão copiar; selo "com acesso"/"sem acesso"), Treino (planos com selo PUBLICADO/RASCUNHO/ATIVO,
   "Novo plano" com opção receita/cópia, "Replicar", "PDF"), Dieta (idem), Peso (lista + adicionar, variação),
   Registros (últimos 14 dias agrupados) e Progresso (lista por exercício: data × maior carga de trabalho; gráfico
   simples é opcional).
4. **Editor de treino** (a tela mais importante):
   - Topo: título, período (campos de data no formato DD/MM/AAAA, nunca seletor nativo da web), selos de estado
     ("Rascunho salvo", "Alterado desde a publicação"), botões Validar, PDF, Publicar.
   - Sessões em cartões (nome, dia da semana, tipo, cardio, observação), reordenar com setas ↑↓.
   - Exercício em cartão: escolher da biblioteca (busca com lista), observação, vídeo, progressão (liga/desliga),
     unidade; séries **agrupadas** ("3x3 - FS 50/70/85%") com editor por grupo: tipo, quantidade (− +), reps
     mín/máx, intensidade; expandir para editar percentual de cada série. Mudar a quantidade de um grupo de
     preparação (FS) reaplica `regraPreparacao`.
   - Painel "Receitas" (lateral no PC, folha inferior no celular): aplicar receita de séries no exercício ou de
     semana no plano; "Desfazer".
   - Salvamento automático do rascunho (debounce 1,5 s) com indicação "Salvando…/Salvo"; 409 → painel "Outra
     pessoa/aba alterou. Recarregar".
   - Publicar: mostra erros (bloqueiam) e avisos (exigem confirmação) em painel; sucesso → selo "Publicado vN".
5. **Editor de dieta**: cabeçalho (objetivo, início, profissional), refeições em cartões com opções A/B
   (adicionar opção), itens (alimento da biblioteca ou manual; quantidade; valores calculados), total por opção,
   "Total do dia (opção A de cada refeição)", orientações (lista título/texto), observações, suplementação (tabela
   livre). Mesmo fluxo de rascunho/validar/publicar/replicar/PDF.
6. **Biblioteca**: abas Exercícios (lista, novo/editar, vídeo), Alimentos (valores por base), Catálogo (busca no
   catálogo público, marcar vários, "Importar selecionados"), Importar CSV (colar ou escolher arquivo, prévia com
   erros por linha, confirmar).
7. **Receitas**: listar/criar/editar/excluir receitas de séries, planos de treino e dieta.
8. **Marca**: nome, lema, cor (campo hex + 8 cores sugeridas), fonte do título (Padrão/Metal com prévia), tema padrão,
   logo (enviar/remover, prévia), **prévia ao vivo** do cabeçalho do app do aluno nos dois temas; regra FS,
   arredondamento, tipos de série, instruções do PDF.
9. **Perfil**: trocar senha, tema, sair.

### 10.5 Telas do aluno

1. **Treino**: cabeçalho com a marca; cartão grande "Treino de hoje" (sessão do dia da semana; se descanso, mostra o
   cardio/orientação); lista da semana em cartões; selo de sincronização no topo ("Sincronizado" verde,
   "N aguardando envio" âmbar, "Sem conexão — salvo no aparelho" cinza, "Falha ao enviar — tentar de novo" vermelho).
2. **Sessão**: exercícios em cartões (nome, modalidade, observação, botão "Vídeo"); ao abrir um exercício:
   campo "Carga de trabalho de hoje" (sugestão da última vez), lista de séries com meta ("Meta: 3 a 6 reps",
   "50% WS", "1 RIR"), campo de carga (sugestão calculada, editável), campo de repetições (vazio por padrão) e
   botão ✓ (marca feita e grava localmente na hora). Observação do exercício no dia. **O plano não é editável.**
3. **Dieta**: refeições em cartões, opções em abas A/B, itens com valores, totais; orientações. Botão PDF. Online
   (mostra "Sem conexão" se não houver cache).
4. **Histórico**: por data, exercícios feitos com carga × reps; peso (lista).
5. **Conta**: tema, "Sincronizar agora", quantidade pendente, sair (com aviso se houver pendência).

### 10.6 Cliente HTTP (`api/cliente.ts`)

- URL da API: `EXPO_PUBLIC_API_URL`; se ausente: web → `/api` (mesma origem); nativo em desenvolvimento → derivar do
  host do Metro (`Constants.expoConfig?.hostUri`, ex.: `192.168.0.10:8081` → `http://192.168.0.10:8088/api`).
- Anexar `Authorization`/XSRF/credenciais só se `caminhoDaApi(url, API_URL) !== null`.
- Header `X-Treinos-Cliente: web|nativo`.
- 401 → um único refresh compartilhado (fila de requisições esperando), repete uma vez; falhou → sessão encerrada.
  Erros `CONFLITO_EDICAO`, `PLANO_INVALIDO`, `CONFIRMAR_AVISOS` nunca disparam refresh/repetição automática.
- Timeout de 15 s com `AbortController`. Mensagem de erro amigável a partir de `ApiError.message`.

---

## 11. Offline e sincronização do aluno

Princípio: cada dado tem um único autor. Plano = treinador (o aparelho só lê a versão baixada).
Registro de série = aluno (o aparelho escreve; o servidor aceita de forma idempotente). Quase não há conflito.

### 11.1 Armazenamento local (`offline/repositorioLocal.ts`)

Interface única com duas implementações:
- **Nativo**: `expo-sqlite`, banco `treinos-<usuarioId>.db` (um por usuário → troca de conta não mistura dados).
  Tabelas: `pacote (chave text primary key, json text, salvo_em text)`, `registro (id text primary key,
  plano_versao_id, sessao_uid, exercicio_uid, serie_uid, data, carga real, repeticoes int, concluida int,
  observacao text, alterado_em text, situacao text)` com índice único `(plano_versao_id, serie_uid, data)`,
  `carga_trabalho (exercicio_uid, data, carga, primary key(exercicio_uid, data))`.
- **Web**: mesma interface sobre `AsyncStorage` (localStorage), chaves com prefixo `treinos:<usuarioId>:`.
  (Se faltar tempo, AsyncStorage também no nativo é aceitável **para a demo**, registrando a pendência.)

`situacao` do registro: `LOCAL` (gravado no aparelho, aguardando envio) → `ENVIADO` (servidor aceitou) ou
`FALHOU` (recusado/erro; mostra motivo e permite tentar de novo).

### 11.2 Fluxo

1. Login do aluno → `GET /aluno/painel` → salvar pacote. Sem internet depois do login → usar o pacote salvo.
2. Registrar série → upsert local pela chave `(plano_versao_id, serie_uid, data)`; se já existe, mantém o **mesmo
   id** e atualiza valores e `alterado_em`; `situacao = LOCAL`. A tela atualiza na hora.
3. Sincronizar (`offline/sincronizacao.ts`), disparado: ao gravar (debounce 2 s), ao voltar conexão (NetInfo), ao
   voltar o app para primeiro plano (`AppState`), botão "Sincronizar agora", e a cada 60 s com o app aberto se houver
   pendência. Uma sincronização por vez (trava em memória).
4. Envia lotes de até 300 `LOCAL` mais antigos. Para cada resultado: `ACEITO`/`IGNORADO_ANTIGO` → `ENVIADO`
   (se o registro mudou localmente depois do envio, continua `LOCAL`: comparar `alterado_em`); `RECUSADO` →
   `FALHOU` com motivo. Erro de rede/5xx → mantém `LOCAL`, tenta de novo com espera crescente (5 s, 15 s, 60 s, 5 min).
5. Depois de enviar com sucesso, atualizar o pacote (`GET /aluno/painel`) se online. Se o treinador publicou versão
   nova, o aluno passa a ver a nova; registros da versão antiga continuam válidos e são enviados normalmente.
6. Logout/troca de conta: se houver `LOCAL`/`FALHOU`, painel de confirmação; ao confirmar, apagar o banco/prefixo
   daquele usuário e o SecureStore.

### 11.3 Testes de unidade obrigatórios do offline

Upsert local mantém o id; envio repetido não duplica; registro alterado durante o envio continua pendente;
`RECUSADO` vira `FALHOU`; falha de rede mantém `LOCAL`; prefixo por usuário isola dados de dois usuários.

---

## 12. PDFs (treino e dieta)

- Gerados no app a partir dos dados estruturados (nunca imagem da tela), em HTML + CSS de impressão:
  `pdf/pdfTreino.ts` e `pdf/pdfDieta.ts` devolvem HTML; `pdf/imprimir.ts`:
  - nativo: `Print.printToFileAsync({ html })` + `Sharing.shareAsync(uri)`;
  - web: `iframe` oculto com `srcdoc = html` e `iframe.contentWindow.print()` (não depender de `Print.printAsync` na web).
- Sempre **fundo branco** (impressão clara), A4, margens 14 mm, fonte do sistema. Cabeçalho com logo (data URI da
  logo baixada da API) ou nome da consultoria em caixa alta; cor da marca em títulos e linhas.
- Quebras: `break-inside: avoid` em cada exercício/refeição; título nunca sozinho no fim da página
  (`break-after: avoid` nos títulos); tabelas com `thead` repetido. Sem página quase vazia no fim.
- Escapar HTML de todo texto vindo do usuário (função `esc()`), inclusive no `srcdoc`.

**PDF do treino** (formato do Saraiva): título da consultoria; nome do aluno; tabela da semana (Segunda…Domingo →
nome da sessão); nota/objetivo/orientações; para cada sessão: título "Segunda - Costas" e tabela
`EXERCÍCIO | SÉRIES x REPS | OBS | VÍDEO` (séries agrupadas: "1x10 a 15 - Aquecimento", "3x3 - FS",
"1x3 a 6 - WS", "2x6 a 8 - Back off"; OBS com observação + "Back off - 85% da WS" gerado da intensidade;
VÍDEO = link "Vídeo"); dias Off com o cardio; acessórios ("2x na semana"); no fim, `instrucoesTreino` da consultoria.

**PDF da dieta** (formato do Saraiva): "SUGESTÃO DE PLANO ALIMENTAR" + "Elaborado por profissional habilitado"
(texto configurável); Identificação (aluno, objetivo, data de início, profissional, emitido em); Distribuição diária
de macronutrientes (totais da opção A, com a frase "Total do dia considerando a opção A de cada refeição");
refeições "Sugestão — Refeição N — NOME", opções "▸ OPÇÃO A", itens
"• Nome qtd | kcal · P: x g · C: y g · G: z g", "Total: ..."; Orientações e recomendações; Observações;
Suplementação (tabela livre Suplemento | Dose | Horário | Obs, só se houver linhas); Acompanhamento de peso
(Data | Peso | Variação | Obs, variação calculada).

---

## 13. Dados de demonstração (seed)

`demo/SeedDemo.java`, roda só com `treinos.demo.seed=true` (profile `demo`) e só se não existir nenhuma consultoria.
Senha de todas as contas = `DEMO_SENHA` (variável obrigatória nesse profile, sem padrão).
**Não usar nenhum dado pessoal real** (nem nome, nem peso, nem protocolo dos PDFs). Aluno é fictício.

### 13.1 Consultoria 1 — Saraiva Team (piloto)

- Marca: nome "SARAIVA TEAM", lema vazio, cor `#C62828`, fonte `METAL`, tema `ESCURO`, sem logo (o Saraiva envia a
  dele na demo, pela tela Marca).
- Treinador: `saraiva@demo.local` (nome "Saraiva").
- Configuração: 7.3 com `regraPreparacao` do Saraiva, arredondamento 0,5 e `instrucoesTreino` = texto da seção
  "Instruções" do PDF do Plano 16 (Progressive Overloading, Rest Pause, Feeder Set e cálculo, Working Set, livres
  1 RIR / máquinas até a falha, Amplitude, Anotação de carga, Muscle Round, RM, Top set, Back off, Cardio, RIR 0–5).
  O texto está no PDF que o Gustavo tem; se não estiver disponível, usar o resumo de `docs/Instruções e Regras.csv`.
- Biblioteca de exercícios: todos os exercícios de `mobile/src/database/pdf_plan_parser.ts` (nomes exatos), com
  modalidade (`isFreeWeight` → LIVRE, senão MAQUINA; Clamshell → ELASTICO; "Elevação pélvica" MAQUINA) e vídeo de
  `mobile/src/constants/exerciseVideos.ts` (só URLs que passarem na validação 5.5).
- Biblioteca de alimentos (fonte "Plano do treinador (exemplo)"), valores por 100 g derivados do PDF:

| Alimento | kcal | P | C | G |
|---|---|---|---|---|
| Pão de forma branco | 266 | 8,4 | 49,6 | 3,2 |
| Semente de chia | 500 | 16 | 42 | 30 |
| Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi) | 40 | 0,53 | 10 | 0 |
| Iogurte desnatado | 36 | 3,53 | 5 | 0,13 |
| Aveia em flocos | 393,3 | 14 | 66,67 | 8,33 |
| Banana prata | 98 | 1,3 | 25,7 | 0,1 |
| Arroz branco cozido | 127,8 | 2,5 | 28,1 | 0,22 |
| Peito de frango grelhado | 159 | 32 | 0 | 2,7 |
| Batata inglesa cozida | 80 | 1,2 | 20 | 0,12 |

  "Ovo inteiro" e "Legumes" ficam como **itens manuais** no plano (o PDF tem valores inconsistentes: 3 ovos/180 g com
  133 kcal; legumes com 45 kcal e macros zerados). Não criar base por 100 g para eles.
- Aluno fictício: "Aluno Demonstração" (`aluno@demo.local`), ativo, com acesso.
- Plano de treino **publicado** (v1, ativo), título "Plano 16", período de 16 dias começando na segunda-feira da
  semana atual, conteúdo = Plano 16 (`pdf_plan_parser.ts`), com:
  - FS/WS/Back off convertidos para o formato 7.1 (`FS` → `PERCENTUAL_WS` com o multiplicador × 100;
    `WORKING_SET` → `CARGA_TRABALHO`; `BACKOFF` → `PERCENTUAL_WS`; `WARMUP` → tipo "Aquecimento", `NENHUMA`);
  - reps como números (ex.: "3 - 6 (Falha)" → 3/6 e observação "Máquina: até a falha" vinda da modalidade);
  - Quinta = "Off ativo" (o PDF tem um título "Quarta - Off ativo" que contradiz o resumo; usar quinta e listar
    na seção 19 para confirmar com o Saraiva);
  - Off ativo com cardio "Cardio 50 min livre ou HIIT de 25 min (1 min forte + 1 min leve), BPM 140 a 150";
  - sessão ACESSORIOS "Acessórios (2x na semana, no final do treino)": "Abdominal supra" 2x6-8, observação
    "Máquina de preferência ou polia alta com corda. Comece com carga alta desde a primeira série.";
  - "Clamshell" e "Elevação pélvica"/"Leg press 45º" com `progressao = false` onde o PDF diz que o objetivo não é
    progressão de carga ("Elevação pélvica" e "Leg press 45º"); Clamshell com `unidade = "nenhuma"`.
- Execuções de exemplo: duas semanas anteriores com cargas plausíveis em 6 exercícios (para o histórico e o progresso
  aparecerem). Marcar no código que são dados fictícios.
- Plano de dieta **publicado**: as 5 refeições do PDF do Saraiva com os itens e valores exatos do PDF (incluindo as
  opções A/B das refeições 3 e 5; Ovo e Legumes como manuais com os valores do PDF), orientações "Hidratação: 3 a 4
  litros de água", "Refeição livre: sem refeição livre até a próxima atualização" e as observações (salada à vontade;
  pelo menos 100 g de legumes nas principais refeições; frango pode ser trocado por outra carne magra).
  **Suplementação vazia** e **sem** a linha de protocolo.
- Peso fictício: 4 registros (ex.: 82,0 / 81,4 / 81,1 / 81,3 kg) em datas recentes.

### 13.2 Consultoria 2 — "Consultoria Exemplo" (prova de vários treinadores e isolamento)

- Marca: cor `#2563EB`, fonte `PADRAO`, tema `CLARO`. Treinador `exemplo@demo.local`. Aluno fictício
  `aluno2@demo.local` com um plano "ABC" publicado usando receitas "Séries simples".

### 13.3 Contas da demo (README)

| Conta | Papel | Consultoria |
|---|---|---|
| `saraiva@demo.local` | Treinador | Saraiva Team |
| `aluno@demo.local` | Aluno | Saraiva Team |
| `exemplo@demo.local` | Treinador | Consultoria Exemplo |
| `aluno2@demo.local` | Aluno | Consultoria Exemplo |

### 13.4 Catálogo público de exercícios (V006)

Nome; grupo; equipamento; modalidade:
Supino reto com barra; Peito; Barra; LIVRE · Supino inclinado com halteres; Peito; Halteres; LIVRE ·
Supino reto na máquina; Peito; Máquina; MAQUINA · Crucifixo na máquina (peck deck); Peito; Máquina; MAQUINA ·
Crossover na polia; Peito; Polia; MAQUINA · Flexão de braço; Peito; Peso corporal; PESO_CORPORAL ·
Puxada alta na polia; Costas; Polia; MAQUINA · Remada curvada com barra; Costas; Barra; LIVRE ·
Remada baixa na polia; Costas; Polia; MAQUINA · Remada unilateral com halter; Costas; Halteres; LIVRE ·
Remada na máquina articulada; Costas; Máquina; MAQUINA · Barra fixa; Costas; Peso corporal; PESO_CORPORAL ·
Pulldown com corda; Costas; Polia; MAQUINA · Desenvolvimento com halteres; Ombros; Halteres; LIVRE ·
Desenvolvimento na máquina; Ombros; Máquina; MAQUINA · Elevação lateral com halteres; Ombros; Halteres; LIVRE ·
Elevação lateral na máquina; Ombros; Máquina; MAQUINA · Crucifixo inverso na máquina; Ombros; Máquina; MAQUINA ·
Face pull na polia; Ombros; Polia; MAQUINA · Rosca direta com barra; Bíceps; Barra; LIVRE ·
Rosca alternada com halteres; Bíceps; Halteres; LIVRE · Rosca martelo; Bíceps; Halteres; LIVRE ·
Rosca na polia; Bíceps; Polia; MAQUINA · Tríceps na polia com corda; Tríceps; Polia; MAQUINA ·
Tríceps na polia com barra; Tríceps; Polia; MAQUINA · Tríceps francês com halter; Tríceps; Halteres; LIVRE ·
Mergulho nas paralelas; Tríceps; Peso corporal; PESO_CORPORAL · Agachamento livre; Pernas; Barra; LIVRE ·
Agachamento no smith; Pernas; Smith; MAQUINA · Leg press 45º; Pernas; Máquina; MAQUINA ·
Leg press horizontal; Pernas; Máquina; MAQUINA · Hack machine; Pernas; Máquina; MAQUINA ·
Cadeira extensora; Quadríceps; Máquina; MAQUINA · Cadeira flexora; Posterior; Máquina; MAQUINA ·
Mesa flexora; Posterior; Máquina; MAQUINA · Stiff com barra; Posterior; Barra; LIVRE ·
Levantamento terra; Posterior; Barra; LIVRE · Elevação pélvica; Glúteos; Barra/Máquina; MAQUINA ·
Abdução de quadril na máquina; Glúteos; Máquina; MAQUINA · Abdução de quadril na polia; Glúteos; Polia; MAQUINA ·
Afundo com halteres; Pernas; Halteres; LIVRE · Búlgaro com halteres; Pernas; Halteres; LIVRE ·
Panturrilha em pé na máquina; Panturrilha; Máquina; MAQUINA · Panturrilha sentado; Panturrilha; Máquina; MAQUINA ·
Abdominal supra na máquina; Abdômen; Máquina; MAQUINA · Abdominal na polia alta com corda; Abdômen; Polia; MAQUINA ·
Prancha; Abdômen; Peso corporal; PESO_CORPORAL · Elevação de pernas; Abdômen; Peso corporal; PESO_CORPORAL ·
Esteira; Cardio; Esteira; CARDIO · Bicicleta ergométrica; Cardio; Bicicleta; CARDIO · Elíptico; Cardio; Elíptico; CARDIO ·
Clamshell com elástico; Glúteos; Elástico; ELASTICO.

### 13.5 Catálogo público de alimentos (V006, depois V007)

> **Atualizado:** o catálogo real (TACO 4ª ed. com 591 alimentos e 825 exercícios novos em português) entrou nas
> migrations V007/V008. Ver `PLANO-CATALOGO-PUBLICO.md`, `dados/fontes/README.md` e `dados/relatorios/`. O texto abaixo
> descreve só o que a V006 trouxe para a demonstração; os 9 alimentos de exemplo foram retirados do catálogo na V007.

Para a demo, os 9 alimentos da tabela 13.1 com `fonte = 'Valores de demonstração (plano de exemplo). Não usar como
referência nutricional.'`. **Não** digitar valores de memória como se fossem da TACO. A base oficial (TACO/IBGE)
entra depois, com licença e versão verificadas e a fonte gravada em cada item (pendência na seção 19).

---

## 14. Docker local e Caddy

### 14.1 `docker-compose.yml` (raiz)

- `db`: `postgres:17-alpine`, volume `dados-db`, `POSTGRES_DB=treinos`, usuário/senha do `.env`, healthcheck
  `pg_isready`. **Sem** porta publicada (só rede interna), exceto se `DB_PORTA_LOCAL` for definida (opcional).
- `api`: build `./api` (Dockerfile multi-stage: `maven:3.9-eclipse-temurin-21` → `eclipse-temurin:21-jre-alpine`,
  usuário não-root, `-XX:MaxRAMPercentage=75`), profiles `docker,demo`, variáveis do `.env`, depende de `db` saudável,
  healthcheck em `/actuator/health`. Sem porta publicada.
- `web`: build `./app` (Dockerfile multi-stage: `node:24.21.0-alpine` com `npm ci` + `npx expo export --platform web`
  → `caddy:2-alpine` servindo `dist/`), `deploy-local/Caddyfile`, porta **8088:80**, depende de `api` saudável.
- Caddyfile: `:80 { handle_path /api/* { reverse_proxy api:8080 } handle { root * /srv; try_files {path} /index.html; file_server } }`
  + cabeçalhos da seção 5.8.1 + `request_body { max_size 6MB }`. Cache: `*.js *.css *.woff2` com hash → 1 ano;
  `index.html` → `no-cache`.

### 14.2 `.env.example`

```
POSTGRES_USER=treinos
POSTGRES_PASSWORD=           # obrigatório: gerar uma senha
TREINOS_JWT_SEGREDO=         # obrigatório: openssl rand -base64 48
DEMO_SENHA=                  # obrigatório no profile demo: senha das contas de demonstração
CORS_ALLOWED_ORIGINS=http://localhost:8081
APP_URL=http://localhost:8088
REFRESH_COOKIE_SECURE=false  # só local por IP da rede (http). Em produção: true.
REFRESH_COOKIE_PATH=/api/auth
```

### 14.3 Como rodar (README)

```bash
cp .env.example .env    # preencher as três obrigatórias
docker compose up -d --build
# Web (treinador e aluno): http://localhost:8088  (na rede: http://IP-DO-PC:8088)
# Celular (Android/iOS) pelo Expo Go, mesmo Wi-Fi:
cd app && EXPO_PUBLIC_API_URL=http://IP-DO-PC:8088/api npx expo start
# Sem o mesmo Wi-Fi: npx expo start --tunnel  (precisa de internet; usa o túnel do Expo)
```

Windows (o PC do Gustavo): Docker Desktop; `ipconfig` para o IP; liberar a porta 8088 no firewall.

---

## 15. Testes obrigatórios

### 15.1 API (`mvn verify`, Testcontainers com `postgres:17-alpine`, base `AbstractIntegrationTest` como a Central)

1. **Auth**: login ok (web recebe cookie, nativo recebe refresh no corpo); senha errada → 401 genérico; 11ª tentativa
   na mesma conta → 429 + `Retry-After`; refresh rotaciona; refresh reutilizado → 401 e todas as sessões revogadas;
   troca de senha derruba Bearer antigo (`cv`); CSRF exigido no refresh web.
2. **Isolamento**: treinador A não lista/lê/edita/publica nada da consultoria B (404); aluno A não lê plano do aluno B;
   aluno chamando `/alunos` → 403; sem `TenantContext`, consulta de entidade com `@TenantId` volta vazia.
3. **Planos**: publicar cria v1; editar rascunho não altera v1; publicar de novo cria v2 e mantém v1; publicar plano B
   desativa A do mesmo aluno; `CONFLITO_EDICAO` com versão velha; validação bloqueia erros e pede confirmação de avisos;
   replicar gera uids novos.
4. **Execuções**: lote aceito; mesmo lote de novo não duplica; registro mais antigo → `IGNORADO_ANTIGO`; `serieUid`
   inexistente → `RECUSADO`; versão de outro aluno → `RECUSADO`; `exercicio_id` vem da versão, não do cliente.
5. **Convite**: código aceito uma vez; segunda vez 404; expirado 404; e-mail já usado 409.
6. **Logo**: PNG ok; SVG recusado; arquivo > 512 KiB recusado; Content-Type mentiroso (JPEG declarado, bytes de outro
   formato) recusado.
7. **URL de vídeo**: `javascript:` e host fora da lista recusados.
8. `ConfiguracaoProducaoTest` e `ArquiteturaTest` (5.6 e 5.7). Teste de migrations (total esperado).

### 15.2 App

- `npm run typecheck`, `npm run lint`, `npm test` (jest-expo) verdes.
- Unidade: `dominio/cargas.ts` (seção 8), `dominio/agrupamento.ts` ("3x3 - FS"), `dominio/totaisDieta.ts`
  (total da opção A; arredondar no fim), `api/destino-api.ts` (mesmos casos do spec do Servirea), `offline/sincronizacao.ts`
  (11.3), `pdf/*` (escapa HTML).
- Manual (seção 18): web no navegador, Android e iOS pelo Expo Go, offline (modo avião), reconexão, reinício do app.

---

## 16. Fases, passo a passo

Cada fase: implementar → rodar verificações → commit com mensagem em português → `git push -u origin <branch>`.

### Fase 0 — Preparação (30 min)
1. `git checkout claude/saraiva-api-direcionamento-treinos-dv10io && git pull`.
2. Criar `AGENTS.md` (curto, como os outros repos: produto, stack, regras da seção 2, comandos, onde está cada coisa,
   "edite só aqui") e `CLAUDE.md` com `@AGENTS.md`.
3. `app/.nvmrc` com `24.21.0`. Conferir `node -v`, `java -version` (21), `docker version`.
**Pronto quando**: commit "Prepara repositório para a plataforma de treinos".

### Fase 1 — API base e segurança (P0)
1. Ajustar `api/pom.xml` (já existe) e criar `TreinosApiApplication`, `application.yml` (profiles `test`, `docker`,
   `demo`; `server.port: ${PORT:8080}`; `spring.jpa.hibernate.ddl-auto: validate`; `open-in-view: false`;
   threads virtuais ligadas, como a Central), `.mvn/jvm.config` se usar Error Prone.
2. `web/` (ApiError e exceções, handler, RequestIdFilter, Fuso, Exigir) — seguir a Central.
3. Migrations V001 e V002.
4. `security/` + `tenant/` + `auth/` (login, refresh, logout, cadastro de treinador, limite de login, `/eu`, senha).
5. Testes 15.1 itens 1, 2 (parte de auth/tenant) e 8.
**Pronto quando**: `cd api && mvn verify` verde; commit "API: base, autenticação e isolamento por consultoria".

### Fase 2 — API domínio (P0/P1)
1. V003–V006. Marca/logo/configuração. Alunos + convite. Biblioteca + catálogo + importação CSV.
2. Receitas (padrão criadas no cadastro do treinador). Planos de treino (rascunho, validar, publicar, replicar,
   versões). Planos de dieta (mesmo fluxo).
3. Rotas do aluno (painel, dieta, execuções em lote, histórico, pesos) e `/painel` do treinador.
4. Testes 15.1 restantes.
**Pronto quando**: `mvn verify` verde; commit "API: alunos, biblioteca, planos versionados, execuções e dieta".

### Fase 3 — Seed + Docker (P0)
1. `SeedDemo` (seção 13). 2. Dockerfiles, `docker-compose.yml`, `deploy-local/Caddyfile`, `.env.example`.
3. `docker compose up -d --build` e testar com `curl`: login das 4 contas, `/aluno/painel`, isolamento.
**Pronto quando**: tudo sobe do zero; commit "Seed de demonstração e Docker local".

### Fase 4 — App base (P0)
1. Criar o app (10.1), estrutura (10.2), tokens e tema (10.3), componentes `ui/`.
2. Cliente HTTP + destino-api + sessão (web: cookie/CSRF; nativo: SecureStore).
3. Telas: entrar, convite, cadastro, redirecionamento por papel, layouts treinador/aluno, troca de tema, marca após
   login (`MarcaTitulo` com fonte Metal).
**Pronto quando**: login funciona na web (`npx expo start --web`) e no Expo Go; typecheck/lint/test verdes;
commit "App: base, design, sessão e marca".

### Fase 5 — Treinador (P0 → P1)
P0: Alunos + ficha + convite; editor de treino completo com receitas, validar e publicar; Marca.
P1: Início; Biblioteca (+ catálogo, CSV); editor de dieta; replicar; peso; registros/progresso; Receitas.
**Pronto quando**: o Saraiva consegue montar e publicar um treino do zero pelo celular e pelo PC;
commit(s) "App: painel do treinador – ...".

### Fase 6 — Aluno + offline (P0)
1. Pacote offline, tela de treino/sessão/registro (seção 8 e 10.5), sincronização (11), selos de estado.
2. Dieta (P1), histórico (P1), conta.
**Pronto quando**: registrar em modo avião, fechar e reabrir o app, reconectar → aparece no histórico do treinador;
commit "App: área do aluno com offline e sincronização".

### Fase 7 — PDFs (P0 treino, P1 dieta)
**Pronto quando**: PDF do treino e da dieta parecidos com os do Saraiva, sem título solto no fim da página, na web e no
celular; commit "PDF do treino e da dieta".

### Fase 8 — Acabamento (P1)
Error Prone/ArchUnit/JaCoCo se ficaram para trás; revisar segurança (checklist da seção 5); README (como rodar, contas,
pendências), atualizar `DIRECIONAMENTO-APP-TREINOS.md` (decisões da seção 1.2 substituem as da seção 9 de lá onde
conflitarem: app único em vez de app por loja; fase de cobrança adiada); ensaiar o roteiro da seção 18 do zero.
**Pronto quando**: roteiro completo funciona em máquina limpa; commit "Acabamento e roteiro da demonstração".

---

## 17. Prioridade se faltar tempo

- **P0 (precisa estar no domingo)**: Docker local; login web e celular; cadastro de aluno + convite; editor de treino
  com receitas + publicar; aluno vê o treino, registra carga/reps, funciona offline e sincroniza; marca (cor, fonte
  Metal, logo) + tema claro/escuro; PDF do treino; isolamento entre as duas consultorias.
- **P1**: editor e PDF da dieta; replicar plano; biblioteca com catálogo e CSV; Início; histórico/progresso; peso.
- **P2**: receitas personalizadas pelo treinador; dica de progressão; gráfico; Error Prone (se atrasar, registrar).

Nunca cortar segurança (seção 5) nem testes de isolamento/idempotência para ganhar tempo.

---

## 18. Roteiro da demonstração (domingo)

1. Abrir `http://IP:8088` no PC → entrar como `saraiva@demo.local` → mostrar a marca SARAIVA TEAM (fonte Metal),
   trocar para tema claro e voltar.
2. Marca: enviar a logo do Saraiva (se ele mandar o arquivo) e mostrar a prévia.
3. Alunos → "Aluno Demonstração" → Treino "Plano 16" publicado → abrir o editor, aplicar uma receita num exercício,
   mudar FS de 3 para 2 (percentuais viram 70/85), validar, publicar v2.
4. Replicar o plano para o próximo ciclo e mostrar que só edita o necessário.
5. Gerar o PDF do treino e o da dieta.
6. No celular (Expo Go) entrar como `aluno@demo.local` → treino de hoje → registrar séries → **modo avião** →
   registrar mais → fechar e abrir o app (continua lá, "aguardando envio") → tirar do modo avião → "Sincronizado".
7. Voltar ao PC: ficha do aluno → registros e progresso aparecem.
8. Mostrar a segunda consultoria (`exemplo@demo.local`): outra marca, outro tema, e nada do Saraiva aparece
   (vários treinadores, cada um isolado).
9. Criar uma conta nova de treinador ao vivo ("Sou treinador, criar conta") para mostrar a escala.

---

## 19. Fora do escopo agora / pendências para conversar com o Saraiva

- Cobrança (Central), preço (R$ 59/99 + R$ 1 por aluno: "cadastrado" ou "ativo"?), split/gateway, contrato da parceria.
- App próprio nas lojas por treinador (adicional pago futuro; regras 4.2.6/4.3 da Apple).
- MFA do treinador (a Central tem; o Servirea ainda não) — próxima fase de segurança.
- Row Level Security no Postgres como segunda trava do isolamento.
- IBGE (POF) como segunda base de alimentos e resposta da UNICAMP sobre uso comercial da TACO; vídeos próprios hospedados.
- Importar plano a partir da planilha do Saraiva (hoje só biblioteca via CSV).
- Ambiguidades dos PDFs: Off ativo na quarta ou quinta; back off sobre "carga da WS" ou "maior peso do exercício"
  (o app usa o maior peso registrado na WS do dia); cardio todo dia ou só nos dias Off; "Refeição 2 — ALMOÇO" com
  frutas (nome provavelmente trocado); ovo 3 un/180 g com 133 kcal; legumes com 45 kcal e macros zerados; variação de
  peso −1 onde a conta dá −1,5. Mostrar ao Saraiva; o sistema não corrige sozinho.
- O que o Saraiva controla hoje no Sheets sobre os clientes (vencimento? pagamento? renovação?) → módulo "clientes".
- Notificações, chat, fotos/avaliações, ranking: não.

---

## 20. Armadilhas conhecidas

- `Alert.alert` não funciona na web; `window.confirm` é proibido → `PainelConfirmacao`.
- `SafeAreaView` do `react-native` está obsoleto → `react-native-safe-area-context`.
- `expo-secure-store` não existe na web → abstração `armazenamentoSeguro.ts` (memória na web; refresh no cookie).
- `expo-sqlite` na web exige cabeçalhos COOP/COEP e WASM → na web usar a implementação com AsyncStorage (11.1).
- `Print.printAsync` na web imprime a página atual → usar `iframe` + `print()` (seção 12).
- Cookie `Secure` não é aceito em `http://IP` → `REFRESH_COOKIE_SECURE=false` só no `.env` local.
- Caminho do cookie de refresh atrás do Caddy é `/api/auth`, não `/auth`.
- Expo Go só roda o SDK mais recente da loja (57). Celular e PC no mesmo Wi-Fi, ou `--tunnel`.
- Hibernate 7 + Jackson 3: mapear `jsonb` como `String` e converter no service (seção 7).
- `@TenantId` não protege SQL nativo: toda consulta nativa (upsert de execuções, contador) filtra por
  `consultoria_id`/`aluno_id` explicitamente.
- Não usar `parseInt` em texto de faixa ("3 a 6" virava 36 no protótipo).
- Não deixar dados reais (nome do aluno, peso, protocolo) no seed, em teste ou em log.
- O ambiente de nuvem do Claude Code pode bloquear `docs.expo.dev`; nesse caso, conferir as APIs pelos tipos em
  `node_modules/<pacote>/build/*.d.ts`.
