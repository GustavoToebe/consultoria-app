# Verificação humana (Cloudflare Turnstile)

Cadastro de treinador, login e "esqueci a senha" exigem um token do Turnstile, conferido no servidor antes de qualquer outra
coisa. **Desligada por padrão** (`TREINOS_TURNSTILE_HABILITADO=false`): desligada, nada é exigido e o app não mostra widget.
O resumo das regras de código está no `AGENTS.md` (item "Verificação humana").

## Como funciona
- `GET /publico/configuracao` → `{ verificacaoHumana, siteKey }` (só a chave pública; cache de 5 min). O app lê isso ao abrir as
  telas, então trocar a chave não exige novo build.
- `POST /auth/login`, `/auth/cadastro-treinador` e `/auth/esqueci-senha` levam `turnstileToken`. O servidor chama o siteverify da
  Cloudflare com o segredo e o **IP real** (`getRemoteAddr()`: o túnel da Cloudflare já entrega o IP certo; não ler `X-Forwarded-For`).
- Token ausente ou recusado: `400 VERIFICACAO_HUMANA`. Cloudflare fora (rede, timeout de 3 s/5 s, 5xx, resposta que não é JSON) ou
  segredo recusado: `503 VERIFICACAO_INDISPONIVEL`. **Falha fechada** nas três rotas, nunca passa sem verificar.
- Token é de uso único e vale 5 min: o app renova o widget depois de cada envio (inclusive o segundo envio do login com MFA).
- As falhas (400) contam no limite por IP (`treinos.limites.verificacao-ip`, 20 por janela de 600 s). IP que já gastou o limite recebe
  `429` antes de a Cloudflare ser chamada. O `503` não conta (não é falha da pessoa).
- `X-Treinos-Cliente: nativo` **não** dispensa nada. O app nativo resolve o desafio num `WebView` (`react-native-webview`) que
  carrega o widget com `baseUrl` `https://consultoria.servirea.com.br` (o hostname precisa ser o cadastrado no widget).
- `/auth/refresh`, `/auth/redefinir-senha` e `/auth/logout` não passam pela verificação.

### Login com a Cloudflare fora do ar
Decisão: **falha fechada** também no login. Quem já tem sessão continua (o refresh não exige token); ninguém novo entra enquanto
a Cloudflare não responder. Saída de emergência: `TREINOS_TURNSTILE_HABILITADO=false` e recriar a API (o login volta a ser só
senha + limites por IP e conta). No app, o widget que desiste (ou o toque em "Tentar de novo") busca `/publico/configuracao` de
novo, sem cache (`?r=<hora>` fura o `max-age` de 5 min, que o fetch do celular pode respeitar); se a verificação já saiu do ar,
o botão é solto sem reiniciar o app. Quem ainda está com o widget carregando e funcionando só percebe ao reabrir a tela.

## Variáveis
| Variável | Padrão | Observação |
|---|---|---|
| `TREINOS_TURNSTILE_HABILITADO` | `false` | ligada, a API só sobe com a chave pública e o segredo |
| `TREINOS_TURNSTILE_SITE_KEY` | vazio | chave pública do widget |
| `TREINOS_TURNSTILE_SEGREDO` | vazio, sem valor padrão | segredo do widget; só na VPS, por `gravar-segredo.sh`; nunca no git, em log ou no chat |
| `treinos.turnstile.verify-url` | siteverify da Cloudflare | só os testes mudam (servidor local de mentira) |
| `treinos.limites.verificacao-ip` | `20` | falhas por IP na janela |

## Testes
`TurnstileConfiguracaoTest` (sobe/não sobe, sem vazar valor), `TurnstileClienteTest` e `VerificacaoHumanaIntegrationTest` (servidor
de mentira do JDK, sem rede: token válido, ausente, recusado, Cloudflare fora, segredo recusado, cabeçalho nativo, limite),
`TurnstileCloudflareRealTest` (chaves de teste públicas da Cloudflare contra o siteverify de verdade; pula sozinho sem rede).
Chaves de teste da Cloudflare: site key `1x00000000000000000000AA` + segredo `1x0000000000000000000000000000000AA` (sempre passa);
site key `2x00000000000000000000AB` + segredo `2x0000000000000000000000000000000AA` (sempre recusa); site key `3x00000000000000000000FF` força o desafio interativo.

## CSP
O widget precisa de `https://challenges.cloudflare.com` em `script-src` e em `frame-src`. A CSP de produção mora no
`central-api-back` (`deploy/proxy/extras/consultoria.caddy.modelo`); aqui só o `deploy-local/Caddyfile` muda. Linha nova:

```
Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:"
```

O PDF na web não usa iframe (bloco só de impressão), então liberar `frame-src` só para a Cloudflare não muda nada nele. `connect-src`
continua `'self'`: a documentação da Cloudflare consultada não pede essa origem para o widget; ao ligar em produção, abrir o console
do navegador e, se aparecer bloqueio de `connect-src`, acrescentar `https://challenges.cloudflare.com` também nele.

## Para ligar em produção (ordem)
1. Criar o widget no painel da Cloudflare (domínio `consultoria.servirea.com.br`, modo Managed). Copiar a site key e o segredo.
2. Gravar o segredo na VPS com `gravar-segredo.sh` (`TREINOS_TURNSTILE_SEGREDO`); a site key vai em `TREINOS_TURNSTILE_SITE_KEY` no `consultoria.env`.
3. Aplicar a CSP nova no proxy (`consultoria.caddy.modelo`, depois da Fase 5) e conferir no navegador que o cabeçalho saiu.
4. Só então `TREINOS_TURNSTILE_HABILITADO=true` e recriar a API (o compose da VPS lê o `consultoria.env` inteiro por `env_file`, então as
   variáveis passam sem mudar o compose). Ligada e sem o segredo, a API **não sobe**: conferir a saúde e o log logo depois de recriar;
   a volta é `HABILITADO=false` e recriar. Testar entrar, cadastrar e esqueci a senha no navegador e no celular (o WebView do celular
   nunca foi visto num aparelho), e confirmar que uma tentativa ruim não dá 429 para outra rede (o limite por IP depende de o
   `getRemoteAddr()` ser o IP real atrás do túnel, a mesma fonte do limite de login do módulo auth).
5. Ordem de validação: o corpo inválido (422) é conferido antes da verificação humana; a verificação vem antes dos limites, do módulo auth e do BCrypt.
