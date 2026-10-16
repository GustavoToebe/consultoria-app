# Integração com a Central

Estado em 13/10/2026. O lado do Saraiva (Treinos) do contrato `central/central-api-back/docs/contrato-integracao-v1.md`
está **implementado e testado**, desligado por padrão. Falta só o lado da Central: cadastrar o produto, trocar as chaves e
apontar a URL (seção 5). Sem `TREINOS_INTEGRACAO_ATIVA=true` nada fala com a Central e a Minha conta continua com os
dados de demonstração.

## 1. O que existe (`api/.../integracao/`)

| Peça | O que faz |
|---|---|
| `HmacAssinatura` | Assinatura HMAC-SHA256 do contrato 2.3 (`MÉTODO\nCAMINHO(+query)\nTIMESTAMP\nNONCE\nSHA256(corpo)`). Testada com os dois vetores da 2.5. Biblioteca própria e pequena: o `servirea-comum` exige token do GitHub Packages no build do Docker. |
| `ChavesDeIntegracao` | Lê as chaves uma vez, na subida; configuração errada derruba a API com mensagem clara. Segredo Base64 de no mínimo 32 bytes, no máximo duas chaves de entrada (troca sem parada). Chave com **três campos** (`id:segredo:PRODUTO`) é recusada: no Saraiva o escopo é da Central. |
| `IntegracaoSecurityConfig` / `IntegracaoFiltro` | Cadeia própria para `/integracao/**`: sem JWT, sem cookie, sem CSRF, sem sessão. Confere chave, janela de ±300 s, formato, corpo (máx. 1 MiB) e assinatura; só então grava o nonce (tabela `integracao_nonce`, única por chave+nonce). Erros: `401` com `CHAVE_DESCONHECIDA`, `TIMESTAMP_FORA_DA_JANELA`, `ASSINATURA_INVALIDA`, `NONCE_INVALIDO`, `NONCE_REPETIDO`; `503 INTEGRACAO_NAO_CONFIGURADA` se desligada. A autoridade `PERM_INTEGRACAO` só existe para quem passou pelo HMAC; nenhum usuário a tem. |
| `IntegracaoController` | `GET /integracao/v1/saude`, `GET /recursos`, `POST /instancias` (provisionamento), `GET /instancias/{tenantId}`, `PUT /instancias/{tenantId}/direitos`, e a extensão `POST /instancias/{tenantId}/convite-administrador`. |
| `ProvisionamentoService` | Provisionamento idempotente (seção 3). |
| `DireitosService` | Webhook e sincronização: só versão **maior** altera o snapshot; igual ou menor só atualiza `confirmado_em`. |
| `SincronizacaoDireitosService` | `GET /integracao/v1/produtos/{produto}/direitos` na subida (em outra thread), a cada 8 h e a cada 30 min enquanto a última rodada falhou. Nunca lança. |
| `CentralClient` / `FonteDaContaCentral` | Chamadas assinadas à Central (timeout de 5 s para conectar e 10 s para responder). Minha conta vem de `.../instancias/{idExterno}/minha-conta`; `idExterno` é o id da consultoria. `404` vira `CONTA_NAO_ENCONTRADA`; rede, 5xx, 401/403 ou corpo ilegível viram `502 CENTRAL_INDISPONIVEL`. `previa` passa a `false` e o aviso "Prévia" some sozinho. |
| `AcessoPorDireitos` | Regra de acesso (seção 4). |
| Migration `V026__integracao_central.sql` | `integracao_nonce`, `integracao_operacao` e `usuario_convite.criado_por` aceitando nulo (convite emitido pelo sistema). |

`FonteDaContaLocal` só existe com a integração desligada; `SeedContaDemoRunner` não semeia com ela ligada (senão gravaria
dado fictício ao lado do real).

## 2. Variáveis de ambiente

Só em variável de ambiente; segredos nunca no git. Os nomes estão em `.env.example` e em `docker-compose.yml`.

| Variável | Conteúdo |
|---|---|
| `TREINOS_INTEGRACAO_ATIVA` | `true` liga tudo. Ligada, a API **não sobe** com chave ou URL incompleta. |
| `TREINOS_INTEGRACAO_CHAVES_ENTRADA` | `id:segredoBase64[,id:segredoBase64]`: com que a Central assina para o Saraiva. |
| `TREINOS_INTEGRACAO_CHAVE_SAIDA_ID` / `_SEGREDO` | Com que o Saraiva assina para a Central. |
| `TREINOS_INTEGRACAO_CENTRAL_URL` | Base da Central (`https://...`), sem `/integracao`. Se houver prefixo (ex.: `/api`), ele entra aqui. |
| `TREINOS_INTEGRACAO_PRODUTO` | Código do produto na Central. Padrão `TREINOS`. |
| `TREINOS_INTEGRACAO_TOLERANCIA_HORAS` | Padrão 72. |
| `TREINOS_INTEGRACAO_BLOQUEIO_ATIVO` | Padrão `false` (seção 4). |

