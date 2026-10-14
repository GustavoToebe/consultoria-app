# Plataforma de treinos e dieta

Plataforma para vários treinadores (cada um com a sua consultoria isolada) montarem treino e dieta dos alunos.
O aluno vê o plano no celular ou na web e registra cargas e repetições, inclusive sem internet. O Saraiva
(Saraiva Team) é o primeiro treinador.

- Regras para quem mexe no código e decisões de produto: [AGENTS.md](AGENTS.md). Catálogo público: [docs/catalogo.md](docs/catalogo.md).
- `api/` — backend (Java 25, Spring Boot 4.1.1, PostgreSQL 18). `app/` — app Expo (web, Android e iOS).

## Como rodar (local, Docker)

```bash
cp .env.example .env    # preencher POSTGRES_PASSWORD, TREINOS_JWT_SEGREDO e TREINOS_LOGIN_SAL (openssl rand -base64 48 cada) e DEMO_SENHA
docker compose up -d --build
# Web (treinador e aluno): http://localhost:8088   (na rede: http://IP-DO-PC:8088)
```

**Token do GitHub Packages.** A API usa a biblioteca `plataforma` (`docs/biblioteca-comum.md`), que o GitHub Packages só entrega com
token. Antes do primeiro `up --build`, crie `deploy-local/segredos/gh_token` (fora do git) com um token de leitura
(`read:packages`) numa linha; o Docker o usa só durante o build, sem gravá-lo na imagem.

No Windows: Docker Desktop; `ipconfig` mostra o IP do PC; liberar a porta 8088 no firewall para o celular.
O banco começa com os dados de demonstração (só quando está vazio). Para recomeçar do zero:
`docker compose down -v && docker compose up -d --build`. Volume criado com o Postgres 17 (antes da Fase 3) não serve
ao 18, que guarda os dados em outra pasta: rode `docker compose down -v` antes do primeiro `up`.

### Em outro computador

1. Instalar o **Git** e o **Docker Desktop** (pede administrador no Windows). Para o celular, também o **Node 24.21.0**
   (`app/.nvmrc`). JDK 25 e Maven só para rodar os testes da API.
2. Pegar o código: `git clone https://github.com/GustavoToebe/consultoria-app.git` (a `main` tem tudo), em
   `Documents/consultoria-app`, fora do OneDrive (git e `node_modules` brigam com a sincronização, e senha não vai
   para a nuvem de arquivos).
3. Cada PC tem o próprio `.env`, que **não está no git** (tem as senhas). Num clone novo: `cp .env.example .env` e preencher
   `POSTGRES_PASSWORD`, `TREINOS_JWT_SEGREDO` e `TREINOS_LOGIN_SAL` (`openssl rand -base64 48` cada) e `DEMO_SENHA` (senha das contas de
   demonstração). Nunca mandar o `.env` por e-mail, chat ou commit.
4. `docker compose up -d --build` e abrir `http://localhost:8088`. O banco começa limpo, com a demonstração.
5. Celular: o IP muda de rede para rede (`ipconfig`). Rede de empresa costuma bloquear um aparelho de falar com o
   outro; nesse caso, `npx expo start --tunnel`.

### Celular (Android/iOS) pelo Expo Go

Com o Docker rodando, no mesmo Wi-Fi do PC:

```bash
cd app
npm ci                   # só na primeira vez (Node 24.21.0, ver app/.nvmrc)
npx expo start           # ler o QR code com o Expo Go (SDK 57)
```

O app acha a API sozinho em `http://IP-DO-PC:8088/api` (pelo endereço do Metro). Se não achar, rodar com
`EXPO_PUBLIC_API_URL=http://IP-DO-PC:8088/api npx expo start`. Sem o mesmo Wi-Fi: `npx expo start --tunnel`.

### Verificações

- API: `cd api && mvn verify` (Error Prone, ArchUnit, JaCoCo ≥ 70%; precisa do Docker para o Testcontainers).
- App: `cd app && npm run typecheck && npm run lint && npm test`; bundle nativo: `npx expo export --platform android`.

## Roteiro da demonstração

Antes do ensaio, recomeçar do zero: `docker compose down -v && docker compose up -d --build`.
Depois, para trazer os vídeos, as semanas de treino (Wellness, Torso & Limbs, Planos 10, 2.1 e 16) e a mobilidade:
`set -a; . ./.env; set +a; node scripts/importacao/importar.mjs` (pode repetir, não duplica).

