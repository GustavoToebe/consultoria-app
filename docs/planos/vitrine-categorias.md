# Vitrine: foto no cadastro, formulário em seções, grade e categorias

Situação: Em andamento · Onde: main · Atualizado: 24/11/2026

## Objetivo
O treinador cadastra o item já com a foto, edita num formulário em seções, vê a Vitrine como grade de cartões agrupada por categoria e ordena categorias e itens; o aluno vê a vitrine separada por categoria, na ordem definida.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Foto no "Novo item" | Mesma área do "Editar item"; criar o item e depois enviar a foto no mesmo fluxo; se a foto falhar, o item fica criado e a folha vira "Editar item" com o erro na área da foto | Gustavo, 24/11 |
| 2 | Folha média | Formulário em seções (Item, Preço, Onde comprar, Visibilidade) em `LARGURA_FOLHA_LARGA` | Gustavo, 24/11 |
| 3 | Categoria | Entidade `vitrine_categoria` (nome, ordem) com `@TenantId`; item com categoria opcional; excluir categoria deixa os itens "Sem categoria", nunca apaga item; nada é criado automaticamente (só sugestões clicáveis) | Gustavo, 24/11 |
| 4 | Migration | V099: **só sobe depois da V098** (Flyway recusa migration de número menor que chega depois, sem `outOfOrder`). A V098 já está na origem desde o commit `5ae79ef6`, então não há mais bloqueio | sessão principal |
| 5 | Públicas | Página pública e marketplace não mudam; só a vitrine do aluno ganha a categoria | sessão principal |
| 6 | Estado inteiro no PUT do item | `PUT /vitrine/itens/{id}` grava o estado inteiro: `categoriaId` ausente apaga a categoria, então o app reenvia sempre | sessão principal, 24/11 |
| 7 | Excluir categoria | Itens ficam "Sem categoria" sem mexer na `versao` do item; app com a folha aberta e o id apagado recebe 404 ao salvar e recarrega | sessão principal, 24/11 |
| 8 | Renomear sem lock otimista | Sem `versao` no contrato da categoria: vale o último. Escritas travam a consultoria (`consultorias.travar`), `VitrineService.alterar` agora também | sessão principal, 24/11 |
| 9 | `PUT /ordem` de categorias | Id de outra consultoria = 409 `CONFLITO_EDICAO` (como a ordem dos itens), não 404 | sessão principal, 24/11 |
| 10 | Auditoria | `VITRINE_CATEGORIA_CRIADA`, `_RENOMEADA` (só se o nome mudou), `_EXCLUIDA` e `VITRINE_CATEGORIAS_REORDENADAS` (só se a ordem mudou); entidade `VITRINE_CATEGORIA`; resumo fixo, sem o nome; espelhado em `treinador/equipe/acoesAuditoria.ts` | sessão principal, 24/11 |
| 11 | Foto da vitrine | Dica "JPEG, até 300 KB" sai de `LIMITES_FOTO_DA_VITRINE` (limite real da API); o app reduz qualquer foto antes de enviar | sessão principal, 24/11 |
| 12 | Peça nova `ui/AreaDeFoto` | Quadrada 1:1 (`lado` 180), vazia = quadro tracejado clicável e soltável na web, preenchida = prévia de quem usa + "Trocar" e "Remover", erro com "Tentar de novo"; não lê arquivo nem chama a API | sessão principal, 24/11 |
| 13 | Layout da Vitrine | Grade de `CartaoDoProduto` agrupada por categoria; Página pública em coluna fixa de 380 px ao lado, sem teto na faixa larga (empilhada, até 640 px, abaixo); reordenar por arrastar e por ⋯ → Mover | sessão principal, 24/11 |
| 14 | Sugestões de categoria | Sem nenhuma categoria, `CampoCategoria` mostra sugestões por tipo (Físico: Roupas, Calçados, Acessórios, Livros; Digital: E-books, Cursos, Guias, Serviços) que só criam ao clicar; nada automático | Gustavo, 24/11 |

