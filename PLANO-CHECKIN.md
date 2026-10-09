# Plano: atualização (check-in) do aluno com feedback do treinador

> Para o Sonnet ou o Codex executar. Leia o `AGENTS.md` antes. Vale para a **API**, o **app do aluno** (celular e web)
> e o **painel do treinador**. Objetivo: o aluno responde a atualização **no app**, e não mais no WhatsApp; o
> treinador lê e responde **no app**, com um feedback escrito (decisão do Gustavo: "opção B").
> Fotos: o campo aparece, mas tocar mostra "Ainda não implementado". O envio de verdade fica para um plano próprio.

## 0. Como trabalhar

1. **Ponto seguro:** `git switch main && git pull --ff-only origin main && git tag antes-checkin && git push origin antes-checkin`.
   Trabalhar direto na `main`, como diz o `AGENTS.md`.
2. **Commits:** um commit por item (C1, C2…), em português.
   - App, antes de cada commit: `cd app && npm run typecheck && npm run lint && npm test`.
   - API, antes de cada commit: `cd api && mvn verify`.
3. **Demonstração de domingo, 11/10, às 16:30:**
   - nada deste plano pode quebrar o roteiro do README;
   - se não estiver tudo ✅ até sábado à noite, o Gustavo decide se mostra ou se volta para `antes-checkin`.
4. **Fim:** relatório da seção 9 ao Gustavo (✅/❌, tiradas de tela do aluno e do treinador, o que ficou de fora) e push
   só com autorização.

## 1. Regras de produto (decididas)

- **Data da atualização = `fim` da pasta ativa do aluno** (`pasta_plano.fim`, V009). Sem pasta ativa com `fim`, não
  existe atualização.
- **Datas** (constantes num lugar só, `dominio/atualizacao.ts` no app e uma classe de regras na API, iguais nos dois e
  com teste):
  - **aviso:** começa **3 dias antes** ("Sua atualização é em 3 dias");
  - **formulário:** libera **1 dia antes** e continua aberto depois da data;
  - **atrasada:** a partir do dia seguinte à data, se não foi enviada.
- **Estados:**
  - `ABERTA`: liberada, ainda não enviada;
  - `ENVIADA`: o aluno enviou e aguarda o treinador;
  - `REVISADA`: o treinador escreveu o feedback.
  - "Atrasada" **não é estado**: é calculada pela data.
- **"Vou atrasar":** o aluno avisa com uma nova data (até 15 dias depois da data da atualização) e um motivo opcional. O
  aviso aparece para o treinador e o lembrete passa a usar a nova data. **Nunca** bloqueia nem encerra o aluno: o
  sistema só avisa; quem decide é o treinador.
- **Peso:** ao enviar, grava também um `registro_peso` na **data da atualização**, na mesma transação. Já existe
  `unique (aluno_id, data)`, então, se houver peso nesse dia, atualiza. Sai no gráfico de peso que já existe.
- **Feedback (opção B):** texto do treinador, de 1 a 4.000 caracteres.
  - Enviar o feedback muda o estado para `REVISADA` e avisa o aluno.
  - Pode ser **editado** depois, e o aluno vê "editado em dd/mm".
  - O aluno lê o feedback junto com as próprias respostas.
- **Uma atualização por pasta** (`unique (pasta_id)`). Reenviar a mesma não duplica: é idempotente, como o registro de
  série.
- **Dado sensível (LGPD):** psicológico, estresse, digestão, dores e o peso.
  - Nunca em log nem em mensagem de erro.
  - Só o aluno dono e os treinadores da consultoria veem.
  - Outro aluno ou outra consultoria recebe **404**.
  - Testes e seed só com texto fictício.
- **O sistema não interpreta nada:** sem alerta de "nota baixa", sem sugestão.

## 2. O formulário (texto do Saraiva, em caixas)

