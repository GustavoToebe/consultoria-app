# Design, hierarquia visual e estrutura do front

Documento para quem vai ajudar no visual ou no front do consultoria-app: uma pessoa de design, um dev ou outra IA.
Explica o que o app é, como o front está montado, os problemas de design que estamos resolvendo e a regra que
vale acima de todas: **manter o sistema funcional, simples e rápido**. Escrito em 30/10/2026, sobre o código da
`main` (commit `68750b2`).

---

## 1. O produto em poucas linhas

- **Quem usa:** o **treinador** e a equipe dele montam treino, dieta e mobilidade dos alunos, acompanham as
  atualizações e cuidam dos interessados e da agenda. O **aluno** vê o plano e registra carga e repetições.
- **Onde usa:**
  - O treinador usa quase sempre a **web no PC**, com tela larga, mouse e muita informação.
  - O aluno usa o **celular na academia**, com uma mão, pressa e às vezes sem internet.
- **Um app só** para os dois papéis, na web, no Android e no iOS. A marca (cor, logo e nome) é a de cada
  consultoria e é carregada depois do login.
- **Dado sensível:** peso, dieta, fotos e observações são dados pessoais protegidos pela LGPD. Isso limita o que
  pode aparecer em tela, em log e no aparelho.

---

## 2. Linguagens e tecnologias do front

| Camada | O que usamos | Observação |
| --- | --- | --- |
| Linguagem | **TypeScript** 6 (estrito) | Todo o front. Nada de JavaScript solto, exceto scripts de apoio em `.mjs`. |
| Base | **React 19** + **React Native 0.86** | Mesmo código para web e celular. |
| Plataforma | **Expo SDK 57** | Web pelo **react-native-web**; Android e iOS pelo EAS. |
| Navegação | **Expo Router** | Rotas por arquivo em `app/src/app/`. |
| Estilo | **StyleSheet do React Native + tokens próprios** (`tema/tokens.ts`) | É o padrão: cerca de 220 arquivos usam assim. Uniwind (Tailwind 4) existe, mas só nas peças-base copiadas do RNR (cerca de 12 arquivos). |
| Componentes-base | **RNR** (react-native-reusables, cópia local) sobre `@rn-primitives` | Ficam em `src/components/ui/`. As peças do app ficam em `src/ui/`. |
| Ícones | **lucide-react-native** | |
| Animação | **Reanimated 4** | Respeita "movimento reduzido". |
| Compilação | **React Compiler** ligado | Memoiza sozinho; não usamos `React.memo` à mão. |
| Offline (aluno) | **expo-sqlite** no celular, `localStorage` na web | Fila de envio idempotente. |
| Gráficos | SVG próprio (`GraficoLinha`, `GraficoBarras`) | Sem biblioteca de gráficos. |
| PDF | HTML montado no app + `expo-print` / impressão do navegador | |
| Testes | **Jest** (cerca de 185 suítes, regras puras e telas) e **Playwright** (48 arquivos de e2e na web, com a API simulada) | O e2e roda em 390 px (celular) e 1280 px (PC). |
| Fontes | Inter (texto); Bebas Neue, Oswald e Metal Mania só no nome da marca | |

**O que não usamos de propósito:** biblioteca de UI pronta (Material, NativeBase etc.), CSS-in-JS de terceiros,
biblioteca de gráficos, Redux ou outro gerenciador de estado global. O estado mora nos *providers* (sessão, tema,
aluno offline) e nas próprias telas.

Os outros fronts do ecossistema (Central e Servirea) são **Angular 21 + Tailwind 3**, outra base. Eles seguem os
mesmos três pilares de design (seção 4.1), mas não dividem código com este app.

---

## 3. Como o front está estruturado

Tudo fica em `app/src/`. A regra é separar **rota**, **tela**, **peça visual** e **regra pura**:

