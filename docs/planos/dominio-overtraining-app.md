# Domínio `overtraining.app`

Situação: No ar em 11/11/2026 (o app atende em `overtraining.app`; faltam, com o Gustavo: o registro DS na GoDaddy, a chave e o remetente novos do Resend na VPS, o merge do PR central#39 e conferir os dois endereços do produto no painel da Central) · Onde: `main` e produção · Atualizado: 11/11/2026

## Objetivo
Passar a usar `overtraining.app` (comprado na GoDaddy em 10/11/2026, renova em 10/11/2027) como endereço do produto, sem
derrubar `consultoria.servirea.com.br` até todos os links já enviados (convites, e-mails) terem migrado.

## Decisões
| # | Decisão | Valor |
| --- | --- | --- |
| D1 | DNS | Zona na Cloudflare (mesma conta da `servirea.com.br`), servidores de nome trocados na GoDaddy |
| D2 | Configuração da zona | Igual à `servirea.com.br`: SSL `strict`, HTTPS sempre, TLS mínimo 1.2, TLS 1.3, HTTP/3 |
| D3 | Registros DNS | Só depois da aplicação pronta para o host novo (passo 3); nada aponta para a produção antes |
| D4 | Endereço do app (11/11) | `overtraining.app` direto, um só nome para o app e a API (`/api`), como hoje; `www` redireciona para ele. Confirmado pelo Gustavo em 11/11 ("pode deixar o overtraining.app"); a alternativa `app.overtraining.app` foi descartada |
| D5 | Corte, não convivência (11/11) | A API confere um hostname só na verificação humana (`TREINOS_TURNSTILE_HOSTNAME`, vazio = host do `APP_URL`): depois da troca do `APP_URL` o login só passa pelo endereço novo. Sem cliente real, não se cria lista de hostnames |
| D6 | Endereço antigo (11/11) | As páginas redirecionam (308) para o novo, com caminho e fragmento (o código do convite vai no fragmento e sobrevive); `/api/*` continua respondendo no antigo, para a integração com a Central e para as sessões já abertas |
| D7 | Proteção (11/11) | As regras da zona antiga (WAF gerenciado, limite de login, bloqueio fora do Brasil e de caminhos de robô) copiadas para a zona nova, só com os caminhos do consultoria |
| D8 | E-mail (11/11) | O remetente continua no domínio antigo até o domínio novo estar verificado no Resend |
| D9 | Sessões (11/11) | Todo mundo entra de novo uma vez (o cookie é do endereço) |

## Estado feito em 10/11/2026 (Cloudflare, autorizado pelo Gustavo na conversa)
- Zona `overtraining.app` criada (plano Free, tipo `full`), id `d0d5ef44aa2983f062c3e79e91d886fc`, status `pending`.
- Servidores de nome da Cloudflare: `adelaide.ns.cloudflare.com` e `lamar.ns.cloudflare.com` (trocar na GoDaddy: Domínio › DNS › Servidores de nome › "Inserir meus próprios servidores de nome").
- Configurações aplicadas: `ssl=strict`, `always_use_https`, `automatic_https_rewrites`, `min_tls_version=1.2`, `tls_1_3`, `opportunistic_encryption`, `http3`, `brotli`, `ipv6`, `websockets`, `security_level=medium`, `browser_check`, `email_obfuscation`.
- **Nenhum registro DNS foi criado.**
- Validade: a zona só vale depois do status `active`; refazer a conferência se o domínio mudar de registrador ou de conta.

## Estado feito em 11/11/2026 (Cloudflare, com o ok do Gustavo na conversa; GET antes de cada alteração)
- Zona `active` (o Gustavo trocou os servidores de nome na GoDaddy).
- Tunnel `plataforma-vps`: destinos `overtraining.app` e `www.overtraining.app` para `http://caddy:80`, antes da regra final 404 (configuração da versão 1 para a 2; os sete destinos antigos intactos).
- DNS: `CNAME` de `overtraining.app` e de `www` para o Tunnel, com proxy.
- Regras da zona nova: WAF gratuito gerenciado; limite de 20 POST em 10 s por IP em `/api/auth/login`, `/api/auth/esqueci-senha`, `/api/auth/redefinir-senha` e `/api/auth/cadastro-treinador`; bloqueio fora do Brasil (exceto a própria VPS) e dos caminhos que só robô acessa (fora `/.well-known/`).
- HSTS igual ao da zona antiga (1 dia, sem subdomínios, sem preload).
- Turnstile: o widget do consultoria ganhou o domínio `overtraining.app` (mesma site key; o antigo continua na lista).
- Até a VPS ser trocada, `https://overtraining.app` responde 404 do Caddy (não há bloco para o host) e o endereço antigo segue igual.

## Estado feito em 11/11/2026, segunda rodada (com o ok do Gustavo a cada item; leitura antes e depois)
- Web Analytics da zona nova desligado (`settings/rum` de `on` para `off`): as páginas não trazem mais o `beacon.min.js` que a CSP bloqueava (conferido em `/` e `/treinador/entrar`).
- DNSSEC ligado na Cloudflare; fica `pending` até o registro DS entrar na GoDaddy: `overtraining.app. 3600 IN DS 2371 13 2 CBC60C431CC30C2697732D591484077958984A43839B9F196B55B1FF14C3B7A0` (key tag 2371, algoritmo 13, tipo de digest 2).
- Resend: domínio `overtraining.app` criado (região `sa-east-1`, sem rastreio de abertura nem de clique) e **verificado**. Registros na Cloudflare, todos sem proxy: `TXT resend._domainkey` (DKIM), `MX send` para `feedback-smtp.sa-east-1.amazonses.com` (prioridade 10), `TXT send` (`v=spf1 include:amazonses.com ~all`), `CNAME rsend` para `send.forge.rmta.net` e `TXT _dmarc` (`v=DMARC1; p=none;`).
- Central: PR central#38 mesclado (`14dc08e`); a VPS já estava nesse commit (o deploy da Central puxou) e o `consultoria.caddy` em uso é igual ao `.modelo` novo. Prometheus recriado (só ele): 19 alvos `up`, entre eles `overtraining.app:443` (certificado) e `https://overtraining.app/` (site no ar). Os alertas `InstanciaComLimiteAtingido` e `InstanciasSemResumoAtual` já estavam ativos desde 04/11 e voltaram a contar o prazo com a recriação.
- Validade: reconferir se a zona mudar de conta ou de registrador, ou se a chave do DNSSEC for trocada (o DS muda junto).

## Passos
- [x] 1. Zona na Cloudflare com as configurações da `servirea.com.br` — responsável: sessão principal — commit: — (só Cloudflare)
- [x] 2. Gustavo troca os servidores de nome na GoDaddy; zona `active` em 10/11 — responsável: Gustavo. **Falta o DNSSEC** (ligar na Cloudflare e copiar o DS para a GoDaddy): ver passo 9
- [x] 3. Desenho decidido (D4 a D9) e lista do que muda na aplicação: `APP_URL` e `CORS_ALLOWED_ORIGINS` na VPS, hostname da verificação humana (segue o `APP_URL`), bloco do Caddy, `baseUrl` do WebView e `EXPO_PUBLIC_API_URL` no app — 11/11
- [ ] 4. E-mail: domínio verificado no Resend em 11/11 (registros na Cloudflare, ver "segunda rodada"). **Falta, com o Gustavo:** criar no Resend a chave "Sending access" restrita a `overtraining.app`, gravá-la na VPS (`gravar-segredo.sh`, `TREINOS_EMAIL_RESEND_API_KEY`), trocar `TREINOS_EMAIL_REMETENTE` para `... <acesso@overtraining.app>` e recriar a API (`recriar.sh consultoria api`); depois, pedir um "esqueci a senha" e conferir o remetente. Até lá os e-mails saem do domínio antigo (D8)
- [x] 5. Túnel e DNS (e também regras, HSTS e Turnstile): ver "Estado feito em 11/11/2026" — evidência: leitura da Cloudflare depois de cada alteração
- [x] 6. VPS: bloco do Caddy atende o endereço novo, redireciona `www` e as páginas do antigo; `APP_URL` e `CORS_ALLOWED_ORIGINS` com o endereço novo; recriar a API do consultoria e o Caddy — sessão principal, 11/11, depois do deploy `3878563a` verde — evidência: `caddy validate` "Valid configuration" antes de recriar; `recriar.sh consultoria api` saudável; `printenv` do contêiner com os dois valores novos; cópias de antes da mudança apagadas (a do `.env` com `shred -u`). Só essas duas linhas do `consultoria.env` mudaram
- [x] 7. Conferir: página de entrada, `GET /api/publico/configuracao`, login e "esqueci a senha" no endereço novo, redirecionamento do antigo e da `www`, `/api` do antigo — evidência (11/11, de fora da VPS): `overtraining.app/`, `/treinador/entrar`, `/api/actuator/health` e `/api/publico/configuracao` 200; `www` e as páginas do antigo 308 para o novo (o fragmento do convite sobrevive, visto no navegador); `/api` do antigo 200; `/api/actuator/env` e `/api/monitoramento/metrics` 404; Servirea e Central de pé depois de recriar o Caddy; no Chromium com janela a verificação humana resolveu no hostname novo e `POST /api/auth/esqueci-senha` deu 202 com e-mail fictício. **Não conferido:** login com conta de verdade (fica com o Gustavo), e-mail chegando com o link novo, iPhone
- [x] 8. Código: `app/eas.json`, `dominio/verificacaoHumana.ts` (e teste), textos, scripts e documentação — sessão principal — commit `e3685a45`, run 43110771616 verde em 11/11 (só a parte `app/`; web `e3685a452b31` no ar); local: typecheck e lint sem erro, Jest 297 suítes e 6411 testes, `acesso.test.mjs` 8 de 8
- [ ] 9. DNSSEC: ligado na Cloudflare em 11/11 (`pending`). **Falta, com o Gustavo:** pôr o registro DS na GoDaddy (valores em "segunda rodada"); depois conferir que o status virou `active` — evidência: leitura da Cloudflare (`status: pending`, DS acima)
- [x] 10. APK novo apontando para `https://overtraining.app/api` — sessão principal — build do EAS `3953d1c0-0f3a-4098-9d4f-673afb2c81d2` (perfil `preview`, commit `e3685a45`, versão 0.1.0), concluído em 11/11. **Não conferido:** instalar e entrar pelo APK no celular (a verificação humana do app resolve no endereço novo pelo `baseUrl`)
- [x] 11. Central (branch curta + PR): `consultoria.caddy.modelo`, `.env.example`, alvos do Prometheus, `proxy.test.sh`, `compose.test.sh`, `cloudflare-regras.md` e README — PR GustavoToebe/central#38 mesclado em 11/11 (merge `14dc08e`, runs da `main` verdes); VPS em `14dc08e` e Prometheus recriado com os alvos novos `up`
- [ ] 12. Central: (a) o painel só aceitava links de convite e de suporte em `servirea.com.br` (`features/comum/url-acesso.ts`), então os da consultoria deixaram de aparecer; correção no PR GustavoToebe/central#39 (commit na branch `painel-aceita-overtraining-app`; local: lint, 432 testes e build; CI do PR verde). **Falta o Gustavo mesclar** (o merge publica o painel). (b) Os endereços do produto ficam no painel, em Catálogo › Produtos: "Endereço da API do aplicativo" (o seed usa `http://consultoria-api:8080`, rede interna, que não muda) e "Retorno do pagamento (Minha conta do app)"; **o Gustavo confere** e troca o retorno se estiver com o endereço antigo (o antigo ainda chega, pelo 308). Nada foi escrito no banco da Central
- Aceite: app abre em `https://overtraining.app` com certificado válido, login e e-mails funcionando; os links antigos (`consultoria.servirea.com.br`) chegam ao endereço novo.

## Como desfazer
`APP_URL` e `CORS_ALLOWED_ORIGINS` de volta ao endereço antigo, bloco do Caddy de volta ao `.modelo`, recriar os dois. O DNS, o
Tunnel e as regras da zona nova podem ficar: sem o bloco no Caddy o endereço novo responde 404.

## Fora do escopo
- Lojas de aplicativo (as URLs de privacidade e de exclusão de conta passam ao domínio novo quando a publicação for aberta).
- Site de divulgação na raiz (a raiz é o app).
- Trocar os nomes internos (`treinos`, `TREINOS_*`, `consultoria` nos contêineres e no banco).

## Pendências e riscos
- `central-api-back/deploy/cloudflare-regras.md` (seção da zona `overtraining.app`) ainda não cita o Web Analytics desligado, o DNSSEC nem os registros de e-mail: entra no próximo PR da Central que mexer no back (para não gastar uma CI só com isso).
- Quem tem o APK antigo instalado não consegue mais entrar (a verificação humana dele resolve no endereço antigo): instalar o APK novo (passo 10).
- O domínio é `.app` (HSTS preloaded): só funciona por HTTPS, o que já é a regra.
- A Central tem URLs e HMAC próprios: mapear os dois lados antes de mudar (`docs/integracao-central.md`).
- Convites e e-mails já enviados apontam para o host antigo: não removê-lo cedo.
- A GoDaddy oferece "Proteção de domínio" paga (opcional); recomendável ligar verificação em duas etapas e renovação automática na conta.