O modelo fica **na API** como JSON versionado: o mesmo para todas as consultorias por enquanto, já que as perguntas
não identificam ninguém. Editar o modelo pelo painel fica para depois.

O app desenha a partir do JSON, **sem pergunta escrita à mão na tela**. Tipos usados:

| Tipo | Na tela |
|---|---|
| `DATA_AUTOMATICA` | Só mostra a data da atualização (não editável) |
| `PESO` | Campo numérico em kg, uma casa, faixa 20–400 |
| `NOTA` | Escolha de 0 a 10 em 11 botões (`Escolha`, seleção invertida) |
| `TEXTO` | Campo de uma linha, até 500 caracteres |
| `TEXTO_LONGO` | Campo de várias linhas, até 2.000 caracteres |
| `NOTAS_POR_DIA` | Uma linha por dia, cada uma com a nota de 0 a 10 |
| `FOTOS` | 3 caixas (Frente, Costas, Lado) + 1 livre. Tocar mostra `useAviso`: "Envio de fotos ainda não implementado." Não conta como resposta |

**Instruções no topo** (caixa destacada, texto do Saraiva):
- "O feedback deve ser enviado no dia da atualização. Caso ocorra atrasos, avise previamente."
- "👉🏻 Atualização de peso e fotos em jejum".

**Modelo v1** (`id` fixo de cada pergunta; `*` = obrigatória para enviar):

**Seção "Atualização"**
| id | tipo | rótulo |
|---|---|---|
| `data` | DATA_AUTOMATICA | Atualização |
| `peso` * | PESO | Peso (em jejum) |
| `fotos` | FOTOS | Fotos em jejum |
| `psicologico` | TEXTO_LONGO | Como foi o seu psicológico durante o mês? |
| `sono` * | NOTA | De 0 a 10, como foi o seu sono? |
| `estresse` | TEXTO_LONGO | Passou algum momento de estresse? |

**Seção "✅ Alimentar"**
| id | tipo | rótulo |
|---|---|---|
| `alim_desempenho` * | NOTA | Desempenho (0 a 10) |
| `alim_faltou` | TEXTO_LONGO | Sentiu que faltou algo durante a dieta? |
| `alim_livre` | TEXTO_LONGO | O que comeu em cada refeição livre e em qual quantidade? |
| `alim_digestao` | TEXTO | Como está sua digestão? |
| `alim_fome` | TEXTO | Momento que mais ficou com fome |
| `alim_enjoou` | TEXTO_LONGO | Algum alimento que enjoou ou gostaria de substituir? |
| `alim_incluir` | TEXTO_LONGO | Gostaria de comer algo durante as refeições (e em qual refeição)? |

**Seção "✅ Treino"**
| id | tipo | rótulo |
|---|---|---|
| `treino_dias` | TEXTO | Quantos dias por semana está conseguindo treinar? |
| `treino_desempenho` * | NOTA | Desempenho (0 a 10) |
| `treino_dores` | TEXTO_LONGO | Sentiu dores ou dificuldades? Quais as dores? Em quais exercícios? |
| `treino_descanso` | TEXTO | Precisou fazer descanso no meio da semana? Se sim, qual dia? |
| `treino_acrescentar` | TEXTO_LONGO | Algo a acrescentar? |

Em `treino_dias`, uma linha de ajuda com o que o app registrou: "No app: média de N dias com treino por semana neste
período" (ver C2). O aluno responde assim mesmo.

