# Cardio e HIIT

Situação: Em andamento (etapa 0: contrato e regras puras) · Onde: main (sem commit) · Atualizado: 27/11/2026

Base: `main` em `fb57efa9`, com trabalho não commitado de outras frentes na árvore. Validade: este contrato vale enquanto
`ConteudoTreino.Cardio`, `formatoDoPacote.cardio` e `exercicio` (biblioteca) estiverem como no mapa abaixo. Se alguém mexer
neles antes do P1, confira de novo.

## Objetivo
O cardio deixa de usar a peça de série de musculação. Ele ganha uma prescrição própria, Contínuo ou Intervalado, com os
protocolos HIIT curto, HIIT longo, SIT, RST e Personalizado. O cardio pode ter vários blocos, e o aluno ganha um timer de
intervalos. Na Biblioteca, o exercício de cardio tem "Tipo de cardio" e "Medidas que fazem sentido".

## Mapa do que existe hoje (27/11)

**API**
- `api/.../treino/ConteudoTreino.java`
  - :46 tem `CARDIO`; :168 tem `ExercicioPlano` (`modalidade`, `series` até 30, `equipamento` com `NON_NULL`); :221 tem `deCardio()`.
  - :259 tem `Serie` (com `cardio`).
  - :475-516 tem `Cardio(duracaoMin, distanciaKm, ritmo ≤ 40, zona, intervalos)` e `Intervalos(trabalhoSeg, descansoSeg, voltas)`.
  - O `problemas()` desses records confere hoje: ao menos duração, distância ou intervalos; duração de 1 a 600 min; distância entre 0 (exclusive) e 1000 km; zona de 1 a 5; esforço de 1 a 3600 s; descanso de 0 a 3600 s; voltas de 1 a 100.
- `ValidadorTreino.java`: :148 aplica "cardio só por cardio" nas alternativas; :385-458 tem `problemasDaSerie(x, exercicioCardio)`. A série de cardio não tem tipo, carga, esforço, repetições nem técnica.
- `PlanoTreinoService.java`:94-99: `paraPublicar` copia o `equipamento` da biblioteca (`equipamentoDe`).
- `execucao/IndiceVersao.java`:66: no histórico, a série de cardio se chama "Cardio" e não leva "kg".
- `biblioteca/Exercicio.java`: :22 `Modalidade` (com `CARDIO`); :30 `@TenantId`; :37-40 `grupo_muscular` e `equipamento`.
- `biblioteca/dto/BibliotecaDtos.java`: :27 `ExercicioRequest`; :41 `ExercicioResponse`.
- `BibliotecaService.java`:195/206: criar e alterar.
- Catálogo V003:56-58 e outras: 15 cardios com grupo "Cardio" e equipamento "Esteira", "Bicicleta", "Máquina"…
- O conteúdo do plano é `jsonb` (`plano_versao.conteudo`, V001). **A prescrição do treino não precisa de migration.**
- Migrations: a última é a V111, provisória. O total nos testes é **110** (`FlywayMigrationIntegrationTest`:26 e `PapeisBancoIntegrationTest`:302; a V078 não existe).

**App**
- `app/src/api/tipos.ts`: `Cardio`, `IntervalosDeCardio`, `Serie.cardio`, `Exercicio`, `ExercicioRequest`.
- `offline/formatoDoPacote.ts`:70-73 confere as chaves de `cardio` e de `intervalos` de forma **estrita**: chave nova = pacote recusado pelo app instalado. As chaves de `serie` estão em :117.
- `dominio/editorTreino.ts`: :172 `novaSerieDeCardio`; :428 `copiarCardio` e :440 `serieNormalizada`, que copiam **só as chaves conhecidas**.
- `dominio/validacaoDeSerie.ts`:80: `problemasDoCardio` espelha a API.
- `dominio/agrupamento.ts`:201: `textoCardio`, usado em :360, `cargas.ts`:63, `resumoDaSerie.ts`:38 (que alimenta o PDF), `telaDoExercicio.ts`:57 e `aluno/CartaoExercicioDoDia.tsx`:59.
- `dominio/inspetorDoTreino.ts`:31/59.
- `dominio/importarTreinoDeTexto.ts`:783: `lerCardio`, que gera dado no formato antigo.
- Editor:
  - `treinador/treino/CamposDaPrescricao.tsx`:18-42 tem `CamposDoCardio` e `CARDIO_VAZIO`.
  - `CartaoExercicio.tsx`:79/150/161: `EditorSeries cardio`.
  - `CartaoSessao.tsx`:38: "+ Adicionar cardio" abre a `FolhaBiblioteca`.
