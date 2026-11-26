# Importação: mais rápida, mais certeira e com entrada única (26/11)

Situação: Pronto, sem commit · Onde: `main` (sem push até o Gustavo pedir) · Atualizado: 26/11/2026

## Objetivo
Importar fica mais fácil e erra menos. Na assistida: lê vários arquivos ao mesmo tempo, manda à IA um pedido mais preciso (planilha com cabeçalho, mais campos) e resolve termos de uma vez. Na manual: o app reconhece o arquivo, sugere a trilha, o destino, a linha do cabeçalho e as colunas, e a gravação é feita em lote.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Blocos desta rodada | 1. Assistida rápida, 2. Assistida certeira, 3. Manual esperta, 4. Manual rápida | Gustavo, 26/11 |
| D2 | Entrada da importação manual | Entrada única: escolhe o arquivo e o app segue pela planilha completa (várias abas reconhecidas) ou por uma aba (destino sugerido); as duas trilhas continuam por dentro | Gustavo, 26/11 |
| D3 | Excel antigo (.xls) | Não aceita; a tela pede "Salve como .xlsx no Excel e envie de novo" | Gustavo, 26/11 |
| D4 | Releitura do arquivo a cada etapa da manual | Fica (zip + StAX de até 900 KB é barato; guardar o arquivo no servidor entre etapas seria dado pessoal parado). O custo real é a gravação linha a linha | Sessão, 26/11 |
| D5 | Reconhecimento do arquivo (`POST /importacoes/reconhecer`) | Devolve só tipos de aba, destino sugerido, linha do cabeçalho e contagens; nunca valor de célula, como o diagnóstico | Sessão, 26/11 |

## Passos
- [x] 1. Assistida rápida: arquivos em paralelo, tempo limite coerente (tela × provedor), uma nova tentativa em falha passageira, cache do prefixo do pedido no Claude, progresso "Lendo N de M" — commit: — (local, sem commit); testes `RoteadorInterpretadorIaTest`, `ImportacaoAssistida*Test`
- [x] 2. Assistida certeira: formato rígido no pedido (schema da ferramenta), técnica, cadência, água e modo de preparo; planilha enviada com o cabeçalho; aviso do que foi cortado por limite e motivo da leitura por regras; "Aceitar todas as sugestões"; aviso do .xls — commit: — (local); chamada real ao Claude **não testada** (fica com o Gustavo)
- [x] 3. Manual esperta (API): `POST /importacoes/reconhecer`; `/colunas` com linha do cabeçalho detectada e sugestão de mapeamento por sinônimo e semelhança — commit: — (local); testes `SugestaoDeColunasTest`, `ReconhecimentoDoArquivoTest`, `ImportacaoIntegrationTest`
- [x] 4. Manual rápida: gravação em lote, sem flush por linha, pesos existentes lidos de uma vez — commit: — (local); teste `ImportacaoEmLoteIntegrationTest`
- [x] 5. Entrada única no app (tela) usando o passo 3 — commit: — (local); e2e da importação 95/95 em 26/11 (API simulada)
- [x] 6. Verificações: `mvn clean verify` de 26/11 (árvore com esta frente e a do contrato digital, sem commit): 3.521 testes, todos os da importação verdes; 2 falhas fora daqui (`PrivacidadeIntegrationTest`, seção `contratos` da outra frente; `ComunidadeOrganizadaIntegrationTest`, ordem do mural); JaCoCo não rodou porque a fase de testes falhou. App: typecheck, lint e jest verdes antes do lote final; e2e da importação 95/95

## Fora do escopo
- OCR de PDF escaneado; leitura de .xls; guardar o arquivo entre etapas.

## O que ficou para trás
- Teste real com o Claude (Haiku 5.5): pedido com schema, `tool_choice` forçado, cache do `system` e campos novos só foram conferidos contra a documentação. Responsável: Gustavo, importando 2 arquivos numa sessão da assistida com a IA ligada.
- Gemini sem `responseSchema` (só o Claude ganhou o formato rígido).
- Gravação da planilha completa (`GravacaoDaPlanilha`) ainda grava item a item; só a importação de uma aba ficou em lote.
- Destino sugerido pelo reconhecimento não é filtrado pela permissão (o 403 aparece ao seguir).
- Duas abas do mesmo tipo dão trilha `DESCONHECIDA`; CSV com título acima de um cabeçalho com vírgula não é detectado.
- Pior caso da assistida: ~11 min por arquivo antes de cair nas regras; o primeiro lote de 3 arquivos em paralelo não aproveita o cache.
