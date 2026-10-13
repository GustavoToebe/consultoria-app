# Plano — Questionários de Atualização editáveis por consultoria

## Contexto
Hoje existe **um único questionário de Atualização global** (`atualizacao_modelo`, v1 semeada na V017, sem
`consultoria_id`, sem API de edição). A plataforma vai ter vários treinadores, e cada um precisa montar o próprio
check-in que o aluno responde no app: criar, editar, duplicar, excluir. A referência de UX é o editor de layout da
escala do servirea: rascunho e versão publicada imutável, validador igual no TS e no Java, enums fechados,
chave estável por item, quem consome guarda a versão usada, e item já usado é arquivado em vez de excluído.

**Decisões do Gustavo:**
- vários questionários por consultoria, um **padrão**;
- a escolha fica **no aluno**, e a **pasta** pode trocar só para o período dela;
- tipos novos: **Escolha única, Múltipla escolha, Número e Sim/Não**, além dos atuais (Nota 0–10, Notas por dia,
  Texto, Texto longo, Peso, Data automática; Fotos continua não implementado);
- o editor fica numa **aba "Atualização" no Planejamento**.

**Status:** Bloco 1 ✅ (V024, resolver, serviço, seed). Bloco 2 ✅ (esquema v2, validadores Java e TS, fixtures de paridade; API 328 testes, app 456). Bloco 3 ✅ (V025 e permissões, `QuestionarioService`/`Controller`, rotas de aluno e pasta, auditoria; PDF da dieta sem "Profissional" nem "Elaborado por"; API com `QuestionariosIntegrationTest`, `PermissoesQuestionarioMigrationIntegrationTest` e isolamento entre consultorias). Bloco 4 ✅ (app do aluno com os 11 tipos, envio por `questionarioVersaoId`, rascunho por versão com reconciliação, Resumo do treinador por destaque; app 481 testes, API 352 com `mvn verify`; conferência manual no navegador/aparelho **ainda não feita**). Bloco 5 ✅ (aba Atualização no Planejamento, lista, editor com prévia, hook, permissões e telas; app 500 testes, `expo export` Android ok; conferência manual no navegador **ainda não feita**). Bloco 6 ✅ (`SeletorDeQuestionario` na ficha do aluno e na folha da pasta, "Questionário: {nome}" na atualização da pasta, ajuda e guia do treinador em PDF; app 502 testes, `expo export` Android ok; conferência manual **ainda não feita**). Pendente: conferência manual dos blocos 4 a 6 no navegador e no aparelho.
**Pontos confirmados pelo Gustavo:** Nutricionista com QUESTIONARIO_LER e ALTERAR (Assistente só LER); replicar a
pasta **não** copia a escolha de questionário; Publicar fica dentro de QUESTIONARIO_ALTERAR.
A cópia deste plano já está em `PLANO-QUESTIONARIOS.md` na raiz do repositório (atualizar junto com este arquivo).

---

## 1. Banco

### V024__questionarios.sql

**Tabela `questionario`** (`@TenantId`):
- colunas: `id`, `consultoria_id`, `nome varchar(120)`, `descricao varchar(400)`, `padrao bool`, `arquivado bool`,
  `rascunho jsonb`, `rascunho_alterado_em`, `versao_publicada int default 0`, `publicado_em`, `criado_em`,
  `versao bigint` (`@Version`);
- `unique(consultoria_id, id)`, para as FKs compostas;
- índice único parcial `(consultoria_id) where padrao`;
- índice único `(consultoria_id, lower(nome)) where not arquivado`;
- `check (not padrao or (not arquivado and versao_publicada > 0))`.

**Tabela `questionario_versao`** (`@TenantId`, imutável):
- colunas: `id`, `consultoria_id`, `questionario_id`, `numero`, `conteudo jsonb`, `publicado_em`,
  `publicado_por` (nulo quando o sistema cria);
- `unique(questionario_id, numero)` e `unique(consultoria_id, id)`;
- FK composta para `questionario`;
- todas as colunas `updatable=false`, mais trigger `before update` que lança exceção;
- não reaproveitar `VersaoBase`/`PlanoBase`, porque eles exigem aluno e período.

**Modelo de fábrica:**
- inserir em `atualizacao_modelo` a `versao=2` com a v1 convertida para o formato v2;
- a conversão mantém os ids das perguntas, dá `uid` fixo às seções, marca `destaque` em sono, alimentação e treino
  (com `rotuloCurto`) e põe `ajudaAutomatica: MEDIA_DIAS_TREINO` em `treino_dias`;
- a tabela global continua (em `ENTIDADES_GLOBAIS`) e passa a ser só a fonte para "Novo a partir do padrão".

**Padrão de cada consultoria:**
- função `criar_questionario_padrao(cid)`, no molde de `criar_perfis_padrao` da V018, com ids determinísticos
  `md5(cid||':questionario-padrao')` e `md5(cid||':questionario-padrao:1')`;
- roda para as consultorias existentes e, por trigger, `after insert on consultoria`;
- trigger em vez de serviço porque, sem padrão, a atualização daria 404.

**Ajustes em `atualizacao`:**
- guarda no início: falha se houver `modelo_versao <> 1`;
- adiciona `questionario_versao_id` com FK composta;
- preenche as linhas não ABERTA com a versão 1 do padrão; linhas ABERTA ficam nulas;
- `check (estado='ABERTA' or questionario_versao_id is not null)`;
- remove `modelo_versao`.

**Escolha no aluno e na pasta:**
- `aluno.questionario_id` e `pasta_plano.questionario_id`, os dois nulos;
- FK composta com `on delete set null (questionario_id)`.

### V025__permissoes_questionario.sql
- permissões novas `QUESTIONARIO_LER` (não sensível) e `QUESTIONARIO_ALTERAR` (inclui publicar);
- recriar `criar_perfis_padrao` sem perder nenhum código e incluir as novas nos perfis existentes, localizando cada
  perfil pelo **id determinístico**, nunca pelo nome;
- perfis: Treinador e Nutricionista com LER e ALTERAR, Assistente só LER;
- `FlywayMigrationIntegrationTest`: 23 → 25.

## 2. Qual versão vale para cada pasta
- **`questionarios/QuestionarioResolver.versaoPara(pasta, aluno)`** (JPA):
  - testa `pasta.questionarioId`, depois `aluno.questionarioId`, depois o padrão;
  - fica com o primeiro que não está arquivado e tem `versaoPublicada > 0`.
- **Versão fixa só no envio.** Enquanto a atualização está ABERTA, inclusive depois de "vou atrasar", a versão é
  resolvida na hora. É o mesmo precedente da data, que acompanha o `fim` da pasta.
- **`AtualizacaoService`:**
  - `modelo(a)` usa `a.questionarioVersaoId` quando existir; senão, o resolvedor;
  - `avisarAtraso` deixa de fixar a versão;
  - `enviar` grava a versão.
- **Envio:** `EnviarRequest` ganha `questionarioVersaoId`. Se for diferente do resolvido, 409
  `MODELO_ATUALIZACAO_ALTERADO`. App antigo sem esse campo: compara `modeloVersao` com o `numero`, como
  compatibilidade temporária.
- **`Detalhe`** ganha `questionarioVersaoId` e `questionarioNome`.
- **Rascunho no aparelho** (`RascunhoAtualizacao`):
  - guarda `questionarioVersaoId`;
  - ao reabrir com outra versão, ou depois do 409, `respostasCompativeis(modelo, respostas)` mantém só as respostas
    cujo id existe, com o mesmo tipo e válidas;
  - aviso: "Seu treinador atualizou o questionário. Confira as respostas."

## 3. Ids estáveis e papéis no lugar dos ids fixos
**Ids:**
- pergunta, seção e opção usam `novoUid()`, e os ids antigos (`peso`, `sono`…) continuam válidos;
- o **tipo de um id não muda entre versões** (422 ao publicar), e o editor não deixa trocar o tipo;
- duplicar uma pergunta gera ids novos.

**Papéis:**

| Hoje (fixo no código) | Novo |
|---|---|
| `respostas.path("peso")` grava o `RegistroPeso` | No máximo uma pergunta `PESO`, procurada pelo tipo. Sem pergunta ou sem resposta, o peso não é gravado. |
| `DATA_AUTOMATICA` | No máximo uma. |
| `FOTOS` | No máximo uma, fora do menu "Adicionar". A que veio na v1 é preservada. |
| Resumo do treinador com `peso/sono/alim_desempenho/treino_desempenho` | Peso e variação (se houver PESO), mais até **4** perguntas com `destaque` (NOTA, NUMERO, SIM_NAO, ESCOLHA_UNICA), usando o `rotuloCurto`. |
| `p.id==='treino_dias'` | `ajudaAutomatica: "MEDIA_DIAS_TREINO"` |