```
app/src/
├── app/          Rotas (Expo Router). Arquivo = endereço. Só monta a tela, quase sem lógica.
│   ├── treinador/   /treinador/...  (início, alunos, ficha, planejamento, biblioteca, agenda, importação…)
│   ├── aluno/       /aluno/...      (início, treino do dia, dieta, mobilidade, histórico, conta)
│   └── entrar, convite, inscricao/[codigo], redefinir-senha…  (telas públicas)
├── treinador/    Peças das telas do treinador (cerca de 140 arquivos): editores de treino e dieta, cartões da ficha, importação…
├── aluno/        Peças das telas do aluno (cerca de 75): cartão Hoje, série, descanso, água, anamnese…
├── ui/           Peças compartilhadas (cerca de 100): Cartao, CabecalhoDeGrupo, Folha, Tabela, LinhaDaLista, Botao, Selo, Alerta…
├── components/ui Base copiada do RNR (button, card, tabs, switch…), adaptada pelos arquivos de ui/
├── dominio/      REGRAS PURAS, sem React (cerca de 140 arquivos, quase todos com teste): datas, cargas, períodos, textos de status…
├── tema/         tokens.ts (cores, espaços, larguras, fontes), TemaProvider, contraste
├── api/          cliente.ts (o único que fala HTTP) e rotas.ts (uma função por rota da API)
├── offline/      AlunoProvider, repositório local (SQLite/web), fila de sincronização
├── sessao/       login, renovação do token, perfil e permissões
├── pdf/          montagem dos PDFs (treino, dieta, mobilidade, cargas, lista de compras)
└── ajuda/        texto único da Ajuda e dos guias em PDF
```

### Regras de organização que mantêm o código sob controle

- **Regra de negócio não mora na tela.** Se é conta, texto de status ou decisão ("mostra o botão?"), vai para
  `dominio/` como função pura com teste. A tela só chama.
- **Uma peça para cada papel.** Lista de registros usa `LinhaDaLista`; seção usa `Cartao`; painel lateral ou
  formulário em cima da tela usa `Folha`; confirmação usa `PainelConfirmacao`; aviso na tela usa `Alerta`.
  Tela nova copia uma existente antes de inventar controle novo.
- **Dados de tela** vêm de `useCarregar` (chave → busca). Nada de buscar dentro de `useEffect` com `setState`
  síncrono (o lint recusa).
- **Permissões:** a tela pergunta `pode('CODIGO')` só para decidir o que mostrar. Quem autoriza de verdade é a API.
- **Nada é salvo sozinho nos editores.** Existem "Salvar rascunho" e "Publicar"; sair com alteração pendente pergunta
  antes (`GuardaDeSaida`).
- **O que não existe não aparece.** Recurso desligado, sem permissão ou sem dado some da tela. Valor ausente é
  "—", nunca zero inventado.

---

## 4. O sistema visual de hoje

### 4.1 Os três pilares (valem em todos os apps do ecossistema)

1. **Cor com significado:**
   - verde = positivo;
   - âmbar = atenção;
   - vermelho = problema ou ação destrutiva;
   - cinza = encerrado.

   A cor da marca **nunca** diz status e só aparece em ação principal, item de menu ativo, cartão "Hoje" do aluno e
   título. Status sempre vem num selo **com texto**.
2. **Blocos:** tudo em cartão (cantos de 12 px, borda de 2 px, sem sombra; ajuste de 30/10). A ficha é feita de blocos pequenos, cada um
   com seus botões.
3. **SaaS limpo:** visual *flat*, grade de 8 px, tipografia contida, nada decorativo.

### 4.2 Níveis de superfície (o coração da hierarquia)

```
fundo da página (quase branco: #F7F7F8)
 └─ Cartao               superficie  + borda de 2 px   (seção: "Dieta", "Exercício 1")
     ├─ faixa de título   superficie3 + linha de 3 px embaixo   ← onde a seção COMEÇA
     └─ item              superficie2 + borda      (série, alimento, linha)
         └─ campo         campo + bordaCampo       (o "buraco" onde se escreve)
```

- 24 px entre blocos, 16 px dentro do cartão.
- Toque mínimo de 44 px; fonte mínima de 12.
- Temas disponíveis: **claro** (padrão), **escuro**, **claro areia** (opção pedida na reunião de 29/10) e
  **contraste alto**. O contraste de cada combinação é conferido por teste (`tema/tokens.test.ts`): texto ≥ 4,5:1 e
  borda de campo ≥ 3:1.
