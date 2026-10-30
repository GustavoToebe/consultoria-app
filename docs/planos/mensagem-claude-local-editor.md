# Mensagem para o Claude local: testar e ajustar o editor de treino

Cole o bloco abaixo no Claude Code do seu PC, aberto na pasta do consultoria-app.

---

Vou testar no meu PC o novo visual do editor de treino e te pedir ajustes conforme eu for vendo. Leia primeiro o
`AGENTS.md` da raiz e o `docs/planos/editor-de-treino-visual.md` (as decisões D1 a D12 e o porquê de cada uma). Tudo em
português.

**Onde está o trabalho**
- Branch `atualizacao-visual-app-full` (ainda não foi para a `main`). Rode `git fetch origin` e
  `git switch atualizacao-visual-app-full` (ou `git pull` se já estiver nela). Não troque para a
  `main` nem faça merge nela: push na `main` publica em produção.
- O que mudou (só visual, nenhuma regra do plano, contrato da API, fila offline ou publicação):
  - App todo: fundo quase branco (`#F7F7F8`; areia `#FAF9F6`), cantos de 12 px (`RAIO`), borda de 2 px nos blocos
    (`BORDA_BLOCO`) e linha de 3 px embaixo da faixa do título (`LINHA_DA_FAIXA`), item ativo do menu lateral
    preenchido com a cor da marca, opção "Bordas reforçadas" em Perfil › Preferências. Tudo em `app/src/tema/tokens.ts`,
    `app/global.css` (espelho, tem teste) e `app/src/dominio/preferencias.ts`.
  - Peças: `ui/Cartao`, `ui/CabecalhoDeGrupo` (props `linha`, `inicio`, selo com ícone), `ui/Folha`, `ui/Tabela`,
    `ui/IconeBotao` (prop `moldura`), `ui/Selo` (prop `Icone`, fundo opaco por `tingido`), `ui/Navegacao`.
  - Editor de treino (`app/src/treinador/treino/`): `CartaoSessao` (barra da marca, bloco "Adicionar próximo exercício"),
    `CartaoExercicio` (faixa forte, grupo muscular, selo de estado, Trocar/↑/↓/lixeira com moldura),
    `EditorSeries` (uma série aberta por vez, número, Pronta/Atenção/Corrigir, seções em caixinhas, Esforço e Descanso
    lado a lado, "Para o aluno" colorido) e `ContadoresDoTreino` (topo do editor).

**Como subir para eu testar (Windows)**
1. Banco e API pelo Docker, com a demonstração: no `.env` (nunca mostre os valores dele nem mande para lugar nenhum)
   precisam estar `SPRING_PROFILES_ACTIVE=docker,demo`, `COMPOSE_PROFILES=demo` e `DEMO_SENHA`. Rode
   `docker compose up -d --build` e espere a API ficar saudável. Isso já serve a web em `http://localhost:8088`.
2. Para ver cada ajuste na hora, sem reconstruir a imagem: em `app/`, `npm ci` (se o `package.json` mudou) e
   `$env:EXPO_PUBLIC_API_URL="http://localhost:8088/api"; npx expo start --web`, que abre em `http://localhost:8081`
   (essa origem já está liberada no CORS do compose). Entrar com `saraiva@demo.local` e a `DEMO_SENHA`.
3. Para abrir o editor: Alunos › um aluno › uma pasta › treino › Editar, ou Planejamento › Treino › um modelo.
   Teste no PC (janela larga) e no celular (estreite a janela para 390 px ou use o modo de dispositivo do Chrome), nos
   temas Claro, Claro areia e Escuro, e com "Bordas reforçadas" ligada e desligada.

**Como trabalhar comigo**
- A cada pedido, mude o mínimo e me diga o que mudou e onde. Cor, espessura, espaço e canto vêm de
  `tema/tokens.ts` (nada de cor em hexadecimal solta nos componentes). Se a mudança for no token, vale para o app inteiro:
  me avise antes. Reaproveite as peças de `app/src/ui/`.
- Não mude regra de negócio, validação, contrato da API, `useCarregar`, fila offline nem publicação por causa de visual.
- Contraste: texto com 4,5:1 ou mais, borda de campo com 3:1; os testes em `tema/tokens.test.ts` conferem. Se um ajuste
  meu baixar o contraste, me diga e proponha o mais próximo que passa.
- Antes de cada commit, em `app/`: `npm run typecheck`, `npm run lint` e `npm test` verdes, e o e2e das telas tocadas
  (`npx playwright test e2e/editor-series.spec.ts e2e/series-metodologia.spec.ts e2e/grupos-e-cardio-treino.spec.ts`,
  e `npm run e2e` inteiro no fim). Se um e2e quebrar só porque um texto ou botão mudou de lugar, ajuste o teste e me
  diga qual. Se quebrar por comportamento, pare e me pergunte.
- Commit só quando eu pedir, na mesma branch, em português, e um push por lote (os minutos do GitHub Actions são
  contados). Nada de `--force`, rebase, merge na `main` nem PR: isso eu combino com o Claude da nuvem.
- Atualize o `docs/planos/editor-de-treino-visual.md` (decisões e passos) e o `AGENTS.md` quando algo de lá mudar.
- Dados só fictícios. Nada de dado de aluno real, `.env` ou segredo em commit, log ou resposta.

Quando estiver tudo de pé, me mostre a tela do editor e me pergunte o que quero mudar primeiro.
