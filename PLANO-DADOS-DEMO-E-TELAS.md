# Dados de demonstração com histórico e ajustes de telas (10/10/2026)

Pedido do Gustavo para a demonstração de domingo, 11/10 às 16:30. Leia o `AGENTS.md` e o `CONTEXTO-CLAUDE-LOCAL.md`
antes. **Uma parte por sessão**, com relatório com ✅/❌ ao fim de cada uma.

**Decisões do Gustavo:**
- zerar o banco local **hoje**, **sem backup**: é tudo dado de demonstração;
- o conteúdo novo e as 5 metodologias são **só da consultoria Saraiva Team**. Nada disso entra em `ReceitasPadrao` nem
  em consultoria nova;
- as contas `aluno@demo.local` e `aluno2@demo.local` continuam, além dos 10 alunos novos.

**Ordem:**
1. Parte 1: telas.
2. Parte 2: conteúdo e código do histórico.
3. Parte 3: zerar e popular.
4. Parte 4: conferir.

Se o tempo apertar, a prioridade é a Parte 2 e a Parte 3. Nas telas, a prioridade é o Planejamento e o cartão do
exercício.

## Regras desta tarefa (além das do `AGENTS.md`)

- **Só dados fictícios.**
  - Nomes inventados; e-mails `aluno01@demo.local` … `aluno10@demo.local`.
  - Nenhum dado de pessoa real, nenhum arquivo de `docs/`.
  - Os guias que o Gustavo enviou não vão para o git: o conteúdo necessário está transcrito na seção 2.1.
- **Código de semente só para desenvolvimento.** Ele só roda com propriedade explícita (`treinos.demo.historico=true`)
  e nunca no profile de produção. Teste que prova que, sem a propriedade, nada roda.
- **Não inventar valor nutricional nem opinar sobre saúde.**
  - Dieta = alimento + quantidade, com o alimento ligado ao catálogo TACO quando existir. Sem meta de kcal ou macros
    digitada.
  - Títulos neutros: "Fígado bovino", e não "Rico em ferro".
  - Feedback do treinador fictício só sobre execução e rotina, por exemplo:
    - "Cargas subiram em quase todos os exercícios; seguimos para a próxima pasta.";
    - "Semana com poucos treinos registrados; vamos manter a mesma divisão."
- **Isolamento:** tudo dentro da consultoria Saraiva Team, por `TenantContext.executarComo`. SQL nativo, se houver,
  filtra `consultoria_id` explicitamente.
- **Antes de cada commit:** `cd api && mvn verify` e `cd app && npm run typecheck && npm run lint && npm test`.
  Push na `main`.

---

## Parte 1: telas

Só apresentação: **não mudar API, enum, rotas nem dados**. A mesma mudança vale na web e no celular. Siga o `AGENTS.md`:
- níveis;
- **um `primario` por área**;
- `Selo` para status;
- `PainelConfirmacao` para ações destrutivas.

Tire print antes e depois de cada tela.

### 1.1 Planejamento (`app/src/app/treinador/planejamento/index.tsx`, `treinador/planejamento/modelos.ts`)

**1. Rótulos de `CATEGORIAS`**, com descrições que digam onde a peça é usada:

| Tipo | Rótulo novo |
|---|---|
| `SERIES` | Receitas de séries |
| `SESSAO_TREINO` | Dias de treino |
| `PLANO_TREINO` | Semanas de treino |
| `METODOLOGIA` | Metodologias |
| `PLANO_DIETA` | Dietas |
| `REFEICAO` | Refeições |
| `PASTA_PLANO` | Pacotes (treino + dieta) |
| `MOBILIDADE` | Mobilidade |

**2. Abas agrupadas**, com rótulo de grupo (no celular, rolagem horizontal por grupo):
- **TREINO:** Semanas, Dias de treino, Receitas de séries, Metodologias;
- **DIETA:** Dietas, Refeições;
- **PACOTES**;
- **MOBILIDADE**.

