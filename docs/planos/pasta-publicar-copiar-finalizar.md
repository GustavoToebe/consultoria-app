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
| D2 | Permissão | (revisada em 02/11/2026) a de publicar **só dos tipos que seriam publicados** (planos nunca publicados ou com rascunho alterado depois da última publicação), conferida **antes de qualquer efeito**; faltou alguma = 403 e nada é publicado; tipo sem alteração não pede permissão; nada para publicar = resposta clara, sem versão nova nem auditoria. Na tela, o botão só desabilita quando falta a permissão de um tipo com alteração, com o motivo ("Falta permissão para publicar o treino"). Antes valia "cada tipo presente" | Gustavo |
| D3 | Atomicidade | valida todos antes: problema em um = nenhum publicado, com a lista por plano e o mesmo tratamento de `CONFIRMAR_AVISOS` | Gustavo |
| D4 | Versão e auditoria | cada publicação gera a sua versão imutável e a sua auditoria; plano sem rascunho alterado é pulado | Gustavo |
| D5 | Copiar a pasta para outro aluno | mesmas regras do `CopiarPlanoService`: o destino recebe tudo em **rascunho**, sem ergogênicos e sem o questionário escolhido | Gustavo |
| D6 | Recusas e permissões da cópia | outra consultoria = 404; destino anonimizado = 409; exige `PASTA_ALTERAR` + `ALUNO_LER` + o `*_ALTERAR` de cada tipo; auditoria com resumo fixo | Gustavo |
| D7 | Tela da cópia | ⋯ da pasta → "Copiar pasta para outro aluno", com aviso e o atalho para abrir a ficha | Gustavo |
| D8 | C25 Finalizar pasta | pré-preencher o peso com o da atualização daquela pasta (só com `ALUNO_SENSIVEL_LER` + `ATUALIZACAO_LER`), editável e com o aviso de substituição que já existe | Gustavo |
| D9 | C22 | resolver a sobra do `?pastaId` | Gustavo |
| D10 | Ajuda | explicar que ajuste no meio do ciclo = editar e publicar na mesma pasta (versão nova); ciclo novo = "Renovar pasta". O modelo de uma pasta por ciclo **não muda** | Gustavo |

## Passos
Andamento em 02/11/2026 (tudo na worktree `wt-pasta`, branch `pasta-publicar-copiar`, a partir da main `210d828c`; **nada commitado ainda**):
- Passo 1 feito: o explorador mapeou `PlanoServiceBase`, `PastaService`, `PastaController`, `CopiarPlanoService`, `Auditoria`, `rotas.ts` e `CartaoPastas.tsx`. Achado: o comentário em `CartaoPastas.tsx:390` diz que o peso da atualização nunca é copiado para o finalizar; isso contradiz a D8 e deve ser corrigido junto com o passo 5.
- Passos 2 a 4 feitos (commit 797b9751; 16 testes novos + regressão verdes; `mvn verify` completo ainda por rodar): o `executor` fez só a API (e `rotas.ts`, `tipos.ts`, `acoesAuditoria.ts` no app). Decisões já passadas a ele: peso pré-preenchido pelo front com aviso de substituição; a rota `peso-sugerido` confere `ALUNO_SENSIVEL_LER` + `ATUALIZACAO_LER` no servidor; "pulado" = plano publicado com rascunho não alterado depois da publicação (sem migration; se precisar, ele para e avisa); auditoria `PASTA_COPIADA` com resumo fixo; validação de todos numa transação só; mobilidade só com a funcionalidade do plano.
- Passo 5 (tela): `executor-front` em andamento em `wt-pasta` (Publicar tudo, Copiar pasta, peso no finalizar, `?pastaId`).
- Permissão do "Publicar tudo" mudou em 02/11/2026 (D2 acima): só dos tipos com alteração. O `executor` ajusta a API e os testes (Nutricionista publica a dieta com treino sem alteração; 403 quando o treino também tem alteração; pasta sem nada alterado); o `executor-front` ajusta a tela e a api-falsa.
- Conflito previsto com a Frente A em `CartaoPastas.tsx` e `PastaService`: quem abrir o PR depois faz `git merge origin/main` e regera os guias.

- [x] 1. Mapear `PastaService`, `CopiarPlanoService`, `PlanoServiceBase.publicar`, `CartaoPastas` e o fluxo do `?pastaId` (explorador) — explorador — feito em 02/11/2026 (sem commit; só leitura)
- [x] 2. API: `POST` de publicação conjunta da pasta (permissões antes de tudo, validar todos, publicar só se todos passarem, versão e auditoria por plano), testes de integração (um com erro = nenhum publicado; sem permissão de um tipo = nada muda; outra consultoria 404) — executor — feito em `wt-pasta` — commit: 797b9751
- [x] 3. API: cópia da pasta para outro aluno (D5/D6) reaproveitando `CopiarPlanoService`/`paraCopiaDeOutroAluno`; testes de integração — executor — feito em `wt-pasta` — commit: 797b9751
- [x] 4. API: peso sugerido da atualização da pasta no finalizar, com as duas permissões — executor — feito em `wt-pasta` — commit: 797b9751
- [ ] 5. Tela: "Publicar tudo" na Folha da pasta com lista por plano; ⋯ → "Copiar pasta para outro aluno"; peso pré-preenchido; `?pastaId` — executor-front — commit: —
- [ ] 6. Ajuda (D10), guias regerados, e2e da Folha da pasta, `AGENTS.md` só no item das pastas — commit: —
- [ ] 7. Revisão do **Opus** (permissão, LGPD, contrato) antes do PR — `advisor` (Opus); se indisponível, agente `revisor` (Opus, leitura) e avisar o Gustavo. A revisão do diff pelo Sonnet não a substitui. O corpo do PR traz a linha "Revisão (Opus): feita por <advisor|revisor> — apontou: … — resolvido: …" — commit: —

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
- —
