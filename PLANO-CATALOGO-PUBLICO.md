# Plano — catálogo público com TACO e exercícios em português

Documento de trabalho para quem for implementar (pessoa ou agente de IA, por exemplo Sonnet 5.5). Escrito em
08/10/2026. Leia **inteiro** antes de começar e siga as fases na ordem; cada fase termina com verificação e commit.

- Repositório: `GustavoToebe/Saraiva-api`. Branch: `claude/saraiva-api-direcionamento-treinos-dv10io`
  (nunca commitar na `main`; o Gustavo decide quando juntar).
- Antes de tudo, ler `AGENTS.md` (regras do projeto) e as seções 6, 9.3 e 13 do `PLANO-IMPLEMENTACAO.md`.
- Idioma de código, comentários, mensagens, interface e commits: **português**.

---

## 0. Para o Gustavo, antes de chamar o Sonnet

Coloque os arquivos que você baixou dentro do repositório, nestas pastas (crie se não existirem):

```
dados/fontes/taco/                 ← os dois arquivos da TACO que você baixou, como vieram
dados/fontes/exercicios-bd-ptbr/   ← a pasta exercises/ inteira e o LICENSE do repositório joao-gugel/exercicios-bd-ptbr
```

- Se um dos arquivos da TACO for **.pdf**, ele não vai para o git (o `.gitignore` ignora `*.pdf`); deixe na pasta
  mesmo assim, o Sonnet usa para conferir, ou diga a ele onde está.
- Mande também, se puder, o e-mail para `taco@unicamp.br` perguntando se o uso comercial da TACO, com a fonte citada,
  está liberado. A licença da TACO permite reproduzir citando a fonte, mas não fala de uso comercial.
- Depois: abra uma sessão com o Sonnet no repositório Saraiva-api e mande:
  > "Leia o `PLANO-CATALOGO-PUBLICO.md` da branch `claude/saraiva-api-direcionamento-treinos-dv10io` e execute a
  > partir da Fase 1, uma fase por vez."

---

## 1. Objetivo

Trocar o catálogo público de demonstração por bases reais, que o treinador importa para a própria biblioteca
(isso já existe: aba **Catálogo** em Biblioteca, rotas `GET /catalogo/exercicios|alimentos` e
`POST /exercicios|alimentos/importar-catalogo`).

| Catálogo | Hoje (V006) | Depois |
|---|---|---|
| Alimentos | 9 itens com valores de demonstração (`fonte` = "Valores de demonstração...") | **TACO 4ª edição** (NEPA/UNICAMP), cerca de 600 alimentos, valores por 100 g |
| Exercícios | 52 nomes escritos à mão, em português | Os 52 **mais** os do **exercicios-bd-ptbr** (tradução em domínio público do free-exercise-db), com nomes revisados para o jeito brasileiro de academia |

Por que essas bases (decidido com o Gustavo em 08/10/2026):
- **TACO**: tabela oficial brasileira; a própria publicação permite reproduzir no todo ou em parte **citando a fonte**.
- **exercicios-bd-ptbr** (`joao-gugel/exercicios-bd-ptbr`): licença **CC0** (domínio público); é a tradução do
  `yuhonas/free-exercise-db`, que é **Unlicense** (domínio público). Pode copiar para o banco e usar em produto pago.
- **Não usar**: TBCA/USP (CC BY-NC-ND: proíbe uso comercial), ExerciseDB (proíbe guardar dados), FatSecret (base
  brasileira só paga), APIs de texto livre (mandariam dado de aluno para fora). Não consultar nenhuma API ao vivo.

---

## 2. Regras que não podem ser quebradas

1. **Nunca inventar valor nutricional.** Valor ausente ou "em análise" **não vira zero**: o alimento fica fora do
   catálogo e entra no relatório de descartados (seção 5.3). As únicas conversões permitidas estão na seção 5.3.
2. **A fonte oficial é a planilha do NEPA.** Dados convertidos pela comunidade (ex.: `raulfdm/taco-api`) e o PDF
   servem só para **conferir**. Divergência vai para o relatório; nada é corrigido "no olho".