## Contrato da API (equipe: `@ExigeVitrine`, `VITRINE_LER`/`VITRINE_ALTERAR`; aluno: rotas atuais)
- Tabela `vitrine_categoria` (`id`, `consultoria_id`, `nome` até 40, `nome_normalizado` (minúsculas, sem acento, strip), `ordem`, `versao`, datas); `UNIQUE (consultoria_id, nome_normalizado)` e `UNIQUE (consultoria_id, id)`; no máximo 30 por consultoria. `vitrine_item.categoria_id` nulo, FK composta `(consultoria_id, categoria_id)` com `ON DELETE SET NULL (categoria_id)`.
- `GET /vitrine/categorias` → `[{id, nome, ordem, quantidade}]` por `ordem`. `POST /vitrine/categorias {nome}` → 201 `{id, nome, ordem, quantidade}` (vai para o fim). `PUT /vitrine/categorias/{id} {nome}` → 200. `DELETE /vitrine/categorias/{id}` → 204 (itens ficam sem categoria). `PUT /vitrine/categorias/ordem {ids}` → 204 (lista completa, como a dos itens).
- Erros: 422 `VITRINE_CATEGORIA_INVALIDA` (`fieldErrors` em `nome`: "Informe o nome da categoria." / acima de 40), 409 `VITRINE_CATEGORIA_DUPLICADA` (`nome`: "Já existe uma categoria com esse nome."), 409 `VITRINE_CATEGORIAS_LIMITE`, 404 de outra consultoria. Mensagens fixas, sem repetir o texto digitado.
- Item: `ItemRequest.categoriaId` (opcional; categoria inexistente ou de outra consultoria = 422 `VITRINE_ITEM_INVALIDO` com `fieldErrors` em `categoriaId` e mensagem fixa "Categoria não encontrada.", a mesma resposta nos dois casos) e `ItemResponse.categoriaId`/`categoriaNome`. Lista da equipe ordenada por ordem da categoria (sem categoria por último) e depois por ordem do item.
- Aluno: `ItemDoAlunoResponse.categoria {id, nome, ordem}` (nulo = sem categoria) e a lista já vem ordenada (categorias na ordem, sem categoria por último, depois a ordem do item).

## Passos
- [x] 1. API: migration V099, entidade, repositório, serviço, controller, `ArquiteturaTest`, testes de integração (`VitrineCategoriasMigrationTest`, `VitrineCategoriasIntegrationTest`) — feito no commit f6e2664c
- [x] 2. App: cliente (`api/vitrineCategorias.ts`) e regras puras (`dominio/vitrineCategorias.ts`), `CampoCategoria` com busca/criar/sugestões, `FolhaCategorias` ("Organizar categorias") — feito no commit f6e2664c
- [x] 3. App: foto no "Novo item" (`ui/AreaDeFoto`), `FolhaDoItem` em seções, `TelaVitrine` em grade agrupada com arraste, vitrine do aluno por categoria — feito no commit f6e2664c (e2e: `vitrine-categorias.spec.ts`, `vitrine-treinador.spec.ts`, `vitrine-aluno.spec.ts`)
- [x] 4. Docs (`design-e-front.md`, `AGENTS.md`: escritos em 24/11) e capturas (só 1280 e 1920 nesse lote) — commit/run: —

## Fora do escopo
- Página pública da loja e marketplace por categoria; categoria por idioma; ícone ou cor de categoria.

## O que ficou para trás
- Contraste do tracejado da `AreaDeFoto` (`bordaCampo` sobre `superficie2`, e o estado de soltar em `acaoSuave`) fora de `contrasteDasPecas.test.ts`.
- Foto da vitrine no nativo (câmera, "Tirar foto", arrastar por toque) não conferida.
- Avisos do rodapé ("Ordem alterada." com Desfazer, "Foto do item salva.") ficam atrás das folhas modais.
- Capturas só em 1280 e 1920; 390 e os temas Areia e contraste alto sem captura.
- Cada sobra também está em "Pendências soltas" do README.
