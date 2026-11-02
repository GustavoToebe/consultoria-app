# Datas válidas (faixa por tipo de campo, atraso com teto) e dois ajustes de texto

Situação: Concluída (PR #38, mesclado em 02/11/2026) · Onde: branch `datas-validas` (worktree `wt-datas-validas`) · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C76 (mais C68 e C54) · Frente A da leva 1

## Objetivo
Na reunião de 30/10, a conta de teste do treinador ficou com pastas e atualizações no ano 0260/0261, e o aluno via
"Atualização atrasada há 644943 dias" no Início, no Treino e no seletor. Cada data passa a ter a faixa que faz sentido
**no lugar onde é digitada** (e a mesma regra na API), e o atraso exibido ganha um teto. Na mesma frente, dois ajustes
de texto: o convite da equipe (C68) e o "Outros" da dieta (C54).

## O que o código faz hoje (main 19b1fd6)
- `app/src/dominio/formatos.ts:19` `dataDaTela`: exige `dd/mm/aaaa` e confere se a data existe; aceita os anos 0100 a
  9999. Não tem regra de passado nem de futuro. `mascaraData` só é usada em `ui/Campos.tsx:42`.
- `api/.../pastas/PastaService.java:210` `exigirPeriodo`: só confere se o fim vem depois do início.
- `app/src/dominio/atualizacao.ts:14`: `diasDeAtraso = max(0, -diasParaPrazo)`, sem teto (e o espelho `RegrasAtualizacao`).
- O caminho que gerou 0260 não foi reproduzido. Suspeita: editar o ano no campo com `mascaraData`.
- `dominio/ergogenicos.ts:56` e `pdf/pdfDieta.ts:177` mostram concentração e apresentação da biblioteca ao aluno.

## Decisões (Gustavo, 02/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde mora a faixa | regra por tipo de campo, em `dominio/` (`dataNaFaixa`), fora de `dataDaTela`, espelhada na API por um validador comum | Gustavo |
| D2 | **Planejamento**: início e fim da pasta, renovar ou copiar período, aplicar modelo com período, compromisso, evento e o "até" da repetição, retorno de interessado, nova data da atualização, filtros de período | de 01/01/2000 até 31/12 do ano atual + 5 | Gustavo |
| D3 | **Registro**: peso, avaliação física, lesão, finalizar pasta | de 1900 até hoje; futuro não | Gustavo |
| D4 | **Nascimento e pergunta DATA** do questionário | 1900 até hoje com `somentePassado`; sem ele, até o ano atual + 5 | Gustavo |
| D5 | Atraso acima de 365 dias | mostrar "Atrasada desde dd/mm/aaaa" em vez de contar os dias (`dominio/atualizacao.ts` e `RegrasAtualizacao`) | Gustavo |
| D6 | Mensagem de erro | no próprio campo (app). Na API: **campo de corpo (formulário)** = 422 que diz o campo e **não repete o valor**; **filtros de período `de`/`ate` (query: atualizações, auditoria, importações, interessados)** = 400 `PERIODO_INVALIDO`, o código que já existia, só com a faixa nova, e a mensagem diz qual parâmetro veio errado ("Data inicial" ou "Data final") sem repetir o valor (revisada em 02/11/2026) | Gustavo |
| D7 | Datas ruins já gravadas em produção | não corrigir nem contar sem ordem do Gustavo | Gustavo |
| D8 | C68 | o botão "Gerar convite" da equipe deixa claro que o e-mail já foi enviado e que o link é só para copiar se precisar | Gustavo |
| D9 | C54 | em "Outros", o aluno e o PDF da dieta mostram só a dose prescrita; concentração e apresentação ficam na biblioteca e no editor do treinador | Gustavo |

Campos que o Gustavo não classificou (financeiro: contratação, lançamento, baixa; ciclo menstrual; os dois "a conferir"
`CartaoPastas.tsx:396` e `dieta/EditorDeDieta.tsx:462`): o passo 1 os classifica numa das três regras acima; a baixa do
financeiro segue "registro" (já é não futura) e o ciclo só muda se for preciso, pois o calendário já bloqueia dia futuro.
O que ficar fora das três regras é anotado aqui antes do código.

## Passos
Andamento em 02/11/2026 (worktree `wt-datas-validas`, branch `datas-validas`): passos 2 a 6 feitos no commit 677d5b2c. Passo 7 feito (commit 26200904 e guias no commit seguinte). Passo 8 feito (revisão do Opus por `revisor`, ajustes aplicados).

- [x] 1. Listar **todos** os usos de `dataDaTela` e das datas na API (explorador) e classificar cada um em Planejamento, Registro ou Nascimento/DATA — explorador — feito em 02/11/2026 (sem commit; só leitura)
- [x] 2. Reproduzir como o 0260 entrou (editar o ano com `mascaraData`) e cobrir com teste — executor — commit: 677d5b2c
- [x] 3. Regra pura `dataNaFaixa` em `dominio/` com teste; cada campo chama com a sua faixa e mostra a mensagem no próprio campo — executor — commit: 677d5b2c
- [x] 4. API: o mesmo validador comum nas rotas dos três grupos, 422 com o campo e sem o valor; teste de integração por rota — executor — commit: 677d5b2c
- [x] 5. Teto do atraso: "Atrasada desde dd/mm/aaaa" acima de 365 dias, no app e em `RegrasAtualizacao` — executor — commit: 677d5b2c
- [x] 6. C68 (texto do "Gerar convite") e C54 (dose prescrita em "Outros" no aluno e no PDF da dieta) — executor-rapido, revisado pelo Sonnet — commit: 677d5b2c
- [x] 7. Ajuda (`ajuda/conteudo.ts`: verbete "Datas" em Pastas de plano, "Lesões e peso" e "Convidar um membro"), `AGENTS.md` só no item da atualização/datas, e2e dos campos mexidos (390 e 1280 px: `datas-validas.spec.ts` novo com peso, lesão e avaliação física; casos novos em `pasta-periodo`, `pasta-e-atualizacao` (finalizar), `agenda-presencial` e `anamnese` (nascimento 1960); a data do peso de `pasta-e-atualizacao` saiu de 31/10/2026 para 15/03/2025, porque o registro não aceita o futuro) e guias PDF regerados — feito em 02/11/2026: typecheck, lint e jest (219 suítes, 3429 testes) verdes, e2e dos cinco specs 44/44, `mvn verify` 1921 testes sem falha — commit: 26200904 (código, Ajuda, AGENTS.md, e2e) e o seguinte (guias PDF)
- [x] 8. Revisão do **Opus** (contrato da API) antes do PR — agente `revisor` (Opus, leitura; o `advisor` só enxerga a conversa e não lê os diffs) — feito em 02/11/2026. Apontou: (1) teste esperando 422 em filtro de período, que a decisão D6 manda ser 400; (2) `/inscricoes/indicadores` aceitava datas fora da faixa; (3) aviso quando o e-mail do convite não foi enviado (C68) e texto "enviado na hora" sem condição; (4) textos do `AGENTS.md`. Resolvido: teste corrigido para 400 e `/inscricoes/indicadores` entrou no laço dos filtros, faixa aplicada em `IndicadoresDeInscricoes`, `UsuariosEquipe.tsx` e `AGENTS.md` ajustados; `mvn verify`, jest, typecheck e lint verdes depois dos ajustes — commit: ver o commit de fechamento da frente

## Critérios de aceite
- Ano 0261 recusado em pasta, agenda, peso e lesão, com mensagem no campo, em 390 e 1280 px.
- Peso, lesão e avaliação com data futura recusados; nascimento de 1960 aceito.
- Atraso de 2 anos aparece como "Atrasada desde dd/mm/aaaa".
- Aluno e PDF da dieta mostram só a dose prescrita em "Outros".

## Arquivos em comum com outras frentes
- `CartaoPastas.tsx` (A: campos de data; D: menu ⋯ e Finalizar), `ajuda/conteudo.ts`, `app/public/guias/*.pdf` e o `AGENTS.md`.
  Quem entrar depois faz `git merge origin/main`, resolve e **regera os guias** (PDF binário não se mescla).

## Fora do escopo
- Corrigir ou contar datas ruins em produção (D7).

## O que ficou para trás
- Data de início da dieta validada só no app (`dominio` e `EditorDeDieta`); o `ValidadorDieta` da API está fora desta entrega.
- Importação por planilha tem faixa própria (até 2040), fora das três regras.
- O calendário da agenda navega de 2000 a 2100: ocorrências depois do teto de planejamento (ano+5) aparecem, mas não são editáveis.
- `hojeIso` do app usa o fuso do aparelho e a API usa Brasília: perto da meia-noite, o "hoje" dos dois pode divergir em um dia.
- Dados ruins já gravados (D7) não foram tocados: uma atualização com data 0260 mostrará "Atrasada desde dd/mm/0261", o que é esperado.
- Atraso: `desdeQuandoAtrasou` ainda sai de `prazoAtualizacao` (pode divergir da data original em atualização com "vou atrasar").
- `paraFazer.ts:44` e o teste `atualizacao.test.ts:126` (tautológico) não foram revistos.
- `hojeEmBrasilia()` em `datasValidas.ts` não tem teste próprio de virada de dia.
- C54: `concentracao` continua no JSON do aluno (só a tela e o PDF deixaram de mostrar); decidir se a API também omite.