- Aluno:
  - `aluno/CartaoSerieDeCardio.tsx` mostra as linhas de `serieDoAluno.linhasDoCardio` (:79). O aluno só marca "feito".
  - `ExercicioAluno.tsx`:175/229.
  - `aluno/useTelaAcesa.ts` usa `expo-keep-awake`; `ui/vibrar.ts` usa `expo-haptics` e respeita a preferência de vibração.
  - `dominio/descanso.ts` tem o relógio da barra de descanso (`relogioDoDescanso`, `rotuloDescanso`).
- Biblioteca: `treinador/biblioteca/AbaExercicios.tsx` (formulário) e `ModalidadeDoExercicio.tsx`.
- Ajuda: `ajuda/conteudo.ts`:266 (Exercícios) e :284 (Cardio).
- PDF: `pdf/pdfTreino.ts`, via `resumoDaSerie` → `textoCardio`. O :164 é o texto livre antigo da sessão.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | O que é um bloco | **Cada `Serie` de um exercício `CARDIO` é um bloco**, sem `blocosDeCardio[]` novo. Já funcionam assim: o "feito" do aluno, o histórico ("Cardio"), os uids novos em cópia e réplica, as alternativas (que herdam as séries) e o teto de 30. "+ Novo bloco de cardio" cria uma série nova; "2 blocos" é `series.length`. | Executor (etapa 0) |
| D2 | Tudo aditivo | Os campos novos entram em `Cardio` com `@JsonInclude(NON_NULL)`, como o `valorKg`. Plano antigo sai **idêntico** no JSON e continua lendo no APK instalado. `Intervalos` não muda. | Executor |
| D3 | Modo e dado antigo | **O contínuo nunca grava `modo`**: sem `modo` e sem `intervalos` = CONTINUO, sempre com as regras novas do contínuo. Isso é seguro para o legado, porque a regra antiga sem intervalos já exigia duração ou distância, com os mesmos limites; só o texto muda para "Informe a duração ou a distância.". **Só o intervalado novo grava `modo: "INTERVALADO"`**. Sem `modo` e com `intervalos` = intervalado antigo (PERSONALIZADO), com **exatamente a regra de hoje** ("Tempo de esforço de 1 a 3600 segundos." etc.). Assim, republicar ou replicar o legado nunca quebra. `modo: "CONTINUO"` explícito é aceito, mas o editor não o envia. | Executor (diverge de "cardio atual = Contínuo": o legado com intervalos é intervalado) |
| D4 | Unidades | Os tempos **novos** ficam em segundos: `aquecimentoSeg` e `desaquecimentoSeg`. Estímulo, recuperação e voltas **reaproveitam** `intervalos.trabalhoSeg`, `descansoSeg` e `voltas`, que já são segundos. `duracaoMin` (minutos) e `distanciaKm` ficam: trocar a unidade invalidaria as versões publicadas, que são imutáveis. | Executor (diverge de "tudo em segundos") |
| D5 | Esforço | A `zona` (1 a 5) já existe e vale nos dois modos. "Máximo / all-out" é `esforcoMaximo: true` (só `true` ou ausente; `false` vira nulo), só no intervalado, e nunca junto com a zona. Não se chama `esforco` para não confundir com `Serie.esforco` (RIR/RPE). | Executor |
| D6 | Tempo total do intervalado | aquecimento + voltas × estímulo + (voltas − 1) × recuperação + desaquecimento. Não há recuperação depois do último estímulo: ali entra o desaquecimento. É a soma das fases do timer (`fasesDoBloco`), então a conta e o timer não divergem. Fase de 0 s não entra. O total soma os segundos de todos os blocos e arredonda **uma vez** para o minuto mais próximo (nunca "~0 min"). Se algum bloco não tem tempo (contínuo só com distância), não há total: "2 blocos", nunca um total parcial. | Executor |
| D7 | Padrões por protocolo | CURTO: 5 min + 10 × 30 s / 30 s + 5 min, Zona 5 (dá 1170 s, "~20 min"). LONGO: 5 + 5 × 3 min / 2 min + 5, Zona 4 (~33 min). SIT: **4 min** + 6 × 30 s / 3 min + **3 min**, esforço máximo (dá 1500 s, "~25 min"). RST: 5 + 10 × 6 s / 30 s + 5, esforço máximo (~16 min). Personalizado: mantém o que havia. Nenhum par único de aquecimento e desaquecimento fecha ao mesmo tempo o "~20" do CURTO e o "~25" do SIT, por isso os padrões são por protocolo. O tipo da recuperação fica **sem padrão** (o treinador escolhe), senão a prévia do exemplo mudaria. | Executor |
| D8 | Faixas (só AVISO no app; o servidor não recusa) | CURTO: estímulo ≤ 60 s e recuperação ≤ 60 s. LONGO: estímulo > 60 s e recuperação > 60 s. SIT: estímulo de 20 a 30 s, recuperação de 120 a 240 s e esforço máximo. RST: estímulo de 3 a 10 s, recuperação < 60 s e esforço máximo. Personalizado não tem faixa. Campo vazio não avisa. É **um aviso por bloco**, com as partes juntas: "Fora da faixa do SIT (estímulo de 20 a 30 s)"; "Fora da faixa do RST (estímulo de 3 a 10 s; recuperação abaixo de 60 s; esforço máximo)". A zona 4–5 do CURTO e a 4 do LONGO são só padrão e não entram na faixa. | Executor |
| D9 | Formato do tempo | `rotuloDescanso` das séries: "30 s", "1 min", "1 min 30 s", "3 min". 90 s aparece como "1 min 30 s", não "90 s". | Executor |
| D10 | Entrada de tempo | Não havia parser de texto (o descanso usa dois campos de dígitos). `segundosDoTexto(texto, unidadePadrao)` aceita "75", "1:30", "2 min", "90 s", "1 min 30 s", "1min30" e "1,5 min". O número sem unidade vale a unidade do campo: segundos no estímulo e na recuperação, minutos no aquecimento e no desaquecimento. Vazio ou ilegível dá nulo; a tela mostra "Tempo inválido" quando há texto. | Executor |
| D11 | Ritmo | Continua texto livre até 40. `ritmoTexto` completa "6" → "6 min/km" e "5:30" → "5:30 min/km"; o que já veio escrito fica como está. | Executor |
| D12 | Biblioteca: tipo e medidas | `tipo_de_cardio` (nulo = não informado) e `cardio_mede_distancia`/`cardio_mede_ritmo`, `boolean NOT NULL DEFAULT true`, para o exercício antigo continuar mostrando tudo. Na API, `tipoDeCardio` e `medidasDeCardio: ['DISTANCIA','RITMO']`. Duração e zona aparecem sempre. O editor esconde a medida desmarcada, **nunca um valor já gravado** (`mostraMedida`). Cardio manual (sem `exercicioId`) mostra as duas. | Executor |
| D13 | Grupo e equipamento do cardio | Criar ou alterar com `CARDIO` grava `grupo_muscular` e `equipamento` **nulos** (o formulário não os mostra). O que já está gravado não é apagado em massa (nada de UPDATE na migration): só muda quando o treinador salvar de novo. A importação do catálogo mantém o que o catálogo traz. | Executor |
| D14 | Tipo de cardio no plano publicado | **Sem chave nova** no `ExercicioPlano`: uma chave nova faria o APK velho recusar o pacote. Na publicação, `equipamentoDe` passa a usar, para `CARDIO` com tipo, o rótulo do tipo de máquina (Esteira, Bike, Elíptico, Escada, Remo). Corrida ao ar livre, Natação e Outro saem sem equipamento; sem tipo, usa o `equipamento` gravado (legado). Assim "Equipamentos do dia" do aluno continua com "Esteira" depois de editar o exercício. As medidas não vão ao plano: só o editor as usa, lendo da biblioteca pelo `exercicioId`. | Executor |
| D15 | Migration | **`V199` provisória** (renumerar no merge; a V111 e a V190 também são provisórias em outras frentes). Só a biblioteca muda. `exercicio` já tem `@TenantId` e não há entidade nova. O total vai de **110 para 111** em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`: confira o número no arquivo na hora, porque outra frente pode tê-lo subido. | Executor |
| D16 | APK e ordem de lançamento | O contínuo, novo ou antigo, sai com as mesmas chaves de hoje (D3), e o APK instalado continua aceitando. **Só o bloco intervalado novo** (`modo`, `protocolo`, aquecimento…) é recusado pelo `formatoDoPacote` do APK velho. O efeito real está em `offline/repositorioLocal.ts`:378-387 e `repositorioSqlite.ts`:277-286: ao ler, o pacote fora do formato é **apagado** e marcado `pacoteRecusado`, e o aluno perde o plano offline inteiro (a tela pede para atualizar o app). O P3 amplia o `formatoDoPacote` com as chaves novas e os enums. **Ordem de lançamento: o APK com o P3 precisa estar nas lojas (e instalado) antes de o treinador poder salvar intervalado em produção.** P1 e P2 podem ir ao main antes, mas sem uso real de intervalado até lá. O coordenador decide como garantir isso. | Executor |
| D17 | Vibração e tela acesa | `expo-haptics ~57.0.3` e `expo-keep-awake ~57.0.2` já estão no `package.json`, e `useTelaAcesa` e `vibrar` já existem. **Nada a instalar.** O P3 reaproveita os dois (o `vibrar` pode ganhar um método para a troca de fase). | Executor |

## Contrato final

### (a) Prescrição no plano de treino

Exercício de cardio com dois blocos, um contínuo e um SIT. Os campos de série que não são de cardio vão nulos, como hoje.

```json
{
  "uid": "8c1d…", "exercicioId": "1f0a…", "nome": "Bicicleta ergométrica", "modalidade": "CARDIO", "unidade": "nenhuma",
  "series": [
    {
      "uid": "b1…", "tipo": null, "repsMin": null, "repsMax": null, "amrap": null, "carga": null, "esforco": null,
      "descansoSegundos": null, "tecnica": null, "alvoExtra": null,
      "cardio": { "duracaoMin": 10, "distanciaKm": null, "ritmo": null, "zona": 2, "intervalos": null }
    },
    {
      "uid": "b2…", "tipo": null, "repsMin": null, "repsMax": null, "amrap": null, "carga": null, "esforco": null,
      "descansoSegundos": null, "tecnica": null, "alvoExtra": null,
      "cardio": {
        "modo": "INTERVALADO", "protocolo": "SIT",
        "duracaoMin": null, "distanciaKm": null, "ritmo": null, "zona": null, "esforcoMaximo": true,
        "aquecimentoSeg": 240, "desaquecimentoSeg": 180, "recuperacaoTipo": "PASSIVA",
        "intervalos": { "trabalhoSeg": 30, "descansoSeg": 180, "voltas": 6 }
      }
    }
  ]
}
```

O bloco contínuo (o primeiro) tem as mesmas chaves de hoje, sem `modo` (D3). Só o intervalado novo traz chaves novas.

Java (P1):

```java
public enum ModoDeCardio { CONTINUO, INTERVALADO }
public enum ProtocoloDeCardio { CURTO, LONGO, SIT, RST, PERSONALIZADO }
public enum TipoDeRecuperacao { ATIVA, PASSIVA }

