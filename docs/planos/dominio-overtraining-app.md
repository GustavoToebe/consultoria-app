# Domínio `overtraining.app`

Situação: Em andamento (Cloudflare pronta em 11/11; faltam a VPS, o código, o APK, a Central e o Resend) · Onde: `main` e produção · Atualizado: 11/11/2026

## Objetivo
Passar a usar `overtraining.app` (comprado na GoDaddy em 10/11/2026, renova em 10/11/2027) como endereço do produto, sem
derrubar `consultoria.servirea.com.br` até todos os links já enviados (convites, e-mails) terem migrado.

## Decisões
| # | Decisão | Valor |
| --- | --- | --- |
| D1 | DNS | Zona na Cloudflare (mesma conta da `servirea.com.br`), servidores de nome trocados na GoDaddy |
| D2 | Configuração da zona | Igual à `servirea.com.br`: SSL `strict`, HTTPS sempre, TLS mínimo 1.2, TLS 1.3, HTTP/3 |
| D3 | Registros DNS | Só depois da aplicação pronta para o host novo (passo 3); nada aponta para a produção antes |
| D4 | Endereço do app (11/11) | `overtraining.app` direto, um só nome para o app e a API (`/api`), como hoje; `www` redireciona para ele. Recomendação do Claude; o Gustavo deu o ok aos passos em 11/11 sem pedir a alternativa (`app.overtraining.app`) |
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

## Passos
- [x] 1. Zona na Cloudflare com as configurações da `servirea.com.br` — responsável: sessão principal — commit: — (só Cloudflare)
- [x] 2. Gustavo troca os servidores de nome na GoDaddy; zona `active` em 10/11 — responsável: Gustavo. **Falta o DNSSEC** (ligar na Cloudflare e copiar o DS para a GoDaddy): ver passo 9
- [x] 3. Desenho decidido (D4 a D9) e lista do que muda na aplicação: `APP_URL` e `CORS_ALLOWED_ORIGINS` na VPS, hostname da verificação humana (segue o `APP_URL`), bloco do Caddy, `baseUrl` do WebView e `EXPO_PUBLIC_API_URL` no app — 11/11
- [ ] 4. E-mail: verificar o domínio no Resend (SPF, DKIM, DMARC; os registros entram na Cloudflare) e trocar `TREINOS_EMAIL_REMETENTE`; só depois de verificado — responsável: Gustavo cadastra, Claude grava o DNS
- [x] 5. Túnel e DNS (e também regras, HSTS e Turnstile): ver "Estado feito em 11/11/2026" — evidência: leitura da Cloudflare depois de cada alteração
- [ ] 6. VPS: bloco do Caddy atende o endereço novo, redireciona `www` e as páginas do antigo; `APP_URL` e `CORS_ALLOWED_ORIGINS` com o endereço novo; recriar a API do consultoria e o Caddy — evidência: —
- [ ] 7. Conferir: página de entrada, `GET /api/publico/configuracao`, login e "esqueci a senha" no endereço novo, redirecionamento do antigo e da `www`, `/api` do antigo — evidência: —
- [ ] 8. Código: `app/eas.json`, `dominio/verificacaoHumana.ts` (e teste), textos, scripts e documentação — commit/run: —
- [ ] 9. DNSSEC: ligar na Cloudflare e o Gustavo copia o DS para a GoDaddy — evidência: —
- [ ] 10. APK novo apontando para `https://overtraining.app/api` — evidência: —
- [ ] 11. Central (branch curta + PR): `consultoria.caddy.modelo`, `.env.example`, alvos do Prometheus, `proxy.test.sh`, `compose.test.sh`, `cloudflare-regras.md` e README — PR: —
- [ ] 12. Central: endereço da consultoria na integração (só pelo painel ou pela configuração dela, nunca pelo banco) — evidência: —
- Aceite: app abre em `https://overtraining.app` com certificado válido, login e e-mails funcionando; os links antigos (`consultoria.servirea.com.br`) chegam ao endereço novo.

## Como desfazer
`APP_URL` e `CORS_ALLOWED_ORIGINS` de volta ao endereço antigo, bloco do Caddy de volta ao `.modelo`, recriar os dois. O DNS, o
Tunnel e as regras da zona nova podem ficar: sem o bloco no Caddy o endereço novo responde 404.

## Fora do escopo
- Lojas de aplicativo (as URLs de privacidade e de exclusão de conta passam ao domínio novo quando a publicação for aberta).
- Site de divulgação na raiz (a raiz é o app).
- Trocar os nomes internos (`treinos`, `TREINOS_*`, `consultoria` nos contêineres e no banco).

## Pendências e riscos
- O domínio é `.app` (HSTS preloaded): só funciona por HTTPS, o que já é a regra.
- A Central tem URLs e HMAC próprios: mapear os dois lados antes de mudar (`docs/integracao-central.md`).
- Convites e e-mails já enviados apontam para o host antigo: não removê-lo cedo.
- A GoDaddy oferece "Proteção de domínio" paga (opcional); recomendável ligar verificação em duas etapas e renovação automática na conta.
