# Plano: acompanhamento completo do aluno

> Para o Codex executar. É o pacote que leva o processo do Saraiva (Google Forms + Drive + WhatsApp) para dentro do
> app. Cobre os itens 2, 3, 4 (o que faltou), 5, 7, 8, 9 e 10 do roteiro combinado com o Gustavo:
>
> | Bloco | Conteúdo |
> |---|---|
> | **Q** | Ganhos rápidos: serviço e vencimento, convite pelo WhatsApp com situação, linha do tempo, painel "o que fazer hoje" |
> | **P** | Nota rápida ao fim do treino e "troquei este exercício" (o que faltou do check-in) |
> | **F** | Fotos: armazenamento privado, envio, poses guiadas (liga as fotos do check-in) |
> | **A** | Anamnese por link, com questionário completo |
> | **V** | Evolução: medidas, gráficos e comparador de fotos |
> | **M** | Academia do aluno: maquinário e aviso no editor de treino |
> | **D** | Dieta: preferências do aluno no editor e substituições por item |
> | **O** | Primeiros passos, "ver como o aluno vê", tours e ajuda |
>
> **Tudo local** (Docker no PC do Gustavo). Nada de servidor, e-mail, push remoto, cobrança nem IA.

## 0. Antes de começar

1. **Leitura obrigatória:**
   - `AGENTS.md` (regras que não podem ser quebradas);
   - `PLANO-CHECKIN.md` e `PLANO-EQUIPE.md`: este plano **usa** o que eles criam (atualização, modelo de questionário,
     permissões e auditoria);
   - `PLANO-HIERARQUIA-VISUAL.md` (padrão visual: níveis, `CabecalhoDeGrupo`, um primário por área, seleção invertida).
2. **Pré-requisitos:**
   - **o `PLANO-CHECKIN.md` precisa estar feito.** Se não estiver, pare e avise o Gustavo;
   - o `PLANO-EQUIPE.md` é recomendado. Se não estiver feito, use `hasRole('TREINADOR')` nas rotas novas e escreva no
     relatório a lista das permissões desta seção que ficaram pendentes.
3. **Ponto seguro:** `git switch main && git pull --ff-only origin main && git tag antes-acompanhamento && git push origin antes-acompanhamento`.
   Trabalhar direto na `main`, como diz o `AGENTS.md`.
4. **Commits:** um commit por item (Q1, Q2…), em português.
   - API: `mvn verify` (testes, ArchUnit, JaCoCo ≥ 70%).
   - App: `npm run typecheck && npm run lint && npm test`.
   - Migrations novas: sempre a **próxima livre**; subir o total no `FlywayMigrationIntegrationTest`; nunca editar
     uma antiga.
5. **Ordem dos blocos:** Q → P → F → A → V → M → D → O.
   - Cada bloco fecha com a verificação dele (seção 11) antes de começar o próximo.
   - Se o tempo acabar, entra o que estiver completo. Nada pela metade dentro de um item.
6. **Fim:** relatório da seção 12. Push só com autorização do Gustavo.

## 1. Regras que valem para o plano inteiro

- **Isolamento:**
  - todo dado novo tem `consultoria_id` com `@TenantId`;
  - aluno só vê o que é dele; outra consultoria ou outro aluno recebe **404**;
  - SQL nativo filtra `consultoria_id` e `aluno_id` explicitamente;
  - rota nova do treinador tem `@PreAuthorize` com a permissão certa (seção 10).
- **Dado sensível (LGPD):** anamnese, fotos, medidas, peso, notas e respostas.
  - Nunca em log, mensagem de erro, auditoria, URL ou nome de arquivo.
  - Precisa de permissão `*_SENSIVEL_*` (ver `PLANO-EQUIPE.md`).
  - Testes e seed só com dados fictícios.
- **O sistema não interpreta saúde:**
  - nada de alerta automático por sintoma, nota, medida ou substância;
  - nada de sugestão de dieta ou carga;
  - ausência de dado é "—".
- **Nada de imagem de terceiros:** não copiar imagens do Fitness Programer, do GymVisual nem tabelas de Bristol de
  sites. Usar texto, cores próprias ou SVG feito aqui.
- **Visual:** níveis e tipografia do `PLANO-HIERARQUIA-VISUAL.md`; status sempre no `Selo` com texto; confirmação com
  `PainelConfirmacao`; nada de `alert()`.
- **Offline do aluno:**
  - o que o aluno registra durante o treino (nota pós-treino, troca de exercício) grava no aparelho na hora e sincroniza
    depois, como as séries;
  - fotos e anamnese precisam de conexão: o app avisa com clareza, sem perder o que já foi preenchido.

## 2. Bloco Q: ganhos rápidos

### Q1. Serviço contratado, vencimento e telefone do aluno

- **Banco (migration):** em `aluno`,
  - `servico_treino boolean not null default true`;
  - `servico_dieta boolean not null default true`;
  - `plano_nome varchar(80)` (ex.: "Consultoria Premium");
  - `vencimento date`;
  - `telefone varchar(20)`.
  - `check (servico_treino or servico_dieta)`.
- **API:** `FormAluno` e DTOs com os campos novos.
  - Telefone validado como no Servirea (`Formatos`, celular BR com DDD) e gravado formatado.
  - **Sem cobrança nenhuma**: é só informação.
