# Pasta: publicar tudo, copiar a pasta para outro aluno, peso ao finalizar

Situação: Em andamento · Onde: branch `pasta-publicar-copiar` (worktree `wt-pasta`) · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C21, C25, C22 (mais a cópia da pasta inteira) · Frente D da leva 1

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
| D2 | Permissão | (revisada em 02/11/2026) a de publicar **só dos tipos que seriam publicados** (planos nunca publicados ou com rascunho alterado depois da última publicação), conferida **antes de qualquer efeito**; faltou alguma = 403 e nada é publicado; tipo sem alteração não pede permissão; nada para publicar = 200 com `publicados` vazio e os planos intactos em `pulados` (só ids), sem versão nova nem auditoria. Na tela, o botão só desabilita quando falta a permissão de um tipo com alteração, com o motivo ("Falta permissão para publicar o treino"). Antes valia "cada tipo presente" | Gustavo |
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
- (e) Dois planos do mesmo tipo a publicar: o campo do erro `tipo[<planoId>].<caminho>` não tem teste.
- (f) Mobilidade com a funcionalidade desligada no plano: implementada e sem teste.
- (g) O campo de data da cópia usa o campo existente; a Frente A cuida da faixa. Quem abrir o PR depois faz `git merge origin/main` e regera os guias.
- (i) Da revisão do Opus (02/11/2026), fora do PR para o Gustavo decidir: (1) o "Publicar tudo" não amarra a publicação às versões que a tela viu (`PastaService.publicarTudo` passa a versão da própria entidade, então o lock otimista nunca falha): um rascunho salvo por outra pessoa entre abrir a Folha e tocar em Publicar tudo é publicado sem 409, e o `confirmarAvisos` pode confirmar aviso que ninguém viu; correção possível: o corpo leva `{planoId: versao}` e o servidor responde 409 `CONFLITO_EDICAO`; (2) duas chamadas simultâneas não publicam duas vezes nem pela metade (versão única e `@Version`), mas a segunda resposta não tem handler e tende a 500 (a rota individual já é assim): mapear `ObjectOptimisticLockingFailureException`/`DataIntegrityViolationException` para 409; (3) `pulados` devolve o `planoId` de tipos que a pessoa pode não ler (só ids): filtrar pelo `*_LER` ou devolver só a contagem; (4) dois planos do mesmo tipo pendentes: o aluno passa a ver o último, sem aviso na tela; (5) a cópia com mobilidade desligada pula a mobilidade sem avisar e leva a última versão publicada, não o rascunho; (6) digitar o peso antes de a sugestão chegar troca a data para a da atualização; (7) depois do `git merge origin/main` com a frente A, repetir `pesoNaFinalizacao.test.ts` e os 3 casos D8 de `pasta-e-atualizacao.spec.ts` (a D8 depende de `dataDaTela(dataParaTela(x)) === x`).
- (h) Guias PDF: regerados por mim antes do PR (`node scripts/guias/gerar.mjs`). Quem abrir o PR depois faz `git merge origin/main` e regera de novo, porque PDF binário não se mescla.