**3. "Coleções".** As pastas que organizam modelos passam a se chamar "Coleções" em toda a interface:
- "Todas", "Sem coleção" e "Organizar coleções";
- "Nome e pasta" vira "Renomear / mover";
- o filtro vira um seletor ao lado de "Buscar modelo".

A **pasta do aluno** (o período) continua se chamando pasta. É ela que dá o sentido da palavra "pasta" no app.

**4. Cartão do modelo:**
- Semanas, Dietas, Pacotes e Mobilidade têm "Aplicar ao aluno" como primário, mais "Editar". O resto vai para um menu ⋯:
  - Renomear/mover;
  - Duplicar;
  - Excluir, com `PainelConfirmacao`.
- As peças (Receitas de séries, Dias, Refeições, Metodologias) têm "Editar", o menu ⋯ e a linha "Use dentro do editor".

### 1.2 Editor de treino: cartão do exercício

1. **"Escolher da biblioteca" vira o botão "Trocar"** (ícone de troca), na mesma linha do campo Nome, à direita. A
   modalidade continua embaixo do nome.
2. **Seção SÉRIES, nesta ordem:**
   1. Carga (Em kg / Sem carga);
   2. lista de séries;
   3. linha com "+ Adicionar série" e "Usar receita" (mesmo tamanho, secundários);
   4. Progressão de carga.
3. **"Observação para o aluno" e "Vídeo"** num bloco recolhível "Observação e vídeo", depois das séries. Ele abre
   sozinho se algum dos dois estiver preenchido.
4. **"Remover exercício"** continua no fim.

### 1.3 As outras telas: mesmos princípios

Passe por **todas as telas** do treinador e do aluno, na ordem da lista abaixo, e aplique os mesmos princípios. **Uma
tela por commit.**

**Princípios:**
- **Nome claro para quem treina, não para quem programa.** Uma palavra significa uma coisa só: "pasta" é só o período
  do aluno, "modelo" é só o que fica no Planejamento.
- **Uma ação principal por área**, em destaque. As secundárias ficam visíveis só se forem frequentes; o resto vai para o
  menu ⋯. Destrutivo sempre no ⋯ ou em `perigoTexto`, com `PainelConfirmacao`.
- **Cada controle perto do que ele altera.** Ação de série fica nas séries, ação do exercício no exercício.
- **Agrupar o que é do mesmo assunto** com rótulo de grupo (`CabecalhoDeGrupo`), em vez de uma fila longa de botões
  iguais.
- **O que se usa mais vem primeiro.** Detalhe opcional fica recolhido, mas abre sozinho quando tem conteúdo.

**Ordem das telas:**
1. Ficha do aluno (pasta, `CartaoPastas` e a folha da pasta);
2. editor de dieta;
3. editor de mobilidade;
4. Alunos (lista);
5. Início/Painel;
6. Biblioteca;
7. Marca;
8. Equipe;
9. Auditoria;
10. aluno: Treino de hoje, Dieta, Mobilidade e Histórico.

Em cada tela: se não há nada a mudar, escreva "sem mudança" no relatório. **Não invente controle novo.** Se uma mudança
exigir regra nova ou API, **anote no relatório e não faça**.

**Limite de tempo:** se até **sábado às 20h** não tiver acabado, pare na tela em que estiver, dê push e siga para a
Parte 3. O resto fica para depois de domingo.

---

## Parte 2: conteúdo e código do histórico

### 2.1 Conteúdo novo (só Saraiva, não padrão)

Crie como **modelos do Planejamento pela API**, no molde do `scripts/importacao/importar.mjs`:
- `scripts/demo/popular-modelos.mjs`, que entra como `saraiva@demo.local` com `DEMO_SENHA`, é idempotente e tem a
  opção `--simular`;
- `scripts/demo/dados/*.json`.

**Exercícios:** use o da biblioteca quando existir (mesma função `chave()` do importar). Quando não existir, crie o
exercício na biblioteca sem vídeo. **Vídeo nunca inventado.**

**Séries padrão das semanas:** 3 a 4 séries de 8 a 12 repetições, descanso de 60 a 90 s. Exercício composto pesado
(agachamento, terra, supino, remada) com 4 séries de 6 a 10.