3. **Citar a fonte** em todo alimento (`fonte`) e na tela (créditos). Isso é condição da licença da TACO.
4. **Reprodutível**: o SQL das migrations é **gerado por script** a partir de `dados/fontes/`; ninguém edita o SQL
   gerado à mão. Rodar o script de novo gera exatamente o mesmo arquivo (ordem estável, UUIDs determinísticos).
5. **Migration aplicada não muda.** Tudo entra em migrations novas (V007, V008...). Não editar V001–V006.
6. Catálogo é **global** (sem `@TenantId`, como hoje) e só leitura pela API. O treinador importa cópias.
7. Sem dado pessoal: as bases são públicas e não têm dado de pessoa.

---

## 3. Estado atual do código (para não reinventar)

- Tabelas (`api/src/main/resources/db/migration/V003__biblioteca.sql`):
  - `catalogo_exercicio (id uuid pk, nome varchar(120) unique not null, grupo_muscular varchar(60), equipamento
    varchar(60), modalidade varchar(20) not null)`.
  - `catalogo_alimento (id uuid pk, nome varchar(160) unique not null, base_quantidade numeric(8,2) default 100,
    base_unidade varchar(10) default 'g', kcal, proteina, carboidrato, gordura numeric(8,2) not null,
    gramas_por_unidade numeric(8,2), fonte varchar(200) not null)`.
- `V006__catalogo_publico.sql`: 52 exercícios e 9 alimentos; ids = `md5('catalogo-exercicio:' || nome)::uuid`
  e `md5('catalogo-alimento:' || nome)::uuid`.
- `FlywayMigrationIntegrationTest` confere total de migrations (6), 52 exercícios e 9 alimentos: **atualizar**.
- Entidades `biblioteca/CatalogoExercicio`, `CatalogoAlimento`; repositórios com `buscar(padrao)` **sem limite**
  (com ~1.500 itens isso precisa mudar, seção 7); `BibliotecaService.importarCatalogo*` copia para a biblioteca do
  treinador (alimento já copia a `fonte`).
- App: `app/src/treinador/biblioteca/AbaCatalogo.tsx` (busca com 300 ms, lista, marcar e importar);
  `api/rotas.ts` (`catalogoExercicios`, `catalogoAlimentos`, `importarDoCatalogo`); tipos em `api/tipos.ts`.
- Modalidades válidas: `LIVRE, MAQUINA, ELASTICO, PESO_CORPORAL, CARDIO, OUTRO`.

---

## 4. Estrutura nova

```
dados/
  fontes/
    README.md                     ← NOVO: o que é cada arquivo, de onde veio, data do download, licença, citação
    taco/...                      ← arquivos da TACO (colocados pelo Gustavo)
    exercicios-bd-ptbr/...        ← exercises/*.json + LICENSE (colocados pelo Gustavo)
  curadoria/
    exercicios-nomes.csv          ← NOVO: id;nome_traduzido;nome_final;situacao;observacao (seção 6.3)
  relatorios/
    taco-importacao.md            ← NOVO, gerado: totais, descartados com motivo, divergências da conferência
    exercicios-importacao.md      ← NOVO, gerado: totais, filtrados, duplicados, dúvidas de nome
scripts/catalogo/
  requirements.txt                ← só se precisar ler .xls (xlrd==2.0.1); .xlsx lê com a biblioteca padrão
  comum.py                        ← normalizar texto (sem acento, minúsculas), uuid determinístico, escrita de SQL
  gerar_taco.py                   ← lê a planilha → V007 + relatório
  gerar_exercicios.py             ← lê o JSON + curadoria → V008 + relatório
  test_catalogo.py                ← unittest (python -m unittest scripts/catalogo/test_catalogo.py)
api/src/main/resources/db/migration/
  V007__catalogo_taco.sql         ← gerado
  V008__catalogo_exercicios_ptbr.sql ← gerado
  (V009 só se precisar de ajuste de esquema separado; ver 7.1)
```

Python 3.12+, só biblioteca padrão quando der (`zipfile` + `xml.etree` leem .xlsx, como o `parse_sheets.py` da raiz já
faz). Scripts com `if __name__ == "__main__":`, caminhos relativos à raiz do repositório, saída UTF-8 com `\n`.

