# Mensagem para o Claude local: estilo novo no app inteiro e pendências da análise

Cole o bloco abaixo no Claude Code do seu PC, aberto na pasta do consultoria-app. Pode mandar enquanto as telas de aluno
estão em andamento: a mensagem tira elas daqui.

---

Próxima rodada, em paralelo com o que já está em andamento. Tudo em português.

**Leia antes de mexer**
1. `AGENTS.md` da raiz (inteiro) e `docs/design-e-front.md` (a seção 4.1 descreve o estilo novo).
2. `docs/planos/atualizacao-visual-app-full.md`: decisões D1 a D5 e os passos 0 a 11. É o contrato desta rodada.
3. Os protótipos aprovados em `docs/prototipos/` (abra no Chrome) e o editor de treino já pronto
   (`app/src/treinador/treino/`): é a referência viva do estilo.

**Fora desta rodada:** o editor de treino e as telas de aluno do treinador (lista, ficha, novo aluno), que já estão
sendo feitos. Não mexa nesses arquivos aqui.

**Passo 0: renomear a branch**
- A branch passa a se chamar `atualizacao-visual-app-full`. Com tudo o que está em andamento já commitado (ou junto na
  árvore, o `git branch -m` não perde nada): `git branch -m claude/saraiva-api-direcionamento-treinos-dv10io
  atualizacao-visual-app-full` e `git push -u origin atualizacao-visual-app-full`.
- **Não apague a branch antiga no GitHub**: o Claude da nuvem confere e apaga depois.
- Troque o nome antigo pelo novo no "Onde" de `docs/planos/editor-de-treino-visual.md`, `telas-do-aluno-visual.md`,
  nas mensagens `mensagem-claude-local-*.md` e na linha de `docs/planos/README.md` (o "Evolução: `mvn verify`…" das
  pendências soltas também cita a branch).

**Trabalhe o máximo possível em paralelo**
- Use subagentes (ferramenta Agent) em paralelo para os lotes independentes, até uns 4 ou 5 por vez, cada um com um
  conjunto de arquivos só dele (dois agentes nunca editam o mesmo arquivo). Quando um precisar mexer numa peça comum de
  `app/src/ui/`, essa peça é do passo 1 e só um agente cuida dela.
- Ordem: o passo 1 (peças comuns) primeiro, porque muda todas as telas. Enquanto ele roda, já podem ir em paralelo os
  passos que não dependem de visual: 6 (migration), 7 (cabeçalho da importação, API), 10 (plano do A02) e os
  protótipos dos passos 8 e 9. Depois do passo 1, as telas em lotes paralelos (abaixo), mais os passos 4 e 5.
- Cada agente recebe: o trecho do `AGENTS.md` da área, a seção 4.1 do design, os arquivos que são dele e os testes
  que precisa rodar. Você (o coordenador) junta, roda os testes do conjunto e me mostra.
- Testes demorados (e2e completo, `mvn verify`) rodam em segundo plano enquanto outro lote anda.

**Passos 1 a 3: estilo novo no app inteiro**
- Primeiro as peças comuns de `app/src/ui/` (lista no plano). Depois as telas, nestes lotes:
  - **Treinador, lote A:** Início, Atualizações (lista e detalhe), Agenda, Números.
  - **Treinador, lote B:** Planejamento (lista, editor de modelo, editor de questionário), editores de dieta e de
    mobilidade, Receitas.
  - **Treinador, lote C:** Biblioteca (todas as abas), Importação, Interessados (lista, Kanban, folha).
  - **Treinador, lote D:** Financeiro, Marca, Equipe, Auditoria, Minha conta, Meus dados, Segurança, Ajustes, Perfil,
    Ajuda, Termos.
  - **Aluno:** Início, Treino, sessão do dia e exercício, Dieta, Lista de compras, Mobilidade, Histórico, Atualização,
    Anamnese, Conta, Ciclo, Ajuda, Termos.
  - **Públicas:** Entrar, Cadastro, Convite, Convite da equipe, Esqueci a senha, Redefinir senha, Inscrição.
- Só apresentação: blocos com faixa de título, ações na faixa com `IconeBotao moldura`, selos com ícone para estado,
  um botão primário por área, cores e medidas só de `tema/tokens.ts`. Nada de regra, rota, permissão, `useCarregar`,
  fila offline ou texto de negócio por causa do visual.