**Metodologias (5, tipo `METODOLOGIA`).** O conteúdo segue o formato de `conteudoInicial('METODOLOGIA')`, uma
`Configuracao`. Leia o formato antes.
1. **Séries tradicionais:** número fixo de séries e repetições com descanso padronizado (ex.: 3x10, 90 s); progressão de
   carga gradual e cadência controlada (2–3 s na descida).
2. **Feeder + Working sets:** séries preparatórias com carga crescente e 1–2 séries principais pesadas.
3. **Rest-pause:** série pesada até a falha, 10–20 s de pausa e mais repetições até a falha.
4. **Back-off sets:** depois das séries principais, reduzir 10–20% da carga para 1–2 séries com mais repetições.
5. **Drop-set e Cluster:**
   - drop-set: até a falha, reduzir 20–30% e continuar, 2–3 vezes;
   - cluster: carga alta com pausas de ~15 s dentro da série;
   - bi-set: dois exercícios seguidos.

**Semanas de treino (tipo `PLANO_TREINO`, com os dias de cada uma):**
- **Full Body (5 treinos):**
  - T1: Agachamento livre, Supino reto com barra, Remada curvada, Desenvolvimento com halteres, Rosca direta,
    Tríceps no pulley.
  - T2: Levantamento terra, Leg press 45º, Puxada alta, Supino inclinado com halteres, Elevação lateral,
    Panturrilha em pé.
  - T3: Afundo com halteres, Barra fixa, Paralelas, Remada serrote unilateral, Rosca martelo, Tríceps testa.
  - T4: Agachamento búlgaro, Supino declinado, Remada sentada com triângulo, Desenvolvimento na máquina,
    Encolhimento com halteres, Panturrilha sentado.
  - T5: Stiff, Cadeira extensora, Crucifixo reto com halteres, Puxada alta supinada, Elevação frontal,
    Rosca concentrada.
- **AB Superior/Inferior:**
  - A1 (superiores, força): Supino reto com barra, Remada curvada, Desenvolvimento com halteres, Puxada alta,
    Rosca alternada, Tríceps corda.
  - B1 (inferiores, quadríceps): Agachamento livre, Leg press, Cadeira extensora, Cadeira flexora,
    Panturrilha no leg press.
  - A2 (superiores, hipertrofia): Supino inclinado com halteres, Barra fixa, Elevação lateral, Remada serrote,
    Tríceps testa, Rosca scott.
  - B2 (inferiores, posterior): Levantamento terra romeno, Afundo com halteres, Mesa flexora, Elevação pélvica,
    Panturrilha em pé.
  - A3 (cabos e máquinas): Cross over, Remada sentada baixa, Desenvolvimento na máquina, Crucifixo inverso no cabo,
    Rosca martelo com corda, Tríceps francês na polia.
- **ABC Empurrar/Puxar/Pernas:**
  - A1: Supino reto, Supino inclinado com halteres, Desenvolvimento militar, Elevação lateral com halteres,
    Tríceps pulley, Tríceps corda.
  - B1: Puxada alta aberta, Remada curvada supinada, Pulldown com corda, Encolhimento, Rosca direta barra W,
    Rosca scott.
  - C1: Agachamento livre, Leg press, Cadeira extensora, Mesa flexora, Panturrilha sentado, Panturrilha em pé.
  - A2: Voador, Supino máquina, Desenvolvimento com halteres, Elevação frontal no cabo, Paralelas,
    Tríceps testa unilateral.
  - B2: Barra fixa, Remada serrote, Remada máquina pegada neutra, Crucifixo inverso no voador, Rosca alternada,
    Rosca martelo.