---

## 5. TACO → `catalogo_alimento`

### 5.1 Identificar os arquivos (Fase 2, passo 1)

O Gustavo baixou **dois** arquivos da TACO. Abrir os dois e descobrir:
- Qual é a **planilha oficial** do NEPA/UNICAMP (TACO 4ª edição revisada e ampliada, 2011; normalmente `.xls`/`.xlsx`
  com a tabela de composição centesimal). **Essa é a fonte.**
- O outro (PDF oficial, ou dado da comunidade como `raulfdm/taco-api`) é **só conferência**.
- Se **nenhum** for a planilha oficial: **parar** e avisar o Gustavo (não usar dado da comunidade como fonte).
- Anotar em `dados/fontes/README.md`: nome do arquivo, origem, edição, data do download (perguntar se não souber),
  SHA-256 do arquivo e a citação:
  `NEPA/UNICAMP. Tabela Brasileira de Composição de Alimentos – TACO. 4. ed. rev. e ampl. Campinas: NEPA/UNICAMP, 2011.`

### 5.2 Ler a planilha

- A tabela principal tem, por linha de alimento: número do alimento, descrição, umidade, **energia (kcal)**, energia
  (kJ), **proteína (g)**, **lipídeos (g)**, colesterol, **carboidrato (g)**, fibra, cinzas e minerais. Valores **por
  100 g de parte comestível**. Os nomes exatos das colunas e das abas: **conferir no arquivo**, não presumir.
- Linhas de **grupo** (ex.: "Cereais e derivados", "Frutas e derivados", "Carnes e derivados"...) separam os
  alimentos: guardar o grupo de cada alimento.
- Ignorar cabeçalhos repetidos, linhas em branco, notas de rodapé e legendas.
- Mapeamento para o nosso banco:

| TACO | `catalogo_alimento` |
|---|---|
| Descrição do alimento (texto oficial, sem mudar) | `nome` (aparar espaços; manter vírgulas e acentos) |
| Energia (kcal) | `kcal` |
| Proteína (g) | `proteina` |
| Lipídeos (g) | `gordura` |
| Carboidrato (g) | `carboidrato` |
| — | `base_quantidade = 100`, `base_unidade = 'g'`, `gramas_por_unidade = null` |
| Número do alimento | `codigo_fonte` (coluna nova, 7.1) |
| Grupo | `grupo` (coluna nova, 7.1) |
| — | `fonte = 'TACO 4ª ed. (2011), NEPA/UNICAMP'` |

### 5.3 Marcadores da TACO (o ponto mais importante)

A TACO usa marcadores no lugar de números. Conferir a **legenda da própria planilha/PDF** e aplicar, só para os
4 valores que usamos (kcal, proteína, lipídeos, carboidrato):

| Marcador | Significado (conferir na legenda) | O que fazer |
|---|---|---|
| `Tr` | traço: valor existe, mas abaixo do que dá para quantificar | gravar **0** e marcar o nutriente em `tracos` (7.1) |
| `NA` | não aplicável | gravar **0** e registrar no relatório quantos ocorreram |
| `*`, vazio, `-`, `ND` ou qualquer texto não numérico | sem análise / em análise / não determinado | **descartar o alimento** do catálogo e listar no relatório com o motivo |

- Números com vírgula decimal (`2,5`) → ponto. Números negativos ou absurdos (kcal > 950/100 g, macro > 100 g/100 g)
  → descartar e listar.
- Se a legenda da planilha disser algo diferente desta tabela, **seguir a legenda** e anotar no relatório.
- Nome duplicado (mesmo `nome` normalizado) → manter o primeiro, listar os outros no relatório.

### 5.4 Conferência automática

Comparar a planilha oficial com o segundo arquivo (PDF convertido em texto com `pdftotext`, ou o dado da comunidade):
por número do alimento, os 4 valores. Diferença maior que 0,1 (ou marcador diferente) → seção "Divergências" no
relatório, com os dois valores. **Não corrigir sozinho**: a planilha oficial vale; o Gustavo decide.
Se o segundo arquivo não permitir comparar, registrar isso no relatório.