1. PC, `http://IP:8088`: entrar como `saraiva@demo.local` → marca SARAIVA TEAM (fonte Metal); Perfil → Preferências →
   Tema “Claro” e voltar para “Padrão da consultoria”.
2. Marca: enviar a logo do Saraiva (PNG/JPEG até 512 KB, em “Identidade”) e ver a prévia nos dois temas; trocar a cor
   por uma das paletas e a fonte do nome (Padrão, Metal, Esportiva, Condensada) e voltar ao que estava.
3. Alunos → Aluno Demonstração → pasta “Plano 16” → Abrir o treino → chip “Seg · Costas” → Remada baixa → “Usar receita de
   séries” → mudar FS de 3 para 2 (os percentuais viram 70/85) → Validar → Publicar (confirmar os avisos) → v2.
4. Ficha → tocar na pasta → Replicar pasta (o próximo ciclo já vem sugerido) → o plano novo abre como rascunho, igual ao anterior.
5. PDF do treino e da dieta (botão PDF na ficha ou no editor; na web abre “Salvar como PDF”).
6. Celular (Expo Go), `aluno@demo.local`: tocar no “Treino de hoje” (ou num chip de data das divisões) → abrir um
   exercício → marcar séries → modo avião → marcar mais → fechar e abrir o app (“salvo no aparelho”) → tirar do
   modo avião → “Sincronizado”. Na quinta o seed tem Off ativo: usar o chip da quarta.
7. PC: ficha do aluno → “Registros e cargas” (por divisão ou por dia, 14/30/60 dias), PDF das cargas e Progresso.
8. `exemplo@demo.local`: outra marca e tema claro; nada do Saraiva aparece.
9. Sair → “Sou treinador, criar conta” → consultoria nova, já com as receitas prontas.

## Contas de demonstração

Senha de todas: o valor de `DEMO_SENHA` no `.env`. Todos os dados são fictícios.

| Conta | Papel | Consultoria |
|---|---|---|
| `saraiva@demo.local` | Treinador | Saraiva Team (fonte Metal, tema escuro) |
| `aluno@demo.local` | Aluno | Saraiva Team (Plano 16 publicado, dieta, histórico de 2 semanas) |
| `exemplo@demo.local` | Treinador | Consultoria Exemplo (tema claro) |
| `aluno2@demo.local` | Aluno | Consultoria Exemplo (plano ABC) |

## Em aberto

**Perguntas para o Saraiva** (o app não corrige nada sozinho; mostra o que o treinador passar):

- [ ] Off ativo na **quarta** ou na **quinta**? (o seed usa quinta)
- [ ] Back off sobre a **carga da WS do dia** ou o **maior peso feito no exercício**? (o app usa a maior carga da WS
      do dia)
- [ ] Cardio **todo dia** ou **só nos dias Off**?
- [ ] Texto completo das **instruções do PDF do Plano 16** (hoje vem da planilha; trocar na metodologia padrão, em Planejamento).
- [ ] **PDF da dieta** (a do seed tem quantidades de exemplo).
- [ ] “Refeição 2 — Almoço” só com frutas: nome certo?
- [ ] Ovo inteiro 3 un / 180 g = 133 kcal: confere? Faltam proteína, carboidrato e gordura.
- [ ] Legumes com 45 kcal e macros zerados: valores certos?
- [ ] Variação de peso −1 onde a conta dá −1,5: qual vale?

**Para depois da demonstração:** preço por aluno “cadastrado” ou “ativo”; o que o Saraiva
controla hoje na planilha sobre os clientes; cobrança pela Central; RLS no Postgres; service
worker na web (abrir sem internet); importar plano da planilha; app próprio nas lojas.

## Pendências e decisões

Decisões tomadas onde o plano não fechava; conferir com o Gustavo ou com o Saraiva.