public record Cardio(
        Integer duracaoMin,
        BigDecimal distanciaKm,
        @Size(max = 40) String ritmo,
        Integer zona,
        @Valid Intervalos intervalos,
        @JsonInclude(JsonInclude.Include.NON_NULL) ModoDeCardio modo,
        @JsonInclude(JsonInclude.Include.NON_NULL) ProtocoloDeCardio protocolo,
        @JsonInclude(JsonInclude.Include.NON_NULL) Integer aquecimentoSeg,
        @JsonInclude(JsonInclude.Include.NON_NULL) Integer desaquecimentoSeg,
        @JsonInclude(JsonInclude.Include.NON_NULL) TipoDeRecuperacao recuperacaoTipo,
        @JsonInclude(JsonInclude.Include.NON_NULL) Boolean esforcoMaximo) {

    public Cardio {
        esforcoMaximo = Boolean.TRUE.equals(esforcoMaximo) ? Boolean.TRUE : null;
    }

    /** Dado antigo (sem modo): as regras de hoje. */
    public Cardio(Integer duracaoMin, BigDecimal distanciaKm, String ritmo, Integer zona, Intervalos intervalos) {
        this(duracaoMin, distanciaKm, ritmo, zona, intervalos, null, null, null, null, null, null);
    }
    // Intervalos(trabalhoSeg, descansoSeg, voltas) não muda.
}
```

Validação do servidor (`Cardio.problemas()`), espelho exato de `dominio/cardio.erroDoBloco`. O 422 `PLANO_INVALIDO` usa o
campo `sessoes[i].exercicios[j].series[k].cardio.<campo>` e textos fixos, sem o valor digitado:

| Condição | Campo | Mensagem |
| --- | --- | --- |
| `modo` nulo **e** `intervalos` preenchido (intervalado antigo) | — | as regras de hoje, sem mudar nada |
| CONTINUO = `modo` nulo sem `intervalos`, ou `modo: CONTINUO` | — | as linhas CONTINUO abaixo |
| zona fora de 1 a 5 (os dois modos) | `zona` | "Zona de 1 a 5." |
| CONTINUO sem duração e sem distância | `duracaoMin` (só nele) | "Informe a duração ou a distância." |
| CONTINUO com duração fora de 1 a 600 | `duracaoMin` | "Duração de 1 a 600 minutos." |
| CONTINUO com distância ≤ 0 ou > 1000 | `distanciaKm` | "Distância maior que zero e até 1000 km." |
| CONTINUO com ritmo > 40 | `ritmo` | "Ritmo com no máximo 40 caracteres." |
| CONTINUO com `intervalos`, `protocolo`, `aquecimentoSeg`, `desaquecimentoSeg`, `recuperacaoTipo` ou `esforcoMaximo` | o próprio | "Só vale no intervalado." |
| INTERVALADO com `duracaoMin`, `distanciaKm` ou `ritmo` | o próprio | "Só vale no contínuo." |
| INTERVALADO com estímulo nulo ou fora de 1 a 3600 (inclusive sem `intervalos`) | `intervalos.trabalhoSeg` | "Estímulo de 1 s a 60 min." |
| INTERVALADO com recuperação fora de 0 a 3600 (nula vale) | `intervalos.descansoSeg` | "Recuperação de 0 a 60 min." |
| INTERVALADO com voltas nulas ou fora de 1 a 100 | `intervalos.voltas` | "Voltas de 1 a 100." |
| aquecimento ou desaquecimento fora de 0 a 3600 (nulo vale) | `aquecimentoSeg` / `desaquecimentoSeg` | "Aquecimento de 0 a 60 min." / "Desaquecimento de 0 a 60 min." |
| zona junto com esforço máximo | `esforcoMaximo` | "Use a zona ou o esforço máximo, não os dois." |
| `protocolo` nulo no INTERVALADO | — | vale como PERSONALIZADO |
| fora da faixa do protocolo | — | **nada** (só o aviso no app) |

Enum desconhecido dá 400 na leitura do corpo, como os outros enums. O número de blocos segue o `@Size(max = 30)` de
`series`. O resto do `ValidadorTreino` não muda: uma série de cardio continua sem tipo, carga, esforço, repetições e técnica.

### (b) Biblioteca

```json
{ "nome": "Esteira", "modalidade": "CARDIO", "grupoMuscular": null, "equipamento": null,
  "tipoDeCardio": "ESTEIRA", "medidasDeCardio": ["DISTANCIA", "RITMO"], "videoUrl": null, "observacoes": null }