**Seção "Feedbacks dos treinos durante esse período"**
| id | tipo | rótulo |
|---|---|---|
| `fb_recuperacao` | TEXTO_LONGO | De 0 a 10, como foi a recuperação de cada dia? |
| `fb_dores` | TEXTO_LONGO | Sentiu dores durante a semana? |
| `fb_fadiga` | TEXTO_LONGO | Sentiu muita fadiga durante a semana? |
| `fb_desgastante` | TEXTO | Qual dia foi mais desgastante? |
| `fb_substituiu` | TEXTO_LONGO | Teve algum exercício que substituiu por não ter o maquinário próprio na sua academia? Se sim, quais? |
| `fb_recuperou` | TEXTO_LONGO | Seu músculo recuperou até a próxima sessão de treino? (ajuda: "Exemplo: treinei perna na segunda e na outra sessão de pernas treinei com dores") |
| `fb_pos_treino` | NOTAS_POR_DIA (`dias: [1,2,3,4,5,6]`) | De 0 a 10, como você se sentiu pós-treino nos dias abaixo |
| `fb_mes` | TEXTO_LONGO | Me diz brevemente um feedback desse mês ou alguma observação relevante para o seu desenvolvimento |

O texto é o do Saraiva, só com acentos e pontuação corrigidos. As duas perguntas de dores ficam como ele escreveu;
juntar é decisão dele, depois.

## 3. API

### C1. Banco (migration nova: a próxima livre, hoje `V017__atualizacoes.sql`)

- **`atualizacao_modelo`** (global, sem `@TenantId`, como o catálogo):
  - colunas: `id`, `versao int unique`, `conteudo jsonb`, `criado_em`;
  - a migration insere a **v1** da seção 2.
- **`atualizacao`** (com `@TenantId`):
  - colunas: `id`, `consultoria_id`, `aluno_id`, `pasta_id unique`, `data_atualizacao date`, `modelo_versao int`, `estado`
    (check nos 3 valores), `respostas jsonb`, `enviada_em`, `atraso_ate date`, `atraso_motivo varchar(300)`,
    `atraso_avisado_em`, `feedback text`, `feedback_em`, `feedback_editado_em`, `feedback_por uuid`, `feedback_visto_em`,
    `versao` (lock otimista), `criado_em`;
  - índice `(consultoria_id, estado, data_atualizacao)` para o painel.
- **A linha nasce no primeiro envio ou aviso de atraso** do aluno. Antes disso, a atualização "existe" calculada pela
  pasta: **sem agendador e sem job**.
- Subir o total do `FlywayMigrationIntegrationTest`.

### C2. Regras e serviço (`atualizacoes/`)

- **`RegrasAtualizacao`** (pura, com teste): calcula a fase a partir de hoje, `fim` e `atraso_ate`:
  - `NENHUMA`, `AVISO` (até 3 dias antes), `ABERTA` (a partir de 1 dia antes), `ATRASADA` (depois da data ou de
    `atraso_ate`), `ENVIADA`, `REVISADA`;
  - mais `diasParaData` e `diasDeAtraso`.
- **Validação das respostas contra a versão do modelo:**
  - ids desconhecidos são ignorados;
  - tipos e faixas conferidos (nota inteira 0–10, peso 20–400, textos dentro do limite);
  - obrigatórias exigidas;
  - JSON total até 64 KiB;
  - erro = 422 `ATUALIZACAO_INVALIDA` com `fieldErrors` (`field` = id da pergunta), como os planos.
- **Resumo do período** (para a ajuda de `treino_dias` e para o treinador):
  - dias distintos com série registrada entre `inicio` e `fim` da pasta ÷ semanas do período;
  - último peso antes da data;
  - consulta **com `aluno_id` e `consultoria_id` explícitos** se for SQL nativo.

### C3. Rotas do aluno (`@PreAuthorize("hasRole('ALUNO')")`, aluno sempre da sessão)