- **Catálogo público real** (ver `docs/catalogo.md`). Alimentos: **591** da TACO 4ª ed. (NEPA/UNICAMP,
  2011), de 597 na planilha. Exercícios: **877** (52 próprios + 825 do exercicios-bd-ptbr, CC0), com nomes revisados em
  `dados/curadoria/exercicios-nomes.csv`. O SQL (`V002`, `V003`) é gerado por `scripts/catalogo/` a partir de
  `dados/fontes/`; relatórios em `dados/relatorios/`. Pontos para o Gustavo/Saraiva olharem:
  - **TACO, uso comercial:** a publicação permite reproduzir citando a fonte e não fala de uso comercial. Decisão do
    Gustavo: não consultar a UNICAMP; a fonte é citada em cada alimento e na tela (`dados/fontes/README.md`).
  - **Descartados (6):** Feijoada (nº 540, nome `L` na planilha) fica de fora por decisão do Gustavo; os outros 5 estão
    marcados `*` (análise reavaliada) ou com valor em branco (`dados/relatorios/taco-importacao.md`).
  - **Carboidrato negativo por diferença** (−0,007 a −0,045 g em 4 alimentos) foi gravado como 0, e `Tr`/`NA` viram 0
    (o `Tr` aparece como "Tr" na tela). Valores com 2 casas, como na planilha (o PDF imprime menos casas).
  - **Conferência com o PDF da TACO:** 578 alimentos comparados, 0 divergências; 19 sem como conferir (linhas
    incompletas no PDF). O PDF não vai para o git.
  - **Nomes de exercício:** a revisão manteve alguns em inglês (por exemplo "Bent press com kettlebell", "Press com
    pinos", "Press no pescoço"); trocar no CSV e rodar o gerador se o Saraiva preferir "desenvolvimento". 27
    exercícios do dataset repetem um dos 52 próprios e não entram; 21 de strongman ficaram de fora.
  - A busca do catálogo ignora acento e olha só o nome; o grupo é um filtro à parte.

- **Dieta de demonstração reconstruída.** O PDF da dieta do Saraiva não está no repositório: a dieta do seed usa os
  9 alimentos de exemplo com valores por 100 g, com quantidades de exemplo (5 refeições, opções A/B no
  almoço e no jantar). Ajustar no editor quando houver o PDF. O seed antigo do protótipo não foi usado:
  não bate com o PDF descrito e traz medicamentos, que não podem ir para o seed.
- **Instruções do PDF do treino** vêm das regras do Saraiva (FS, cálculo, WS); o texto completo do PDF do Plano 16 pode substituir na metodologia padrão (Planejamento).
- `login_tentativa` segue o da Central (uma linha por chave).
- **Offline do aluno: SQLite no celular, AsyncStorage na web.** No Android/iOS cada usuário tem um banco
  `treinos-<usuarioId>.db` (expo-sqlite), com os registros numa tabela de chave única igual à do servidor e cada
  gravação numa transação; sair da conta apaga o arquivo. Na abertura, o app traz o que a versão anterior guardou no
  AsyncStorage (inclusive registros ainda não enviados) e apaga de lá. Na web continua o AsyncStorage (localStorage):
  o SQLite na web exige cabeçalhos COOP/COEP e WASM. Os testes rodam a mesma bateria nas duas implementações, com o
  SQLite do próprio Node. Na web o app não abre sem servidor (não há service worker); sem internet no meio do uso,
  continua funcionando.
- **PDF na web sem iframe.** A CSP do Caddy tem `frame-src 'none'`; o PDF entra num bloco só de impressão da própria
  página e abre o “Imprimir / Salvar como PDF” do navegador. No celular gera o arquivo e abre o compartilhar.
- **Item “Ovo inteiro, 3 un” do seed só tem kcal (133).** Sem proteína, carboidrato e gordura, os totais de macros do
  café e do dia aparecem como “—” (o sistema não inventa valor nutricional). Preencher no editor de dieta com os
  valores que o Saraiva usar.
- **Logs sem dado pessoal:** erro inesperado vai para o log só com as classes e os pontos do código, e o driver do
  Postgres não inclui o “Detalhe” (que traria e-mail ou peso) nas exceções.
- `execucao_serie.serie_trabalho`: marca a série de trabalho, vinda da versão do plano.
- Ambiguidades dos PDFs para mostrar ao Saraiva: Off ativo na quarta ou na quinta (o seed usa
  quinta); back off sobre "carga da WS" ou "maior peso do exercício" (o app usa o maior peso registrado na WS do dia);
  cardio todo dia ou só nos dias Off; "Refeição 2 — ALMOÇO" com frutas; ovo 3 un/180 g com 133 kcal; legumes com
  45 kcal e macros zerados; variação de peso −1 onde a conta dá −1,5.

### Visual e movimento — verificação de 08/10/2026

Parte A preservada na etiqueta `demo-parte-a`. Parte B em `visual/rnr`: Uniwind estável 1.12.2 com Tailwind 4, sem configuração de Babel; Metro estende a configuração do Expo. O Button foi adicionado pelo CLI do React Native Reusables e adaptado para o desenho flat, cantos de 8 px e alvo mínimo de 44 px. `src/components/ui/` guarda as bases copiadas; os adaptadores em `src/ui/` preservam as props.

Prova B1: tipos, lint, 99 testes e exports web/Android/iOS passaram. O Docker fez `npm ci` limpo e publicou atrás da CSP atual do Caddy; tema claro/escuro e registro offline/reconexão passaram no navegador sem erro de execução. Expo Go, vibração e ensaio físico no celular continuam pendentes: Gustavo autorizou continuar sem esse teste em 08/10. Isso não equivale a uma validação nativa concluída. A Parte B não é juntada automaticamente à branch da demonstração.

B4 concluído: Botao, Cartao, Selo, Campo/Label, Interruptor, Abas, PainelConfirmacao, Escolha e Texto mantêm as interfaces públicas sobre as bases RNR. A composição Radix recebe estilos achatados; regressão coberta por teste. Confirmações conservam foco inicial no cancelamento e restauram o foco ao fechar na web. Os componentes copiados vêm de https://github.com/founded-labs/react-native-reusables (MIT), com adaptações locais de estilo e comportamento.

B5: ✅ verificações automáticas, exports, npm ci/Docker, CSP, compiler e fluxos web; ✅ marca/tema em execução nas duas consultorias; ✅ convenções atualizadas. ❌ Expo Go/vibração e ensaio manual completo pelo Gustavo ainda pendentes. A autorização para continuar não foi tratada como resultado de teste nem aprovação para juntar a B.

Parte C implementada em `visual/movimento`, que inclui a B: descanso automático somente quando o plano define segundos, início manual (60/90/120/180 s), ajustes e pular; término por timestamp no AlunoProvider; transição do treino sem API experimental; números interpolados; esqueleto sem gradiente; folha com mola e arraste pelo cabeçalho no celular; progresso semanal com registros locais e histórico. O histórico da semana fica no repositório isolado por usuário para consulta offline. Notificações com o app fechado continuam fora do escopo.

C7: ✅ 110 testes do app (20 suítes), tipos, lint e exports web/Android/iOS; ✅ Expo Doctor 21/21 e dependências compatíveis; ✅ cronômetro entre telas, ajustes, término, reinício e série sem descanso na web; ✅ esqueleto com resposta atrasada, offline/reconexão, duas consultorias e temas; ✅ 20 capturas em larguras de 390/1280 px. API: `mvn verify`, 70 testes e cobertura de linhas de 89%. O React Compiler está presente nos bundles de antes e depois. ❌ Segundo plano no celular, vibração, desempenho nativo, arraste e ensaio completo com Gustavo ainda exigem aparelho. O usuário autorizou continuar a implementação sem esse teste; nenhuma validação física foi presumida.

Para concluir a validação física: abrir no Expo Go, marcar/desmarcar séries (incluindo a última), iniciar descanso e navegar, ir ao segundo plano e voltar, testar ±15 s/Pular, arrastar a folha e ativar movimento reduzido. Repetir o roteiro da demonstração nos dois temas/consultorias antes de domingo. A tag `demo-parte-a` permanece disponível para retorno.

Junção (08/10/2026): por decisão do Gustavo, `visual/rnr` e `visual/movimento` foram juntadas à branch da demonstração e à `main` depois da revisão (testes, exports web/Android, Compiler no bundle e roteiro no navegador). Ajustes da revisão: aba ativa voltou a ser só o sublinhado (o gatilho do RNR desenhava uma caixa) e a folha lateral entra a partir da largura do painel. O ensaio no celular continua pendente; se algo falhar no aparelho, rodar a demonstração pela etiqueta (`git checkout demo-parte-a` e `npm ci` em `app/`).