- **ABCDE:**
  - A (peito): Supino reto, Supino inclinado com halteres, Crucifixo inclinado, Cross over polia média, Voador.
  - B (costas): Barra fixa, Levantamento terra, Puxada alta neutra, Remada curvada, Remada serrote, Pulldown.
  - C (pernas): Agachamento livre, Leg press 45º, Agachamento búlgaro, Cadeira extensora, Mesa flexora, Stiff.
  - D (ombros e trapézio): Desenvolvimento com halteres, Elevação lateral com halteres, Elevação lateral na polia,
    Crucifixo inverso, Encolhimento com barra, Encolhimento com halteres.
  - E (braços): Tríceps pulley, Tríceps testa W, Tríceps francês unilateral, Rosca direta, Rosca scott máquina,
    Rosca martelo.
- **PPL (5 variações de cada, como semanas "PPL 1" a "PPL 5")**, cada semana com Empurrar N, Puxar N e Pernas N:
  - **Empurrar:**
    - 1: Supino reto, Desenvolvimento militar, Paralelas, Crucifixo reto, Elevação lateral, Tríceps testa W.
    - 2: Supino vertical máquina, Desenvolvimento máquina, Cross-over alta, Elevação lateral cabo, Tríceps pulley,
      Tríceps corda.
    - 3: Supino inclinado halteres, Supino reto halteres, Desenvolvimento halteres, Elevação frontal,
      Tríceps francês, Mergulho.
    - 4: Voador, Supino declinado, Arnold press, Elevação lateral máquina, Tríceps coice polia, Supino fechado.
    - 5: Cross-over polia baixa, Supino inclinado Smith, Desenvolvimento barra, Crucifixo máquina,
      Tríceps corda unilateral, Elevação lateral.
  - **Puxar:**
    - 1: Remada curvada, Remada serrote, Puxada alta triângulo, Encolhimento barra, Rosca direta, Rosca martelo.
    - 2: Barra fixa, Puxada alta aberta, Pulldown corda, Encolhimento halteres, Rosca alternada, Rosca concentrada.
    - 3: Remada sentada neutra, Puxada articulada, Remada baixa corda, Crucifixo inverso voador, Rosca scott máquina,
      Rosca polia baixa.
    - 4: Levantamento terra, Remada cavalinho, Puxada supinada, Crucifixo inverso curvado, Rosca aranha,
      Rosca inversa.
    - 5: Barra fixa supinada, Remada curvada halteres, Pulldown barra, Encolhimento Smith, Rosca inclinada 45º,
      Rosca martelo corda.
  - **Pernas:**
    - 1: Agachamento livre, Leg press 45º, Cadeira extensora, Mesa flexora, Panturrilha em pé, Panturrilha sentado.
    - 2: Stiff, Cadeira flexora, Elevação pélvica, Leg press pés altos, Afundo, Panturrilha no leg press.
    - 3: Agachamento búlgaro, Extensora unilateral, Flexora unilateral, Passada, Panturrilha unilateral.
    - 4: Hack squat, Leg press horizontal, Extensora, Flexora, Máquina de glúteo, Panturrilha máquina.
    - 5: Agachamento frontal, Sissy squat, Leg press unilateral, Stiff com halteres, Panturrilha sentado,
      Tibial anterior.

**Dias de treino (tipo `SESSAO_TREINO`):** crie também 6 dias avulsos a partir dos de cima:
- Empurrar 1;
- Puxar 1;
- Pernas 1;
- Superiores A1;
- Inferiores B1;
- Full Body T1.

**Dietas (tipo `PLANO_DIETA`, 10).** Todas com 4 refeições: Café, Almoço, Lanche e Jantar.
- **Café padrão** (variações 2 a 10): 50 g pão de forma, 3 ovos, 5 g chia, 100 g da fruta da variação,
  150 g iogurte desnatado, 30 g aveia. A variação 5 troca o pão por 50 g de tapioca.
- **Observação da dieta** (texto do treinador, sem conta): "Acrescentar ao menos 100 g de legumes nas refeições
  principais; salada verde à vontade; água ao longo do dia."