| Rota | O que faz |
|---|---|
| `GET /aluno/atualizacao` | A atualização da pasta ativa: fase, datas, modelo (conteúdo da versão), respostas enviadas (se houver), feedback (se houver), resumo do período. Sem pasta com `fim`: `{fase: "NENHUMA"}` |
| `POST /aluno/atualizacao/enviar` | `{modeloVersao, respostas}` → valida, grava `ENVIADA` + peso, na mesma transação. Já `ENVIADA` ou `REVISADA` → 409 `ATUALIZACAO_JA_ENVIADA` (corrigir é pelo feedback/conversa, não reenviando) |
| `POST /aluno/atualizacao/atraso` | `{novaData, motivo?}` → só antes de enviar; nova data entre hoje e data + 15 dias |
| `GET /aluno/atualizacoes` | Histórico: data, estado, se tem feedback não lido |
| `GET /aluno/atualizacoes/{id}` | Respostas + feedback de uma antiga (404 se não for dele) |
| `POST /aluno/atualizacoes/{id}/feedback-visto` | Marca `feedback_visto_em` |

### C4. Rotas do treinador (`hasRole('TREINADOR')`)

| Rota | O que faz |
|---|---|
| `GET /atualizacoes?situacao=PARA_REVISAR\|ATRASADAS\|AVISARAM_ATRASO\|PROXIMAS` | Painel. `PROXIMAS` = data nos próximos 7 dias e ainda não enviada (calculada pelas pastas ativas, sem linha) |
| `GET /alunos/{alunoId}/atualizacoes` | Lista na ficha |
| `GET /atualizacoes/{id}` | Respostas organizadas pelo modelo + resumo do período + peso anterior (para a variação) |
| `PUT /atualizacoes/{id}/feedback` | `{texto, versao}` → grava, `REVISADA`. Lock otimista (409 se mudou) |

`GET /painel` ganha os contadores "Para revisar" e "Atrasadas".

### C5. Testes da API (Testcontainers)

- O aluno vê só a própria, e outro aluno recebe 404.
- Outra consultoria recebe 404 em todas as rotas do treinador.
- Enviar duas vezes → 409, sem duplicar nada.
- O peso vai para `registro_peso` com a data da atualização (e atualiza, se já existia).
- Validação: obrigatória faltando, nota 11, peso 0 e texto grande demais → 422 com o `field` certo.
- Atraso fora da faixa → 422. Atraso depois de enviar → 409.
- Feedback: muda o estado; editar marca `feedback_editado_em`; versão antiga → 409.
- `RegrasAtualizacao`: todas as fases nas datas de borda (3 dias antes, 1 dia antes, no dia, depois, com e sem
  `atraso_ate`).
- O `ArquiteturaTest` continua verde (`@PreAuthorize` em toda rota, `@TenantId`, SQL nativo filtrado).

## 4. App do aluno

### C6. Onde aparece

- **Início do aluno:** um cartão **"Sua atualização"**, acima do "Treino de hoje" quando houver ação. Cor por estado,
  **sempre com `Selo` e texto**, nunca a cor da marca:
  - `AVISO`: neutro, "Sua atualização é em 3 dias (dd/mm)" + "Ver o que vou responder";
  - `ABERTA`: âmbar, "Responda sua atualização até dd/mm" + botão **Responder** (primário da tela) + "Vou atrasar";
  - `ATRASADA`: vermelho, "Atualização atrasada há N dias" + Responder + "Vou atrasar";
  - atraso avisado: âmbar, "Você avisou: nova data dd/mm";
  - `ENVIADA`: verde, "Enviada. Aguardando o treinador";
  - `REVISADA` com feedback não lido: verde, **"Seu treinador respondeu sua atualização"** + "Ler".
- **Histórico** (ou Conta): seção "Atualizações", com as antigas e os feedbacks.

### C7. Tela do formulário (`app/aluno/atualizacao.tsx` + `aluno/atualizacao/`)

- Cabeçalho "Atualização · dd/mm", com o selo de sincronização.
- Caixa de **instruções** (texto da seção 2), em destaque.
- **Uma caixa (`Cartao` com `CabecalhoDeGrupo`) por seção** do modelo, com as perguntas dentro. Os campos usam os
  componentes que já existem (`Campo`, `CampoNumerico`, `Escolha`), sem campo novo para isso.