### 5.5 Gerar `V007__catalogo_taco.sql`

1. `delete from catalogo_alimento where fonte like 'Valores de demonstração%';` (os 9 de demonstração saem do
   catálogo; as cópias já importadas por treinadores ficam na biblioteca deles, que não tem FK para o catálogo).
2. Ajustes de esquema da seção 7.1 que tocam `catalogo_alimento` (se não ficarem numa V009 separada).
3. `insert into catalogo_alimento (...) values (...)` em blocos de até 200 linhas, ordem pelo número do alimento.
   `id = md5('catalogo-alimento:taco:' || codigo)::uuid` (estável mesmo se o nome mudar numa edição futura).
4. Cabeçalho do arquivo: "GERADO por scripts/catalogo/gerar_taco.py a partir de dados/fontes/taco/<arquivo>
   (sha256 ...). Não editar à mão."
5. Escapar aspas simples (`'` → `''`) em todo texto.

---

## 6. exercicios-bd-ptbr → `catalogo_exercicio`

### 6.1 Arquivo de entrada

Usar `exercises-ptbr-partial-translation.json` (nome e instruções em português; os demais campos em **inglês**, que
são valores fixos do schema do free-exercise-db e mapeiam sem ambiguidade). O `id` (ex.: `Barbell_Bench_Press_-_Medium_Grip`)
é o nome original em inglês e serve de referência para revisar a tradução. Conferir o nome exato do arquivo na pasta.

Valores possíveis (schema do free-exercise-db): `category` = strength, powerlifting, olympic weightlifting, strongman,
cardio, stretching, plyometrics; `equipment` = barbell, dumbbell, kettlebells, e-z curl bar, machine, cable, bands,
body only, medicine ball, exercise ball, foam roll, other, null; `primaryMuscles` = abdominals, abductors, adductors,
biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps,
triceps.

### 6.2 Filtro e mapeamento

- **Excluir** `category = strongman` (equipamento que academia não tem). Manter o resto.
- `modalidade`: `category = cardio` → `CARDIO`; senão pelo equipamento: barbell, dumbbell, kettlebells, e-z curl bar →
  `LIVRE`; machine, cable → `MAQUINA`; bands → `ELASTICO`; body only → `PESO_CORPORAL`; demais/null → `OUTRO`.
- `equipamento` (texto em português): barbell → "Barra"; dumbbell → "Halteres"; kettlebells → "Kettlebell";
  e-z curl bar → "Barra W"; machine → "Máquina"; cable → "Polia"; bands → "Elástico"; body only → "Peso corporal";
  medicine ball → "Medicine ball"; exercise ball → "Bola suíça"; foam roll → "Rolo de liberação"; other/null → null.
- `grupo_muscular` = primeiro de `primaryMuscles`, nos grupos que o catálogo já usa: chest → "Peito"; lats, middle back,
  lower back → "Costas"; traps → "Trapézio"; shoulders → "Ombros"; biceps → "Bíceps"; triceps → "Tríceps";
  forearms → "Antebraço"; quadriceps → "Quadríceps"; hamstrings → "Posterior"; glutes → "Glúteos";
  abductors → "Abdutores"; adductors → "Adutores"; calves → "Panturrilha"; abdominals → "Abdômen"; neck → "Pescoço".
  `category = cardio` → "Cardio". Alongamentos (`stretching`) seguem a regra do músculo e entram com o prefixo
  "Alongamento: " no nome só se a tradução já não deixar claro que é alongamento.
- `instrucoes` (coluna nova, 7.1) = itens de `instructions` unidos por `\n`, como vieram (tradução da fonte). Até
  4.000 caracteres; se passar, cortar no último item inteiro e anotar no relatório.
- `id = md5('catalogo-exercicio:fedb:' || id_original)::uuid`.
- `fonte = 'exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)'`.

### 6.3 Revisão dos nomes (curadoria)

A tradução do repositório não diz se foi manual ou automática, e nome de academia brasileira não é tradução literal.
Revisar **todos** os nomes, comparando com o `id` em inglês, e gravar em `dados/curadoria/exercicios-nomes.csv`
(`;` como separador, UTF-8):