| Dieta | Fruta | Almoço | Lanche | Jantar |
|---|---|---|---|---|
| 1. Base clássica | maçã | 160 g arroz branco, 180 g peito de frango grelhado | 150 g maçã, 50 g pão, 150 g frango | 160 g arroz, 180 g frango, 150 g maçã |
| 2. Carne bovina magra | abacaxi | 350 g batata inglesa cozida, 180 g patinho moído | 150 g abacaxi, 50 g pão, 150 g patinho | 350 g batata, 180 g patinho, 150 g abacaxi |
| 3. Peixe branco | kiwi | 160 g arroz, 200 g tilápia | 150 g kiwi, 50 g pão, 170 g tilápia | 160 g arroz, 200 g tilápia, 150 g kiwi |
| 4. Suíno e batata-doce | mamão | 220 g batata-doce, 180 g lombo suíno | 150 g mamão, 50 g pão, 150 g lombo suíno | 220 g batata-doce, 180 g lombo, 150 g mamão |
| 5. Massa e frango | maçã | 160 g macarrão cozido, 180 g frango desfiado | 150 g maçã, 50 g pão, 150 g frango | 160 g macarrão, 180 g frango, 150 g maçã |
| 6. Mandioca e carne | abacaxi | 150 g mandioca cozida, 180 g patinho | 150 g abacaxi, 50 g pão, 150 g patinho | 150 g mandioca, 180 g patinho, 150 g abacaxi |
| 7. Fígado bovino | mamão | 160 g arroz, 180 g fígado bovino | 150 g mamão, 50 g pão, 150 g frango | 160 g arroz, 180 g fígado, 150 g mamão |
| 8. Purê e tilápia | kiwi | 350 g purê de batata, 200 g tilápia | 150 g kiwi, 50 g pão, 150 g frango | 350 g purê, 200 g tilápia, 150 g kiwi |
| 9. Frango e boi | maçã | 160 g arroz, 180 g patinho | 150 g maçã, 50 g pão, 150 g frango | 220 g batata-doce, 180 g frango, 150 g maçã |
| 10. Músculo e batata | abacaxi | 350 g batata assada, 180 g músculo cozido | 150 g abacaxi, 50 g pão, 150 g frango | 160 g macarrão, 180 g músculo, 150 g abacaxi |