- Seleção (chips, escolhas) é **invertida**: fundo escuro e letra clara, nunca a cor da marca.
- Larguras:
  - formulário: 640;
  - editor: 1040;
  - lista e painel: até 1800;
  - aluno: 720.
- Pontos de quebra: abaixo de 768 px é celular (barra inferior); de 768 a 1023, menu lateral só com ícones; a
  partir de 1024, menu lateral completo.

### 4.3 Peças principais

| Peça | Para quê |
| --- | --- |
| `Cartao` | Seção. Com título ganha a **faixa de cabeçalho**. Pode ser recolhível. |
| `CabecalhoDeGrupo` | Faixa de grupo (sessão, refeição, pasta, dia), recolhível, com resumo e selo. |
| `Folha` | Painel por cima da tela (formulários, escolhas). No PC pode ser arrastada pelo cabeçalho; no celular o mesmo arraste fecha. Entra no histórico do navegador. |
| `LinhaDaLista` / `ListaDeLinhas` | Lista de registros numa coluna: título, metadados, selos, ações. |
| `Tabela` | Colunas no PC, cartões empilhados no celular. |
| `Alerta` | Caixa de aviso: `perigo` (erro), `atencao` (cuidado, mas não impede), `sucesso`. |
| `Selo` | Status curto com texto e cor de significado. |
| `Botao` | Um `primario` por área; o resto é secundário. Desabilitado sempre diz o porquê (`motivo`). |
| `EscolhaSuspensa` / `EscolhaEmFolha` | Escolha com busca: lista suspensa no PC, folha no celular. |

---

## 5. Os problemas de design que estamos resolvendo

Origem principal: a reunião gravada de 29/10, com o treinador usando o sistema por 40 minutos. Ele elogiou a
fluidez, mas **dependeu de explicação para se achar**. O diagnóstico é de **orientação**, não de cor.

### 5.1 "Tudo parece uma coisa só, sem início e fim"

- **Sintoma:** em telas densas (editor de treino, ficha do aluno, pasta), não dava para ver onde um bloco terminava
  e o outro começava.
- **Causa no código:** o cartão do exercício e o grupo de séries usavam a mesma superfície e bordas muito parecidas;
  bordas e faixas eram claras demais.
- **O que já fizemos (30/10):**
  - faixa de cabeçalho em todo cartão com título e no topo de toda Folha;
  - bordas mais fortes nos temas;
  - exercício como bloco principal e grupo de séries como região interna diferente;
  - pasta com Treino, Dieta e Mobilidade em blocos próprios;
  - tema "Claro areia".
- **O que ainda pede atenção:** não cair no extremo oposto. Cartão dentro de cartão dentro de cartão deixa a tela
  pesada. Regra: **contorno forte só no grupo principal; nos níveis de dentro, divisor ou recuo.**

### 5.2 Confusão entre "pasta", "plano" e "o que o aluno vê"

- **Sintoma:** com duas pastas "ativas", o treinador não sabia qual o aluno estava usando, e achava que finalizar
  a pasta antiga trocava o aluno para a nova.
- **Realidade do sistema:** são três coisas diferentes:
  - **pasta aberta/concluída** é organização;
  - **plano rascunho/publicado** é disponibilidade;
  - **plano em uso pelo aluno** é o último publicado de cada tipo.
- **O que já fizemos:**
  - o filtro passou de "Ativas" para "Abertas";
  - cada plano mostra o selo "Em uso pelo aluno";
  - finalizar explica que não troca o que o aluno vê;
  - aplicar modelo e copiar plano pedem o destino e dizem que entra como rascunho.

### 5.3 Ação que não faz o que parece

- **Sintoma:** na importação, "Escolher Alunos" parecia enviar o arquivo e o botão de modelo parecia importar.
  O lugar de enviar o arquivo ficava escondido lá embaixo.