```

- `Exercicio.TipoDeCardio { ESTEIRA, BIKE, ELIPTICO, ESCADA, REMO, CORRIDA_AO_AR_LIVRE, NATACAO, OUTRO }` e `MedidaDeCardio { DISTANCIA, RITMO }`.
- `ExercicioRequest` ganha `TipoDeCardio tipoDeCardio` e `@Size(max = 2) List<MedidaDeCardio> medidasDeCardio`. Os dois só contam em `CARDIO`; fora dele são ignorados (tipo nulo, medidas no padrão). Medidas ausentes: na criação, as duas; na edição, mantém as gravadas. Com `CARDIO`, `grupoMuscular` e `equipamento` do corpo são ignorados e gravados nulos (D13).
- `ExercicioResponse` ganha `tipoDeCardio` (nulo) e `medidasDeCardio` (lista; vazia fora do `CARDIO`).
- Migration `V199__cardio_na_biblioteca.sql` (provisória):

```sql
ALTER TABLE exercicio
  ADD COLUMN tipo_de_cardio varchar(30),
  ADD COLUMN cardio_mede_distancia boolean NOT NULL DEFAULT true,
  ADD COLUMN cardio_mede_ritmo boolean NOT NULL DEFAULT true;
ALTER TABLE exercicio ADD CONSTRAINT ck_exercicio_tipo_de_cardio CHECK (tipo_de_cardio IS NULL OR (modalidade = 'CARDIO'
  AND tipo_de_cardio IN ('ESTEIRA','BIKE','ELIPTICO','ESCADA','REMO','CORRIDA_AO_AR_LIVRE','NATACAO','OUTRO')));