`id;nome_traduzido;nome_final;situacao;observacao` — `situacao` ∈ `OK` (nome mantido), `AJUSTADO` (nome_final diferente),
`DUVIDA` (importa com nome_final, mas listar para o Gustavo/Saraiva olharem), `EXCLUIR` (não importa; dizer por quê).

Glossário obrigatório (termos de academia no Brasil):

| Inglês | Português |
|---|---|
| Bench Press | Supino (reto / inclinado / declinado) |
| Fly / Flyes | Crucifixo |
| Pec Deck / Butterfly | Peck deck (voador) |
| Cable Crossover | Crossover |
| Lat Pulldown / Pulldown | Puxada alta (na polia) |
| Pull-up / Chin-up | Barra fixa (pronada / supinada) |
| Seated Cable Row | Remada baixa (na polia) |
| Bent Over Row | Remada curvada |
| T-Bar Row | Remada cavalinho |
| Upright Row | Remada alta |
| Shrug | Encolhimento |
| Shoulder Press / Military Press | Desenvolvimento (militar) |
| Lateral Raise / Front Raise | Elevação lateral / frontal |
| Reverse Fly | Crucifixo inverso |
| Barbell Curl | Rosca direta |
| Hammer Curl | Rosca martelo |
| Preacher Curl | Rosca Scott |
| Concentration Curl | Rosca concentrada |
| Triceps Pushdown | Tríceps na polia (pulley) |
| Lying Triceps Extension / Skull Crusher | Tríceps testa |
| Overhead Triceps Extension | Tríceps francês |
| Dips | Mergulho (paralelas) |
| Squat / Front Squat | Agachamento / Agachamento frontal |
| Hack Squat | Agachamento hack |
| Leg Press | Leg press |
| Leg Extension | Cadeira extensora |
| Lying Leg Curl / Seated Leg Curl | Mesa flexora / Cadeira flexora |
| Stiff-Legged Deadlift | Stiff |
| Romanian Deadlift | Levantamento terra romeno |
| Deadlift | Levantamento terra |
| Good Morning | Bom dia |
| Hip Thrust / Glute Bridge | Elevação pélvica / Ponte de glúteo |
| Lunge | Avanço (afundo) |
| Bulgarian/Split Squat | Agachamento búlgaro |
| Hip Adduction / Abduction (máquina) | Cadeira adutora / abdutora |
| Glute Kickback | Coice (glúteo) |
| Calf Raise | Panturrilha (elevação de panturrilha) |
| Crunch / Sit-Up | Abdominal |
| Plank | Prancha |
| Smith Machine | no smith |
| E-Z Bar | barra W |

- Preferir o nome mais curto que o treinador brasileiro usa; manter o detalhe que diferencia (pegada, banco, unilateral).
- Primeira letra maiúscula, resto minúsculo, exceto nomes próprios (Scott, Arnold, Smith).
- **Duplicados**: comparar `nome_final` normalizado (sem acento, minúsculas) com os 52 do V006 e entre si. Se igual a
  um dos 52 → **não importar** (os 52 já foram escritos à mão e valem). Se repetido dentro da base → diferenciar pelo
  detalhe do `id` (pegada, equipamento) ou marcar `EXCLUIR` com o motivo.
- `nome_final` até 120 caracteres.

### 6.4 Gerar `V008__catalogo_exercicios_ptbr.sql`

Mesmo padrão do V007: cabeçalho "GERADO...", inserts em blocos, ordem estável (por `nome_final`), escape de aspas,
`fonte` preenchida. Os 52 existentes recebem `fonte = 'Catálogo próprio'` (update) e `instrucoes` nulas.

---

## 7. Mudanças na API

### 7.1 Esquema (em V007/V008 ou numa migration própria antes delas)

