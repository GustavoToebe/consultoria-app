# Proteção contra robôs (Cloudflare + Turnstile)

Situação: Concluída em 28/10/2026 (partes A e B; Turnstile ligado em produção; falta só o teste no iPhone nativo, antes do TestFlight) · Onde: Cloudflare (zona `servirea.com.br`) e VPS · Atualizado: 28/10/2026

## Objetivo
Barrar robôs na borda sem afetar usuário real (alunos em IP compartilhado, app no celular) e ligar o Turnstile
("não sou robô") no login e no "esqueci a senha" do consultoria em produção.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Não banir IP, VPN nem país; sem Bot Fight Mode, "Under Attack" nem desafio em `/api` (o app não resolve desafio) | Só regra de caminho + limite de requisições | Gustavo |
| 2 | Regra de caminhos de robô entra no ruleset de regras personalizadas que já existia (POST em `/rules`, nunca PUT do ruleset) | Regra `018982bd…` | Claude |
| 3 | Plano Free só tem 1 regra de rate limit: a da Fase 6B foi editada, não criada outra. Limite 20 req/10 s por IP e datacenter, bloqueio de 10 s (o Free não aceita outros períodos) | Regra `bf0f2191…` | Claude |
| 4 | Widget do Turnstile criado pelo Gustavo no painel; o segredo é gravado por ele direto na VPS e não passa pelo agente nem pelo chat | — | Gustavo |
| 5 | Parte B só depois que o run 40714486714 terminar verde com o `publicar`, para não misturar duas mudanças em produção | — | Gustavo |
| 6 | Só se diz "ligado em produção" depois que o Gustavo confirmar login no navegador **e** no APK | — | Gustavo |

## Passos
- [x] A1. Regra de bloqueio de caminhos de robô (`/wp-*`, `.php`, `/.env`, `/.git` etc.; `/.well-known/` fora) — Cloudflare, regra `018982bdc1a04501ab8e1d3af50601b1`, 28/10/2026
- [x] A2. Limite de requisições nos POST de autenticação (consultoria, Servirea, Central), sem refresh/logout/eu — Cloudflare, regra `bf0f21916668489aa0f9d19839014ead`, 28/10/2026
- [x] A3. Expressões das regras e como desfazer documentados na Central (`central-api-back/deploy/cloudflare-regras.md`, PR próprio) — PR: —
- [x] B0. APK de teste (build `03b08e96`, perfil preview) no Android do Gustavo e CSP no ar (a CSP já tem `challenges.cloudflare.com` em `script-src` e `frame-src`) — 28/10/2026
- [x] B1. Gustavo criou o widget (Turnstile › Add widget › `consultoria.servirea.com.br`, Managed) — 28/10/2026
- [x] B2. Gustavo na VPS: segredo, `TREINOS_TURNSTILE_SITE_KEY`, `TREINOS_TURNSTILE_HABILITADO=true`, API recriada depois do `publicar` verde — 28/10/2026
- [x] B3. Testes pelo Gustavo: login e "esqueci a senha" no PC (sem erro no console) e no navegador; no APK Android o widget inteiro passou sozinho e o login entrou; também depois da troca do túnel (`cloudflared` 2026.10.5) — 28/10/2026
- [x] B4. `docs/turnstile.md`, `docs/build-celular.md` e a frase do `AGENTS.md` atualizados — 28/10/2026
- [ ] B5. Testar o app nativo do iPhone (WKWebView) antes do TestFlight; fica em Pendências soltas do README

## Verificado na parte A (28/10/2026, de fora)
- `/.env`, `/wp-login.php`, `/.git/config`, `/x.PHP`, `/WP-admin/a`: 403 da Cloudflare em consultoria, app, central, www, whatsapp e api-central.
- `/`, `/api/actuator/health` e `/.well-known/…` seguem como antes (200; 301 no apex/www; 401 em whatsapp e api-central, que já era assim).
- Limite: 60 POSTs de login com e-mails diferentes, 5 em paralelo, em 4 s: 19 passaram e 41 receberam `error code: 1015` (página de rate limit da Cloudflare), batendo com 20 por 10 s. `POST /api/auth/refresh`, `/api/auth/logout` e `GET /api/eu` continuaram chegando na API. Login do consultoria, do Servirea e da Central voltaram a chegar na API após a janela.
- A trava da própria API (`LOGIN_LIMITADO`, por conta) é outra coisa: um e-mail errado várias vezes dá 429 JSON da API, e não da Cloudflare.
- O Gustavo confirmou o login normal no navegador e no APK depois das regras (28/10/2026).

## Fora do escopo
- Cadastro de treinador: fechado em produção, sem teste.
- Mexer no bloqueio por país da Fase 6B (ver abaixo).

## O que ficou para trás
- A regra "Bloqueio por pais (Fase 6B)" (`adfb3957…`) bloqueia tudo fora do Brasil, exceto `/webhooks/` e a VPS. Contradiz o "não bloquear país" desta frente, mas foi decisão anterior e não foi alterada. Gustavo decide se mantém.
- O proxy vivo da Central no repositório não tem bloco para `consultoria.servirea.com.br` (só o `consultoria.caddy.modelo`), mas o site responde em produção com a CSP certa: o arquivo na VPS não é o do repositório. Conferir antes de qualquer mudança de `connect-src` (README da Central §13).