- **Rascunho no aparelho:**
  - cada mudança grava no `RepositorioLocal` (chave por pasta);
  - fechar o app e voltar mantém tudo;
  - o rascunho é apagado ao enviar com sucesso e no logout.
  - Entra no contrato do `RepositorioLocal` e na bateria do `offline.test.ts`, nas duas implementações.
- **Enviar:**
  - pergunta faltando: rolar até a primeira e marcar o campo;
  - sem conexão: aviso "Sem conexão: suas respostas ficam salvas no aparelho. Envie quando conectar." **Não enfileira
    o envio sozinho**, porque o aluno precisa ver o resultado;
  - sucesso: tela "Atualização enviada" e volta ao início.
- **"Vou atrasar"** abre uma `Folha` com o campo de data (padrão: data + 2 dias, máximo data + 15) e o motivo opcional.
- **Fotos:** as caixas aparecem e mostram o aviso "ainda não implementado". Não bloqueiam o envio.
- **Leitura de uma enviada ou revisada:** as mesmas caixas, só leitura, e no topo o **feedback do treinador** num
  cartão próprio (data, texto, "editado em", se houver). Ao abrir, marca o feedback como visto.

### C8. Notificações (avisar que a atualização está chegando)

- **No app (web e celular):** o cartão do C6 e um ponto na aba **Treino** da barra inferior, quando houver
  `ABERTA`/`ATRASADA` ou feedback não lido.