```sql
alter table catalogo_alimento add column grupo varchar(80);
alter table catalogo_alimento add column codigo_fonte varchar(20);
alter table catalogo_alimento add column tracos varchar(60);   -- ex.: 'gordura,carboidrato' (valores Tr gravados como 0)
alter table catalogo_alimento add column nome_busca varchar(200);
alter table catalogo_exercicio add column instrucoes text;
alter table catalogo_exercicio add column fonte varchar(200);
alter table catalogo_exercicio add column nome_busca varchar(160);
```

- `nome_busca` = nome sem acento e em minúsculas, preenchido pelo script para as linhas novas e por
  `update ... set nome_busca = translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')` para as
  já existentes. Depois: `alter column nome_busca set not null` e índice (`create index ... (nome_busca)`;
  para `like '%x%'` um índice `pg_trgm` é opcional, mas o volume é pequeno, ~1.500 linhas, então não é obrigatório).
- Entidades `CatalogoAlimento`/`CatalogoExercicio`: novos campos (`grupo`, `codigoFonte`, `tracos`, `instrucoes`,
  `fonte`). `ddl-auto: validate` exige bater com o banco.

### 7.2 Busca

- `GET /catalogo/exercicios?busca=&grupo=&modalidade=&limite=` e `GET /catalogo/alimentos?busca=&grupo=&limite=`.
- Busca sem acento: normalizar o termo no Java (`Normalizer.Form.NFD` + remover marcas + minúsculas, `Locale.ROOT`) e
  comparar com `nome_busca` (e `grupo` normalizado). Continuar escapando `%`/`_` como o `Buscas.padrao` já faz.
- `limite` padrão 50, máximo 200. Resposta: `{ itens: [...], total: N }` (total = quantos casaram com a busca),
  para a tela dizer "Mostrando 50 de 312; refine a busca". **Mudou o DTO**: atualizar `api/tipos.ts` e as telas.
- `GET /catalogo/alimentos/grupos` e `GET /catalogo/exercicios/grupos` → lista distinta de grupos (para o filtro).
- Resposta de alimento inclui `grupo`, `codigoFonte`, `tracos`, `fonte`; de exercício, `instrucoes` e `fonte`.
- Tudo continua `@PreAuthorize("hasRole('TREINADOR')")` e só leitura.

### 7.3 Importar para a biblioteca

- Alimento: já copia `fonte`. Manter. (Não copiar `tracos`/`grupo`: a biblioteca do treinador não tem essas colunas;
  fora de escopo.)
- Exercício: copiar `instrucoes` para `observacoes` **não**: observação é do treinador. Só nome, grupo, equipamento e
  modalidade, como hoje.

---

## 8. Mudanças no app (`AbaCatalogo.tsx`)

- Filtro por grupo (lista curta → `<select>`/seletor do projeto) além da busca; busca já tem debounce de 300 ms.
- Linha do alimento: nome, grupo, "por 100 g: X kcal · P · C · G"; nutriente em `tracos` aparece como "Tr" (não "0").
- Linha do exercício: nome, modalidade, grupo, equipamento; botão/expansão "Ver instruções" quando houver.
- Rodapé da lista: "Mostrando N de TOTAL. Refine a busca para ver mais." quando `total > itens`.
- **Créditos** (obrigatório): rodapé fixo da aba Catálogo:
  "Alimentos: Tabela Brasileira de Composição de Alimentos – TACO, 4ª ed. (2011), NEPA/UNICAMP. Valores por 100 g.
  Exercícios: exercicios-bd-ptbr (CC0), tradução do free-exercise-db (domínio público)."
- Seguir o design existente (tokens, `Selo`, cartões); nada de `Alert`.

---

## 9. Testes obrigatórios

### Scripts (`python -m unittest scripts/catalogo/test_catalogo.py`)
- Marcadores: `Tr` → 0 + nutriente em `tracos`; `NA` → 0; `*`, vazio, `-`, texto → alimento descartado com motivo.
- Vírgula decimal; valores absurdos descartados; nome duplicado vai para o relatório.
- Escape de aspas no SQL; UUID determinístico; rodar duas vezes gera arquivo idêntico.
- Mapeamentos de modalidade, equipamento e grupo (todos os valores do schema da seção 6.1 cobertos); strongman fora;
  curadoria `EXCLUIR` respeitada; duplicado com os 52 não entra.

