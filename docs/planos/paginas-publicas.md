# Páginas públicas: privacidade, termo de uso e exclusão de conta

Situação: PR aberto, aguardando revisão do Gustavo · Onde: branch `paginas-publicas` (um PR, API + app, sem migration) · Atualizado: 04/11/2026

## Objetivo
As lojas da Apple e do Google pedem uma URL pública para o aviso de privacidade e, na Play, para o pedido de exclusão
de conta. Hoje os termos só aparecem dentro do app, depois do login. Esta frente abre os mesmos textos sem login e
explica como excluir a conta.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Fonte do texto | Uma só: `api/src/main/resources/termos/*.md`. O app busca pela API e não guarda cópia. | Gustavo, 04/11 |
| D2 | Rota | `GET /publico/termos` (`TermosPublicoController`, `permitAll()`, em `CONTROLLERS_PUBLICOS`): `{versao, rascunho, documentos}`, sem nada do usuário, `Cache-Control: max-age=300, public`. `GET /termos` e o aceite não mudam. | Gustavo, 04/11 |
| D3 | Páginas | `/privacidade`, `/termos-de-uso` e `/excluir-conta`, com `ui/TelaPublica` e a marca do produto, fora das guardas de login. | Gustavo, 04/11 |
| D4 | Exclusão sem login | Não existe. A página só explica: o aluno entra e vai em Conta › "Excluir minha conta" (texto de `dominio/excluirConta.ts`); quem não consegue entrar fala com o treinador ou com o e-mail de contato; o treinador cancela pela Central. | Gustavo, 04/11 |
| D5 | E-mail de contato | `contato@servirea.com.br` (o mesmo que recebe os alertas da Cloudflare), numa constante só (`dominio/contato.ts`). | Gustavo, 04/11 |
| D6 | Texto jurídico | Nada novo e nenhum prazo prometido. Os termos continuam **RASCUNHO** para a revisão jurídica. | Gustavo, 04/11 |

## URLs para as lojas
- Política de privacidade (App Store e Play): https://overtraining.app/privacidade
- Termo de uso: https://overtraining.app/termos-de-uso
- Exclusão de conta (Play, "Excluir conta" no Data safety): https://overtraining.app/excluir-conta

## Passos
- [x] 1. API: `GET /publico/termos`, teste sem login em `TermosIntegrationTest` e entrada no `ArquiteturaTest`. Commit: 1c62685
- [x] 2. App: as três páginas, os links "Privacidade" e "Termos de uso" no rodapé do Entrar e da inscrição, e o título da aba em `dominio/telas.ts`. Commit: 1c62685
- [x] 3. e2e em 390 e 1280 px (`e2e/paginas-publicas.spec.ts`, 12 de 12; `inscricao`, `inscricao-perguntas`, `telas-publicas-erros` e `senha-provisoria` verdes). Commit: 1c62685
- [x] 4. Verificação em 04/11: typecheck e lint limpos, `npm test` 5769 de 5769, `mvn verify` 2113 testes sem falha (JaCoCo incluído). PR: (este)

## Fora do escopo
- Mudar o texto dos termos: depende da revisão jurídica.
- Formulário público de pedido de exclusão.

## O que ficou para trás
- ~~E-mail de contato real no lugar do marcador~~ · `contato@servirea.com.br`, definido em 04/11.
- Central, no próximo PR de documentação: a exceção (a) do `cloudflare-regras.md` já libera `/api/`, e com isso o
  `/api/publico/termos`; faltam as três páginas (`/privacidade`, `/termos-de-uso`, `/excluir-conta`). Sem elas, o
  revisor fora do Brasil recebe o 403 da Cloudflare nessas URLs. A página é o SPA: o `index.html` também carrega
  `/_expo/` (JS e CSS), `/assets/` (fontes e imagens) e `/favicon.ico`, que precisam entrar na mesma exceção, senão
  a página abre em branco fora do Brasil. Em produção o `web.Caddyfile` da Central já devolve o `index.html`
  para essas rotas (`try_files {path} /index.html`, conferido em 04/11): fora a Cloudflare, nada a mudar lá.
- Revisão jurídica dos termos, que continuam RASCUNHO.