## 4. Esquema v2, limites e validação
**Formato:**
```
{ formato: 2, instrucoes[≤10, ≤300],
  secoes[{ uid, titulo ≤80, perguntas[{ id, tipo, rotulo ≤200, obrigatoria, ajuda? ≤300,
    destaque?, rotuloCurto? ≤20, ajudaAutomatica?,
    dias? (NOTAS_POR_DIA: 1..7, valores 1..14),
    opcoes?[{id, rotulo ≤80}] (2..20, únicas),
    unidade? ≤12, min?, max?, casas? 0..2 (NUMERO) }] }] }
```

**Limites:**
- até 15 seções, 40 perguntas por seção e 80 no total;
- rascunho até 256 KiB;
- soma das capacidades de texto até 40.000 caracteres;
- respostas: o teto sobe de 64 KiB para **256 KiB**, no Java e no TS.

**Formato das respostas:**
- ESCOLHA_UNICA: id da opção;
- MULTIPLA_ESCOLHA: `string[]`, e lista vazia conta como não respondida;
- NUMERO: número dentro da faixa, com as casas definidas;
- SIM_NAO: `boolean`.

**Validação:**
- **Ao salvar o rascunho:** `ConteudoQuestionario` (record com Bean Validation), aceita conteúdo incompleto.
- **Ao publicar:** `ValidadorQuestionario`. Erro 422 `QUESTIONARIO_INVALIDO`, com `fieldErrors` no formato
  `secoes[i].perguntas[j]...`.
- **Respostas:** `ValidadorAtualizacao` ganha os 4 tipos novos. O espelho fica em `dominio/respostasAtualizacao.ts`,
  mais `validarQuestionario` (→ `{erros, avisos}`; `errosDoQuestionario` é o atalho só dos erros) em `dominio/questionario.ts`.
- **Constantes:** `LIMITES_QUESTIONARIO` (TS) e `LimitesQuestionario` (Java), com o comentário "mudou uma,
  muda a outra".
- **Teste de paridade:** fixtures JSON em `api/src/test/resources/paridade-questionario/`, lidas pelo JUnit e pelo
  Jest.

## 5. API (pacote `questionarios/`)

| Rota | Permissão |
|---|---|
| `GET /questionarios?arquivados=` (resumo + uso: alunos, pastas, envios) | QUESTIONARIO_LER |
| `GET /questionarios/opcoes` (id, nome, padrão; só publicados e não arquivados) | QUESTIONARIO_LER ou ALUNO_ALTERAR ou PASTA_ALTERAR |
| `POST /questionarios {nome, descricao, origem: VAZIO\|FABRICA}` | ALTERAR |
| `GET /questionarios/{id}` / `PUT /questionarios/{id}` (rascunho, 409 `CONFLITO_EDICAO`) | LER / ALTERAR |
| `POST /questionarios/{id}/publicar`, `/duplicar`, `/padrao`, `/arquivar`, `/desarquivar`; `DELETE /questionarios/{id}` | ALTERAR |
| `PUT /alunos/{id}/questionario`, `PUT /pastas/{id}/questionario` (`{questionarioId\|null}`) | ALUNO_ALTERAR / PASTA_ALTERAR |

**Regras:**
- **Definir padrão:** desmarcar o atual, `flush`, depois marcar o novo. Só um questionário publicado pode virar padrão.
- **O padrão** não pode ser arquivado nem excluído: 409 `QUESTIONARIO_PADRAO`.
- **Excluir:**
  - só se nenhum envio aponta para as versões dele, conferido por JPQL, sem SQL nativo;
  - se já foi usado, 409 `QUESTIONARIO_EM_USO`, e o app oferece **Arquivar**;
  - aluno e pasta que o usavam voltam para o padrão (FK `set null`).
- **Arquivar:** a resolução passa a ignorá-lo.
- **Atribuir:** só questionário publicado e não arquivado. Questionário ou recurso de outra consultoria responde 404.
- **Rotas dedicadas** para aluno e pasta, porque `AlunoRequest` e `PastaRequest` são PUT completos.
  `AlunoDetalhe` e `PastaResumo` ganham `questionarioId`.
- **Replicar pasta** não copia a escolha dela.
- **Auditoria** (`@Auditar`, resumos fixos):
  - ações: QUESTIONARIO_CRIADO, _PUBLICADO, _DUPLICADO, _PADRAO_ALTERADO, _ARQUIVADO, _EXCLUIDO,
    ALUNO_QUESTIONARIO_ALTERADO e PASTA_QUESTIONARIO_ALTERADO;
  - salvar o rascunho não é auditado.
- **`SeedHistoricoDemo`** passa a usar o `QuestionarioResolver`.

## 6. App
**Tipos e rotas** (`api/tipos.ts`, `api/rotas.ts`):
- `TipoPergunta` com os 11 tipos, `OpcaoPergunta`, `ConteudoQuestionario`, `Questionario*`;
- `RespostaAtualizacao` aceita também `boolean | string[]`;
- `questionarioId` no aluno e na pasta;
- uma função por rota.

**Formulário do aluno** (`aluno/atualizacao/QuestionarioAtualizacao.tsx`):
- ESCOLHA_UNICA: `Escolha`, ou `EscolhaEmFolha` acima de 8 opções;
- MULTIPLA_ESCOLHA: `SelecaoMultipla`/`CaixaSelecao`;
- NUMERO: `CampoNumerico` com a unidade e a faixa;
- SIM_NAO: `Escolha` Sim/Não, para que "sem resposta" exista;
- modo leitura com o rótulo da opção;
- tipo desconhecido: "Atualize o app para responder esta pergunta.";
- `key` da seção = `uid ?? titulo`.

**Resumo do treinador** (`app/treinador/atualizacoes/[id].tsx`): regra pura
`dominio/atualizacao.resumoDoTreinador`, com teste.

**Planejamento** (`app/treinador/planejamento/index.tsx`):
- não mexer em `TipoReceita`/`GRUPOS_DE_MODELOS`;
- as abas ficam `GRUPOS_DE_MODELOS` mais **"Atualização"** (com QUESTIONARIO_LER) e `?aba=atualizacao`;
- a aba mostra `treinador/questionarios/ListaDeQuestionarios.tsx`, com "Novo questionário" como único primário;
- os cartões têm os selos Padrão, Publicado vN, Alterado desde a publicação e Arquivado, mais o uso, e o menu ⋯ com
  Duplicar, Definir como padrão, Arquivar/Desarquivar e Excluir (com `motivo` quando estiver em uso).

**Editor** (`app/treinador/planejamento/questionario/[id].tsx` → `treinador/questionarios/EditorQuestionario.tsx`):
- **Hook `useQuestionarioEditor`:** mesma semântica de `usePlanoEditor` (revisao/salvoEm/emVoo, nada salvo sozinho,
  409 → recarregar) e `useGuardaDeSaida(pendente)`.
- **Abas "Editar | Prévia".**
- **Editar:**
  - nome e descrição;
  - instruções;
  - `SecoesDoQuestionario.tsx`, no molde de `treinador/mobilidade/SecoesDeMobilidade.tsx`: ↑↓, duplicar,
    remover com `PainelConfirmacao`, "Mover para seção…";
  - "Adicionar pergunta" abre uma `Folha` com os tipos (PESO e Data desabilitados com `motivo` quando já existem);
  - `PropriedadesDaPergunta.tsx`, painel por tipo: rótulo, ajuda, obrigatória, destaque e rótulo curto, opções,
    unidade/mín./máx./casas, dias, ajuda automática.
- **Prévia:** o mesmo `QuestionarioAtualizacao` com `previaDeAtualizacao(conteudo)` (sem números inventados) e um
  botão "Conferir respostas".
- **Botões:** "Salvar rascunho" (secundário) e "Publicar" (primário). O `PainelConfirmacao` do Publicar explica que
  quem ainda não enviou passa a ver a versão nova e quem já enviou mantém a que respondeu.
- **Domínio puro** (`dominio/questionario.ts`): normalizar, `paraApi`, `novaPergunta(tipo)`, `novaSecao`,
  `novaOpcao`, `duplicarPergunta`, `errosDoQuestionario`, `respostasCompativeis`, `perguntaPeso`, `destaques`,
  `questionarioEfetivo` e `LIMITES_QUESTIONARIO`. Reaproveita `mover`/`remover`/`substituir` de
  `dominio/editorTreino.ts`.

**Seletores:**
- ficha do aluno: `CampoLeitura` "Questionário de atualização" mais uma `Folha` de escolha;
- `FolhaPasta`: "Questionário deste período" (vazio = o do aluno);
- `AtualizacaoDaPasta` mostra o questionário em uso.

**Permissões e telas:**
- `dominio/permissoes.ts`: ramo `/treinador/planejamento/questionario` antes do ramo do Planejamento, que passa a
  aceitar MODELO_LER **ou** QUESTIONARIO_LER;