Gerar um segredo: `openssl rand -base64 48`.

## 3. Provisionamento (decisões do Gustavo, 13/10/2026)

- **Adoção pelo e-mail do administrador.** Se o e-mail já é de um administrador ativo de uma consultoria, a contratação
  adota essa consultoria (`administrador.situacao = VINCULADO`) e o `tenantId` devolvido é o id dela. Senão cria
  consultoria nova com o `slug` e o nome do pedido (`CONVIDADO`). Risco conhecido: **e-mail digitado errado na Central
  adota a consultoria errada**. Por isso uma consultoria já ligada a uma contratação recusa outra
  (`409 CONSULTORIA_JA_VINCULADA`). E-mail de aluno ou de usuário inativo: `422 ADMINISTRADOR_INVALIDO`. Slug já usado:
  `422 SLUG_EM_USO`.
- **Primeiro acesso por link, também por e-mail.** Consultoria nova ganha um convite de administrador
  (válido 7 dias) que o app **também envia por e-mail** ao administrador (módulo `auth`, texto fixo só com o link, depois do
  commit do provisionamento), quando `TREINOS_EMAIL_HABILITADO` está ligado; o mesmo vale para o convite reemitido. Só a
  chamada que cria a consultoria envia: repetição idempotente e adoção (`VINCULADO`) não mandam nada. Falha do provedor não
  desfaz o provisionamento (só a classe do erro vai para o log) e a resposta para a Central não muda. O link (`{APP_URL}/convite-equipe#código`) vem **uma única vez**, na primeira resposta, em
  `administrador.convite` (campo aditivo; a Central ignora o que não conhece). Não é gravado em repouso e não volta numa
  repetição idempotente. Para ver de novo: `POST /integracao/v1/instancias/{tenantId}/convite-administrador` (extensão do
  Saraiva, fora do contrato v1): invalida o anterior e devolve um novo, enquanto o administrador não aceitou.
  `409 ADMINISTRADOR_JA_ATIVO` depois disso. Com o e-mail desligado, o link continua sendo entregue por quem opera a Central.
- **Idempotência.** `Idempotency-Key` igual ao `contratacaoId`; mesma chave com o mesmo corpo devolve `200` +
  `Idempotency-Replayed: true`; com outro corpo, `409`. Duas chamadas simultâneas: a perdedora refaz e cai no replay.
- A consultoria da demonstração local (com linha em `direitos_locais` vinda do seed antigo) responde
  `409 CONSULTORIA_JA_VINCULADA` se a Central tentar adotá-la com outra contratação: apague o banco de demonstração ou a
  linha de `direitos_locais` antes.

## 4. Bloqueio de acesso (opcional, desligado)

`liberado = acessoLiberado E (agora − confirmadoEm) ≤ tolerância`. Com `TREINOS_INTEGRACAO_BLOQUEIO_ATIVO=true`:

- login, renovação de sessão e aceite de convite recusam com `403 ACESSO_BLOQUEADO` e uma mensagem em português
  ("O acesso desta consultoria está suspenso..." ou "Não foi possível confirmar o plano...");
- a cada requisição autenticada a sessão deixa de valer na hora (`401`), então suspender na Central derruba quem já estava
  dentro.
- Consultoria **sem** linha em `direitos_locais` (não governada pela Central) nunca é bloqueada.
- A Central fora do ar não derruba o app: o acesso só cai quando passam 72 h sem confirmação. A confirmação vem do webhook
  ou da sincronização (8 h).
- Antes de ligar em produção: conferir que a sincronização funciona (log "Sincronização de direitos: N item(ns)...") e que
  `confirmado_em` está recente nas consultorias reais.
- No app: quem já está dentro leva `401`, o refresh volta `401/403` e a sessão é encerrada (`api/cliente.ts`, sem laço de renovação); na tela de entrar a mensagem do `403` aparece como erro do login. **Ainda não foi testado no navegador com o bloqueio ligado**: fazer isso (suspender uma consultoria de teste na Central e ver login e sessão aberta) antes de ligar em produção.
- `GET /integracao/v1/instancias/{tenantId}` informa `acessoEfetivo` mesmo com o bloqueio desligado, para a Central conciliar.

## 5. Como ligar (lado da Central e deste app)