- **Celular, com o app fechado:** **notificações locais** com `expo-notifications` (`npx expo install
  expo-notifications`). São agendadas no aparelho a partir das datas que vieram no pacote, e funcionam offline:
  - 3 dias antes, às 9h: "Sua atualização é em 3 dias.";
  - no dia, às 9h: "Hoje é dia da sua atualização. Peso e fotos em jejum.";
  - 1 dia depois, às 9h, se não enviou: "Sua atualização está pendente. Se for atrasar, avise pelo app.".
  - Reagendar sempre que o pacote ou o atraso mudarem; cancelar ao enviar e no logout.
  - Pedir permissão **na primeira vez que o cartão aparecer**, com uma explicação antes ("Quer um lembrete no dia da
    atualização?"), nunca ao abrir o app.
  - Texto **sem dado sensível** (nada de peso nem de respostas).
  - Na web, nada de notificação: só o cartão.
- **"Seu treinador respondeu":** só no app por enquanto (ponto + cartão). Avisar com o app fechado exige push remoto,
  que exige o app publicado nas lojas, e fica para o plano do chat.
- Atualizar no `AGENTS.md` a frase "Não adicionar notificações com o app fechado neste escopo": vale para o descanso;
  a atualização usa notificação **local**.

## 5. Painel do treinador

### C9. Início do treinador

- Cartões **"Atualizações para revisar (N)"**, **"Atrasadas (N)"**, "Avisaram atraso (N)" e "Próximas 7 dias (N)".
  Cada um abre a lista filtrada.
- Na lista: nome do aluno, data da atualização e o selo do estado ("Atrasada há 2 dias", "Avisou: nova data dd/mm").
- Tocar abre a atualização.

### C10. Tela da atualização (`app/treinador/atualizacoes/[id].tsx`)

- **Trilha:** Alunos › Nome › Atualização dd/mm.
- **Resumo no topo:**
  - peso e variação para o peso anterior;
  - as notas (sono, alimentar, treino) como números grandes;
  - "Média de N dias com treino por semana (registrado no app)".
- **Respostas** nas mesmas caixas do aluno, só leitura. Pergunta sem resposta mostra "—".
- **Feedback:**
  - campo grande "Seu feedback para o aluno" + **"Enviar feedback"** (único primário da tela);
  - depois de enviado: o texto, com "Editar";
  - erro 409: "Outra pessoa alterou; recarregue".
- **Atalho:** "Abrir pasta do aluno" (para replicar a pasta com os ajustes, fluxo que já existe).

### C11. Ficha do aluno

- Cartão **"Atualizações"**: a próxima data (com o estado) e a lista das antigas (data, estado, "com feedback").
- Tocar abre o C10.

## 6. O que não fazer

- Envio de fotos de verdade, storage e upload: fica para o plano das fotos. Aqui é só o aviso.
- Push remoto, e-mail ou WhatsApp para a atualização (só notificação local e aviso no app).
- Editor do modelo no painel (o modelo v1 vem da migration).
- Qualquer interpretação automática das respostas (alerta, cor por nota, sugestão).
- Encerrar ou bloquear aluno por atraso.
- Mudar `V001`–`V016`, as regras de pastas ou o fluxo de planos.
- Apagar `backend/` ou `mobile/`. Usar `alert()` ou `confirm()`.

## 7. AGENTS.md (atualizar junto, curto)

- **Atualização (check-in):**
  - uma por pasta, com a data no `fim`, sem agendador;
  - modelo global versionado (`atualizacao_modelo`), respostas em JSON validadas pela versão;
  - estados `ABERTA`/`ENVIADA`/`REVISADA`, e atrasada é calculada;
  - "vou atrasar" só avisa;
  - o peso entra em `registro_peso`;
  - feedback do treinador em texto, editável;
  - dado sensível: nunca em log, 404 fora do dono e da consultoria.
- **App:**
  - rascunho no `RepositorioLocal`;
  - notificações **locais** (3 dias antes, no dia, 1 dia depois) sem dado sensível, canceladas ao enviar e no logout;
  - fotos ainda não implementadas.

## 8. Ordem

C1 → C2 → C3 → C5 (API pronta e testada) → C6 → C7 → C8 → C9 → C10 → C11.

Se o tempo acabar, entra o que estiver completo, na ordem. A API sem a tela não aparece para ninguém, então não
arrisca a demonstração.

## 9. Verificação (antes de pedir para juntar)

1. **Automático:**
   - `mvn verify`;
   - `npm run typecheck && npm run lint && npm test`;
   - `npx expo export --platform web` e `--platform android`.
2. **Docker com o banco zerado:** `docker compose down -v && docker compose up -d --build`, depois rodar de novo o
   `scripts/importacao/importar.mjs`.
3. **Preparar:** na ficha do aluno de demonstração, ajustar a pasta ativa para o `fim` cair **amanhã**.
4. **Aluno (celular e web):**
   - [ ] o cartão aparece com "Responda sua atualização até dd/mm";
   - [ ] as caixas estão na ordem da seção 2, com as instruções no topo;
   - [ ] as fotos mostram "ainda não implementado";
   - [ ] fechar o app no meio do preenchimento e voltar mantém as respostas (rascunho);
   - [ ] enviar sem peso marca o campo; enviar completo mostra "Enviada" e o peso aparece no gráfico da ficha;
   - [ ] "Vou atrasar" com nova data muda o cartão e aparece para o treinador;
   - [ ] no celular: a permissão é pedida com a explicação e a notificação local chega no horário (para testar,
     reduzir o horário com uma constante só de desenvolvimento, nunca deixada no commit).
5. **Treinador:**
   - [ ] o painel mostra "Para revisar (1)";
   - [ ] a tela mostra peso com variação, notas e média de dias;
   - [ ] o feedback enviado faz o aluno ver "Seu treinador respondeu" e ler o texto;
   - [ ] editar mostra "editado em".
6. **Isolamento:**
   - [ ] `aluno2@demo.local` não vê nada da atualização do aluno 1;
   - [ ] `exemplo@demo.local` recebe 404 na atualização do Saraiva.
7. **Roteiro da demonstração do README** do começo ao fim, sem regressão.

**Relatório ao Gustavo:** a lista com ✅/❌, as tiradas de tela (aluno: cartão, formulário, enviada, feedback; treinador:
painel, tela da atualização) e o que ficou de fora.