Ligue cada alimento ao TACO pela busca (`/alimentos`). Se não achar, use o mais próximo **pelo nome** (ex.: "Pão, trigo,
forma"). Se nada servir, deixe o item **sem alimento do catálogo**: só nome e quantidade, e o app mostra "—". **Nunca
digitar valor nutricional.**

**Refeições (tipo `REFEICAO`, 4):** "Café padrão (maçã)", "Almoço frango e arroz", "Lanche pão e frango" e
"Jantar tilápia e arroz".

**Pacotes (tipo `PASTA_PLANO`, 3):**
- "ABC + Base clássica";
- "Full Body + Peixe branco";
- "PPL 1 + Carne bovina magra".

**Mobilidade (tipo `MOBILIDADE`, 10).** Seções com itens: nome e prescrição em texto, **sem vídeo**.
1. **Mobilidade matinal:**
   - Gato-vaca: 2x10;
   - Rotação de tronco deitado: 10 cada lado;
   - Cócoras sustentada: 1–2 min;
   - Rotação de ombros: 15 cada sentido;
   - Balanço de pernas: 15 frente/trás e 15 lado/lado, cada perna.
2. **Pré-treino de pernas:**
   - Mobilidade de tornozelo na parede: 2x15 cada lado;
   - 90/90 de quadril: 2x10 transições;
   - Monster walk com elástico: 2x15 passos;
   - Couch stretch dinâmico: 10 cada lado;
   - Agachamento com rotação torácica: 5 cada lado.
3. **Pré-treino de superiores:**
   - Dislocates com bastão: 2x15;
   - Thread the needle: 2x10 cada lado;
   - Peitoral na parede dinâmico: 10 cada lado;
   - Wall slides: 2x12;
   - Scapular push-up: 2x10–15.
4. **Pós-treino global** (30–45 s cada):
   - Isquiotibiais;
   - Quadríceps em pé;
   - Peitoral e bíceps na parede;
   - Tríceps;
   - Postura da criança.
5. **Lombar e cadeia posterior:**
   - Joelhos ao peito: 60 s;
   - Torção deitado: 45 s cada lado;
   - Cachorro olhando para baixo: 2x30 s;
   - Figura 4: 45 s cada lado;
   - Esfinge: 30 s.
6. **Agachamento profundo:**
   - Goblet squat sustentado: 60 s;
   - Tornozelo ajoelhado: 2x15 cada perna;
   - Elevação pélvica unilateral: 2x15 cada lado;
   - Sapo: 60 s.
7. **Abertura de quadril:**
   - Borboleta: 60 s;
   - Pombo: 60 s cada perna;
   - Cossack squat: 2x8 cada lado;
   - Flexor de quadril ajoelhado: 45 s cada lado.
8. **Coluna torácica:**
   - Extensão no rolo: 10–15;
   - Gato-vaca: 15;
   - Anjos no chão: 15;
   - Open book: 12 cada lado.
9. **Recuperação ativa (circuito 3x):**
   - Inchworm até prancha: 10;
   - Cachorro olhando para baixo;
   - World's greatest stretch: 5 cada lado;
   - Agachamento com bastão acima da cabeça: 10.
10. **Flexibilidade profunda** (2 min cada):
    - Isquiotibiais com faixa;
    - Couch stretch;
    - Abertura frontal e lateral no limite;
    - Peitoral no batente;
    - Dead hang: até a falha da pegada.

Coloque todo o conteúdo novo numa **coleção "Biblioteca do guia"**, para separar do conteúdo do Saraiva.

### 2.2 Histórico dos alunos: `SeedHistoricoDemo`

A API não deixa criar o passado: o check-in só aceita a pasta vigente, e as cargas só até 60 dias para trás. Por isso o
histórico é um **seed Java só de desenvolvimento**:
- `api/.../demo/SeedHistoricoDemo.java` + runner com `@ConditionalOnProperty(name = "treinos.demo.historico",
  havingValue = "true")`;
- variável `TREINOS_DEMO_HISTORICO` no `docker-compose.yml`, **sem valor padrão `true`** (ausente = desligado);
- **idempotente:** se `aluno01@demo.local` já existe, não faz nada;
- **pré-requisito:** os modelos da Parte 2.1 já existirem. Busque por nome; se faltar, pare com mensagem clara.

**Use os services para o que eles permitem:**
- criar aluno e conta de login (mesma senha `DEMO_SENHA`, pelo mesmo caminho que o `SeedDemo` usa para
  `aluno@demo.local`);
- criar pasta;
- aplicar modelo à pasta;
- publicar;
- lesões.

**Escreva direto pelos repositórios/entidades, com data explícita, só o que é passado:**
- execuções (`execucao_serie`, com `exercicio_id` e `serie_trabalho` tirados da versão publicada, como o
  `ExecucaoUpsert` faz);
- registros de peso;
- atualizações ENVIADA/REVISADA com respostas no formato do modelo v1 e feedback;
- `concluida_em` das pastas antigas.

**Os 10 alunos** (nomes fictícios, ex.: Ana Ribeiro, Bruno Costa, Carla Mendes, Diego Alves, Eduarda Lima,
Felipe Rocha, Gabriela Nunes, Henrique Souza, Isabela Martins, João Pereira):
- `dias_atualizacao` = 30;
- **5 pastas** seguidas de 30 dias cada:
  - as 4 primeiras concluídas, com peso e observação ao finalizar;
  - a 5ª vigente.
- Varie a divisão de treino (Full Body, AB, ABC, ABCDE, PPL), a dieta (das 10) e a metodologia.
- **Mobilidade publicada em 4 deles.**
- Troque de divisão em 1 ou 2 pastas ao longo do tempo, como um treinador faria.

**Execuções:**
- 3 a 5 treinos por semana, com 1 ou 2 semanas fracas por aluno;
- carga subindo ~2,5 kg (ou 1 a 2 repetições) a cada 2 ou 3 semanas, nos exercícios com carga;
- poucas séries recusadas;
- a carga começa num valor plausível por exercício e é gravada **como se o aluno tivesse digitado**.

**Peso:** 1 registro por semana, com variação pequena e tendência suave (uns sobem e outros descem, sem extremos).

**Atualizações:**
- nas 4 pastas concluídas: ENVIADA e REVISADA, com feedback neutro (seção "Regras");
- **2 alunos** com uma atualização antiga **atrasada** (enviada dias depois da data);
- **1 aluno** com "vou atrasar" numa pasta antiga.

**A 5ª pasta (vigente) define o painel de hoje:**

| Alunos | Fim da pasta | O que aparece |
|---|---|---|
| 2 | daqui a 1–2 dias | formulário aberto |
| 1 | daqui a 3 dias | aviso |
| 1 | já passou, sem enviar | atrasada |
| 1 | enviou ontem | "para revisar" no painel |
| 5 | no meio do período | — |

**Lesões em 3 alunos:** texto neutro, por exemplo "Desconforto no ombro direito relatado em 03/2026", com data e
situação. O sistema não interpreta.

**Responsável:** Saraiva em todos. Se houver tempo, crie um membro fictício "Treinador Demo" (perfil Treinador) e passe 3
alunos para ele, para mostrar o filtro "Meus alunos".

**Teste (`SeedHistoricoDemoIntegrationTest`):**
- sem a propriedade, nada é criado;
- com a propriedade e os modelos, cria 10 alunos com 5 pastas cada e atualizações nos estados esperados;
- rodar duas vezes não duplica;
- outra consultoria não vê nada.

---

## Parte 3: zerar e popular (depois das Partes 1 e 2 no GitHub)

```bash
git pull --ff-only origin main
docker compose down -v
docker compose up -d --build          # profile de demonstração: SeedDemo cria Saraiva, Exemplo, aluno e aluno2
# esperar a API healthy: docker compose ps
node scripts/importacao/importar.mjs  # padrão do Saraiva: vídeos, 8 semanas, 2 mobilidades
node scripts/demo/popular-modelos.mjs --simular
node scripts/demo/popular-modelos.mjs # metodologias, semanas, dias, dietas, refeições, pacotes, mobilidades
# ligar o histórico só para esta subida:
TREINOS_DEMO_HISTORICO=true docker compose up -d api   # (no Windows: definir a variável no .env, subir, e TIRAR do .env depois)
# esperar healthy e conferir o log: "Histórico de demonstração criado"
```

**Depois:**
- **Tirar `TREINOS_DEMO_HISTORICO` do `.env`** e subir a API de novo (`docker compose up -d api`), para não rodar sem
  querer.
- **Ajustar o fim da pasta do `aluno@demo.local` para 12/10/2026**, para o formulário de atualização estar aberto no
  domingo.
- Senha de todas as contas: `DEMO_SENHA`. **Nunca imprimir.**

---

## Parte 4: conferir (relatório com ✅/❌)

- **Treinador (`saraiva@demo.local`), na web:**
  - Planejamento com as abas agrupadas, a coleção "Biblioteca do guia" e as 5 metodologias;
  - Alunos com 11 alunos;
  - Painel com formulário aberto, aviso, atrasada e para revisar;
  - ficha de um aluno com 5 pastas, cargas por divisão subindo, gráfico de peso, atualizações com feedback e
    lesões (nos 3).
- **Aluno (`aluno01@demo.local`) no celular:** Treino de hoje, Histórico com meses de treino, Dieta, Mobilidade (se
  tiver) e cartão de atualização.
- **`aluno@demo.local`:** pasta com fim em 12/10 e o formulário abrindo no domingo; sem aba Mobilidade.
- **`exemplo@demo.local`:** não vê nenhum dos 10 alunos.
- Rodar de novo o checklist do celular do `CONTEXTO-CLAUDE-LOCAL.md`, porque o banco e as telas mudaram.
- **No relatório:**
  - prints das telas mudadas (sem dado real, só os fictícios);
  - telas marcadas "sem mudança";
  - o que ficou para depois de domingo.
