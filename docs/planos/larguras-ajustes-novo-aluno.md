# Larguras de Ajustes e Novo aluno (lote 2 das margens do PC) e acertos de Números e Biblioteca

Situação: Concluída em 12/11/2026 · Onde: `main` · Atualizado: 12/11/2026

## Objetivo
Aproveitar a largura do PC em Ajustes e Novo aluno, que usavam um contêiner estreito centralizado (1040 e 640 px), sem dividir uma
área estreita em colunas: o contêiner externo cresce (`folga`, como em Números) e as colunas agrupam por assunto, com limite de
leitura nos campos e nos textos. Dois acertos pequenos: o cartão "Equipe hoje" termina com o conteúdo e a Biblioteca aproxima título e descrição.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Contêiner externo | `Tela` sem `largura` fixa, `folga` de 28 px a partir de 768 px (a mesma de Números); `Tela` não mudou | Gustavo (12/11) |
| 2 | Ajustes | duas colunas por assunto: Tema à esquerda; Contraste, Bordas, Tamanho do texto, Animações, Gráficos, Navegador, Unidade da carga, Vibração e extras à direita; `PreferenciasDoApp` ganha a prop opcional `duasColunas` (a Conta do aluno segue igual); base de 464 px e teto de 720 por coluna; lado a lado a partir de ~952 px de contêiner | Gustavo / Claude (`executor-front`) |
| 3 | Novo aluno | seções por assunto (Cadastro, Dados pessoais, Acompanhamento) em colunas com base de 440 e teto de 560 px; `FormAluno` ganha a prop opcional `colunas` (a ficha segue igual); telefone e objetivo não se juntam na linha só porque cabem; celular em uma coluna, na mesma ordem do foco; campos, máscaras, validações e regras de LGPD intactos | Gustavo / Claude |
| 4 | Lembretes × Recebimento online | não lado a lado: são abas separadas (`?aba=lembretes`, `?aba=recebimento`) e a segunda só existe com `recebimentoOnlineHabilitado`; o Financeiro já usa `LARGURA_LISTA` e o cartão de Lembretes (640 px, à esquerda, como a aba vizinha) não ganhou `folga` para não deslocar a Visão geral | Claude (premissa do pedido não vale) |
| 5 | Pequenos | "Equipe hoje" com `alignItems: flex-start` (termina junto do conteúdo, sem acompanhar a altura do vizinho); Biblioteca com a descrição no `subtitulo` do `Cabecalho`, como o Financeiro | Gustavo |
| 6 | Fora | Equipe em cartões, índices laterais e prévias só para preencher espaço: não entram; Perfil, Meus dados, Segurança, Marca, Ajuda e editores só depois de conferir cada tela renderizada | Gustavo |

## Passos
- [x] 1. Ajustes (`ui/PreferenciasDoApp.tsx`, `app/treinador/ajustes.tsx`); commit e49f6b82
- [x] 2. Novo aluno (`treinador/FormAluno.tsx`, `app/treinador/alunos/novo.tsx`); commit e49f6b82
- [x] 3. Lembretes: só o e2e (nenhuma mudança de código; ver decisão 4); commit e49f6b82
- [x] 4. Equipe hoje e Biblioteca (`numeros.tsx`, `biblioteca.tsx`, `e2e/numeros.spec.ts`); `numeros.tsx` e `numeros.spec.ts` entraram no commit 765e06d5 (larguras) e `biblioteca.tsx`, em e49f6b82
- [x] 5. e2e novo `e2e/larguras-ajustes-cadastro-lembretes.spec.ts` (1920, 1440, 1280 e 390: sem rolagem horizontal, uso acima de 1040 px, colunas lado a lado, uma coluna no celular, campos até 560 px); commit e49f6b82

## Fora do escopo
- Renovações em "Meus" (Financeiro › Visão geral): correção funcional separada, de API (`executor`); registrada em `composicao-de-telas-12-11.md`.
- Área do aluno (largura 720 preservada).

## O que ficou para trás
- Novo aluno: em 1920 as três seções ficam lado a lado; em 1440 e 1280 o Acompanhamento desce para a esquerda, na linha seguinte (muda de lugar conforme a largura). Alternativa de uma linha: `maxWidth: 2 * 560 + espaco(4)` em `secoesEmColunas` e ajuste do e2e de 1920. Sem a permissão de dado sensível sobra vazio à direita em janela muito larga.
- Ajustes com o tamanho de texto "Extra" nas colunas de ~475 px (1280) e com o menu recolhido (trilho de 88 px) não foram conferidos; temas areia e contraste alto, barra de rolagem real do Windows, app nativo e leitor de tela também não.
- Perfil, Meus dados, Segurança, Marca, Ajuda, Equipe, Termos, Auditoria, Interessados, Planejamento e os editores de modelo e de questionário: avaliar cada tela renderizada antes de propor (formulário curto não precisa de duas colunas; Marca com prévia só se a prévia já existir).