```

  `DEFAULT` constante não reescreve a tabela (PG ≥ 11). Todas as linhas atuais têm `tipo_de_cardio` nulo e passam no
  CHECK. Trocar a modalidade de `CARDIO` para outra zera o tipo no serviço antes de gravar.
- Publicação: ver D14.

### Tipos TypeScript (já em `app/src/api/tipos.ts`)
- `ModoDeCardio`, `ProtocoloDeCardio`, `TipoDeRecuperacao`, `TipoDeCardio`, `MedidaDeCardio`.
- `Cardio` ganha os campos novos, **todos opcionais**: `CARDIO_VAZIO` e `copiarCardio` montam o objeto inteiro em arquivos de outras frentes.
- `Exercicio` ganha `tipoDeCardio?` e `medidasDeCardio?`; `ExercicioRequest` ganha `tipoDeCardio?` e `medidasDeCardio?`. Ficam opcionais até o P1 devolver os campos.

### Regras puras (já em `app/src/dominio/cardio.ts`, com 38 testes)
`PROTOCOLOS`, `definicaoDoProtocolo`, `modoDoBloco`, `protocoloDoBloco`, `blocoContinuo`, `padraoDoProtocolo`,
`avisoForaDaFaixa`, `fasesDoBloco` (sequência do timer), `tempoTotalDoBloco`, `tempoTotalDoCardio`, `minutosAproximados`,
`tempoCurto`, `resumoDoBloco` ("10 × 30 s / 30 s · ~20 min no total"), `resumoDaLista` ("SIT · 6 × 30 s · ~25 min",
"2 blocos · ~30 min", "Contínuo · 30 min"), `previaDoBloco`/`previaParaOAluno` ("SIT · 6 × 30 s all-out / 3 min · ~25 min";
o tipo da recuperação entra entre parênteses quando escolhido), `erroDoBloco`, `segundosDoTexto`, `ritmoTexto`,
`TIPOS_DE_CARDIO`, `MEDIDAS_DE_CARDIO` e `mostraMedida`.

## Passos

Cada passo tem dono exclusivo dos arquivos listados. Arquivo compartilhado fora da lista volta ao coordenador.

**Aceite comum (a armadilha de perda de dado):** o protocolo, o aquecimento e o esforço máximo de um bloco **sobrevivem**
a salvar o rascunho, a editar outro campo, a copiar para outro aluno, a replicar, a virar modelo e a passar pelo pacote
offline. Em Java, todo `new Cardio(` com os 11 componentes precisa receber os campos novos. No app, `copiarCardio` e
`serieNormalizada` precisam copiá-los.

- [x] 0. Contrato, regras puras e tipos: este plano, `dominio/cardio.ts` e `cardio.test.ts` (38 testes) e `api/tipos.ts` — commit/run: — (sem commit; jest, eslint e tsc verdes em 27/11)
- [ ] P1. API (só `api/`):
  - `ConteudoTreino.Cardio` (componentes novos, construtor antigo, `problemas()` da tabela acima), mais os enums.
  - Os `new Cardio(` de `IndiceVersao`, `TiposDaMetodologia`, `ValidadorTreino` e dos testes.
  - `Exercicio` (colunas e enums), `BibliotecaDtos`, `BibliotecaService` (D12, D13) e `PlanoTreinoService.equipamentoDe` (D14).
  - `V199`, o total 110 → 111 nos dois testes e a linha da V199 no `AGENTS.md` (o coordenador aplica).
  - Testes: `ValidadorTreinoTest`, com os casos espelhados de `cardio.test.ts`, incluindo o legado sem `modo`; um teste de integração da biblioteca (criar e editar cardio; grupo e equipamento nulos; modalidade trocada zera o tipo); um teste de JSON: plano antigo sai sem chave nova; publicação com tipo vira equipamento; e protocolo que sobrevive a copiar para outro aluno e a replicar.
  - `mvn verify` — commit/run: —
- [ ] P2. Editor de treino (`app/src/treinador/treino/*`, **depois** que o agente das séries liberar `EditorSeries`, `CamposDaPrescricao`, `TabelaDeBlocos`, `InspetorDoExercicio` e `CartaoExercicio`; também `dominio/editorTreino.ts`, `dominio/inspetorDoTreino.ts` e `dominio/validacaoDeSerie.ts`):
  - O inspetor do cardio deixa de ter tabela de séries. No lugar, a seção "PRESCRIÇÃO DO CARDIO" com o segmento Contínuo · Intervalado.
  - Contínuo: os campos com `mostraMedida`. Intervalado: o select de protocolo com o ⓘ (`definicao` + "Saiba mais" na seção da Ajuda), os campos com `segundosDoTexto`, o resumo `resumoDoBloco` e o aviso `avisoForaDaFaixa` (não bloqueia).
  - O erro aparece só no campo (`erroDoBloco` no lugar de `problemasDoCardio` quando há `modo`), sem selo repetido no cabeçalho, na lista ou na linha.
  - "+ Novo bloco de cardio" é a última linha tracejada; o resumo no cabeçalho vem de `resumoDaLista`.
  - Rodapé com "Para o aluno" (`previaParaOAluno`), "Excluir cardio" (perigo) e "Fechar edição".
  - A lista à esquerda mostra o coração e `resumoDaLista`.
  - `novaSerieDeCardio` nasce com `blocoContinuo()`, e `copiarCardio`/`serieNormalizada` levam os campos novos (aceite comum).
  - Abrir um bloco antigo mostra o modo dado por `modoDoBloco`. O contínuo nunca grava `modo`. O intervalado antigo só passa a `modo: "INTERVALADO"` (e às regras novas) quando o treinador mexer nele. Nesse momento a duração, a distância e o ritmo antigos saem, e o editor avisa antes, se houver valor neles.
  - Specs e2e do editor e capturas — commit/run: —
- [ ] P3. App do aluno e timer (`app/src/aluno/*`, `offline/formatoDoPacote.ts` e o teste dele, `dominio/agrupamento.ts` (`textoCardio`), `aluno/serieDoAluno.ts`):
  - O `formatoDoPacote` aceita as chaves novas de `cardio` (enums conferidos, números pelo tipo).
  - `textoCardio` e `linhasDoCardio` usam `previaDoBloco` quando há `modo`, e o legado segue igual. Isso também cobre o PDF, que passa pelo `resumoDaSerie`.
  - O cartão mostra o protocolo e os blocos.
  - O timer do intervalado segue `fasesDoBloco`: contagem regressiva do estímulo e da recuperação, volta atual "3 de 10", `vibrar` na troca de fase e `useTelaAcesa`. O estilo é o da `BarraDescanso`, e o relógio vem de `dominio/descanso`, sem `setInterval` novo fora do padrão da barra.
  - O timer só existe no aparelho, sem registro novo na API: o aluno continua só marcando "feito".
  - Specs e capturas do aluno — commit/run: —
- [ ] P4. Biblioteca, Escolher cardio e Ajuda (`treinador/biblioteca/*`, a folha "Escolher cardio" (arquivo novo ao lado da `FolhaBiblioteca`, **depois** que o agente da Biblioteca liberar `FolhaBiblioteca`/`EscolhaDoExercicio`) e `ajuda/conteudo.ts` com o teste):
  - Com Modalidade = Cardio, somem "Grupo muscular" e "Equipamento" e aparecem "Tipo de cardio" (`TIPOS_DE_CARDIO`) e "Medidas que fazem sentido" (`MEDIDAS_DE_CARDIO`).
  - A folha "Escolher cardio" usa a mesma peça da "Escolher exercício", com filtro `modalidade=CARDIO`, escolha **única** e "+ Usar 'texto' como cardio manual".
  - A Ajuda ganha a seção "Cardio e HIIT", com as 4 categorias (as definições de `PROTOCOLOS`), e o id dela é o alvo do "Saiba mais" do ⓘ — commit/run: —
- [ ] P5. PDF, exportação e modelos:
  - Conferir `pdf/pdfTreino.ts` e `pdf/exemplos.ts` (um exemplo com SIT), o PDF do aluno e o do treinador (o texto vem do P3).
  - Exportação: o JSON do plano sai inteiro, sem mudança esperada; só conferir.
  - Modelos e receitas padrão (`SemanasPadrao`, `receitas-padrao/semanas/*.json`) só têm o texto antigo e não mudam.
  - `importarTreinoDeTexto` continua gerando o formato antigo, que é válido (melhoria opcional fora do escopo) — commit/run: —

## Critérios de aceite
- Plano antigo com contínuo ou intervalado publica, replica e chega ao aluno como antes, sem nenhuma chave nova no JSON. O contínuo salvo pelo editor novo também sai sem chave nova.
- Os exemplos do pedido saem literais: "10 × 30 s / 30 s · ~20 min no total", "SIT · 6 × 30 s · ~25 min", "SIT · 6 × 30 s all-out / 3 min · ~25 min", "2 blocos · ~30 min" e "Fora da faixa do SIT (estímulo de 20 a 30 s)".
- O servidor recusa com o mesmo campo e o mesmo texto do app e **não** recusa fora da faixa.
- O aceite comum dos passos (a armadilha de perda de dado).
- Capturas em 1280 e 390, escuro e claro: cardio contínuo, os 4 protocolos, um fora da faixa, o cardio na lista do editor, o Novo exercício com Cardio e o timer do aluno.

## Plano de e2e
**Suíte completa**: o lote mexe no contrato da API, numa migration, no editor e no app do aluno (regra do `AGENTS.md`). No
mínimo, specs novas ou ajustadas:
- editor: cardio contínuo com erro único no campo; cada protocolo preenche os padrões; aviso fora da faixa; dois blocos e o resumo na lista;
- biblioteca: Novo exercício com Cardio e os campos trocados;
- folha Escolher cardio, com escolha única e o manual;
- aluno: prévia do protocolo e timer (passo de fase com relógio falso, "3 de 10");
- `ver-como-aluno` com o cardio.

Mais `typecheck`, `lint`, `jest` e `mvn verify`.

## Fora do escopo
- Estimar o tempo do contínuo pela distância × ritmo (o ritmo é texto livre). Contínuo só com distância fica sem total (D6).
- Registrar o timer ou o tempo real do cardio na API. O aluno continua marcando só "feito".
- Preencher em massa o `tipo_de_cardio` dos cardios existentes pelo nome.

## O que ficou para trás
- (nada ainda)
