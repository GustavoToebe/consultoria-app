# Domínio `overtraining.app`

Situação: Em andamento (Cloudflare criada, falta o Gustavo trocar os servidores de nome; aplicação ainda em `consultoria.servirea.com.br`) · Onde: `main` · Atualizado: 10/11/2026

## Objetivo
Passar a usar `overtraining.app` (comprado na GoDaddy em 10/11/2026, renova em 10/11/2027) como endereço do produto, sem
derrubar `consultoria.servirea.com.br` até todos os links já enviados (convites, e-mails) terem migrado.

## Decisões
| # | Decisão | Valor |
| --- | --- | --- |
| D1 | DNS | Zona na Cloudflare (mesma conta da `servirea.com.br`), servidores de nome trocados na GoDaddy |
| D2 | Configuração da zona | Igual à `servirea.com.br`: SSL `strict`, HTTPS sempre, TLS mínimo 1.2, TLS 1.3, HTTP/3 |
| D3 | Registros DNS | Só depois da aplicação pronta para o host novo (passo 3); nada aponta para a produção antes |

## Estado feito em 10/11/2026 (Cloudflare, autorizado pelo Gustavo na conversa)
- Zona `overtraining.app` criada (plano Free, tipo `full`), id `d0d5ef44aa2983f062c3e79e91d886fc`, status `pending`.
- Servidores de nome da Cloudflare: `adelaide.ns.cloudflare.com` e `lamar.ns.cloudflare.com` (trocar na GoDaddy: Domínio › DNS › Servidores de nome › "Inserir meus próprios servidores de nome").
- Configurações aplicadas: `ssl=strict`, `always_use_https`, `automatic_https_rewrites`, `min_tls_version=1.2`, `tls_1_3`, `opportunistic_encryption`, `http3`, `brotli`, `ipv6`, `websockets`, `security_level=medium`, `browser_check`, `email_obfuscation`.
- **Nenhum registro DNS foi criado.**
- Validade: a zona só vale depois do status `active`; refazer a conferência se o domínio mudar de registrador ou de conta.

## Passos
- [x] 1. Zona na Cloudflare com as configurações da `servirea.com.br` — responsável: sessão principal — commit: — (só Cloudflare)
- [ ] 2. Gustavo troca os servidores de nome na GoDaddy; esperar a zona `active`; ligar DNSSEC (copiar o DS para a GoDaddy) — responsável: Gustavo
- [ ] 3. Decidir o desenho (um só nome para o app e a API, como hoje, ou nomes separados) e listar o que muda na aplicação: `APP_URL`, `TREINOS_TURNSTILE_HOSTNAME` e a chave do widget (hostname novo), CSP e Caddy (`central-api-back/deploy`), `baseUrl` do WebView do Turnstile, cookie `TREINOS_REFRESH` (`Secure`, `/api/auth`, sem `Domain`), CORS se houver, links do app nas lojas, integração com a Central (URLs e HMAC)
- [ ] 4. E-mail: verificar o domínio no Resend (SPF, DKIM, DMARC) e trocar `TREINOS_EMAIL_REMETENTE`; só depois de verificado
- [ ] 5. Túnel: hostname público no `cloudflared` e registros CNAME proxied para o túnel existente, com o ok do Gustavo na hora
- [ ] 6. Conferir login, "esqueci a senha", convite e Turnstile no host novo; manter o antigo respondendo e, se fizer sentido, redirecionar com 301
- Aceite: app abre em `https://overtraining.app` com certificado válido, login e e-mails funcionando, `consultoria.servirea.com.br` ainda funcionando.

## Pendências e riscos
- O domínio é `.app` (HSTS preloaded): só funciona por HTTPS, o que já é a regra.
- A Central tem URLs e HMAC próprios: mapear os dois lados antes de mudar (`docs/integracao-central.md`).
- Convites e e-mails já enviados apontam para o host antigo: não removê-lo cedo.
- A GoDaddy oferece "Proteção de domínio" paga (opcional); recomendável ligar verificação em duas etapas e renovação automática na conta.