- **O que já fizemos:**
  - assistente em etapas: destino e arquivo, configuração, mapeamento, validação, resultado;
  - baixar modelo virou ação secundária;
  - "Voltar" em vez de "Cancelar";
  - a planilha aparece inteira e dá para corrigir células na própria tabela.
- **Princípio:** o rótulo do botão diz **o resultado** ("Enviar planilha", "Publicar para o aluno"), não a mecânica.

### 5.4 Linguagem que mistura conceitos

- "Porção da embalagem" era lida como "dose prescrita"; agora o campo se chama **Dose prescrita** e a porção aparece
  só como referência.
- Quantidade sem fator de cocção era lida como "compra em cru"; agora o item mostra "Sem fator" / "(como na dieta)".
  Na pendência: separar escrito "Conforme a dieta" de "Estimativa para compra".
- O gráfico de peso "sumia" com um registro só; agora a tela explica que ele aparece com duas datas.
- **Princípio:** linguagem do treinador, não do banco. Se dois conceitos podem ser confundidos, os nomes têm de ser
  visivelmente diferentes.

### 5.5 Excesso de informação ao mesmo tempo

- **Sintoma:** formulários longos (série com técnica, carga e esforço; dieta com opções e complementos) mostram
  tudo de uma vez.
- **Caminho:** revelar aos poucos (abrir o detalhe quando precisa), com um resumo fiel do que já foi preenchido, e
  levar direto ao erro escondido ("N problemas · ir ao primeiro").

### 5.6 O que ainda está em aberto

| Tema | Situação |
| --- | --- |
| Painel do treinador em blocos (Próximo passo → Acompanhamento → Planejamento), inspirado na referência | Não começou; é a próxima frente grande. |
| Orientação no primeiro uso, além do passeio pelo menu | Não começou. |
| Categorias de suplementos do catálogo ("Suplementos / Whey" → "Whey") | Não começou; exige migration sem apagar o que o treinador editou. |
| Textos de modelo × plano do aluno e dos complementos da dieta | Ajuste pequeno, pendente. |
| Escolher a linha do cabeçalho na importação | Pendente; muda a API e a tela. |
| A planilha que falhou na reunião | Só dá para reproduzir com os nomes das abas e das colunas, sem dados. |

---

## 6. A questão principal: funcionalidade, simplicidade e rapidez

Toda mudança de design passa por estas três perguntas, nesta ordem. Quando uma melhora visual piora uma delas,
**a melhora visual perde.**

### 6.1 Funcionalidade: não quebrar o que funciona

O app tem regras que não aparecem na tela mas sustentam tudo. Um ajuste visual **nunca** mexe em:

- **Plano publicado:** é imutável. Editar mexe só no rascunho; publicar cria versão nova.
- **Registro do aluno:** carga, repetições e séries têm a fila offline e o reenvio idempotente.
- **Metodologia:** tipos de série, técnicas, grupos, etapas de Cluster/Rest-pause e carga sugerida têm contrato
  próprio com a API.
- **Isolamento e permissões:** um treinador nunca vê dado de outra consultoria; a tela só esconde, quem barra é a API.
- **Ausência de dado:** é "—", nunca zero, e nada de opinar sobre saúde.

Como garantimos:
- testes de regra pura (Jest) e testes de tela em 390 e 1280 px (Playwright) antes de subir;
- mudança visual vem **separada** de mudança de comportamento, para cada uma ser revisada pelo que é.

### 6.2 Simplicidade: menos coisas, mais claras

- **Um botão principal por área.** Se tudo é destaque, nada é.
- **Peças que já existem antes de peças novas.** Hoje são cerca de 100 peças compartilhadas; outro jeito de fazer
  cartão, lista ou escolha só entra se nenhuma servir, e então vira peça compartilhada.
- **Nada de framework visual novo** nem segunda versão de uma função que já existe: melhorar a descoberta e a
  apresentação do que já está lá.
- **Esconder o avançado, não o essencial.** O dia a dia (registrar série, revisar atualização, publicar plano) tem
  de estar a um ou dois toques.