- `dominio/telas.ts`: "Questionários de atualização" e "Novo questionário";
- rótulos em `treinador/equipe/acoesAuditoria.ts`.

**Ajuda e documentação:**
- `app/src/ajuda/conteudo.ts`, com a seção e a pergunta "Mudei o questionário; e quem já respondeu?", e depois
  `node scripts/guias/gerar.mjs`;
- AGENTS.md: itens Atualização e Planejamento.

## 7. Blocos (um bloco = uma sessão, com commit próprio e relatório ✅/❌)
1. **Banco e resolução** (V024, entidades, `QuestionarioResolver`, `AtualizacaoService` com id e compatibilidade, PESO
   pelo tipo, `Detalhe`, `SeedHistoricoDemo`).
   - Testes:
     - `QuestionarioMigrationIntegrationTest`: Flyway até o 23, insere uma atualização ENVIADA e uma ABERTA, migra e
       confere o resultado e o trigger numa consultoria nova;
     - casos novos em `AtualizacoesIntegrationTest`: resolução pasta > aluno > padrão, arquivado cai no padrão,
       409 por id, enviada mantém a versão, envio sem PESO não grava peso.
2. **Esquema v2 e validadores** (detalhe na seção 8): `ConteudoQuestionario`, `ValidadorQuestionario`,
   `ValidadorAtualizacao` com os 4 tipos e 256 KiB, espelho em TS e fixtures de paridade. Só validação; sem rota,
   sem migration e sem tela.
3. **API de gestão** (V025, `CatalogoPermissoes`, controller e serviço, rotas de aluno e pasta, auditoria).
   - `ConteudoQuestionario.Pergunta.obrigatoria` é `Boolean` (rascunho incompleto não quebra a leitura): salvar o rascunho/`paraApi` normaliza nulo para `false`. O PUT do rascunho também confere `ValidadorQuestionario.excedeTamanhoDoRascunho` (os validadores puros não conferem `RASCUNHO_BYTES`) e, ao publicar, `tiposQueMudaram` contra as versões já publicadas.
   - Teste `QuestionariosIntegrationTest`:
     - CRUD, 409 de rascunho, publicar v1 e v2;
     - UPDATE numa versão falha pelo trigger;
     - 422 com os caminhos;
     - padrão único e troca;
     - excluir com e sem uso;
     - **404 entre consultorias em todas as rotas**;
     - 403 do Assistente ao alterar.
   - Também `CatalogoPermissoesTest` e `EquipeMigrationIntegrationTest`.
4. **App do aluno e leitura do treinador** (tipos, rotas, renderização, `respostasAtualizacao` com paridade, rascunho
   com id, `respostasCompativeis`, Resumo por destaque).
   - Testes de domínio e `offline.test.ts` nas duas implementações do repositório.
   - **Pendência do Bloco 2:** a leitura (`QuestionarioAtualizacao`, modo sem `aoMudar`) mostra "—" para resposta booleana ou lista; trocar pelo rótulo (Sim/Não, rótulos das opções) antes de o editor existir, senão um "Não" real parece dado ausente.
   - **Vai para o ar antes do bloco 5.**
5. **Editor no Planejamento** (lista, editor, prévia, hook, permissões e telas). Testes: `questionario.test.ts`,
   `permissoes.test.ts`, `telas.test.ts`.
6. **Seletores, ajuda e documentação** (ficha, `FolhaPasta`, `AtualizacaoDaPasta`, `conteudo.ts` e PDFs, AGENTS.md).

**Riscos:**
- **App nativo antigo:** mostra os tipos novos como texto e recebe 422. Mitigação: o bloco 4 sai antes; avisar os
  treinadores ou forçar a atualização do app. Tipo futuro `obrigatoria` num app antigo trava o envio (resposta de tipo desconhecido é erro).
- **Recriar `criar_perfis_padrao`:** não pode perder nenhum código existente. Comparar com a V018 e a lista do
  `EquipeMigrationIntegrationTest`.
- **Backfill de `atualizacao`:** coberto pelo teste de migração do bloco 1.
- **Advisor ou revisor:** revisão Opus ao fim dos blocos 1 e 3 (migrations, permissões, multi-tenant).

## 8. Bloco 2 em detalhe — esquema v2 e validadores

**Princípio (já usado em `ConteudoMobilidade`/`ValidadorMobilidade`):** Bean Validation só cobre forma e tamanho, para o
rascunho poder ficar incompleto; as regras de publicação ficam num `@Component` com `ResultadoValidacao.Coletor`
(`planos/ResultadoValidacao.java`) e caminhos no formato `secoes[0].perguntas[1].opcoes[2].rotulo`.

### Java (`api/.../questionarios/`)
- **`LimitesQuestionario`** (classe final com `public static final int`, usada nas anotações e no validador):
  15 seções, 40 perguntas por seção, 80 no total, 10 instruções de ≤300, título ≤80, rótulo ≤200, ajuda ≤300,
  rótulo curto ≤20, opção ≤80 (2 a 20 por pergunta), unidade ≤12, `casas` 0..2, destaques ≤4,
  capacidade de texto somada ≤40.000, rascunho ≤256 KiB (`RASCUNHO_BYTES`), respostas ≤256 KiB (`RESPOSTAS_BYTES`).
  Tamanho de texto conta unidades UTF-16 nos dois lados (Java `String.length`, TS `.length`); a fixture inclui um
  título com emoji (a v1 tem "✅ Alimentar").
- **`ConteudoQuestionario`** (record, `@JsonInclude(NON_NULL)` para o JSON gravado ser o mesmo que o TS produz):
  `formato`, `instrucoes`, `secoes[Secao{uid, titulo, perguntas[Pergunta]}]`. `Pergunta`: `id` (padrão
  `[A-Za-z0-9_-]{1,40}`, para aceitar `peso`, `sono` e uids), `tipo` (**enum** `TipoPergunta` com os 11 tipos; tipo
  desconhecido vira 400 na leitura), `rotulo`, `obrigatoria`, `ajuda`, `destaque`, `rotuloCurto`,
  `ajudaAutomatica` (enum `AjudaAutomatica`, hoje só `MEDIA_DIAS_TREINO`), `dias`, `opcoes[Opcao{id,rotulo}]`,
  `unidade`, `min`, `max` (`BigDecimal`), `casas`. Chave desconhecida é descartada ao regravar.
- **`ValidadorQuestionario.validar(ConteudoQuestionario)` → `ResultadoValidacao`.** Erros (bloqueiam):
  - pelo menos 1 seção e 1 pergunta; título da seção e rótulo da pergunta não vazios;
  - `uid` de seção e `id` de pergunta únicos no questionário inteiro; ids de opção únicos dentro da pergunta;
  - ESCOLHA_UNICA/MULTIPLA_ESCOLHA: 2 a 20 opções com rótulo não vazio e sem rótulo repetido (sem caixa/acento);
  - NOTAS_POR_DIA: 1 a 7 dias, valores 1..14 e sem repetir;
  - NUMERO: `min ≤ max` quando ambos existem, `casas` 0..2 (padrão 0);
  - no máximo um PESO, uma DATA_AUTOMATICA e uma FOTOS;
  - `destaque` só em NOTA, NUMERO, SIM_NAO e ESCOLHA_UNICA, no máximo 4; `rotuloCurto` só com `destaque`;
  - `ajudaAutomatica` só em TEXTO ou NUMERO; campos de outro tipo (opções em NOTA, `dias` fora de NOTAS_POR_DIA…)
    são erro, para o JSON não carregar lixo;
  - totais (80 perguntas, capacidade de texto) e `RASCUNHO_BYTES`.
  - **Aviso** (pede `confirmarAvisos` na publicação): "Sem pergunta de peso: o peso não será registrado."
- **`tiposQueMudaram(atual, List<ConteudoQuestionario> publicadas)`**: função pura que devolve os ids cujo tipo
  difere de uma versão já publicada (a regra "tipo de um id não muda"). Fica pronta aqui; quem a chama é o publicar
  do Bloco 3.
- **`ValidadorAtualizacao` (existente):** passa a usar `LimitesQuestionario.RESPOSTAS_BYTES` (64→256 KiB) e ganha os
  4 tipos: ESCOLHA_UNICA (texto igual ao id de uma opção), MULTIPLA_ESCOLHA (lista sem repetição, cada item é id de
  opção; **lista vazia conta como não respondida**), NUMERO (número dentro de `min`/`max`, no máximo `casas`
  decimais), SIM_NAO (booleano). Tipo desconhecido segue `default -> false`. Resposta de pergunta que nunca foi
  respondida continua descartada.

### TypeScript
- **`api/tipos.ts`:** `TipoPergunta` (11), `OpcaoPergunta`, `PerguntaAtualizacao` ampliada, `ConteudoQuestionario`
  (`ModeloAtualizacao` continua como alias compatível), `RespostaAtualizacao` aceita também `boolean | string[]`.
  Nenhuma tela muda neste bloco.
