# Telas do aluno no treinador: lista, ficha e novo aluno no estilo novo

Situação: Planejando (o Claude local implementa) · Onde: branch `claude/saraiva-api-direcionamento-treinos-dv10io` · Atualizado: 30/10/2026

## Objetivo
Levar a lista de alunos, a ficha (`/treinador/alunos/[id]`) e o cadastro (`/treinador/alunos/novo` e a edição na ficha)
para o estilo do editor de treino (`docs/design-e-front.md`, seção 4.1): blocos com contorno e faixa de título, a lista
em grupos que pedem ação, como a referência de Biblioteca › Outros que o Gustavo mandou. O protótipo aprovado está em
`docs/prototipos/alunos.html` (abrir no Chrome; dados fictícios). Só a apresentação muda: nenhuma rota, DTO, permissão
ou regra da API.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Lista em grupos | Um `Cartao` por grupo, com faixa (título, bolinha na cor do estado, "N alunos · o que significa"): **Para revisar** (âmbar, fase `ENVIADA`), **Atrasados** (vermelho, `ATRASADA`), **Em dia** (verde, as outras fases) e **Sem pasta com período** (sem `atualizacao`). Grupo vazio não aparece. Agrupa só a página que veio da API (30 por página; a paginação e a busca continuam as de hoje) | Gustavo, 30/10 (protótipo) |
| D2 | Colunas da lista | Aluno (iniciais e nome; selos só de exceção: "Inativo", "Sem acesso"), Plano em uso, Atualização (selo de `statusAtualizacaoTreinador`), Último registro (`dataRelativa`; mais de 7 dias ou "Nunca registrou" em `textoSuave`), Responsável (primeiro nome, de `GET /responsaveis`) e, no fim, lápis (editar cadastro) e seta. Cabeçalho das colunas dentro do cartão do grupo. Abaixo de `LARGURA_MENU_LATERAL` cada linha vira cartão (nome, selos e uma linha de metadados) | Gustavo, 30/10 (protótipo) |
| D3 | Linha da lista | Continua link (`<a href>` na web, `propsDeLink`), a linha inteira abre a ficha; o lápis abre a ficha já editando (`?editar=1`). No "Selecionar" a caixa aparece à esquerda e a linha marca, como hoje (`e2e/listas-em-linha.spec.ts` tem de continuar passando) | Gustavo, 30/10 (protótipo) |
| D4 | Ficha | Cabeçalho com a foto de perfil ou as iniciais (`ui/FotoDePerfil`), nome, plano e responsável, "Editar cadastro" e o ⋯ de hoje (`FolhaDeAcoes`). Atalhos das seções (chips: Resumo, Pastas, Treinos, Peso e medidas, Lesões e anamnese, Acesso) que rolam até o cartão (`useRolagem().rolarAte` + `AlvoDeRolagem`). Resumo: "Próximo passo" (`proximoPassoDoAluno`) numa caixa na cor do tipo com o único botão primário, quatro indicadores (Pasta em uso, Atualização, Esta semana, Último registro) e os Dados do aluno em três colunas (Cadastro, Dados pessoais, Acompanhamento) | Gustavo, 30/10 (protótipo) |
| D5 | Ficha, ordem dos blocos | Resumo → Pastas → Frequência, Mobilidade e Água lado a lado (`ui/Grade`, 3 colunas no PC) → Peso e Avaliação física lado a lado → Lesões e Anamnese lado a lado → Acesso ao app. Os demais cartões de hoje (progresso, fotos, evolução, treinos concluídos, recordes, financeiro) seguem nas mesmas permissões, entre Água e Peso | Gustavo, 30/10 (protótipo) |
| D6 | Pastas na ficha | Filtro Abertas / Concluídas / Todas e, em cada linha, o estado de cada plano ("Treino: Publicado", "Dieta: Rascunho", "Mobilidade: —") e o selo da atualização | Gustavo, 30/10 (protótipo) |
| D7 | Novo aluno e edição | Mesmo `FormAluno`, com cada seção num `Cartao` com faixa (Cadastro, Dados pessoais, Acompanhamento), campos em duas colunas no PC, Sexo em chips, CEP com "Buscar", e o rodapé fixo com Cancelar à esquerda e "Salvar aluno" à direita. Com erro: um `Alerta` de perigo no topo, "N campos precisam de correção", e o foco no primeiro campo com erro. Largura de formulário maior (cerca de 880 px no lugar de 640) | Gustavo, 30/10 (protótipo) |

## Passos
- [ ] 1. Lista em grupos e colunas (D1 a D3), com e2e em 390 e 1280 — commit/run: —
- [ ] 2. Ficha (D4 a D6), com e2e — commit/run: —
- [ ] 3. Novo aluno e edição (D7), com e2e de `cadastro-aluno.spec.ts` — commit/run: —
- [ ] 4. AGENTS.md, Ajuda (se o caminho mudar) e capturas para o Gustavo — commit/run: —

## Fora do escopo
- Foto de perfil na lista (seria uma requisição por aluno; fica as iniciais).
- Agrupar no servidor (o agrupamento é da página carregada).
- Mudar o que a API devolve ou as permissões de cada cartão.

## O que ficou para trás
- (nada ainda)