1. **Central: cadastrar o produto** `TREINOS` com `url_base_integracao` = URL que a Central alcança. Na VPS é a **interna**,
   pela rede Docker `plataforma`: `http://consultoria-api:8080` (sem `/api`, sem passar pelo Caddy; a Central não valida a URL).
   Fora da VPS, a pública (ex.: `https://treinos.exemplo.com.br/api`). A Central assina só o caminho que vem **depois**
   dessa base, e o Caddy tira o `/api`: os dois lados enxergam `/integracao/v1/...`.
2. **Chave de entrada (Central → Saraiva).** A Central usa **uma chave de saída global**, a mesma para todos os produtos.
   Então `TREINOS_INTEGRACAO_CHAVES_ENTRADA` do Saraiva tem de ser `id:segredo` **idêntico** ao que o Servirea já usa para
   validar a Central (peça ao operador da Central o par; não crie um novo, senão a Central não consegue assinar).
3. **Chave de saída (Saraiva → Central).** Gerar `id` + segredo novos e cadastrar na Central como chave de entrada
   do produto no formato `id:segredoBase64:TREINOS`. O terceiro campo é obrigatório: a Central não sobe com uma entrada
   de dois campos, e o produto vem sempre da configuração dela, nunca do pedido.
   **Na VPS não se faz nada à mão** (2 e 3): `deploy/apps/consultoria/ligar-integracao.sh`, do `central-api-back`, copia a
   chave da Central para o `consultoria.env`, gera a chave `treinos`, grava `treinos:<segredo>:TREINOS` no `central.env`
   e liga `TREINOS_INTEGRACAO_ATIVA=true`, sem que ninguém veja ou digite as chaves (`deploy/README.md`, seção 12).
4. A Central precisa **alcançar** a API do Saraiva (HTTPS público ou rede privada) e o Saraiva precisa alcançar a Central
   (na VPS: `http://central-api:8081`, sem prefixo, pela rede `plataforma`).
5. Definir as variáveis da seção 2 e `TREINOS_INTEGRACAO_ATIVA=true`. Recriar a API (`deploy/recriar.sh`). No log aparece
   "Sincronização de direitos: ...".
6. Testar: `GET /integracao/v1/saude` assinado; provisionar uma contratação de teste na Central e abrir o link do convite.
7. Códigos de `limites` e `funcionalidades` a cadastrar no produto na Central: `GET /integracao/v1/recursos` os lista
   (`alunos_ativos`, `membros_equipe`, `CHECKIN`, `MOBILIDADE`, `PDF`, `EQUIPE`). **Nenhum limite é aplicado ainda**
   (`aplicado=false`): o consumo só informa.

## 6. Produção na VPS (Fase 6)

O consultoria-app roda em `https://consultoria.servirea.com.br` (API em `/api`) a partir de imagens do GHCR; o compose, o proxy
e o `atualizar.sh` estão em `central-api-back/deploy` (`apps/consultoria/`, `proxy/extras/consultoria.caddy.modelo`).

- Perfil `docker` (sem `demo`, sem `DEMO_SENHA`); `REFRESH_COOKIE_SECURE=true` e `REFRESH_COOKIE_PATH=/api/auth` fixos no compose;
  `APP_URL` e `CORS_ALLOWED_ORIGINS` = `https://consultoria.servirea.com.br` no `consultoria.env` da VPS.
- A integração fica desligada (`TREINOS_INTEGRACAO_ATIVA=false`) até o `ligar-integracao.sh` rodar na VPS (seção 5); ele a liga **antes**
  de o produto ser cadastrado na Central, porque com a flag desligada todo `/integracao/**` responde 503, inclusive à tela da Central.
  O bloqueio por direitos (`TREINOS_INTEGRACAO_BLOQUEIO_ATIVO`) continua desligado.
- `/api/integracao/*` passa pelo `/api` do proxy; o IP da Central não entra em lista nenhuma: a defesa é a assinatura.
- Cada push na `main` publica: o workflow só chama a VPS depois de `testar` e das duas imagens (Trivy) verdes.
- Backup do Postgres inclui `integracao_operacao` (histórico de idempotência). Fase 7: backup antes de qualquer aluno real.

## 7. Fora de escopo (não feito)

- Código de suporte (`/suporte`), endpoint de consumo para a Central (`/consumo`) e relatório de erros (`/erros`).
- Aplicação dos `limites` e das `funcionalidades` (o contrato chama de "aplicação futura").

## 8. Testes

`HmacAssinaturaTest` (vetores do contrato), `ChavesDeIntegracaoTest`, `AcessoPorDireitosTest` e
`IntegracaoCentralIntegrationTest` (filtro, provisionamento, replay, adoção, direitos, bloqueio, sincronização e Minha conta
contra uma Central de mentira que confere a assinatura). `ArquiteturaTest` e `FlywayMigrationIntegrationTest` foram
atualizados (`IntegracaoRepositorio` com SQL nativo; 26 migrations).