- **`dominio/questionario.ts`:** `LIMITES_QUESTIONARIO` (mesmos nomes e valores) e `validarQuestionario(conteudo)` →
  `{erros, avisos}` de `{caminho, mensagem}[]` (e `errosDoQuestionario`), com as mesmas regras e os mesmos caminhos do Java.
- **`dominio/respostasAtualizacao.ts`:** os 4 tipos, 256 KiB. **Tipo desconhecido:** pergunta respondida é erro nos dois lados (Java `default -> false`); a opcional sem resposta passa. Consequência: um tipo futuro marcado `obrigatoria` trava o envio num app antigo.
  Comentário "igual ao `ValidadorAtualizacao`".

### Paridade (nova)
- Fixtures em `api/src/test/resources/paridade-questionario/`: `limites.json`, `questionarios.json`
  (`{nome, conteudo, erros[], avisos[]}`; `erros` e `avisos` são só caminhos) e `respostas.json` (`{nome, modelo, respostas, camposComErro[]}`).
- Java: `ParidadeQuestionarioTest` lê pelo classpath. Jest: `dominio/paridadeQuestionario.test.ts` lê com
  `readFileSync(resolve(__dirname, '../../../api/src/test/resources/paridade-questionario/...'))`, o mesmo recurso do
  `tema/variaveis.test.ts`. Compara **só os caminhos/campos**, não as mensagens. O `app/Dockerfile` copia só `app/`,
  mas não roda testes, então não quebra; conferido no Bloco 2: não há `.github`, nem `npm test` em Dockerfile, `eas.json` ou compose; se um CI vier a rodar `npm test` sem a pasta `api/`, esse teste falha.
- **Manutenção das fixtures:** os JSON são gerados por `scripts/questionario/gerar-fixtures.mjs` (esperados escritos à mão no script; a `fabrica_v2` é derivada da V017 como a V024 faz). Mudou regra: ajuste o caso no script, gere de novo e rode `mvn verify` e `npm test`. Não editar os JSON à mão.
- Casos: válido mínimo, a v2 da fábrica, cada regra acima violada, limites exatos (80 perguntas, 20 opções) e +1,
  emoji no título, ids duplicados, tipo trocado, e para respostas os 4 tipos novos (válido, vazio, fora da faixa,
  opção inexistente, lista repetida, booleano como texto).

### Testes
- `ValidadorQuestionarioTest` (uma regra por teste, caminhos exatos), `ConteudoQuestionarioTest` (Bean Validation e
  leitura de enum desconhecido), `ValidadorAtualizacaoTest` ampliado (4 tipos, 256 KiB: 262.144 passa e 262.145 falha),
  `ParidadeQuestionarioTest`, e um teste de integração que valida a **v2 da fábrica lida do banco** (garante que o
  padrão criado pela V024 é publicável).
- App: `questionario.test.ts`, `respostasAtualizacao.test.ts` ampliado, `paridadeQuestionario.test.ts`.

### Fora deste bloco
Rotas, serviço de gestão, V025/permissões (Bloco 3); renderização e `respostasCompativeis` (Bloco 4); editor (Bloco 5).

### Verificação
`cd api && mvn verify` (ArchUnit e JaCoCo ≥ 70%) e `cd app && npm run typecheck && npm run lint && npm test`.
Revisão do `advisor` antes de fechar (contrato de validação compartilhado com o app).

## 11. Bloco 5 em detalhe — editor no Planejamento (só app)

**Decisões do Gustavo (2026-10-12):** quem tem `QUESTIONARIO_LER` sem `MODELO_LER` entra no Planejamento só com a aba
Atualização; perguntas editadas em **cartão recolhível** (como os exercícios do treino, com "Abrir/Fechar todas");
o questionário da pasta é escolhido **na folha da pasta aberta**; **um commit por bloco, sem push** (o Bloco 4 é
commitado antes de começar o 5; `app/src/app/treinador/_layout.tsx` sempre fora).

**O que já existe:** toda a API de gestão (Bloco 3, `QuestionarioController`); `ConteudoQuestionario`/`TipoPergunta`
em `api/tipos.ts`; `validarQuestionario`/`errosDoQuestionario`/`LIMITES_QUESTIONARIO` em `dominio/questionario.ts`;
`QuestionarioAtualizacao` renderiza os 11 tipos (prévia sai de graça); `mover`/`substituir`/`remover` em
`dominio/editorTreino.ts`; `novoUid()` em `dominio/uid.ts`. **Não existe:** tipos e rotas de gestão no app, fábricas
(`novaSecao`/`novaPergunta`…), tela nenhuma. `usePlanoEditor` está preso a `TipoPlano` e `localizar/uidsComProblema`
(`dominio/caminhos.ts`) usam `uid`/`nome`: não servem ao questionário, por isso o hook e o mapa de caminhos são irmãos.

### Tipos e rotas (`api/tipos.ts`, `api/rotas.ts`)
- Tipos, copiados de `QuestionarioDtos.java`: `OrigemQuestionario` (`VAZIO|FABRICA`), `UsoQuestionario {alunos, pastas, envios}`,
  `QuestionarioResumo {id, nome, descricao, padrao, arquivado, versaoPublicada (0 = nunca), publicadoEm, alteradoDesdePublicacao,
  rascunhoAlteradoEm, uso}`, `QuestionarioDetalhe = Resumo + {versao, rascunho: ConteudoQuestionario, versoes: {numero, publicadoEm}[]}`,
  `OpcaoQuestionario {id, nome, padrao}`, `ResultadoValidacaoQuestionario {erros, avisos: {caminho, mensagem}[]}`.
- Uma função por rota: `listarQuestionarios(arquivados)`, `opcoesDeQuestionario()`, `criarQuestionario({nome, descricao, origem})`,
  `buscarQuestionario(id)`, `salvarQuestionario(id, {nome, descricao, conteudo, versao})`, `publicarQuestionario(id, versao, confirmarAvisos)`,
  `duplicarQuestionario`, `definirQuestionarioPadrao`, `arquivarQuestionario`, `desarquivarQuestionario`, `excluirQuestionario`.
  (`/validar` não entra: o editor valida ao publicar.)

### Domínio puro (novo `dominio/editorQuestionario.ts` + teste; `questionario.ts` continua só o espelho do validador)
- `normalizarQuestionario(c: unknown)`: `formato: 2`, `instrucoes` lista, seção sem `uid` ganha `novoUid()`, `obrigatoria` nulo → false.
- `paraApi(c)`: tira campos que não são do tipo (opções fora de escolha, `dias` fora de NOTAS_POR_DIA, `rotuloCurto` sem `destaque`,
  `ajudaAutomatica` fora de TEXTO/NUMERO, textos opcionais vazios), sem mexer em ids.
- Fábricas: `novaSecao()`, `novaOpcao()`, `novaPergunta(tipo)` (escolhas nascem com 2 opções vazias; NUMERO `casas: 0`; NOTAS_POR_DIA
  `dias: [1..7]`), `duplicarPergunta(p)` (id novo **e** ids novos nas opções; rótulo igual).
- `TIPOS_PARA_ADICIONAR` (os 11 menos FOTOS) com rótulo e descrição curta; `ROTULO_DO_TIPO`.
- `podeAdicionar(conteudo, secao, tipo)` → `{pode, motivo}`: PESO/DATA_AUTOMATICA únicos ("Já existe uma pergunta de peso."),
  40 por seção, 80 no total; `podeAdicionarSecao` (15); `podeDestacar(conteudo, id)` (4 destaques, só NOTA/NUMERO/SIM_NAO/ESCOLHA_UNICA).
- `moverParaSecao(conteudo, de: {secao, pergunta}, para: secao)` (vai para o fim da seção destino).
- `localDoProblema(caminho)` → `{secao?, pergunta?}` lendo `secoes[i].perguntas[j]…`; `problemasPorPergunta(conteudo, problemas)` → `Map<idPergunta, mensagens>`.
- `previaDeAtualizacao(conteudo)` → `Atualizacao` só para a prévia (data de hoje, `resumo` nulo: nada de número inventado, a ajuda
  automática cai no texto fixo da pergunta).
- Teste-chave: para cada tipo, `novaPergunta(t)` com rótulo (e opções) preenchidos passa em `errosDoQuestionario`; e `paraApi` de uma pergunta
  "suja" sai sem os campos de outro tipo.

### Hook `treinador/questionarios/useQuestionarioEditor.ts` (semântica de `treinador/plano/usePlanoEditor.ts`)
- Estado `{detalhe, nome, descricao, conteudo, revisao, salvoEm}`, `versao` em ref; `pendente = revisao !== salvoEm` → `useGuardaDeSaida(pendente)`.
- `salvar()` (espera o envio em voo, manda `paraApi(conteudo)` e a `versao`): `CONFLITO_EDICAO` → situação `conflito` (Recarregar);
  `QUESTIONARIO_NOME_EM_USO`, `QUESTIONARIO_GRANDE_DEMAIS`, `QUESTIONARIO_ARQUIVADO` → mensagem da API. **Nada salva sozinho.**
