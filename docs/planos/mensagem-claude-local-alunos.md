# Mensagem para o Claude local: telas do aluno no estilo novo

Cole o bloco abaixo no Claude Code do seu PC, aberto na pasta do consultoria-app.

---

Agora quero que você implemente no app as telas de aluno do treinador (lista, ficha e novo aluno) no estilo novo, a partir
de um protótipo que eu já aprovei. Tudo em português.

**Leia antes de mexer**
1. `AGENTS.md` da raiz (inteiro) e `docs/design-e-front.md` (a seção 4.1 descreve o estilo).
2. `docs/planos/telas-do-aluno-visual.md`: as decisões D1 a D7 e os passos. É o contrato desta tarefa.
3. O protótipo `docs/prototipos/alunos.html`: abra no Chrome e use o botão "Ajustes" para ver as três telas (Lista,
   Ficha, Novo aluno) no PC e "como celular". É HTML solto com dados fictícios: serve de referência visual, não de código
   para copiar (o app é React Native com `StyleSheet` e as peças de `app/src/ui/`).
4. As telas de hoje: `app/src/app/treinador/alunos/index.tsx`, `[id].tsx` e `novo.tsx`, `app/src/treinador/FormAluno.tsx`,
   `app/src/treinador/ResumoDoAluno.tsx`, `CartaoPastas.tsx` e os cartões da ficha.

**Onde trabalhar**
- Branch `claude/saraiva-api-direcionamento-treinos-dv10io` (`git fetch origin` e `git pull`). Não vá para a `main`:
  push na `main` publica em produção. Se ainda estivermos ajustando o editor de treino nesta branch, termine aquilo
  antes ou faça em commits separados.

**Regras desta tarefa**
- Só apresentação: nenhuma mudança de rota, DTO, permissão, regra da API, `useCarregar`, fila offline nem publicação.
  Tudo o que a tela mostra já vem da API hoje (`GET /alunos`, `GET /alunos/{id}`, `GET /responsaveis` etc.). Se achar
  que precisa de algo novo na API, pare e me pergunte.
- Reaproveite as peças: `Cartao` (faixa de título), `CabecalhoDeGrupo`, `Selo` (com `Icone` para os estados),
  `IconeBotao moldura`, `Botao`, `Escolha`, `Campo`, `Grade`, `Tabela`/`LinhaDaLista`, `FotoDePerfil`, `Alerta`,
  `AlvoDeRolagem`/`useRolagem`. Cores, bordas, cantos e espaços só de `app/src/tema/tokens.ts` (nada de hexadecimal solto).
  Se precisar de peça nova, ela vai para `app/src/ui/` e serve às outras listas.
- Regra pura (agrupar os alunos, textos dos grupos) vai para `app/src/dominio/` com teste, como o resto do app.
- Permissões continuam como hoje: cada cartão da ficha aparece só com a permissão dele (`pode(...)`, `Permitido`).
- A linha do aluno continua link (`<a href>` na web) e o "Selecionar" continua marcando sem abrir a ficha:
  `app/e2e/listas-em-linha.spec.ts` e `app/e2e/cadastro-aluno.spec.ts` têm de passar.
- Acessibilidade: um h1 por tela, alvo de toque de 44 px, contraste conferido (`tema/tokens.test.ts`), funciona no
  tema claro, claro areia, escuro e com "Bordas reforçadas".
- Celular (390 px) e PC (1280 px): confira os dois. Na lista, abaixo de 768 px cada linha vira cartão.

**Ordem sugerida (um passo do plano por vez, me mostrando antes de seguir)**
1. Lista (D1 a D3). 2. Ficha (D4 a D6). 3. Novo aluno e edição (D7). 4. AGENTS.md e capturas.

**Como ver e testar**
- Para ver na hora: Docker com a demonstração (`docker compose up -d --build`, com `SPRING_PROFILES_ACTIVE=docker,demo`,
  `COMPOSE_PROFILES=demo` e `DEMO_SENHA` no `.env`; nunca mostre os valores do `.env`) e, em `app/`,
  `$env:EXPO_PUBLIC_API_URL="http://localhost:8088/api"; npx expo start --web` (abre em `http://localhost:8081`).
  Entrar com `saraiva@demo.local`.
- Antes de cada commit, em `app/`: `npm run typecheck`, `npm run lint`, `npm test`, os e2e das telas tocadas
  (`npx playwright test e2e/listas-em-linha.spec.ts e2e/cadastro-aluno.spec.ts e2e/acesso-aluno.spec.ts` e o que mais
  abrir a ficha) e, no fim, `npm run e2e` inteiro. Acrescente casos de e2e para o que é novo (grupos da lista, atalhos
  da ficha, resumo de erros do cadastro), em 390 e 1280 px, só com dados fictícios.
- Se um e2e quebrar só porque um texto ou botão mudou de lugar, ajuste o teste e me diga qual. Se quebrar por
  comportamento, pare e me pergunte.

**Commits**
- Só quando eu pedir, na mesma branch, em português, um push por lote (minutos do GitHub Actions são contados). Nada de
  `--force`, rebase, merge na `main` nem PR: isso eu combino com o Claude da nuvem.
- Marque cada passo em `docs/planos/telas-do-aluno-visual.md` com o commit e atualize o `AGENTS.md` (itens "Ficha do
  aluno (treinador)", lista de alunos e `FormAluno`) quando o comportamento descrito lá mudar.
- Dados só fictícios. Nada de dado de aluno real, `.env` ou segredo em commit, log ou resposta.

Comece lendo os arquivos e me diga, em poucas linhas, o plano do passo 1 (lista) antes de escrever código.
