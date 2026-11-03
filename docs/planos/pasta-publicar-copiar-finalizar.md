# Pasta: publicar tudo, copiar a pasta para outro aluno, peso ao finalizar

Situação: Em revisão (PR #40) · Onde: branch `pasta-publicar-copiar` (worktree `wt-pasta`) · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C21, C25, C22 (mais a cópia da pasta inteira) · Frente D da leva 1

## Objetivo
A cada renovação, o treinador entra em cada plano só para publicar ("editar, não tem nada, só publico"). Passa a haver
um botão que publica os rascunhos da pasta de uma vez. Também passa a copiar a pasta inteira para outro aluno e a
finalizar a pasta com o peso já preenchido.

## O que o código faz hoje (main 19b1fd6)
- Cada plano é publicado no seu editor; não existe publicação conjunta.
- `CopiarPlanoService` copia **um** plano para outro aluno; a pasta inteira não.
- Finalizar pasta (`CartaoPastas.tsx:390`) começa com o peso vazio, por escolha; há aviso de substituição.
- A sobra do `?pastaId` está no README (pendência "Voltar à pasta").

## Decisões (Gustavo, 02/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | C21 "Publicar tudo" | na Folha da pasta; publica num passo os rascunhos de treino, dieta e mobilidade da pasta | Gustavo |
| D2 | Permissão | (revisada em 02/11/2026) a de publicar **só dos tipos que seriam publicados** (planos nunca publicados ou com rascunho alterado depois da última publicação), conferida **antes de qualquer efeito**; faltou alguma = 403 e nada é publicado; tipo sem alteração não pede permissão; nada para publicar = 200 com `publicados` vazio e os planos intactos em `pulados` (só dos tipos que a pessoa pode ler), sem versão nova nem auditoria. Na tela, o botão só desabilita quando falta a permissão de um tipo com alteração, com o motivo ("Falta permissão para publicar o treino"). Antes valia "cada tipo presente" | Gustavo |
| D3 | Atomicidade | valida todos antes: problema em um = nenhum publicado, com a lista por plano e o mesmo tratamento de `CONFIRMAR_AVISOS` | Gustavo |
| D4 | Versão e auditoria | cada publicação gera a sua versão imutável e a sua auditoria; plano sem rascunho alterado é pulado | Gustavo |
| D5 | Copiar a pasta para outro aluno | mesmas regras do `CopiarPlanoService`: o destino recebe tudo em **rascunho**, sem ergogênicos e sem o questionário escolhido | Gustavo |
| D6 | Recusas e permissões da cópia | outra consultoria = 404; destino anonimizado = 409; exige `PASTA_ALTERAR` + `ALUNO_LER` + o `*_ALTERAR` de cada tipo; auditoria com resumo fixo | Gustavo |
| D7 | Tela da cópia | ⋯ da pasta → "Copiar pasta para outro aluno", com aviso e o atalho para abrir a ficha | Gustavo |
| D8 | C25 Finalizar pasta | (revisada em 02/11/2026) pré-preencher o peso com o da atualização daquela pasta (só com `ALUNO_SENSIVEL_LER` + `ATUALIZACAO_LER`), editável. **Se o valor sugerido não foi editado, o finalizar NÃO grava peso**: ele já foi registrado no envio da atualização, com a data dela; a tela mostra "90 kg, da atualização de 20/10 (já registrado)". Se o treinador mudar o valor ou a data (ou preencher a observação, que exige peso), grava normalmente, com o aviso de substituição que já existe. Sem sugestão, igual a antes | Gustavo |
| D9 | C22 | resolver a sobra do `?pastaId` | Gustavo |
| D10 | Ajuda | explicar que ajuste no meio do ciclo = editar e publicar na mesma pasta (versão nova); ciclo novo = "Renovar pasta". O modelo de uma pasta por ciclo **não muda** | Gustavo |

## Passos
Andamento em 02/11/2026 (tudo na worktree `wt-pasta`, branch `pasta-publicar-copiar`, a partir da main `210d828c`):
- Itens 1 a 6 da revisão do Opus (`versoes`, 409s, `pulados`, cópia, peso): API e app feitos em 02/11/2026 (commits: `27cdbe67` API, `930523f8` app); ver (i) em "O que ficou para trás".
- Passos 2 a 6 feitos nos commits 797b9751, 3394019d, b0e27e44 e 33c4ee44 (guias no commit seguinte). O passo 7 (revisão do Opus) vem antes do PR.
- Conflito previsto com a Frente A em `CartaoPastas.tsx` e `PastaService`: quem abrir o PR depois faz `git merge origin/main` e regera os guias.

- [x] 1. Mapear `PastaService`, `CopiarPlanoService`, `PlanoServiceBase.publicar`, `CartaoPastas` e o fluxo do `?pastaId` (explorador) — explorador — feito em 02/11/2026 (sem commit; só leitura)
- [x] 2. API: `POST` de publicação conjunta da pasta (permissões antes de tudo, validar todos, publicar só se todos passarem, versão e auditoria por plano), testes de integração (um com erro = nenhum publicado; sem permissão de um tipo = nada muda; outra consultoria 404) — executor — feito em `wt-pasta` — commit: 797b9751
- [x] 3. API: cópia da pasta para outro aluno (D5/D6) reaproveitando `CopiarPlanoService`/`paraCopiaDeOutroAluno`; testes de integração — executor — feito em `wt-pasta` — commit: 797b9751
- [x] 4. API: peso sugerido da atualização da pasta no finalizar, com as duas permissões — executor — feito em `wt-pasta` — commit: 797b9751
- [x] 5. Tela: "Publicar tudo" na Folha da pasta com lista por plano; ⋯ → "Copiar pasta para outro aluno"; peso pré-preenchido; `?pastaId` — executor-front — commit: b0e27e44
- [x] 6. Ajuda (D10) — feito em 02/11/2026 (sem commit); `AGENTS.md` só nos itens das pastas — feito em 02/11/2026 (sem commit); e2e da Folha da pasta (3 casos novos do peso sugerido em `pasta-e-atualizacao.spec.ts`, D8); teste de API do finalizar sem peso (sem registro nem auditoria de peso; com peso, cria); guias regerados — feito em 02/11/2026: typecheck, lint e jest verdes, e2e `pasta-e-atualizacao` 36/36, `mvn verify` 1912 testes e `PastasIntegrationTest` (9) sem falha — commit: 33c4ee44 e o seguinte (guias PDF)
- [x] 7. Revisão do **Opus** (permissão, LGPD, contrato) antes do PR — agente `revisor` (Opus, leitura; o `advisor` só enxerga a conversa e não lê os diffs) — feito em 02/11/2026. Nada bloqueia a abertura do PR. Apontou 7 itens, todos registrados em "O que ficou para trás" (i) para o Gustavo decidir (os principais: amarrar o "Publicar tudo" às versões que a tela viu; 409 em chamadas simultâneas); o `AGENTS.md` e o item de `pulados` vazio saíram ajustados — commit: 95343385

## Critérios de aceite
- Publicar tudo com treino válido e dieta inválida: nada é publicado e a tela lista o problema da dieta.
- Plano sem rascunho alterado é pulado, sem versão nova.
- A cópia da pasta chega ao destino em rascunho, sem ergogênicos e sem questionário; ficha de outra consultoria dá 404.
- O peso do finalizar vem preenchido só para quem tem as duas permissões.

## Arquivos em comum com outras frentes
- `CartaoPastas.tsx` (Frente A mexe só nos campos de data), `ajuda/conteudo.ts`, guias, `AGENTS.md`.

## Fora do escopo
- Mudar o modelo de uma pasta por ciclo; contrato de ciclos.

## O que ficou para trás
- (b) O botão "Publicar tudo" fica oculto sem `TREINO_PUBLICAR` nem `DIETA_PUBLICAR` (a rota exige uma das duas).
- (c) O item "Copiar pasta para outro aluno" no ⋯ não tem estado desabilitado: sem o `*_ALTERAR` de um tipo presente, mostra o motivo e a Folha avisa.
- (d) `router.dismissTo` (VoltarParaAPasta) testado só na web, não no celular.
- (e) Dois planos do mesmo tipo a publicar: resolvido em 02/11/2026 (revisão do Opus, item 4): a API responde 409 `PLANOS_PENDENTES_DUPLICADOS` e a tela lista os títulos repetidos e orienta a arquivar o que não deve ir ao aluno, no app ⋯ › Excluir plano (revisão do Opus, item 1 da D; jest `textoDosPendentesDuplicados` e e2e); o campo `tipo[<planoId>].<caminho>` do 422 deixou de ocorrer. Commit: —
- (f) Mobilidade com a funcionalidade desligada no plano: a cópia agora devolve `pulados` com a mobilidade e a tela avisa (jest `mensagemPastaCopiada` e e2e); a publicação continua pulando-a sem aviso (não há o que publicar). Commit: —
- (g) O campo de data da cópia usa o campo existente; a Frente A cuida da faixa. Quem abrir o PR depois faz `git merge origin/main` e regera os guias.
- (i) Da revisão do Opus (02/11/2026), decididos pelo Gustavo e resolvidos em 02/11/2026 (itens 1 a 6; API na revisão anterior, app e documentação nesta; commit: —): (1) o "Publicar tudo" agora amarra a publicação às versões que a tela viu: o corpo leva `versoes {planoId: versao}` (a `versao` do rascunho, de cada plano pendente) e a API responde 409 `CONFLITO_EDICAO` se mudou ou faltar; a tela recarrega os planos e avisa "Os planos mudaram enquanto você olhava. Nada foi publicado; confira e publique de novo." e o `confirmarAvisos` só cobre o que a tela viu; (2) chamada simultânea perdida = o mesmo 409 `CONFLITO_EDICAO` (o handler novo da API); (3) `pulados` da publicação só traz tipos que a pessoa pode ler; (4) dois pendentes do mesmo tipo = 409 `PLANOS_PENDENTES_DUPLICADOS` e a tela diz "Há mais de um {tipo} pendente nesta pasta (“A” e “B”). Nada foi publicado." e orienta a arquivar o que não deve ir ao aluno (corrigido na revisão seguinte: antes dizia para publicar pelo editor), sem tentar de novo; (5) a cópia da pasta devolve `pulados` (mobilidade fora do plano) e leva a versão publicada de cada plano, e a tela avisa que a mobilidade não foi copiada e o texto da Folha da cópia diz que leva a versão publicada; (6) a sugestão do peso no Finalizar só preenche peso, data e observação se a pessoa ainda não mexeu neles antes de ela chegar (`sugestaoParaPreencher`), então digitar o peso antes não troca mais a data; (7) feito: depois do merge com a Frente A, `pesoNaFinalizacao.test.ts` e os 3 casos D8 de `pasta-e-atualizacao.spec.ts` repetidos e verdes. Lista de planos que falhou ao carregar: resolvido em 02/11/2026 (decisão do Gustavo). Nesse caso o "Publicar tudo" fica desabilitado com o motivo visível ("Não foi possível carregar o treino. Tente de novo.", com a concordância por tipo) e um "Tentar de novo" recarrega só as listas que falharam; nada é enviado à API e o aviso "Os planos mudaram" não aparece. O botão também espera, com o motivo "Atualizando os planos…", enquanto qualquer lista é buscada de novo; "Publicar mesmo assim" também fica desabilitado com o motivo. A regra é `situacaoDoPublicar` em `dominio/publicarPasta.ts` (jest) e o e2e está em `pasta-e-atualizacao.spec.ts`. Sem e2e: a sugestão do peso chegando atrasada (só a função pura tem jest).
- (h) Guias PDF: regerados por mim antes do PR (`node scripts/guias/gerar.mjs`). Quem abrir o PR depois faz `git merge origin/main` e regera de novo, porque PDF binário não se mescla.
- (j) Revisão do Opus da D (02/11/2026, itens 1 a 5; commits: `27cdbe67` e `930523f8`): orientação dos duplicados virou "arquive" (app, Ajuda, AGENTS.md e mensagem da API); "Publicar tudo" espera enquanto qualquer lista recarrega; "Publicar mesmo assim" desabilita com o motivo; o peso digitado (mesmo texto ainda inválido) já conta como "mexido" e a sugestão atrasada não o sobrescreve; `api-falsa` não põe a mobilidade pulada em `planos` da cópia. Acréscimo do Gustavo, corrigido depois da revisão (03/11): o formulário de Finalizar diz "Só é gravada junto com o peso. O aluno vê esta observação no histórico de peso e no PDF da dieta." abaixo do campo (a primeira versão prometia "Só a equipe vê", o que era falso: a observação vai ao registro de peso do aluno). "Publicar mesmo assim" reenvia as `versoes` da tentativa que gerou os avisos.