- `publicar(confirmarAvisos)`: salva antes; `QUESTIONARIO_INVALIDO` → `{tipo:'erros', problemas}`; `CONFIRMAR_AVISOS` → `{tipo:'avisos'}`
  (painel "Publicar mesmo assim"); sucesso recarrega o detalhe (selo "Publicado vN").

### Telas
- **`app/treinador/planejamento/index.tsx`:** abas = `GRUPOS_DE_MODELOS` (só com `MODELO_LER`) + "Atualização" (só com `QUESTIONARIO_LER`),
  estado próprio de aba (a aba deixa de ser derivada só de `tipo`); `?aba=atualizacao` abre nela; sem `MODELO_LER` abre direto nela e não
  busca receitas/coleções/consultoria (`useCarregar` com chave `null`). `?novo=1` abre o "novo" **da aba ativa**. O texto de introdução
  muda na aba Atualização. Nada mais muda nos modelos.
- **`treinador/questionarios/ListaDeQuestionarios.tsx`:** `Cartao` "Questionários de atualização" com "Novo questionário" (único primário,
  `Permitido QUESTIONARIO_ALTERAR`) e um `Escolha` Ativos | Arquivados. `Grade` de cartões no molde do `CartaoModelo`: nome, descrição,
  selos (`Padrão` sucesso; `Publicado vN` neutro ou `Nunca publicado` atenção; `Alterado desde a publicação` atenção; `Arquivado` neutro),
  linha de uso "N alunos · N pastas · N envios" e "Editar" (com ALTERAR) ou "Ver" (só LER). Menu ⋯ (só ALTERAR) numa `Folha`: Duplicar;
  Definir como padrão (some se já é; desabilitado com `motivo` se não publicado); Arquivar (desabilitado com `motivo` no padrão) ou
  Desarquivar; Excluir (`perigoTexto`, desabilitado com `motivo` no padrão ou com envios: "Já foi respondido; arquive em vez de excluir").
  Excluir passa por `PainelConfirmacao` (diz que alunos e pastas que o usavam voltam ao padrão); 409 de corrida mostra a mensagem.
  "Novo questionário" abre `Folha` com nome, descrição e `Escolha` "Começar do modelo da plataforma" (FABRICA, padrão) | "Em branco";
  "Criar e editar" leva ao editor.