- Se uma mudança for num token (vale para o app inteiro), me avise antes.
- Mostre capturas antes e depois de cada lote, em 390 e 1280 px, no tema claro e no escuro.

**Passo 4: A06, textos da dieta**
- Deixar claro, no editor da dieta, o que é modelo do Planejamento e o que é o plano do aluno (o treino já faz isso com
  `plano/FaixaDoPlano` e `dominio/planoDoAluno.ts`; a dieta deve seguir o mesmo) e revisar o nome dos complementos
  (suplementação e "Outros"). Só texto. Mostre a lista de textos antes de trocar.

**Passo 5: lista de compras**
- Hoje a diferença só aparece pelo selo de cada item ("como na dieta" / "Sem fator"). Separar com dois rótulos visíveis:
  "Conforme a dieta" (item sem fator) e "Estimativa para compra" (conta com FC/FCc), na tela do aluno, na prévia do
  treinador e no PDF. A conta não muda (`dominio/listaDeCompras.ts`).

**Passo 6: A12, categorias dos suplementos**
- Migration nova (próximo número livre, hoje V047): troca "Suplementos / Whey" por "Whey" e similares **só** onde a
  categoria ainda é exatamente a do catálogo padrão (`api/src/main/resources/suplementos/heavysuppz.json`); categoria
  que o treinador editou não muda. O JSON passa a vir sem o prefixo para as consultorias novas.
- Teste de integração com uma categoria editada à mão que tem de ficar como está. Suba o total de migrations em
  `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` e no `AGENTS.md`.

**Passo 7: linha do cabeçalho na importação**
- Hoje `ConfiguracaoDaImportacao.cabecalho` é sim/não (primeira linha ou nenhuma). Trocar por "linha do cabeçalho"
  (nenhuma, 1, 2…), para planilha com título em cima. As linhas acima do cabeçalho não entram nos dados; o hash da
  prévia cobre a escolha; os ajustes da tabela continuam com o número da linha no arquivo. Muda
  `ImportacaoController`, `ImportacaoService`, `GravadorDaImportacao`, `AjustesDaImportacao`, a tela da etapa de
  configuração e os testes (`mvn verify` e `e2e/importacao.spec.ts`).

**Passos 8 e 9: painel novo e orientação no primeiro uso**
- Painel novo: o Início do treinador em três blocos, "Próximo passo", "Acompanhamento" e "Planejamento". O PDF de
  referência tem nomes reais e não entra no git: me peça para descrever ou mostrar o que precisa.
- A01: algo mais guiado no começo (o passeio pelo menu já existe em `ui/Passeio`).
- Para os dois: primeiro um protótipo em HTML em `docs/prototipos/` (dados fictícios, editável no Chrome como os
  outros), eu aprovo, e só então o código.

**Passo 10: A02, importar plano de PDF ou Google Docs**
- Só o plano em `docs/planos/importar-plano-de-documento.md` (copiado do `MODELO.md`): opções, o que fica no servidor,
  riscos de LGPD (plano de aluno é dado sensível) e perguntas para eu decidir. Nenhum código.

**Regras de sempre**
- Branch `atualizacao-visual-app-full`. Nada na `main` (push na `main` publica em produção), nada de PR, `--force`
  ou rebase: isso eu combino com o Claude da nuvem.
- Antes de cada commit, em `app/`: `npm run typecheck`, `npm run lint`, `npm test` e os e2e das telas tocadas; no fim,
  `npm run e2e` inteiro. Na API (passos 6 e 7): `mvn verify` com o Docker ligado. Se um e2e quebrar só porque um texto
  ou botão mudou de lugar, ajuste o teste e me diga qual; se quebrar por comportamento, pare e me pergunte.
- Para ver na hora: `docker compose up -d --build` com a demonstração e, em `app/`,
  `$env:EXPO_PUBLIC_API_URL="http://localhost:8088/api"; npx expo start --web` (`http://localhost:8081`). Nunca mostre
  valores do `.env`.
- Commit só quando eu pedir, em português, um push por lote (os minutos do GitHub Actions são contados).
- Marque cada passo em `docs/planos/atualizacao-visual-app-full.md` com o commit; atualize `AGENTS.md`, a Ajuda
  (`app/src/ajuda/conteudo.ts`) e os guias PDF quando o que eles descrevem mudar.
- Dados só fictícios. Nada de dado de aluno real, `.env` ou segredo em commit, log ou resposta.

Comece pelo passo 0 e me diga, em poucas linhas, como vai dividir os agentes antes de disparar.