- **App, treinador:** campos novos no cadastro e na ficha ("Serviço: Treino e Dieta · Consultoria Premium · vence em
  dd/mm").
- **App, aluno:** a aba **Dieta** some quando `servico_dieta = false` **e** não há dieta publicada, porque "recurso que
  não existe não aparece". O mesmo vale para o Treino.
- **Testes:** API (check, validação de telefone, isolamento) e a regra de esconder aba (função pura com teste).

### Q2. Convite pelo WhatsApp e situação do convite

- **API:**
  - `AlunoResumo` passa a trazer `situacaoAcesso`: `SEM_CONVITE`, `CONVITE_ATIVO` (com `conviteExpiraEm`),
    `CONVITE_EXPIRADO` ou `COM_ACESSO`. É calculado de `usuario_id` e `convite_expira_em`, que já existem.
  - **Nunca devolver o código depois de gerado**: continua aparecendo só na resposta de "Gerar convite".
- **App, treinador:**
  - na lista de alunos, selo da situação ("Convite expira em 5 dias", "Convite expirado", "Com acesso"), com filtro
    por situação;
  - no `CartaoAcesso`, depois de gerar: **"Enviar pelo WhatsApp"** e **"Compartilhar"**:
    - **celular:** `Share` do React Native;
    - **web:** abre `https://wa.me/<telefone>?text=<mensagem>` (sem telefone: `https://wa.me/?text=`). O link do
      WhatsApp abre fora do app, sem token.
    - **Mensagem** (texto fixo, com o nome da consultoria): "Olá, {nome}! Seu acesso ao app da {consultoria}: {link}
      (vale por 7 dias). Se pedir código: {codigo}."
  - **QR code** do link, para quando o aluno está ao lado:
    - gerado no aparelho com `react-native-qrcode-svg` (usa o `react-native-svg`, que já existe);
    - **nunca** por serviço externo;
    - instalar com `npm install` fixando a versão e conferir o `npx expo-doctor`.
  - logo depois de **cadastrar** o aluno, a tela de sucesso já oferece "Gerar convite e enviar pelo WhatsApp".
- **Testes:** cálculo da situação (bordas de expiração), montagem da mensagem e do link `wa.me` (função pura com
  acentos e caracteres especiais codificados).

### Q3. Linha do tempo do aluno

- **API:** `GET /alunos/{id}/linha-do-tempo?antes=<data>&limite=50`, ordenada da mais nova para a mais antiga e
  paginada pela data. Junta, numa consulta com `union all` filtrada por `consultoria_id` e `aluno_id`:
  - aluno cadastrado e inativado;
  - convite gerado e aceito (primeiro login);
  - pasta criada e finalizada;
  - treino e dieta publicados (título e versão; "por Fulano", se houver equipe);
  - atualização enviada, atraso avisado e feedback enviado;
  - peso registrado (com valor, só com permissão sensível);
  - lesão registrada ou alterada (só "Lesão registrada", sem conteúdo, mesmo com permissão);
  - fotos enviadas (P e F);
  - anamnese respondida (A);
  - **dias de treino**: um evento por dia com registro ("Treinou: Segunda - Costas, 14 séries"), agregado.
- **App, treinador:** cartão **"Linha do tempo"** na ficha, recolhível, com ícone por tipo e "Carregar mais". Cada
  evento leva à tela dele, quando houver.
- **Testes:** isolamento (outro aluno ou consultoria não aparece), paginação, evento sensível omitido sem permissão.

### Q4. Painel "o que fazer hoje"

Reorganizar o **Início do treinador**, de cima para baixo:

1. **"Atenção hoje"**, uma lista curta. Cada linha tem nome, motivo em `Selo` e ação, e abre a tela certa:
   - atualizações **para revisar**;
   - atualizações **atrasadas** e "**avisou atraso**";
   - alunos **sem registro há 7 dias**;
   - **vencimento** em até 7 dias ou vencido (Q1);
   - **convite expirado** ou ativo há mais de 3 dias sem aceite (Q2);
   - **pasta terminando** sem próxima pasta criada;
   - anamnese **respondida e não revisada** (A).
2. **"Próximas atualizações"**: hoje, amanhã e na semana (números que abrem a lista).
3. **Indicadores:** alunos ativos, taxa de atualizações enviadas no prazo nos últimos 30 dias, tempo médio até o
   feedback.

- **API:** `GET /painel` passa a devolver esses blocos, cada lista limitada (ex.: 20) com o total.
- **Filtro "Meus alunos / Todos"** (se o `PLANO-EQUIPE.md` estiver feito).
- **Testes:** cada regra com aluno fictício nas bordas de data.

## 3. Bloco P: durante o treino (o que faltou do check-in)

### P1. Nota rápida ao fim do treino

- **Quando:** ao marcar a **última série** da sessão do dia, ou ao tocar "Concluir treino" (botão novo no fim da
  tela da sessão).
- **O quê:** uma `Folha` "Como foi o treino?":
  - nota de 0 a 10 (11 botões);
  - "Sentiu dor?" Não/Sim; se Sim, um campo curto "Onde e em qual exercício?" (até 200 caracteres);
  - **Pular** sempre visível, e nunca bloqueia nada.
- **Offline:**
  - nova tabela local `avaliacao_sessao` (planoVersaoId, sessaoUid, data, nota, dor, dorTexto, situação de envio);
  - **esquema do SQLite: bloco novo de versão** (`user_version` 2) em `offline/banco.ts`, sem editar o v1;
  - mesma coisa no `RepositorioChaveValor`;
  - entra na bateria do `offline.test.ts` nas duas implementações;
  - sincroniza pelo `Sincronizador`, como as séries.
- **API:**
  - tabela `avaliacao_sessao` (`@TenantId`) com `unique (aluno_id, plano_versao_id, sessao_uid, data)`: reenviar
    atualiza, sem duplicar;
  - `POST /aluno/avaliacoes-sessao/lote`, idempotente, com registro ruim **recusado com motivo** sem derrubar o lote
    (padrão do `ExecucaoUpsert`).
  - A versão e a sessão precisam ser do aluno (senão: recusado).
- **Ligação com o check-in:** no formulário da atualização, `fb_pos_treino` (notas por dia) vem **preenchido** com a
  média das notas do período por dia da semana, editável, com a ajuda "Preenchido com as notas que você deu ao fim de
  cada treino". `fb_dores` vem com a lista das dores informadas (editável).
- **Treinador:** na tela da atualização, a lista das notas por sessão do período; na linha do tempo, o evento.

### P2. "Troquei este exercício"

- **Onde:** na tela do exercício do aluno, um link "Troquei este exercício" abre uma `Folha`:
  - "Usei no lugar" (texto, até 120 caracteres, com sugestões da biblioteca da consultoria, por busca local no pacote);
  - motivo: Sem o aparelho / Aparelho ocupado / Senti dor / Outro.
- **Offline e API:** igual ao P1. Tabela `troca_exercicio` com `unique (aluno_id, plano_versao_id, exercicio_uid, data)`
  e lote idempotente.
- **Séries:** continuam registradas no exercício do plano. A troca é só a informação.
- **Ligação:**
  - `fb_substituiu` do check-in vem preenchido com a lista das trocas do período;
  - no **editor de treino**, ao lado do exercício: "Trocado 3× (sem o aparelho)", com a lista;
  - na linha do tempo, o evento.

## 4. Bloco F: fotos

### F1. Armazenamento privado (local)

- **Docker:** serviço `minio` no `docker-compose.yml`:
  - imagem com **tag de versão fixa**, sem porta publicada (só a rede interna);
  - volume próprio;
  - credenciais `ARQUIVOS_CHAVE` e `ARQUIVOS_SEGREDO` no `.env` **sem valor padrão** (`:?` no compose);
  - `.env.example` sem valores.
- **API:**
  - interface `ArmazenamentoArquivos` (`gravar`, `ler`, `apagar`), com implementação **S3**: AWS SDK v2, `endpoint`
    configurável, *path-style*;
  - assim, trocar para Supabase Storage, R2 ou S3 depois é só configuração;
  - o bucket é criado na subida, se não existir, e é **privado**.
- **Chave do arquivo:** `{consultoriaId}/{alunoId}/{uuid}.jpg`. **Nada de nome de pessoa nem data no nome.**
- **Testes:** Testcontainers do MinIO.

### F2. Envio e leitura de fotos

- **Banco:** `foto` (`@TenantId`) com `id`, `consultoria_id`, `aluno_id`, `origem` (`ANAMNESE`, `ATUALIZACAO`, `EVOLUCAO`),
  `referencia_id` (null até ligar), `pose` (`FRENTE`, `COSTAS`, `LADO`, `LIVRE`), `data`, `chave`, `chave_miniatura`,
  `largura`, `altura`, `bytes`, `enviada_por`, `criado_em`.
- **Envio:** `POST /aluno/fotos` (multipart: `arquivo`, `pose`, `origem`):
  - **limite de 10 MB** só nessa rota: exceção explícita no `LimiteCorpoFilter` e o mesmo limite no
    `request_body` do Caddy para o caminho;
  - **conferir os primeiros bytes** (JPEG ou PNG; HEIC/WebP recusados com mensagem: o app já converte);
  - **ler as dimensões antes de decodificar** e recusar acima de 40 megapixels (proteção contra "bomba" de imagem);
  - decodificar e **regravar como JPEG** (qualidade 0,85, lado maior até 2.000 px). Isso **remove EXIF e GPS**, e
    também gera a miniatura de 400 px;
  - nunca guardar nem devolver o original;
  - limite de 30 envios por hora por usuário (`LimiteTentativas` ou equivalente).
- **Leitura:** `GET /fotos/{id}?tamanho=miniatura|grande`, com autorização em cada pedido (o aluno dono ou um
  treinador com `FOTO_SENSIVEL_LER`):
  - devolve os bytes com `Cache-Control: private, no-store` e `Content-Disposition: inline`;
  - **sem URL pública** e sem link assinado.
- **Apagar:**
  - o aluno apaga uma foto **ainda não ligada** a algo enviado;
  - o treinador tem "Apagar todas as fotos do aluno" (pedido de LGPD), com `PainelConfirmacao` e registro na
    auditoria (sem conteúdo).
- **Limpeza:** foto sem `referencia_id` com mais de 7 dias é apagada, numa limpeza diária (`@Scheduled`).
- **App:**
  - escolher ou tirar foto com `expo-image-picker` (já instalado);
  - **antes de enviar**, `expo-image-manipulator` (`npx expo install`): redimensiona para até 2.000 px e salva em
    **JPEG**. Isso converte HEIC e já tira os metadados no aparelho, mas o servidor regrava de qualquer jeito;
  - mostrar foto protegida com `ui/FotoProtegida`:
    - busca pelo `api/cliente.ts`, com token;
    - na web, vira `blob:` (a CSP já permite `img-src blob:`) e o `URL.revokeObjectURL` roda ao sair;
    - no celular, imagem em memória, **sem cache em disco** (dado sensível).
  - Sem conexão: "Conecte-se para enviar as fotos". O resto do formulário continua salvo no aparelho.

### F3. Poses guiadas e ligação com o check-in

- **Componente `aluno/FotosGuiadas`:** 3 caixas (Frente, Costas, Lado) + 1 livre, cada uma com:
  - a **silhueta da pose em SVG feito aqui** (contorno simples: frente e costas com os braços colados ao corpo; lado com
    os braços a 90° à frente);
  - a instrução: "Braços colados ao corpo, sem contrair. Mostre as coxas.";
  - o botão "Tirar ou escolher foto".
  - **Dicas** (texto do Saraiva, num lugar só): roupa recomendada, celular na altura do tronco, boa iluminação,
    distância para aparecer o corpo todo, **em jejum**.
- **Check-in:**
  - trocar o "Ainda não implementado" do `PLANO-CHECKIN.md` pelas `FotosGuiadas`;
  - as fotos vão com `origem=ATUALIZACAO` e são ligadas (`referencia_id`) ao enviar a atualização;
  - as fotos **não são obrigatórias** por padrão, porque o Saraiva diz "caso não se sinta à vontade, converse
    conosco".
- **Treinador:** na tela da atualização, as fotos em miniatura; tocar abre em tela cheia, com as setas entre as poses.

## 5. Bloco A: anamnese

### A1. Motor de questionário (compartilhado com o check-in)

- **Generalizar o modelo do check-in:** tabela `questionario_modelo`:
  - colunas `id`, `tipo` (`ANAMNESE`, `ATUALIZACAO`), `consultoria_id` **nulo = padrão global**, `versao`, `conteudo jsonb`,
    `criado_em`;
  - `unique (tipo, consultoria_id, versao)`.
  - Migrar o modelo v1 da atualização para cá (migration nova, sem editar a antiga). A atualização passa a guardar o
    `modelo_id`.
- **Escolha do modelo:** o da consultoria, se existir; senão, o global mais recente do tipo.
- **App:** extrair o desenho do formulário do check-in para `questionario/` (um componente por tipo) e usar nos dois.
- **Tipos** (validação igual no app e na API, com teste dos dois lados):
  - já existentes: `TEXTO`, `TEXTO_LONGO`, `NOTA`, `PESO`, `NOTAS_POR_DIA`, `FOTOS`, `DATA_AUTOMATICA`;
  - novos:
    - `NUMERO` (com `unidade`, `min`, `max`, `casas`; ex.: altura em metros);
    - `DATA`;
    - `TELEFONE`, `CPF`, `EMAIL` (validação do `web/Formatos`);
    - `ESCOLHA_UNICA` e `MULTIPLA_ESCOLHA` (opções com `rotulo` e `cor` opcional, para a escala de Armstrong);
    - `GRADE` (linhas × colunas, uma resposta por linha, como "Nunca / Raramente / Ocasionalmente / Frequentemente");
    - `INSTRUCAO` (texto sem resposta; aceita **negrito** e lista simples, sem HTML);
    - `ACEITE` (texto + caixa "Declaro estar ciente"; guarda a versão do texto aceito).
- **Condições:**
  - por seção ou pergunta, `mostrarSe: { servico: "TREINO" | "DIETA" }` (Q1) ou `{ pergunta: id, igual: valor }`;
  - pergunta escondida não é obrigatória e a resposta dela é descartada ao enviar.
- **Limites:** respostas até 128 KiB; textos até 2.000 caracteres; ids desconhecidos ignorados; erro = 422
  `QUESTIONARIO_INVALIDO` com `fieldErrors`.

### A2. Envio por link (sem precisar de conta nem de app instalado)

- **Banco:** `anamnese` (`@TenantId`):
  - colunas `id`, `consultoria_id`, `aluno_id`, `modelo_id`, `estado` (`ENVIADA_AO_ALUNO`, `EM_PREENCHIMENTO`, `RESPONDIDA`,
    `REVISADA`), `respostas jsonb`, `codigo_hash`, `expira_em` (14 dias), `primeiro_acesso_em`, `ultimo_acesso_em`,
    `respondida_em`, `revisada_em`, `revisada_por`, `versao`, `criado_em`.
  - Uma anamnese ativa por aluno; gerar outra **invalida o link anterior**.
- **Treinador:**
  - "Enviar anamnese" na ficha gera o link `…/anamnese#<código>`;
  - o código fica **no fragmento da URL**, que não vai para logs do servidor, e a página o remove da barra assim que
    lê (padrão do check-in do Servirea);
  - "Enviar pelo WhatsApp" igual ao Q2.
- **Página pública** `app/anamnese.tsx`, que funciona no navegador do celular, sem login:
  - `POST /publico/anamneses/abrir` `{codigo}` devolve o modelo e o rascunho;
  - `PUT /publico/anamneses/rascunho` `{codigo, respostas}` faz o **salvar e continuar depois** (automático 2 s depois de
    parar de digitar);
  - `POST /publico/anamneses/enviar` `{codigo, respostas}`;
  - fotos pela rota pública do link, com as mesmas regras do F2;
  - **as rotas públicas** usam `LimiteTentativas`, respondem 404 genérico para código inválido, expirado ou usado, e
    o token só dá acesso **àquela anamnese** (nunca a outros dados do aluno);
  - seguem o cuidado transacional das rotas públicas que gravam em tabela com `@TenantId` (o `AGENTS.md` descreve).
- **Aluno com conta:** a mesma anamnese aparece no app como cartão "Responda sua anamnese" (autenticado, sem
  precisar do link).
- **Consentimento:**
  - primeira tela da anamnese: "Como seus dados são usados" (quem vê, para quê, como pedir para apagar), com
    versão;
  - aceite obrigatório antes da primeira pergunta;
  - tabela `consentimento` (`aluno_id`, `tipo`, `versao_texto`, `aceito_em`, `ip`).
- **Menor de idade:** se a data de nascimento der menos de 18 anos, aparece a seção "Responsável" (nome, CPF,
  telefone) e o aceite é do responsável.

### A3. Modelos de anamnese

- **Global (migration, para toda consultoria):** a estrutura do formulário do Saraiva **sem a marca e sem as regras
  da consultoria**, com as seções:
  - **Dados pessoais:** nome, nascimento, telefone, e-mail, CPF (opcional, com a ajuda "só para emissão de nota"),
    estado e endereço (opcional);
  - **Fotos** (F3);
  - **Dados pessoais 2:** objetivo, altura, peso atual e última pesagem, alteração de peso nos últimos 3 meses,
    ocupação, orçamento mensal para alimentação (Sim / Não / Consigo além disso);
  - **Sintomas:** `GRADE` com as linhas do formulário original (dor de cabeça, insônia, dor de garganta, aftas, acne,
    perda de cabelo, suor excessivo, asma ou bronquite, náuseas/vômito, diarreia, constipação, azia, dor muscular e
    dor articular não induzidas por exercício, fadiga, hiperatividade, ansiedade, depressão, frequentemente doente) ×
    Nunca / Raramente / Ocasionalmente / Frequentemente; "Algum sintoma que queira adicionar";
  - **Digestão e hidratação:**
    - escala de Bristol como `ESCOLHA_UNICA` **só com texto descritivo** de cada tipo (ex.: "Tipo 4: liso e macio,
      em forma de salsicha"), sem imagem;
    - escala de Armstrong como `ESCOLHA_UNICA` com as **cores desenhadas** (opções 1–3, 4–6, 7–8);
  - **Treino** (`mostrarSe servico TREINO`): outras atividades, há quanto tempo, tipo de academia, horário,
    frequência (1× a 7×), tempo disponível, musculatura de foco 1 e 2, divisão atual, exercícios e séries, limitação
    articular, uso de esteroides anabolizantes (texto; **só armazenado**), outro esporte;
  - **Maquinário** (`mostrarSe servico TREINO`): `MULTIPLA_ESCOLHA` por grupo, com a lista do M1, só nomes, mais
    "Faltou alguma máquina?";
  - **Hábitos de vida:** nota do sono, horas de sono, observação sobre o sono, fumo, álcool;
  - **Rotina:** `INSTRUCAO` com o exemplo do Saraiva + `TEXTO_LONGO`;
  - **Hábitos alimentares** (`mostrarSe servico DIETA`): suplementos, alergia, intolerância, o que não gosta, come por
    ansiedade, medicamento contínuo, cirurgia, alimento que gostaria de incluir, físico de referência.
- **Do Saraiva (importação, só na consultoria dele):** acrescentar a `scripts/importacao/dados/anamnese.json` o mesmo
  modelo **mais** a seção "Regras da consultoria" (texto dele) com `ACEITE`. O `importar.mjs` grava como modelo da
  consultoria. Rodar de novo não duplica (compara a versão).
- **Obrigatórias:** as mesmas do formulário original (as marcadas com `*`), exceto CPF e endereço, que ficam
  opcionais.

### A4. Ao enviar e na revisão

- **Ao enviar, na mesma transação:**
  - **peso** → `registro_peso` na data de envio;
  - **objetivo** → `aluno.objetivo`, se estiver vazio;
  - **telefone** → `aluno.telefone`, se estiver vazio;
  - **altura** → `aluno.altura_m` (coluna nova, opcional);
  - **maquinário** → `aluno_aparelho` (M2);
  - **alergia, intolerância, não gosta, gostaria de incluir** → preferências alimentares (D1), se estiverem vazias;
  - **fotos** ligadas (`origem=ANAMNESE`).
- **Treinador** (`ANAMNESE_SENSIVEL_LER`): tela da anamnese:
  - por seção, nos mesmos componentes, só leitura; "—" quando não respondida;
  - **"Marcar como revisada"**;
  - atalho **"Registrar lesão a partir desta resposta"** na limitação articular: abre o formulário de lesão já preenchido
    com o texto. O sistema nunca cria a lesão sozinho.
- **Ficha:** cartão "Anamnese" com o estado ("Enviada em dd/mm · aberta 2× · respondida em dd/mm") e o botão
  "Ver" / "Enviar de novo".

## 6. Bloco V: evolução

### V1. Medidas corporais

- **Banco:** `medida` (`@TenantId`) com `aluno_id`, `data`, `tipo`, `valor_cm numeric(5,1)`, `registrado_por`,
  `unique (aluno_id, data, tipo)`.
- **Tipos fixos:** pescoço, ombros, peito, cintura, abdômen, quadril, braço direito e esquerdo (relaxado), coxa direita
  e esquerda, panturrilha direita e esquerda. Todos opcionais.
- **Quem registra:** o treinador na ficha e o aluno em "Evolução", em ambos os casos com a data.

### V2. Tela "Evolução" (aluno e treinador)

- **Aluno:** uma aba nova, ou seção no Histórico. Se a barra inferior ficar cheia, a Conta vai para o cabeçalho.
- **Treinador:** cartão "Evolução" na ficha.
- **Conteúdo:**
  - **Peso:** o gráfico que já existe (`GraficoLinha`).
  - **Medidas:** gráfico por medida escolhida, mais a tabela.
  - **Notas do check-in ao longo do tempo** (sono, desempenho alimentar, desempenho no treino) e média das notas
    pós-treino por semana (P1). Só números e gráfico, **sem leitura automática**.
  - **Comparador de fotos:**
    - escolher duas datas (das atualizações ou da anamnese);
    - ver lado a lado por pose, com o peso de cada data embaixo;
    - no celular, alternar entre as duas com um toque, ou deslizar.
    - Usa `FotoProtegida` (F2).

## 7. Bloco M: academia do aluno

### M1. Catálogo de aparelhos

- **Banco:**
  - `aparelho` global (migration) com `id`, `nome` e `grupo` (Costas, Peito, Deltoides, Inferiores). Lista do
    formulário do Saraiva, **só nomes**: Pullover Machine, T-Bar Row, Remada pronada e/ou neutra, Remada alta, Remada
    baixa, Supino reto máquina, Supino declinado máquina, Supino reto deitado máquina, Supino inclinado máquina, Chest
    Dips, Desenvolvimento máquina (bateria de pesos), Desenvolvimento máquina (plate loaded), Elevação lateral
    máquina, Pendulum Squat, Hack Squat, Leg Press Horizontal, Elevação pélvica (máquina), Hip Press, Belt Squat;
  - `aparelho_consultoria` (`@TenantId`) para os que a consultoria acrescentar.
- **Biblioteca:** exercício da consultoria ganha `aparelho_id` opcional, escolhido no editor do exercício.

### M2. Aparelhos do aluno e aviso no editor de treino

- **Banco:** `aluno_aparelho` (`@TenantId`) com `aluno_id`, `aparelho_id` (global ou da consultoria), `tem boolean`, e
  `aluno.academia_tipo` (Bairro / Rede / CT).
- **Preenchimento:** pela anamnese (A4) e pelo cartão **"Academia do aluno"** na ficha (lista por grupo com marcar /
  desmarcar).
- **Editor de treino:**
  - se o exercício tem `aparelho_id` e o aluno **informou** os aparelhos e **não marcou** aquele, aparece no exercício
    o aviso âmbar **"O aluno não marcou ter este aparelho"**;
  - abaixo, "Possíveis substituições": exercícios da biblioteca do **mesmo grupo muscular** cujo aparelho o aluno tem,
    ou que não usam aparelho;
  - **o treinador escolhe; o sistema nunca troca sozinho.**
  - Na validação de publicar, entra como **aviso** (`CONFIRMAR_AVISOS`, que já existe), nunca como erro.
  - Se o aluno nunca informou aparelhos, nenhum aviso.
- **P2 junto:** o "Trocado 3× (sem o aparelho)" aparece no mesmo lugar.

## 8. Bloco D: dieta

### D1. Preferências alimentares no editor

- **Banco:** `aluno_preferencia_alimentar` (`@TenantId`, 1 por aluno) com `alergias`, `intolerancias`, `nao_gosta`,
  `gostaria`, todos em texto até 1.000 caracteres, mais `atualizado_por` e `atualizado_em`.
- **Preenchimento:** pela anamnese (A4) e editável no cartão **"Preferências alimentares"** da ficha.
- **Editor de dieta:** faixa fixa no topo, recolhível, **"Lembretes do aluno"** com:
  - os 4 campos;
  - as respostas `alim_enjoou` e `alim_incluir` da **última atualização** ("Na atualização de dd/mm: …").
- **É só lembrete**: o sistema não procura alimento nem bloqueia nada.

### D2. Substituições por item

- **Conteúdo da dieta:** `ConteudoDieta.Item` ganha `substitutos` (opcional, até 5), cada um com `alimentoId`/`nome`,
  `quantidade`, `unidade`, macros calculados do catálogo como nos itens, e `observacao`.
  - Versões antigas continuam válidas, porque o campo é opcional.
  - As **opções de refeição** que já existem (`Refeicao.opcoes`) continuam como estão: são outra coisa (a refeição
    inteira alternativa).
- **Editor:** "Adicionar substituto" no item, pela mesma folha de alimentos.
- **Aluno:** embaixo do item, "Pode trocar por: 120 g de batata-doce ou 100 g de arroz".
- **PDF da dieta:** mesma linha.
- **Sem cálculo automático de equivalência:** quantidade e escolha são do treinador. Os macros de cada substituto
  aparecem só como informação.
- **Testes:** validação (limite, quantidade > 0), macros do substituto, PDF com `esc()`.

## 9. Bloco O: primeiros passos, "ver como aluno", tours e ajuda

### O1. Checklist "Primeiros passos" (treinador)

- **API:** `GET /primeiros-passos` calcula, **pelos dados** (sem botão "concluí"):
  1. marca configurada (logo enviada ou cor diferente da padrão);
  2. biblioteca com pelo menos um exercício próprio ou modelo importado;
  3. primeiro aluno cadastrado;
  4. convite enviado;
  5. aluno entrou no app;
  6. primeiro plano publicado;
  7. anamnese enviada;
  8. primeira atualização revisada.
- **App:** cartão no topo do Início com a barra de progresso e a próxima etapa ("Próximo: convidar seu primeiro
  aluno" + botão).
  - Some quando estiver tudo feito, ou com "Dispensar", guardado por usuário no servidor:
    `usuario.primeiros_passos_dispensados_em`.

### O2. "Ver como o aluno vê"

- **API:** `GET /alunos/{id}/previa-app` devolve **o mesmo pacote** que o aluno receberia (versões publicadas, marca),
  com permissão de leitura de treino e dieta.
- **App:** rota `treinador/alunos/[id]/previa`:
  - mostra as telas do aluno (início, sessão, exercício, dieta) dentro de uma moldura de celular no PC, ou em tela
    cheia no celular;
  - usa um `AlunoPreviaProvider` que oferece o mesmo contexto do `AlunoProvider`, mas **só leitura**: marcar série,
    nota e troca ficam desabilitados, com a faixa "Prévia: nada é gravado";
  - **não usa o repositório offline** nem sincroniza nada.
- **Atalhos:** "Ver como o aluno" no editor (depois de publicar) e na ficha.

### O3. Tours curtos

- **Componente `ui/Tour`:**
  - destaca um elemento (pelo `ref` medido com `measureInWindow`) e mostra o balão;
  - **no celular**, o balão é uma faixa embaixo, como folha baixa;
  - "Pular", "Anterior", "Próximo" e progresso;
  - Esc fecha na web, foco no balão, leitor de tela lê o texto, respeita "reduzir animações";
  - etapa cujo elemento não existe na tela é **pulada**.
- **Estado:** quais tours foram vistos, guardado nas **preferências do usuário** (`treinos:<usuarioId>:preferencias`,
  campo novo `toursVistos`).
- **Rever:** "Rever explicações" no Perfil e na Conta.
- **Tours** (texto curto, sem dado real):
  - **treinador, boas-vindas** (primeiro login): Início/checklist → Alunos → Planejamento → Biblioteca → Marca;
  - **editor de treino** (primeira vez): chips das sessões → exercício e modelo de séries → Modelos → Validar e
    Publicar;
  - **editor de dieta:** refeições → totais → lembretes do aluno → Publicar;
  - **aluno, primeiro acesso:** Treino de hoje → marcar série (funciona sem internet) → selo de sincronização →
    atualização;
  - **aluno, exercício:** carga e marcar série → Descanso → "Troquei este exercício".
- **Teste:** função pura do avanço e de pular etapas sem alvo.

### O4. Ajuda contextual

- **`ajuda/catalogo.ts`**, conteúdo fixo no app, com cerca de 10 textos curtos:
  1. FS, WS, Top set, Back off e modelos de séries;
  2. pastas: período, replicar e finalizar;
  3. publicar e versões (o que o aluno vê);
  4. dieta: totais, "—", "Tr" e substitutos;
  5. atualização: como funciona, prazos, "vou atrasar" e feedback;
  6. anamnese: link, consentimento, revisar;
  7. convite do aluno e situações;
  8. equipe e perfis (se existir);
  9. marca e preferências;
  10. aluno: offline, fotos e privacidade.
- **"?"** (`IconeBotao`) no cabeçalho das telas difíceis abre o texto numa `Folha`.
- **Tela "Ajuda"** com busca local, sem acento.
- **Regras:**
  - os textos explicam **o app**, **nunca** dão orientação de saúde, treino ou dieta;
  - mudou a tela, muda o texto da ajuda **no mesmo commit** (escrever isso no `AGENTS.md`).

## 10. Permissões novas (se o `PLANO-EQUIPE.md` estiver feito)

Acrescentar ao catálogo e aos perfis prontos:

| Código | Admin | Treinador | Nutricionista | Assistente |
|---|---|---|---|---|
| `ANAMNESE_ENVIAR` | ✅ | ✅ | ✅ | ✅ |
| `ANAMNESE_SENSIVEL_LER` | ✅ | ✅ | ✅ | — |
| `FOTO_SENSIVEL_LER` | ✅ | ✅ | ✅ | — |
| `FOTO_APAGAR` | ✅ | — | — | — |
| `MEDIDA_SENSIVEL_LER` / `MEDIDA_ALTERAR` | ✅ | ✅ | ✅ | — |
| `ACADEMIA_ALTERAR` (aparelhos do aluno, catálogo da consultoria) | ✅ | ✅ | — | ✅ |
| `PREFERENCIA_ALIMENTAR_ALTERAR` | ✅ | ✅ | ✅ | — |

A linha do tempo (Q3) mostra cada evento só a quem tem a permissão de leitura correspondente.

## 11. Verificação por bloco (marcar no relatório)

**Comum a todos:** `mvn verify`, `npm run typecheck && npm run lint && npm test`, `npx expo export --platform web` e
`--platform android`, Docker com o banco zerado (`docker compose down -v && docker compose up -d --build`) e
`node scripts/importacao/importar.mjs`.

- **Q:**
  - [ ] aluno só de treino não vê a aba Dieta;
  - [ ] vencimento em 5 dias aparece em "Atenção hoje";
  - [ ] o convite abre o WhatsApp Web com a mensagem certa (sem número: tela de escolher o contato) e o QR lido pelo
    celular abre o link;
  - [ ] a lista mostra "Convite expira em N dias";
  - [ ] a linha do tempo mostra publicação, pasta, atualização e dias de treino, em ordem, com "Carregar mais".
- **P:**
  - [ ] concluir o treino abre "Como foi o treino?", e Pular funciona;
  - [ ] em modo avião, a nota fica salva e sobe ao reconectar;
  - [ ] "Troquei este exercício" aparece no editor do treinador e preenche o check-in.
- **F:**
  - [ ] enviar foto do celular (com GPS ligado na câmera): a foto baixada pela API **não tem EXIF** (conferir com
    `exiftool` ou equivalente);
  - [ ] HEIC do iPhone chega como JPEG;
  - [ ] foto de outro aluno → 404;
  - [ ] sem permissão sensível → 403;
  - [ ] não existe URL pública da foto;
  - [ ] apagar todas as fotos pede confirmação e registra na auditoria sem conteúdo.
- **A:**
  - [ ] link aberto em janela anônima no celular;
  - [ ] consentimento obrigatório;
  - [ ] fechar no meio e voltar mantém as respostas;
  - [ ] seção de Treino some para aluno só de dieta;
  - [ ] menor de idade pede o responsável;
  - [ ] enviar preenche peso, objetivo, aparelhos e preferências;
  - [ ] código usado ou expirado → "link inválido" genérico;
  - [ ] a anamnese do Saraiva (importada) tem as regras e o aceite;
  - [ ] consultoria nova recebe a global, sem as regras dele.
- **V:**
  - [ ] medidas no gráfico;
  - [ ] o comparador mostra duas datas lado a lado com o peso;
  - [ ] as notas do check-in aparecem no gráfico.
- **M:**
  - [ ] aluno sem "Pendulum Squat" + exercício com esse aparelho → aviso âmbar e substituições no editor, aviso na
    publicação;
  - [ ] aluno que nunca informou aparelhos → nenhum aviso.
- **D:**
  - [ ] "Lembretes do aluno" no editor de dieta mostram a anamnese e a última atualização;
  - [ ] o substituto aparece para o aluno e no PDF.
- **O:**
  - [ ] o checklist avança sozinho conforme as ações;
  - [ ] "Ver como o aluno" mostra o plano publicado e não grava nada;
  - [ ] os tours aparecem uma vez e "Rever explicações" mostra de novo;
  - [ ] o "?" do editor abre o texto de FS/WS.
- **Isolamento geral:**
  - [ ] `aluno2@demo.local` e `exemplo@demo.local` não veem nada do aluno do Saraiva (fotos, anamnese, medidas,
    linha do tempo, lembretes) em nenhuma rota: 404.
- **Roteiro da demonstração do README:** sem regressão.

## 12. Relatório ao Gustavo

- A seção 11 com ✅/❌ por item.
- Tiradas de tela (390 e 1280 px, tema escuro e claro):
  - painel "Atenção hoje" e linha do tempo;
  - "Como foi o treino?";
  - fotos guiadas;
  - anamnese pelo link (consentimento, grade de sintomas, maquinário);
  - comparador;
  - aviso de aparelho no editor;
  - lembretes na dieta;
  - checklist;
  - prévia do aluno;
  - um tour.
- **Desvios** do plano com o porquê, e o que ficou de fora.
- Confirmação de que nada sensível aparece em log (`docker compose logs api` depois dos testes, procurando os textos
  fictícios usados).

## 13. AGENTS.md (atualizar junto, curto)

- **Questionários:** `questionario_modelo` (global ou da consultoria, versionado). Tipos e condições validados igual
  no app (`questionario/`) e na API. Anamnese por link com código no fragmento, consentimento versionado e rotas
  públicas com limite de tentativas.
- **Fotos:**
  - `ArmazenamentoArquivos` (S3; MinIO local);
  - envio só pela API, regravado em JPEG sem EXIF, até 40 MP de entrada;
  - leitura só autenticada com `no-store`, sem URL pública;
  - limpeza das soltas em 7 dias.
- **Durante o treino:** `avaliacao_sessao` e `troca_exercicio` offline (SQLite v2) e lotes idempotentes.
- **Aluno:** serviço (treino/dieta), vencimento, telefone, altura, aparelhos, preferências alimentares.
  - Dieta: `Item.substitutos`.
  - Aparelho que o aluno não tem = aviso na publicação, nunca troca automática.
- **Ajuda e tours:**
  - textos em `ajuda/catalogo.ts`, que mudam no mesmo commit da tela;
  - tours vistos nas preferências do usuário;
  - "Ver como o aluno" é só leitura, sem repositório offline.