- **Rota `app/treinador/planejamento/questionario/[id].tsx` → `treinador/questionarios/EditorQuestionario.tsx`** (`LARGURA_EDITOR`):
  - `Cabecalho` "Questionário", trilha Planejamento (`?aba=atualizacao`) › nome, voltar para a aba.
  - Topo (`Cartao`): nome e descrição, selos, situação; "Salvar rascunho" (secundário) e "Publicar" (primário, `PainelConfirmacao`: "Quem
    ainda não enviou passa a ver esta versão; quem já enviou mantém a que respondeu."). Lista de problemas da publicação, cada um com "Ir
    para" (troca para Editar e abre a pergunta).
  - `Abas` Editar | Prévia. Sem `QUESTIONARIO_ALTERAR` (Assistente) só a Prévia, sem botões. Arquivado: aviso "Arquivado. Desarquive para
    editar." e só a Prévia.
  - **Editar:** `Cartao` Instruções (até 10, adicionar/remover) e `SecoesDoQuestionario.tsx` (molde `treinador/mobilidade/SecoesDeMobilidade.tsx`):
    seção = `Cartao` com título editável, ↑↓ e remover (`PainelConfirmacao`; a última não sai); pergunta = `CabecalhoDeGrupo` recolhível
    (rótulo, resumo "Tipo · obrigatória", `Selo` perigo se tem problema) que abre `PropriedadesDaPergunta.tsx` e a `LinhaDeAcoes` ↑↓,
    Duplicar, "Mover para seção…" (`EscolhaEmFolha`, só com 2+ seções) e Remover (`perigoTexto` + `PainelConfirmacao`). "Abrir/Fechar todas";
    pergunta nova nasce aberta. "Adicionar pergunta" abre `Folha` com os tipos (`ItemDeLista`; os indisponíveis com `motivo`). "Adicionar seção".
  - **`PropriedadesDaPergunta`:** rótulo, ajuda, Obrigatória (`Interruptor`; não em DATA_AUTOMATICA/FOTOS); "Mostrar no resumo do treinador"
    + "Nome curto" nos 4 tipos que aceitam destaque; opções (campo, ↑↓, remover com mínimo 2, adicionar até 20); NUMERO: unidade, mín., máx.
    (`CampoNumerico`), casas (`Escolha` 0/1/2); TEXTO/NUMERO: "Mostrar a média de dias com treino como ajuda" (`ajudaAutomatica`);
    NOTAS_POR_DIA: dias 1–14 por chips marcáveis (até 7); PESO: nota "A resposta vai para o registro de peso do aluno."; FOTOS: "Envio de fotos
    ainda não implementado." O tipo nunca muda (para mudar, remove e adiciona).
  - **Prévia:** `QuestionarioAtualizacao` com `previaDeAtualizacao(conteudo)` e respostas em estado local; "Conferir respostas"
    (`errosRespostasAtualizacao`) e "Limpar respostas". Mostra o rascunho; se difere do publicado, o selo do topo já avisa.

### Permissões, telas e ajuda curta
- `dominio/permissoes.ts`: `startsWith('/treinador/planejamento/questionario')` → `QUESTIONARIO_LER` (antes do ramo do Planejamento); o ramo
  do Planejamento passa a `MODELO_LER || QUESTIONARIO_LER`. O menu (`_layout.tsx`) já filtra por `podeAcessarTela`: não precisa mexer nele.
- `dominio/telas.ts`: "Questionários de atualização" (`?aba=atualizacao`, `permissao: 'QUESTIONARIO_LER'`) e ação "Novo questionário"
  (`?aba=atualizacao&novo=1`, `QUESTIONARIO_ALTERAR`, `acao: true`); `TITULOS_DE_SUBTELAS` ganha `/treinador/planejamento/questionario` → "Questionário".
- Testes: `permissoes.test.ts` (só QUESTIONARIO_LER abre Planejamento e editor; só MODELO_LER não abre o editor), `telas.test.ts` (listas do
  assistente e `nomeDaTela`), `editorQuestionario.test.ts`.

### Verificação e fechamento do Bloco 5
`cd app && npm run typecheck && npm run lint && npm test` e `npx expo export --platform android`. Conferência manual (`docker compose up -d --build`,
`:8088`): criar do modelo da plataforma, uma pergunta de cada tipo, prévia, publicar com erro (ir para), com aviso (sem peso) e válido; duplicar,
padrão, arquivar, excluir; Assistente só vê; perfil só com QUESTIONARIO_LER vê só a aba; sair com pendência pede confirmação. Advisor antes de
fechar (`/effort xhigh`). Commit "Questionários: editor no Planejamento". AGENTS.md: item Planejamento (aba Atualização, permissões, editor).

## 12. Bloco 6 em detalhe — seletores, ajuda e documentação (só app)

- **Rotas:** `escolherQuestionarioDoAluno(alunoId, questionarioId | null)` → `AlunoDetalhe`; `escolherQuestionarioDaPasta(pastaId, questionarioId | null)` → `PastaResumo`.
- **`treinador/questionarios/SeletorDeQuestionario.tsx`** (um componente para os dois lugares): props `rotulo`, `valor`, `rotuloDoNulo`,
  `podeAlterar`, `aoEscolher(id | null): Promise<void>`. Carrega `opcoesDeQuestionario()` (`useCarregar('questionarios-opcoes')`).
  Com permissão: `EscolhaEmFolha` (opção vazia = `rotuloDoNulo`, "Padrão" no `detalhe` do padrão; erro da API vira `avisar(..., 'perigo')`,
  409 `QUESTIONARIO_INDISPONIVEL` recarrega as opções). Sem permissão de alterar: `CampoLeitura`. Escolhido que não está nas opções
  (arquivado depois): "Arquivado; vale o {rotuloDoNulo}". Sem acesso às opções (403): a linha não aparece.
- **Ficha do aluno** (`app/treinador/alunos/[id].tsx`, `CartaoDados`, depois de "Nova atualização a cada"): "Questionário de atualização",
  nulo = "Padrão da consultoria", `ALUNO_ALTERAR`, o retorno vai para o `definir` da ficha.
- **Folha da pasta aberta** (`treinador/CartaoPastas.tsx`, entre a `LinhaDeAcoes` e `AtualizacaoDaPasta`): "Questionário deste período",
  nulo = "O do aluno", `PASTA_ALTERAR`; depois de trocar, recarrega pastas e atualizações (a ABERTA resolve na hora).
- **`AtualizacaoDaPasta`:** linha "Questionário: {questionarioNome}" quando a atualização traz o nome (conferir no código se a rota usada pela
  ficha devolve o campo; se não devolver, a linha não aparece e nada muda na API).
- **Ajuda (`app/src/ajuda/conteudo.ts`):** guia do treinador ganha o item "Questionário" na seção "Atualização do aluno" (padrão da consultoria,
  escolha no aluno e na pasta, rascunho e versões, arquivar) e a pergunta "Mudei o questionário; e quem já respondeu?" (quem enviou mantém a
  versão respondida; quem não enviou vê a nova; questionário respondido não se exclui, arquiva-se); tutorial do Planejamento cita a aba
  Atualização. Guia do aluno não muda. Depois `node scripts/guias/gerar.mjs` (Edge/Chrome) e versionar `app/public/guias/*.pdf`.
- **AGENTS.md:** seletores (ficha, pasta) e ajuda; `PLANO-QUESTIONARIOS.md` sincronizado com este arquivo.

### Verificação e fechamento do Bloco 6
`npm run typecheck && npm run lint && npm test`, `npx expo export --platform android`. Manual: escolher no aluno e na pasta, ver o aluno receber o
questionário da pasta, voltar a "O do aluno", arquivar o escolhido e conferir o texto; abrir a ajuda e o PDF. Advisor antes de fechar. Commit
"Questionários: seletores na ficha e na pasta, ajuda". Relatório final ✅/❌ dos blocos 5 e 6, citando a conferência manual que não puder ser feita.

## 10. Bloco 4 em detalhe — app do aluno e leitura do treinador (✅ concluído; só app + testes de API)

**Contexto levantado (leitura do código, 2026-10-12):** o contrato da API já está pronto (o `Detalhe` devolve `modelo`, `questionarioVersaoId`,
`questionarioNome`, `resumo`; o envio aceita `questionarioVersaoId`, e `modeloVersao` só por compatibilidade). O que falta é tudo no app:
1. `QuestionarioAtualizacao` cai num `Campo` de **texto** para ESCOLHA_UNICA/MULTIPLA/NUMERO/SIM_NAO (L73): o aluno grava string e o validador recusa; na leitura
   mostra o id da opção, "—" para boolean/lista e perde casas/unidade do número; a ajuda automática está presa ao id `treino_dias` (L43); `key` da seção é o título.
2. O app **não envia `questionarioVersaoId`** (`rotas.ts:83`, `FormularioAtualizacao.tsx:87` mandam `modeloVersao`). Se a pasta troca de A v1 para B v1 o envio passa pela
   comparação de número, a API valida contra B, descarta ids desconhecidos e devolve 422 por obrigatória que o formulário nem mostra: aluno preso.
3. O formulário copia a prop na montagem (`useState(atualizacao)`) e a chave da tela é `${pasta}:${versao}:${modeloVersao}`, que não muda nesse cenário; o 409 mostra aviso
   genérico para qualquer código e não reconcilia o rascunho (`modeloVersao` do rascunho nunca é lido).
4. Resumo do treinador (`app/treinador/atualizacoes/[id].tsx` L58-73) usa `respostas.peso/sono/alim_desempenho/treino_desempenho` e rótulos escritos no código.
5. `Atualizacao` (tipos.ts) não declara `questionarioVersaoId`/`questionarioNome`. `Escolha` não desmarca, `Interruptor` não tem "sem resposta", `CampoNumerico` não tem faixa.

### Domínio puro (`app/src/dominio/`, com teste)
- **`respostasAtualizacao.ts`:** exportar `respostaValida(pergunta, valor)` (o `valida` de hoje), sem mudar regra.
- **Novo `atualizacaoQuestionario.ts`** (ou dentro de `questionario.ts`, o que ficar menor):
  - `perguntaPeso(modelo)`, `perguntasDestaque(modelo)` (tipos NOTA/NUMERO/SIM_NAO/ESCOLHA_UNICA com `destaque`, ordem do documento, no máximo `destaquesMaximo`).
  - `textoDaResposta(pergunta, valor)`: PESO "80,5 kg"; NOTA inteiro; NUMERO com `casas` e `unidade`; SIM_NAO "Sim"/"Não"; ESCOLHA_UNICA rótulo da opção (id que não existe mais = "—");
    MULTIPLA_ESCOLHA rótulos juntos por ", " (ids desconhecidos ignorados; vazio = "—"); texto como está; ausência = "—" (regra do projeto, nunca zero).
  - `resumoDoTreinador(modelo, respostas, resumo)` → `{ peso: {valor, variacao}|null, destaques:[{id, rotulo, texto}], mediaDiasPorSemana, pesoAnterior }`. Peso e variação só com
    pergunta PESO respondida e `pesoAnterior`; rótulo do destaque = `rotuloCurto ?? rotulo` cortado em ~32 caracteres; sem destaque, só os dados do período.
  - `respostasCompativeis(modelo, respostas)` → `{ respostas, descartadas }`: mantém só id que existe no modelo novo (exceto FOTOS/DATA_AUTOMATICA) e com valor válido (`respostaValida`).
  - `rascunhoVigente(rascunho, atualizacao)` → `{ respostas, mudou }`: mesmo `questionarioVersaoId` = como está; rascunho legado (só `modeloVersao`) ou de outra versão = passa por
    `respostasCompativeis`. **`mudou` = (os dois ids conhecidos e diferentes) || `descartadas.length > 0`**: rascunho legado que não perde nada é regravado em silêncio
    (sem isso, todo aluno com rascunho aberto veria o aviso no primeiro uso depois da atualização do app). `questionarioVersaoId` da atualização pode vir `null` **ou `undefined`**
    (atualização guardada no aparelho por `repositorio.salvarAtualizacao` antes deste bloco, lida offline).
  - **`false` e `0` são respostas**: SIM_NAO "Não" e NUMERO 0 passam por `textoDaResposta`, `respostaValida`, obrigatória (`errosRespostasAtualizacao` já usa `== null`),
    `respostasCompativeis` e `resumoDoTreinador` sem virar "—" nem "não respondida"; casos explícitos nos testes.
  - Auxiliares dos controles: `simNaoParaEscolha`/`escolhaParaSimNao`, `alternarMarcado(lista, opcoes, id)` (devolve na ordem das opções), `ajudaDoNumero(pergunta)` ("De 0 a 10, até 1 casa decimal").
- **Decisão sem pergunta ao Gustavo:** a linha "Média de N dias com treino por semana" continua **sempre** no Resumo (é dado do sistema, vem da API em qualquer questionário); a ajuda automática
  `MEDIA_DIAS_TREINO` na pergunta passa a vir de `ajudaAutomatica`, não do id.

### Tipos, rotas e rascunho
- `api/tipos.ts`: `Atualizacao` + `questionarioVersaoId: string | null`, `questionarioNome: string | null`.
- `api/rotas.ts`: `enviarAtualizacao(pastaId, {questionarioVersaoId, modeloVersao}, respostas)` manda **os dois** (`{pastaId, questionarioVersaoId, modeloVersao, respostas}`):
  a API prefere o id e só usa o número sem ele; sem nenhum dos dois ela devolve 400 (`AtualizacaoService.enviar` L84), então a atualização antiga guardada no aparelho continua enviável.
- `offline/repositorioLocal.ts`: `RascunhoAtualizacao { questionarioVersaoId?: string; modeloVersao?: number; respostas }`. Ler aceita o legado; gravar usa só o id. Mesmo documento `kv`,
  **sem mudar `VERSAO_ESQUEMA`** (nada de `offline/banco.ts`). `offline.test.ts`: fixture nova + um caso legado, nas duas implementações.

### UI
- **`ui/Escolha.tsx`:** prop opcional `limpavel` (tocar no ativo devolve `null`, hoje devolve `''` e é ignorado); sem a prop, comportamento igual ao de hoje.
- **`QuestionarioAtualizacao.tsx`:**
  - SIM_NAO = `Escolha` Sim/Não (`limpavel` se opcional); ESCOLHA_UNICA = `Escolha` até 8 opções, `EscolhaEmFolha` acima (`OPCOES_PARA_BUSCAR`); MULTIPLA_ESCOLHA = bloco com
    `CaixaSelecao` por opção; NUMERO = `CampoNumerico` com `sufixo={unidade}`, `inteiro={(casas ?? 0) === 0}` (ausente = 0, como no esquema) e `ajudaDoNumero`, com a mesma conversão
    texto→número que o campo PESO já faz (nunca gravar o texto cru); erro de cada campo como nos atuais (`erros[p.id]`).
  - ESCOLHA_UNICA opcional com mais de 8 opções (`EscolhaEmFolha`, que não limpa): `LinkTexto` "Limpar" ao lado quando houver valor.
  - Tipo desconhecido: "Atualize o app para responder esta pergunta." (somente leitura, nunca cai em `Campo`).
  - Leitura: `textoDaResposta` (some a pendência do "—").
  - `key` da seção = `uid ?? titulo`; ajuda automática por `ajudaAutomatica === 'MEDIA_DIAS_TREINO'`.
- **`FormularioAtualizacao.tsx` + `app/aluno/atualizacao.tsx`:**
  - Chave do formulário `${pasta}:${versao}:${questionarioVersaoId ?? modeloVersao}`; a leitura do rascunho (`useCarregar`) inclui o id da versão na chave, para reler depois do 409.
  - Respostas iniciais = `rascunhoVigente(...)`; se `mudou`, cartão neutro (sem `alert`) "Seu treinador atualizou o questionário. Confira as respostas." e o rascunho adaptado é regravado com o id novo.
  - `mudar` grava `{questionarioVersaoId, respostas}`; `enviar` manda o id.
  - **Todo 409 do envio recarrega** (`ATUALIZACAO_JA_ENVIADA` também é alcançável), menos `PESO_JA_REGISTRADO`; aviso neutro, não vermelho. **Antes** de `recarregar()`, grava no rascunho as respostas que estão na tela (com o id antigo),
    para a remontagem ler o que o aluno acabou de digitar; o formulário remonta com o modelo novo e as respostas compatíveis. Outros 409 (`PESO_JA_REGISTRADO`) só mostram a mensagem.
  - A tela só monta o formulário depois que o rascunho da chave **nova** terminou de carregar (nada de montar com `rascunho=null` no meio da recarga, o que perderia as respostas).
  - Mostra o `questionarioNome` discreto (`Texto variante="pequeno"`) quando não for o padrão.

### Treinador
- `[id].tsx`: o `Resumo` inline vira `ResumoDaAtualizacao` (em `src/treinador/`) alimentado por `resumoDoTreinador`; cartão não aparece se não houver o que mostrar; cabeçalho com `questionarioNome`
  e versão. Respostas continuam no `QuestionarioAtualizacao` (modo leitura, que já mostra a versão fixada no envio).
- Nenhuma mudança de contrato na API. Um teste de integração novo em `AtualizacoesIntegrationTest`: `GET /atualizacoes/{id}` devolve `questionarioNome`, `modelo` da versão respondida e `resumo`
  (`diasComTreino`, `mediaDiasPorSemana`, `pesoAnterior`), hoje sem cobertura.

### Testes
- Jest: `dominio` novo (peso/destaques/textos de todos os tipos/resumo sem PESO e sem destaque/compatíveis/rascunhoVigente/auxiliares), `respostasAtualizacao.test.ts` (export), `offline.test.ts` (rascunho).
  Não há teste de componente no projeto: a UI é conferida à mão.
- Conferência manual (web `:8088`, `docker compose up -d --build`): como não há editor ainda, criar o questionário de teste pela API (`POST /questionarios` FABRICA, `PUT` acrescentando uma pergunta de
  cada tipo novo, `publicar`, `PUT /alunos/{id}/questionario`); como aluno responder, sair, trocar o questionário pela API e voltar (aviso + respostas mantidas) e enviar com 409 provocado;
  como treinador abrir o detalhe (Resumo por destaque e respostas legíveis). Conferir também o tema escuro e o leitor de tela nos novos controles.

### Riscos
- App nativo antigo continua mostrando tipo novo como texto e recebendo 422: o Bloco 4 precisa ir ao ar antes do Bloco 5 (editor).
- `Escolha` é usada em outras telas: a prop é opt-in, sem mudar o padrão.
- `pesoAnterior` é o último registro de peso anterior à data (de qualquer origem), não necessariamente o da atualização anterior; a variação continua com esse significado.
- Rascunho legado pode ser de um questionário diferente com o mesmo número de versão; por isso o legado sempre passa por `respostasCompativeis`.

### Verificação e fechamento
`cd app && npm run typecheck && npm run lint && npm test` e `npx expo export --platform android`; `cd api && mvn -o verify` (por causa do teste novo). Revisão do `advisor` antes de fechar
(contrato do envio e reconciliação do rascunho); sugerir `/effort xhigh` nela. Sem commit; `app/src/app/treinador/_layout.tsx` fora. AGENTS.md: item Atualização do app (envio por `questionarioVersaoId`,
rascunho por versão, Resumo por destaque) e `PLANO-QUESTIONARIOS.md` sincronizado. Tarefas mecânicas (docs, sincronizar plano) podem ir ao `executor`.

## 9. Bloco 3 em detalhe — API de gestão (✅ concluído; V025, permissões, rotas, auditoria)

Padrão a copiar: `planos/PlanoServiceBase` (409 `CONFLITO_EDICAO`, 422 `ValidacaoException` com `ResultadoValidacao.comoCampos`,
`PlanoDtos`), `EquipeController.responsavel` + `EquipeService.responsavel` (PUT pequeno do aluno) e `PastaService.finalizar`.
Sem enum de ações de auditoria: `@br.com.treinos.api.auditoria.Auditar(acao=, entidade=, resumo=)` com string literal.

### Item avulso antes do bloco (pedido do PDF, pág. 3 — "Quero que saia os usuário que fez")
Decidido: tirar do PDF da **dieta** a linha `['Profissional', …]` (`app/src/pdf/pdfDieta.ts` ~l.87) e a frase
"Elaborado por profissional habilitado" (~l.115), mantendo o aviso RASCUNHO. O campo "Profissional" continua no editor e na tela do
aluno. Treino e cargas não mudam. Mecânico (agente `executor`): acrescentar `not.toContain('Profissional')` e
`not.toContain('Elaborado por')` no bloco da dieta de `pdf.test.ts`; os PDFs de `app/public/guias/` não citam isso (nada a regenerar).

### V025__permissoes_questionario.sql
- `CatalogoPermissoes`: `QUESTIONARIO_LER` ("Conteúdo" / "Questionários de atualização", não sensível) e `QUESTIONARIO_ALTERAR`
  (criar, editar, publicar, duplicar, arquivar, excluir, definir padrão); `DEPENDENCIAS`: ALTERAR → LER. O Administrador (`acesso_total`) já recebe o código novo sem migration.
- Perfis **existentes**: `insert into perfil_permissao … select p.id, codigo from consultoria c join perfil p on p.id = md5(c.id::text||':Treinador')::uuid … on conflict do nothing`
  (nunca por nome; perfil editado ou apagado é ignorado). Treinador e Nutricionista: LER + ALTERAR; Assistente: só LER. Nunca existiu migration assim; este é o primeiro precedente.
- `create or replace function criar_perfis_padrao`: copiar as **quatro listas inteiras da V018** e incluir os códigos novos (o trigger chama a função pelo nome; não recriar). Conferir contra a V018 que nenhum código se perdeu.
- Teste: `FlywayMigrationIntegrationTest` 24 → 25 + descrição "permissoes questionario"; não dar ao Assistente código `%SENSIVEL%` nem `ATUALIZACAO_%` (`EquipeMigrationIntegrationTest`).

### Pacote `questionarios/` (controller fino, service `@Transactional`, `dto/QuestionarioDtos`)
**Entidade:** `Questionario` ganha `novo(nome, descricao, rascunhoJson)`, `salvarRascunho`, `publicar(numero, agora)`, `definirPadrao(boolean)`, `arquivar()/desarquivar()`;
`QuestionarioVersao` ganha fábrica `nova(...)` (hoje só getters); `Aluno.alterarQuestionario(UUID)` e `PastaPlano.alterarQuestionario(UUID)` (hoje só getters, `PastaPlano` sem setter).

**Repositórios (JPQL, sem SQL nativo → `ArquiteturaTest` não muda):** `existsByNomeIgnoreCaseAndArquivadoFalse`, e três contagens agrupadas por questionário
(alunos que o escolheram, pastas, envios = `Atualizacao.questionarioVersaoId in (versões do questionário)`) para a lista sem N+1.

**Rotas** (todas com `hasAuthority('PERM_…')`; a de opções usa `hasAuthority(A) or hasAuthority(B)` porque o `ArquiteturaTest` exige o texto `hasAuthority('PERM_`):

| Rota | Permissão | Notas |
|---|---|---|
| `GET /questionarios?arquivados=` | QUESTIONARIO_LER | `QuestionarioResumo` + uso (alunos, pastas, envios) |
| `GET /questionarios/opcoes` | QUESTIONARIO_LER **ou** ALUNO_ALTERAR **ou** PASTA_ALTERAR | `id, nome, padrao`; só publicados e não arquivados |
| `POST /questionarios {nome, descricao, origem: VAZIO\|FABRICA}` | ALTERAR | VAZIO = 1 seção "Geral" sem pergunta (rascunho aceita incompleto); FABRICA = última de `atualizacao_modelo`. Nome repetido entre ativos = 409 `QUESTIONARIO_NOME_EM_USO` (checado antes; o índice único é a rede) |
| `GET /questionarios/{id}` | LER | detalhe: dados do resumo + `rascunho` + `versoes[numero, publicadoEm]` |
| `PUT /questionarios/{id} {nome, descricao, conteudo, versao}` | ALTERAR | `conteudo` = `ConteudoQuestionario` (`@Valid`: forma e tamanho); versão diferente = 409 `CONFLITO_EDICAO`; `obrigatoria` nulo vira `false`; JSON acima de `RASCUNHO_BYTES` = 422 `QUESTIONARIO_GRANDE_DEMAIS`; arquivado = 409 `QUESTIONARIO_ARQUIVADO`; não é auditado |
| `POST /questionarios/{id}/validar` | ALTERAR | `{erros, avisos}` do rascunho salvo (mesmo `ValidadorQuestionario`) |
| `POST /questionarios/{id}/publicar {versao, confirmarAvisos}` | ALTERAR | erros → 422 `QUESTIONARIO_INVALIDO` (`fieldErrors` com os caminhos); `tiposQueMudaram` contra todas as versões já publicadas → 422 no caminho da pergunta; avisos sem confirmar → 422 `CONFIRMAR_AVISOS`; cria `QuestionarioVersao` numero+1 com `publicado_por`; nunca recebe `PLANO_PUBLICADO`/`PlanoDetalhe` (a `Auditoria.registrar` tem tratamento especial para eles) |
| `POST /questionarios/{id}/duplicar` | ALTERAR | copia o rascunho, "<nome> (cópia)" (corta em 120, sufixo se ocupado), não publicado, não padrão |
| `POST /questionarios/{id}/padrao` | ALTERAR | só publicado e não arquivado (409 `QUESTIONARIO_NAO_PUBLICADO`); desmarca o atual, `flush`, marca o novo; idempotente |
| `POST /questionarios/{id}/arquivar` · `/desarquivar` | ALTERAR | arquivar o padrão = 409 `QUESTIONARIO_PADRAO`; desarquivar com nome ocupado = 409 `QUESTIONARIO_NOME_EM_USO` |
| `DELETE /questionarios/{id}` | ALTERAR | padrão = 409 `QUESTIONARIO_PADRAO`; com envio apontando para alguma versão = 409 `QUESTIONARIO_EM_USO` (o app oferece Arquivar); senão apaga (versões em cascata; aluno e pasta voltam a nulo pela FK) |
| `PUT /alunos/{id}/questionario {questionarioId\|null}` | ALUNO_ALTERAR | aluno de outra consultoria = 404; questionário de outra = 404; arquivado ou sem versão publicada = 409 `QUESTIONARIO_INDISPONIVEL`; devolve `AlunoDetalhe` pelo mesmo mapeamento de `EquipeService.responsavel` |
| `PUT /pastas/{id}/questionario {questionarioId\|null}` | PASTA_ALTERAR | mesmas regras; devolve `PastaResumo` |

**DTOs existentes:** `AlunoDetalhe` e `PastaResumo` ganham `questionarioId` (record posicional: ajustar `de()` e todo construtor/uso, inclusive testes).
`PastaService.replicar` continua **sem** copiar a escolha (já é assim: só aluno, título e período). Todo método auditado devolve um record com `id()` no topo.

**Auditoria** (`@Auditar`, resumos fixos, sem nome nem conteúdo): `QUESTIONARIO_CRIADO`, `QUESTIONARIO_PUBLICADO`, `QUESTIONARIO_DUPLICADO`, `QUESTIONARIO_PADRAO_ALTERADO`, `QUESTIONARIO_ARQUIVADO`, `QUESTIONARIO_DESARQUIVADO`, `QUESTIONARIO_EXCLUIDO`, `ALUNO_QUESTIONARIO_ALTERADO`, `PASTA_QUESTIONARIO_ALTERADO`.

**Concorrência:** `@Version` do `Questionario` protege rascunho e publicação; trocar o padrão em paralelo cai no índice único parcial (conferir se o `GlobalExceptionHandler` traduz a violação para 409; se não, tratar no serviço).

### App (só espelhos manuais, sem tela)
`treinador/equipe/acoesAuditoria.ts` (rótulos das 9 ações), `dominio/perfilEquipe.ts` (`dependencias`: ALTERAR → LER). `podeAcessarTela` só no Bloco 5 (tela nova). Nenhum teste avisa se faltar um destes.

### Testes
- `QuestionariosIntegrationTest`: CRUD; 409 de rascunho; criar por FABRICA e publicar v1, mudar e publicar v2; `UPDATE` direto numa versão falha pelo trigger; 422 com caminhos exatos; tipo de um id trocado = 422; avisos exigem confirmação; padrão único e troca; excluir sem uso e com uso (envio real, 409); excluir questionário escolhido por aluno/pasta devolve nulo; arquivar faz a resolução cair no padrão; `PUT` de aluno/pasta com questionário arquivado ou não publicado = 409; duplicar com nome ocupado.
- **404 entre consultorias em todas as rotas novas**: acrescentar em `IsolamentoHttpIntegrationTest` (A mexendo em questionário/aluno/pasta de B, e questionário de A atribuído a aluno de B e vice-versa).
- Permissões: Assistente lê (200) e não altera (403); Nutricionista altera; perfil sem `QUESTIONARIO_LER` toma 403; `opcoes` abre só com ALUNO_ALTERAR (padrão de `membro(...)` de `AplicarModeloPermissoesIntegrationTest`). Coluna nova em `MatrizPerfisIntegrationTest`.
- Migração: estender `QuestionarioMigrationIntegrationTest` (ou criar a da V025) para conferir que perfis padrão de consultoria já existente e de consultoria nova ganharam as permissões certas, e que perfil editado/apagado não quebra.
- `CatalogoPermissoesTest` (ALTERAR sozinho = 400; fechamento do conjunto), `acoesAuditoria.test.ts`/`perfilEquipe.test.ts` se existirem.

### Docs
AGENTS.md (item Atualização: rotas, permissões `QUESTIONARIO_*`, `QUESTIONARIO_INVALIDO`, regra de excluir/arquivar); `PLANO-QUESTIONARIOS.md` espelhando este arquivo.

### Fora deste bloco
Tela de lista/editor (Bloco 5), seletores na ficha e na pasta (Bloco 6), renderização dos tipos novos (Bloco 4), `GET /questionarios/{id}/versoes/{numero}` (só se o editor precisar).

### Verificação
`cd api && mvn -o verify` (ArchUnit, JaCoCo ≥ 70%); `cd app && npm run typecheck && npm run lint && npm test`; **revisão Opus (advisor) antes de fechar**, por tocar migration, permissões e isolamento entre consultorias; sugerir `/effort xhigh` nessa revisão.

## Arquivos críticos
- **API:**
  - `api/src/main/java/br/com/treinos/api/atualizacoes/AtualizacaoService.java`
  - `api/src/main/java/br/com/treinos/api/atualizacoes/ValidadorAtualizacao.java`
  - `api/src/main/java/br/com/treinos/api/equipe/CatalogoPermissoes.java`
  - `api/src/main/resources/db/migration/V018__equipe.sql` (modelo para a função e o trigger)
  - `api/src/test/java/br/com/treinos/api/arquitetura/ArquiteturaTest.java`
  - `api/src/test/java/br/com/treinos/api/migration/FlywayMigrationIntegrationTest.java`
- **App:**
  - `app/src/aluno/atualizacao/QuestionarioAtualizacao.tsx`
  - `app/src/aluno/atualizacao/FormularioAtualizacao.tsx`
  - `app/src/dominio/respostasAtualizacao.ts`
  - `app/src/app/treinador/atualizacoes/[id].tsx`
  - `app/src/app/treinador/planejamento/index.tsx`
  - `app/src/treinador/mobilidade/SecoesDeMobilidade.tsx` (molde)
  - `app/src/dominio/permissoes.ts`
  - `app/src/dominio/telas.ts`

## Verificação
- **API:** `cd api && mvn verify` (Testcontainers, `ArquiteturaTest`, JaCoCo ≥ 70%) a cada bloco.
- **App:** `cd app && npm run typecheck && npm run lint && npm test`, mais `npx expo export --platform android` nos
  blocos 4 a 6.
- **Ponta a ponta:** `docker compose up -d --build`, abrir `http://localhost:8088`.
  1. Como treinador: Planejamento › Atualização › duplicar o "Padrão", adicionar uma pergunta de cada tipo novo,
     conferir a prévia e publicar.
  2. Atribuir o questionário a um aluno e a uma pasta.
  3. Como aluno: responder e enviar.
  4. Como treinador: conferir o Resumo e os destaques.
  5. Republicar o questionário com o rascunho do aluno aberto e conferir o aviso e as respostas mantidas.
  6. Com uma segunda consultoria: confirmar 404 nas rotas.
