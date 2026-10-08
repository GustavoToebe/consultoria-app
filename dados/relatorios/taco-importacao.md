# Importação da TACO — relatório

GERADO por `scripts/catalogo/gerar_taco.py`. Não editar à mão.

- Fonte: NEPA/UNICAMP. Tabela Brasileira de Composição de Alimentos – TACO. 4. ed. rev. e ampl. Campinas: NEPA/UNICAMP, 2011.
- Planilha: `dados/fontes/taco/Taco-4a-Edicao.xlsx` (sha256 `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14`).
- Alimentos na planilha: **597**. Entram no catálogo: **591**. Descartados: **6**.

## Marcadores gravados como 0

`Tr` (traço) e `NA` (não aplicável) viram 0; `Tr` fica registrado em `tracos` e a tela mostra "Tr".

| Nutriente | Tr | NA |
|---|---|---|
| kcal | 0 | 2 |
| proteina | 6 | 10 |
| gordura | 30 | 2 |
| carboidrato | 0 | 10 |

Alimentos com a energia `NA` (gravada como 0 kcal, conforme a legenda da planilha): 516 Sal, dietético, 517 Sal, grosso.

## Resíduos negativos gravados como 0

O carboidrato é calculado por diferença e, em alguns alimentos, sobra um resíduo negativo minúsculo (até -0,05 g). O PDF imprime 0,0; gravamos 0. Abaixo de -0,05 o alimento seria descartado.

| Nº | Alimento | Valor na planilha |
|---|---|---|
| 288 | Corimba, cru | carboidrato -0.0267 |
| 322 | Tucunaré, filé, congelado, cru | carboidrato -0.0450 |
| 337 | Carne, bovina, capa de contra-filé, sem gordura, grelhada | carboidrato -0.0067 |
| 400 | Frango, fígado, cru | carboidrato -0.0233 |

## Descartados

Valor sem análise, em branco ou impossível: o alimento fica fora do catálogo (nunca vira zero).

| Nº | Alimento | Grupo | Motivo |
|---|---|---|---|
| 450 | Iogurte, sabor abacaxi | Leite e derivados | kcal: '*' (análise sendo reavaliada, segundo a legenda); proteina: '*' (análise sendo reavaliada, segundo a legenda); gordura: '*' (análise sendo reavaliada, segundo a legenda); carboidrato: '*' (análise sendo reavaliada, segundo a legenda) |
| 457 | Leite, de vaca, desnatado, UHT | Leite e derivados | kcal: '*' (análise sendo reavaliada, segundo a legenda); proteina: '*' (análise sendo reavaliada, segundo a legenda); gordura: '*' (análise sendo reavaliada, segundo a legenda); carboidrato: '*' (análise sendo reavaliada, segundo a legenda) |
| 458 | Leite, de vaca, integral | Leite e derivados | kcal: '*' (análise sendo reavaliada, segundo a legenda); proteina: '*' (análise sendo reavaliada, segundo a legenda); gordura: '*' (análise sendo reavaliada, segundo a legenda); carboidrato: '*' (análise sendo reavaliada, segundo a legenda) |
| 472 | Cana, aguardente | Bebidas (alcoólicas e não alcoólicas) | proteina: campo vazio na planilha (análise não solicitada); gordura: campo vazio na planilha (análise não solicitada); carboidrato: campo vazio na planilha (análise não solicitada) |
| 540 | L | Outros alimentos industrializados | nome inválido na planilha ('L'); fica de fora |
| 591 | Coco, verde, cru | Nozes e sementes | kcal: '*' (análise sendo reavaliada, segundo a legenda); proteina: '*' (análise sendo reavaliada, segundo a legenda); gordura: '*' (análise sendo reavaliada, segundo a legenda); carboidrato: '*' (análise sendo reavaliada, segundo a legenda) |

## Conferência com o PDF oficial

PDF: sha256 `2002aec5615b5b1395aaa8fa675635bbb7f712c33f278af5e332f1cac8f108c8` (TACO 4ª ed., 2011, Tabela 1). Compara energia, proteína, lipídeos e carboidrato de cada alimento: o valor da planilha, arredondado como o PDF imprime (kcal inteiro, gramas com 1 casa), precisa ser igual ao impresso; `Tr`/`NA`/`*` precisam coincidir. Nada foi corrigido: a planilha oficial vale e o Gustavo decide.

- Alimentos com a linha inteira lida do PDF e conferidos: **578**.
- Divergências: **0**.
- Não conferidos por leitura do PDF: **19** (ver abaixo).
- Nomes diferentes entre planilha e PDF: **1**.

### Divergências

_Nenhum._

### Nomes diferentes

| Nº | Planilha | PDF |
|---|---|---|
| 540 | L | Feijoada |

### Não conferidos

| Nº | Alimento | Motivo |
|---|---|---|
| 259 | Azeite, de dendê | linha do PDF com colunas em branco; posição dos valores incerta |
| 260 | Azeite, de oliva, extra virgem | linha do PDF com colunas em branco; posição dos valores incerta |
| 267 | Óleo, de babaçu | linha do PDF com colunas em branco; posição dos valores incerta |
| 268 | Óleo, de canola | linha do PDF com colunas em branco; posição dos valores incerta |
| 269 | Óleo, de girassol | linha do PDF com colunas em branco; posição dos valores incerta |
| 270 | Óleo, de milho | linha do PDF com colunas em branco; posição dos valores incerta |
| 271 | Óleo, de pequi | linha do PDF com colunas em branco; posição dos valores incerta |
| 272 | Óleo, de soja | linha do PDF com colunas em branco; posição dos valores incerta |
| 387 | Croquete, de carne, cru | linha do PDF com colunas em branco; posição dos valores incerta |
| 388 | Croquete, de carne, frito | linha do PDF com colunas em branco; posição dos valores incerta |
| 442 | Quibe, frito | linha do PDF com colunas em branco; posição dos valores incerta |
| 472 | Cana, aguardente | linha do PDF com colunas em branco; posição dos valores incerta |
| 513 | Fermento em pó, químico | linha do PDF com colunas em branco; posição dos valores incerta |
| 516 | Sal, dietético | linha do PDF com colunas em branco; posição dos valores incerta |
| 517 | Sal, grosso | linha do PDF com colunas em branco; posição dos valores incerta |
| 519 | Tempero a base de sal | linha do PDF com colunas em branco; posição dos valores incerta |
| 537 | Estrogonofe de carne | linha do PDF com colunas em branco; posição dos valores incerta |
| 538 | Estrogonofe de frango | linha do PDF com colunas em branco; posição dos valores incerta |
| 548 | Sarapatel | linha do PDF com colunas em branco; posição dos valores incerta |