- **Cor não é decoração.** Não pintar cada cartão de uma cor; a cor diz status ou marca, e só.
- **Texto curto e concreto.** Ajuda de campo só onde evita erro, em uma linha.

### 6.3 Rapidez: para o treinador no PC e para o aluno no celular

**O que já ajuda:**
- React Compiler (memoização automática).
- Peças leves: sem sombras, gradientes ou bibliotecas de gráfico.
- Listas grandes paginadas na API (alunos, interessados, auditoria).
- O aluno abre e registra **sem internet**: o plano fica salvo no aparelho e a série gravada aparece na hora.
- Fontes carregadas só nos pesos usados.

**Pontos de atenção medidos (30/10):**
- **O pacote da web é um arquivo só de 7,3 MB (≈ 1,6 MB comprimido).** Não há divisão por rota: o aluno no celular
  pela web baixa também o código do editor de treino, da importação, da agenda etc. É o maior ganho de rapidez
  disponível. Ideias:
  - carregar sob demanda as telas pesadas do treinador;
  - conferir o que mais pesa (ícones, fontes decorativas, PDFs).

  Precisa ser medido antes e depois.
- **Listas renderizadas inteiras** (`map` dentro de rolagem, sem virtualização). Funciona com o volume de hoje,
  mas a planilha da importação já precisou de páginas de 50 linhas. Lista que pode passar de algumas centenas de
  itens deve paginar ou virtualizar.
- **Telas muito grandes num arquivo** (importação, editores de treino e dieta, folha do interessado: 500 a 750 linhas)
  são mais difíceis de manter rápidas e corretas. Dividir quando uma mudança tocar nelas.
- **Mais faixas e bordas = mais elementos na tela.** Na hierarquia visual, preferir resolver com cor de superfície
  e divisor (barato) a acrescentar camadas de `View`.

### 6.4 Lista de conferência para qualquer mudança visual

- [ ] Em 390 px e em 1280 px dá para dizer onde cada bloco começa e termina, sem depender da cor?
- [ ] Funciona no claro, no escuro, no claro areia e no contraste alto (contraste conferido)?
- [ ] O botão diz o resultado da ação? Há só um botão principal na área?
- [ ] Reaproveitou uma peça de `ui/` em vez de criar outra?
- [ ] Nenhuma regra de negócio, contrato da API, fila offline ou publicação mudou por causa do visual?
- [ ] Teclado, foco, leitor de tela e toque de 44 px continuam funcionando?
- [ ] A tela não ficou mais pesada (mais camadas, lista inteira sem página, import grande numa tela do aluno)?
- [ ] Jest, lint, typecheck e o e2e da tela passaram?

---

## 7. Glossário rápido

| Termo | Significado |
| --- | --- |
| Consultoria | O "espaço" de um treinador e sua equipe. Isolado dos outros. |
| Pasta | Período de acompanhamento do aluno; agrupa treino, dieta e mobilidade. Aberta ou concluída. |
| Plano | Treino, dieta ou mobilidade dentro da pasta. Rascunho → publicado (versão imutável). |
| Em uso pelo aluno | O último plano publicado de cada tipo; é o que o aluno vê. |
| Modelo | Molde no Planejamento; aplicar cria uma cópia independente no aluno. |
| Metodologia | Tipos de série (Aquecimento, FS, WS, Top set, Back off), técnicas e combinações da consultoria. |
| Atualização | O questionário que o aluno responde no fim de cada pasta. |
| Folha | Painel por cima da tela (formulário, escolha, detalhe). |
| Faixa | O topo destacado de um cartão ou folha, onde ficam título e ações. |

---

## 8. Onde ler mais

- `AGENTS.md` (raiz) e `app/AGENTS.md`: todas as regras do projeto, inclusive design (seções "Design", "Níveis",
  "Tipografia", "Botões" e "Seleção").
- `app/src/tema/tokens.ts`: as cores e medidas, com o porquê de cada uma.
- `docs/planos/clareza-do-treinador.md`: decisões e entregas da frente de clareza (reunião de 29/10).
- `docs/planos/README.md`: índice das frentes e pendências.
