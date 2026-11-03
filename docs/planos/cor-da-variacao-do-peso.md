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
- [x] 4. Telas: campo na Marca e na ficha, cor na lista do peso, no Histórico do aluno e no "Peso anterior", linha de explicação (D4) — executor-front — commit: o `wip:` da passagem de 03/11 (ver Passagem)
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

## Passagem (03/11, noite)
Trabalho parado a pedido do Gustavo para passar ao Claude da nuvem. Branch `cor-da-variacao-do-peso`, saiu da main `2320c1e8`; **ainda sem `git merge origin/main`** e sem PR.

**Prontos (com commit):**
- Passos 1 a 3 e a API do passo 5: `3f3e9e2f` (V052, meta da consultoria e do aluno, efetiva nas rotas de peso, exportação, anonimização, auditoria; `MetaDoPesoIntegrationTest`) e `87b7217a` (regra pura `dominio/corDaVariacaoDoPeso` com jest, tipos, `acoesAuditoria.ts`).
- Mudança pedida pelo Gustavo na D2 (PUT da ficha como o sexo): `b5eddaa7`.
- Passo 4 e o app do passo 5: no commit `wip:` desta passagem (Marca, ficha, `CartaoPeso`, `VariacaoDoPeso`, `ResumoDaAtualizacao`, PDF da dieta, Ajuda, `AGENTS.md`, `e2e/cor-da-variacao-do-peso.spec.ts`, regra `dominio/metaDoPesoNaFicha` com jest).

**Pela metade / falta:**
- Guias PDF não regerados (`node scripts/guias/gerar.mjs` na raiz; a Ajuda mudou em `app/src/ajuda/conteudo.ts`). Regerar depois do merge da main (a C, PR #42, também mexe na Ajuda).
- `git merge origin/main` (traz a E já na base e a C, se o #42 entrar antes; conflitos prováveis: `AGENTS.md`, `ajuda/conteudo.ts`, `docs/planos/README.md`, guias).
- Passo 6: revisão do Opus (LGPD e permissão) não feita.
- Linha da F no `docs/planos/README.md` ainda diz "Planejando".

**Última verificação de cada uma:**
- `mvn verify`: passou no código de `b5eddaa7` (exit 0; `MetaDoPesoIntegrationTest` 12 testes, 0 falhas). A rodada completa anterior, em `3f3e9e2f`: 1975 testes, 0 falhas.
- typecheck e lint: passaram (código do `wip:`).
- jest: 225 suítes, 3554 testes, todos passaram; depois disso só a Ajuda mudou e o teste dela passou.
- e2e (porta 8103): `cor-da-variacao-do-peso` 26/26 (cor nos três temas em 390 e 1280, Marca, ficha com meta própria e "Padrão", sem `ALUNO_SENSIVEL_LER`); 18 specs existentes que tocam peso, ficha, atualização ou PDF, 178 testes, todos passaram (`abas-foco`, `acesso-aluno`, `anamnese`, `avaliacao-fisica`, `ciclo-menstrual`, `comparacao-de-fotos`, `datas-validas`, `dieta-opcoes-e-preparo`, `impressao-cancelada`, `impressao-emulada`, `pasta-e-atualizacao`, `peso-historico-aluno`, `cadastro-aluno`, `importacao-planilha-completa`, `importacao`, `lista-de-compras`, `visto-e-semana`, `foto-perfil-equipe`). Não rodou de novo: `peso-historico-aluno` depois da última mudança (só título e comentário).
- Revisão do Opus: não rodou.
- Nada disso foi rodado depois do merge da main (que ainda não foi feito).

**Decisões tomadas que não estavam no plano:**
- A meta efetiva vai em cada item da lista de pesos (`metaDoPeso` igual em todos; lista vazia não traz), em vez de embrulhar a lista: o Gustavo aprovou em 03/11.
- API: `PADRAO_DA_CONSULTORIA` existe só no pedido da ficha (`AlunoDtos.MetaDoPesoPedida`); a Marca o recusa com 400; valor inválido = 400; no `POST /alunos` ausente, nulo e `PADRAO_DA_CONSULTORIA` dão nulo; auditoria só quando o valor gravado muda.
- App: no cadastro de aluno novo, "Padrão" não é enviado (nasce nulo); na edição vai sempre o escolhido.
- O campo da ficha exige `ALUNO_SENSIVEL_LER` e `ALUNO_SENSIVEL_ALTERAR` (sem LER a meta lida não chega e o formulário abriria em "Padrão" por engano).
- O resumo da atualização busca `GET /alunos/{id}/pesos` só para a meta (chave própria, só com `ALUNO_SENSIVEL_LER` e só com variação; se falhar, a variação fica sem cor, sem erro). Quem ganha a cor é o bloco "Variação (kg)" (`▲ +1,2`, `▼ −0,7`, tom com uma casa decimal, como o número); a linha "Peso anterior" mostra só o peso.
- PDF da dieta: a coluna da variação diz "▲ +1,2 kg" (antes "+1,2"), com os tons de status do tema claro; a cor da marca saiu.
- A descrição do cartão Acompanhamento da Marca virou "Vale para os alunos sem ciclo ou meta própria no cadastro."; embaixo dos dois campos há uma frase explicando as cores.
- A meta entrou na chave do `CartaoPeso`: as cores mudam logo depois de salvar a ficha.
