# Cor na variação do peso, com a direção decidida pelo treinador

Situação: Em andamento · Onde: branch `cor-da-variacao-do-peso` · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C47 · Frente F, leva 2

## Objetivo
A variação do peso aparece em verde quando vai na direção da meta do aluno e em vermelho quando vai contra, e a direção
(reduzir ou aumentar) é do treinador, não do app. O app continua sem opinar sobre saúde: ele só pinta o que o treinador
decidiu.

## O que o código faz hoje
- A variação do peso é neutra (decisão D2 da Frente E, ver `historico-peso-do-aluno.md`): seta e sinal, sem cor de
  "bom ou ruim".
- Os mesmos cartões de peso são tocados pela Frente E (`CartaoPeso` e o Histórico do aluno); por isso o código desta
  frente só começa depois do merge da E.
- Ponto conhecido: o PDF da dieta (`pdf/pdfDieta.ts`, "Acompanhamento de peso") já pinta a variação positiva com a cor
  da marca, o que contraria a D2 da E. A F decide a cor do PDF junto com a das telas (passos 3 e 4).

## Decisões (Gustavo, 03/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Meta da consultoria | "Meta do peso dos alunos" em Marca › Acompanhamento (`MARCA_ALTERAR`): `REDUZIR` \| `AUMENTAR` \| `SEM_META`. Nasce `REDUZIR`; a migration preenche também as consultorias que já existem | Gustavo |
| D2 | Meta do aluno | "Meta do peso" na ficha: `REDUZIR` \| `AUMENTAR` \| `SEM_META` ou o padrão da consultoria. Na leitura, nulo = padrão da consultoria. No `PUT /alunos/{id}`, ausente ou nulo não mexe no gravado (como o sexo); para voltar ao padrão o cliente manda `PADRAO_DA_CONSULTORIA`, gravado como nulo (Gustavo, 03/11: um cliente que não conhece o campo não pode apagar a meta). A Marca só aceita os três valores. Lê com `ALUNO_SENSIVEL_LER` e grava com `ALUNO_SENSIVEL_ALTERAR` (como o objetivo). Entra na exportação; a anonimização e "Excluir minha conta" zeram | Gustavo |
| D3 | Cor | `REDUZIR`: queda verde e aumento vermelho; `AUMENTAR`: o contrário; `SEM_META` e variação zero: neutro. Tokens de status do tema (verde positivo, vermelho problema), contraste conferido nos três temas. Seta e sinal ficam: a cor nunca é a única informação | Gustavo |
| D4 | Explicação | Uma linha: no treinador "Cores pela meta: reduzir o peso"; no aluno "Verde: no caminho da sua meta" | Gustavo |
| D5 | Onde | Lista do peso na ficha, no Histórico do aluno e o "Peso anterior" do resumo da atualização. O gráfico continua neutro | Gustavo |
| D6 | Quem calcula | A meta efetiva (a do aluno ou, se nula, a da consultoria) vem pronta da API; o app só pinta | Gustavo |

## Passos
- [x] 1. Migration: `consultoria.meta_do_peso` (padrão `REDUZIR`, preenche as existentes) e `aluno.meta_do_peso` (nula); subir o total em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` — executor — commit: 3f3e9e2f
- [x] 2. API: ler/gravar a meta na Marca (`MARCA_ALTERAR`) e na ficha (`ALUNO_SENSIVEL_LER`/`ALTERAR`), `metaDoPeso` efetiva nas rotas de peso do treinador e do aluno, exportação, anonimização e excluir conta; auditoria com resumo fixo — executor — commit: 3f3e9e2f
- [x] 3. Regra pura da cor em `dominio/` (direção × meta → tom neutro/positivo/problema) com jest — executor — commit: 87b7217a
- [ ] 4. Telas: campo na Marca e na ficha, cor na lista do peso, no Histórico do aluno e no "Peso anterior", linha de explicação (D4) — executor-front — commit: —
- [ ] 5. Testes: integração (permissão, padrão, override, exportação, anonimização) e e2e em 390 e 1280 nos três temas; Ajuda, guias regerados e `AGENTS.md` só no item do peso — commit: —
- [ ] 6. Revisão do Opus (LGPD, permissão) antes do PR — advisor/revisor — commit: —

## Critérios de aceite
- Sem meta definida na ficha, vale a da consultoria; com meta na ficha, vale a do aluno; `SEM_META` e variação zero ficam neutros.
- Quem não tem `ALUNO_SENSIVEL_LER` não recebe a meta do aluno; quem não tem `ALUNO_SENSIVEL_ALTERAR` não a grava.
- A cor passa no contraste nos três temas e a informação nunca depende só dela (seta e sinal).

## Fora do escopo
- Cor no gráfico (continua neutro); sugerir meta ou opinar sobre o peso.

## O que ficou para trás
- —
