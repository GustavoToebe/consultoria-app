# CI do consultoria-app: como economiza minutos do Actions

Aqui se trabalha direto na `main` (sem pull request), e todo push na `main` publica em produção. A regra não muda: nada vai para
produção sem os testes terem passado sobre aquele código.

- **Só documentação não roda nada.** O push ignora `.md` e `docs/**`. Exceção: `.md` dentro de `src/` é lido pelo aplicativo (os termos
  de uso e o aviso de privacidade em `api/src/main/resources/termos/`), então mudar um deles publica. Antes só `**/*.md` era ignorado, e
  uma mudança nesses termos nunca chegava à produção.
- **Cancelamento.** Pull request e disparo manual têm o grupo `producao` sem cancelar; só um pull request (que o fluxo normal não usa)
  cancela a execução anterior, em grupo próprio. Um deploy em andamento nunca é cancelado.
- **Cache.** Maven (`setup-java`), npm (`setup-node`) e imagem Docker (`cache-from`/`cache-to` `type=gha`, escopos `api` e `web`).
  Não há Playwright aqui.
- **Limpeza de imagens antigas (GHCR).** `limpar-ghcr.yml`, semanal, mantém as 20 versões com tag mais recentes de `consultoria-api` e
  `consultoria-web`. Começa em **simulação** (só lista no log). Para apagar: rodar à mão com "apagar" marcado, ou criar a variável de
  repositório `GHCR_LIMPEZA_APAGAR=true`. Nunca apaga versão sem tag nem tag que não seja de commit. A VPS só usa a release atual e a
  anterior (`releases/consultoria/atual.env` e `anterior.env`), ambas entre as últimas publicadas.
- **Sem proteção de branch** na `main`: decisão do Gustavo (o fluxo é direto na `main`).