### API (`cd api && mvn verify`)
- `FlywayMigrationIntegrationTest`: total de migrations novo; exercícios = 52 + N (N do relatório) e alimentos = M
  (M do relatório); **nenhum** alimento com `fonte like 'Valores de demonstração%'`; todo alimento com
  `fonte` da TACO, valores ≥ 0 e `nome_busca` preenchido.
- Busca sem acento: `busca=feijao` encontra itens com "Feijão"; `limite` respeitado; `total` correto; filtro por grupo.
- Importar do catálogo continua funcionando (alimento leva a `fonte`).
- `ArquiteturaTest` continua verde (catálogo sem `@TenantId`, como já listado).

### App (`cd app && npm run typecheck && npm run lint && npm test`)
- Função pura de exibição: nutriente em `tracos` mostra "Tr"; texto "Mostrando N de TOTAL".

---

## 10. Fases

Cada fase: implementar → verificar → commit em português → `git push -u origin claude/saraiva-api-direcionamento-treinos-dv10io`.

**Fase 1 — Fontes (30 min).** Conferir os arquivos em `dados/fontes/` (seção 0), escrever `dados/fontes/README.md`
(origem, licença, citação, SHA-256), identificar a planilha oficial (5.1). Se faltar algo, parar e perguntar.
Commit: "Dados: fontes da TACO e do exercicios-bd-ptbr".

**Fase 2 — TACO.** `comum.py`, `gerar_taco.py`, testes do script, V007 gerado, relatório. Revisar o relatório:
quantos entraram, quantos descartados e por quê, divergências da conferência.
Commit: "Catálogo: TACO 4ª edição no catálogo público de alimentos".

**Fase 3 — Exercícios.** Curadoria completa em `dados/curadoria/exercicios-nomes.csv` (6.3), `gerar_exercicios.py`,
testes, V008 gerado, relatório. Commit: "Catálogo: exercícios em português (exercicios-bd-ptbr) com nomes revisados".

**Fase 4 — API.** Esquema (7.1), entidades, busca sem acento com limite/total/grupo (7.2), testes, `mvn verify` verde.
Commit: "API: busca do catálogo sem acento, com limite, grupo e fonte".

**Fase 5 — App.** `AbaCatalogo` (seção 8), tipos, créditos, testes. Verificar na web (`docker compose` ou
`npx expo start --web`) que buscar "feijao" e "supino" funciona e que importar leva para a biblioteca.
Commit: "App: catálogo com filtro por grupo, instruções e créditos das fontes".

**Fase 6 — Documentação.**
- `README.md`: tirar a pendência "valores de demonstração" do catálogo; contar o que entrou (números dos relatórios);
  listar as dúvidas de nome (`DUVIDA`) e as divergências da TACO para o Gustavo/Saraiva.
- `AGENTS.md` (curto): "Catálogo público vem de `dados/fontes/` pelos scripts de `scripts/catalogo/`; SQL gerado não se
  edita à mão; edição nova da fonte = migration nova; valor ausente nunca vira zero (`Tr`/`NA` → 0 com marca)."
- `PLANO-IMPLEMENTACAO.md` seção 13.5: apontar para este documento.
Commit: "Docs: catálogo público com TACO e exercícios em português".

---

## 11. Pronto quando

- `mvn verify` e `npm run typecheck && npm run lint && npm test` verdes; `python -m unittest` dos scripts verde.
- Rodar os dois scripts de novo não muda nenhum arquivo (`git status` limpo).
- Banco novo (`docker compose down -v && docker compose up -d --build`): catálogo com a TACO e os exercícios; busca sem
  acento funciona; créditos aparecem; importar para a biblioteca funciona; os planos da demonstração continuam iguais
  (o seed usa a biblioteca própria do Saraiva, não o catálogo).
- Relatórios em `dados/relatorios/` revisados e citados no README.

## 12. Fora do escopo

USDA, Open Food Facts, imagens/GIFs de exercício, fibras/micronutrientes, porções caseiras ("1 colher"),
`gramas_por_unidade` para a TACO, tradução nova das instruções, API ao vivo de qualquer fonte.
