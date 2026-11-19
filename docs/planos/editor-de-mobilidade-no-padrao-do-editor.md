# Editor de mobilidade no padrão do editor de treino e de dieta

Situação: Em andamento · Onde: main (só `app/`, sem commit) · Atualizado: 19/11/2026

## Objetivo
O editor de mobilidade (modelo do Planejamento e plano do aluno) passa a funcionar como o de treino e o de dieta: um
cartão só no topo, seções com alça de arrastar, painel com a faixa de ação e o título editável no cabeçalho, itens em
tabela com o vídeo compacto. Pedido do Gustavo de 19/11 ("Editor de modelo de mobilidade: mesmo padrão do editor de
treino e de dieta").

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Topo do modelo | Cartão "Sobre o modelo": Nome e Descrição lado a lado (descrição maior) e Orientações recolhidas embaixo ("(vazio)" ou o começo do texto, `aria-expanded`). Sem cartão separado de Orientações. | Gustavo (pedido) |
| D2 | Topo do plano do aluno | As Orientações entram na "Configuração do plano" (prop `children` que já existia), no mesmo bloco recolhido. | Executor-front (o pedido falava do modelo; mantém um cartão só no topo nos dois) |
| D3 | Seções | Alça de arrastar (`ui/ArrasteDaLista`) na lista (PC) e no cabeçalho do cartão (celular); setas saíram para o ⋯ ("Mover para cima/baixo", `acoesDeMover`). Selo "Editando" só no item da lista. | Gustavo (pedido) |
| D4 | Painel da seção | Faixa de 6 px na cor de ação só no inspetor (empilhado, todas as seções estão abertas: faixa em todas quebraria "um nível de destaque por vez"). Cabeçalho com "Seção N de M", o título editável (nome acessível "Título da seção N", único no empilhado), ⋯ e "Excluir seção" (`perigoTexto`; confirma com `PainelConfirmacao` só se tiver itens; Desfazer depois). A única seção não tem "Excluir seção" (como "Remover sessão" no treino). | Gustavo (pedido) + executor-front (detalhes) |
| D5 | Itens | Tabela como a da dieta: cabeçalho "#", "Nome", "Prescrição", "Vídeo" (`aria-hidden`), faixas `superficie2` de cantos 12 a 6 px, alça e número no começo e ⋯ no fim (mover e "Excluir item"); Nome e Prescrição flex 1,2, Vídeo flex 1. Itens sempre abertos (o abrir e fechar por item e o "Abrir todos" saíram). | Gustavo (pedido) |
| D6 | Limiar da tabela | Lista dos itens com 600 px medidos (painel de ~640 px); abaixo, cartão empilhado com os rótulos. O pedido falava em ~760 px de painel, mas em 1280 com o menu aberto o painel tem ~710 px (lista de seções de 280 px): com 760 o PC comum ficaria sem a tabela. | Executor-front (medido) |
| D7 | Vídeo | Vazio: campo com "Cole o link do YouTube" (na tabela, "Link do YouTube"). Válido e fora do foco: "Vídeo adicionado" com Abrir (nova aba) e Trocar (volta ao campo com o foco). Inválido: o campo em erro e o selo de perigo "Link do YouTube inválido" (na tabela, "Link inválido") ligado por `aria-describedby`. Regra: `videoValido` de sempre (`dominio/mobilidade.estadoDoVideo`). | Gustavo (pedido; textos curtos em 19/11) |
| D8 | Cor do link inválido | **Decidida: vermelho** (perigo), pela 4.5 do documento de design, porque trava o salvar: contorno da faixa do item, borda do campo (`erro` com `erroSemTexto`, `aria-invalid`) e selo `perigo` com o ícone do erro (`CircleAlert`). Na coluna Vídeo da tabela (1280 com o menu aberto), placeholder "Link do YouTube" e selo "Link inválido", sem cortar nem quebrar; empilhado, os textos longos. | Gustavo (19/11) |

## Passos
- [x] 1. Regra pura em `app/src/dominio/mobilidade.ts` com teste (`estadoDoVideo`, textos do vídeo, mover/remover/adicionar item, mover seção, resumos) — commit/run: —
- [x] 2. Tela: `treinador/mobilidade/{SecoesDeMobilidade,ItemDeMobilidade,SobreAMobilidade,EditorDeMobilidade}.tsx` e o ramo da mobilidade em `planejamento/EditorModelo.tsx` — commit/run: —
- [x] 3. e2e `app/e2e/editor-mobilidade.spec.ts` (arrastar com o mouse em 1280, ⋯, excluir com confirmação, tabela, vídeo, modelo, capturas) — commit/run: —
- [x] 4. Commit (sessão principal, 19/11) — commit: `74825d91`; publicação: pendente (sem push)
- [x] 5. D8 decidida em 19/11 (Gustavo): link inválido em vermelho (perigo), pela 4.5 do documento de design, porque trava o salvar; atualizar a D8; na coluna Vídeo em 1280, placeholder curto "Link do YouTube" e selo curto "Link inválido" (sem cortar nem quebrar); tirar a pendência solta do README — feito em 19/11 (sem commit): `ItemDeMobilidade.tsx`, `AVISO_CURTO_DO_LINK_INVALIDO` em `dominio/mobilidade.ts` com teste; e2e `editor-mobilidade.spec.ts` 18/18 (caso novo em 1280 claro e escuro: cor igual à do "Corrigir", `aria-invalid`, selo numa linha, placeholder medido no canvas cabendo na caixa, "Salvar modelo" desabilitado com o motivo); capturas vistas em 1280 (claro e escuro) e 390 — commit: `19fd45da`

## Fora do escopo
- Formato dos dados (`ConteudoMobilidade` no app e `receitas/ConteudoMobilidade` na API) não muda.
- Token para a faixa de 6 px (repetida em treino, dieta e mobilidade, `shortcut:` nos três).

## O que ficou para trás
- Commit do passo 5 (sessão principal) e publicação.
