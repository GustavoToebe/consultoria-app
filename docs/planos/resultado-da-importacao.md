# Resultado da importação da planilha completa legível

Situação: Em andamento · Onde: `main` (working tree, sem commit) · Atualizado: 23/11/2026

## Objetivo
O detalhe de uma importação da "Planilha completa" no histórico (Importação › Histórico › abrir) passa a dizer em três
segundos o que entrou, o que entrou de outro jeito e o que ficou de fora, agrupado por aba, com a lista inteira para
copiar e corrigir a planilha. Também investiga os nomes de aba que apareceram como "Refei????es".

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Folha | `LARGURA_FOLHA_LARGA` (800 px) só no detalhe da planilha completa; o selo da situação sai do topo e fica sob o título, com a data e o arquivo. Os outros destinos não mudam | Gustavo, 23/11 |
| 2 | Resumo | Três `CartaoDeIndicador` numa `GradeDeIndicadores minimo={211}`: registros criados (`sucesso`), linhas com ajuste (`atencao`), linhas que ficaram de fora (`perigo`); zero fica neutro | Gustavo, 23/11 |
| 3 | Contagem | Por linha da planilha (aba + linha distintas), não por problema; linha com algum problema "de fora" conta só como "de fora" | Claude, 23/11 |
| 4 | Classificação | Pelo código que a API já grava (`<aba>: <CÓDIGO>`), em `dominio/resultadoDaPlanilha.ts`: "Ficou de fora" quando o código diz que a linha (ou o bloco) não entra (`continue` na montagem da API); "Ajustado" quando a linha entra sem um campo, com o campo "—", cortada ou com o padrão. Código desconhecido = "Ajustado". Todo código de `PROBLEMAS` tem classe (teste) | Gustavo (regra), Claude (tabela), 23/11 |
| 5 | Tabela | Uma seção recolhível por aba (`Cartao recolhivel`, nasce fechada pela regra de 18/11; aberta quando só há uma aba), título com a contagem; `Tabela` Problema, O que aconteceu (selo), Linhas; 8 linhas + "e mais N" que mostra todas | Gustavo, 23/11 |
| 6 | Copiar | "Copiar lista de problemas": texto simples por aba, com todas as linhas guardadas (`textoDaListaDeProblemas`), sem mudança de API | Gustavo, 23/11 |
| 7 | Desfazer | Botão `perigo`; a confirmação repete o que vai e o que fica (o texto de hoje) e que não dá para voltar. Regra do desfazer sem mudança | Gustavo, 23/11 |
| 8 | Teto do histórico | A API guarda até 1.000 problemas (`GravacaoDaPlanilha.ERROS_GUARDADOS`) e `comErro` é o total de problemas: acima disso a tela e o texto copiado avisam quantos ficaram sem detalhe | Claude, 23/11 |

## Passos
- [x] 1. Diagnóstico do "Refei????es" (3a): leitor do `.xlsx`, gravação em `jsonb`, banco e app conferidos, sem perda de acento (ver abaixo) — commit/run: —
- [x] 2. Regra pura `dominio/resultadoDaPlanilha.ts` + `resultadoDaPlanilha.test.ts` (abas "Refeições" e "Histórico Pesos") — commit/run: —
- [x] 3. Tela: `planilhaCompleta/NoHistorico.tsx` (`DetalheDaPlanilha`), `planilhaCompleta/ResultadoPorAba.tsx` e a largura/selo do `FolhaDetalhe` em `TelaImportacao.tsx` — commit/run: —
- [x] 4. E2e em 390 e 1280: `e2e/importacao-planilha-completa.spec.ts` (todos verdes em 23/11; `importacao-assistida` e
  `importacao-modal` seguem falhando como no HEAD, por mocks desatualizados) — commit/run: —
- [ ] 5. Commit e entrada no `docs/planos/README.md` (sessão principal) — commit/run: —

## Diagnóstico do 3a (23/11)
- Leitor: `LeitorDePlanilha` lê `xl/workbook.xml` por StAX a partir dos bytes (a codificação vem da declaração XML). Rodado
  o leitor compilado num programa descartável com abas "Refeições" e "Histórico Pesos": nomes iguais, código a código.
- Gravação: `GravacaoDaPlanilha.erros` monta `"<aba>: <CÓDIGO>"` e grava com Jackson numa coluna `jsonb`; Jackson ida e volta
  mantém os acentos. Banco local `UTF8` (conferido). O de produção não foi conferido: pela leitura do deploy, nasce de
  `postgres:18.6-alpine` (locale `en_US.utf8`) por `CREATE DATABASE` sem `ENCODING`, então deve ser `UTF8` (inferência).
  A ida e volta pelo `jsonb` não foi exercitada (o banco local está na V006).
- API: nenhuma conversão para ASCII/ISO-8859-1 nem `new String(bytes)` sem charset no caminho (`api/src/main` inteiro).
- App: `fetch().json()`, sem decodificação própria; os textos acentuados do app aparecem certos na mesma folha.
- Padrão: cada letra acentuada virou exatamente `??` (os dois bytes UTF-8 lidos como um byte cada e escritos em ASCII). Isso
  acontece fora do código, quando o nome da aba já chega assim no arquivo (planilha gerada por script que leu UTF-8 como
  ANSI) ou num console que mostra o JSON. Conferência decisiva: o JSON cru de `GET /importacoes/{id}` na aba Rede do
  navegador; se já vier com `??`, o nome foi gravado assim a partir do arquivo.
- Proposta para a API (não aplicada): caso no `LeitorDePlanilhaTest` com as abas "Refeições" e "Histórico Pesos".

## Fora do escopo
- Mudança de API (contagem por linha no servidor, mais de 1.000 problemas guardados).
- `ProblemasAgrupados` da prévia (etapa 4 do assistente) continua como está.

## O que ficou para trás
- Teste do leitor com abas acentuadas na API (diff proposto no relatório), se o Gustavo quiser.

## Nome de aba "Refei????es" (23/11/2026)
- Teste de integração `NomesDeAbaIntegrationTest` (planilha fictícia): a API devolve o nome de aba exatamente como está no arquivo, com acento certo ("Refeições") ou com "?" literal ("Refei????es"); a aba com "?" continua reconhecida como dieta pelos títulos das colunas. Os 4 "?" batem com os bytes UTF-8 de "çõ" convertidos um a um: o arquivo já veio com a codificação errada, não é defeito da API nem da tela.
- Detecção segura: o Excel não aceita "?" em nome de aba, então qualquer nome com "?" indica arquivo gravado ou convertido errado. A tela mostra o aviso "Os nomes de aba deste arquivo vieram com caracteres inválidos. Salve a planilha de novo no Excel e importe." na etapa das abas e no resultado (`dominio/planilhaCompleta.ts`: `temNomeDeAbaInvalido`, `AVISO_NOME_DE_ABA_INVALIDO`).
