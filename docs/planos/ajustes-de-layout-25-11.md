# Ajustes de layout de 24 e 25/11 (lote com nove frentes)

Situação: Em andamento · Onde: main · Atualizado: 25/11/2026

## Objetivo
Corrigir, num lote só, defeitos de layout e de legibilidade apontados pelo Gustavo: Configurações em colunas empilhadas, selos da lista de alunos, Equipe sem meia tela vazia, Cobranças com linha de uma altura, catálogo da Biblioteca no padrão das abas, Frequência e Água da ficha, divisórias e botões da `ListaDeDados`, editor de questionário em tela larga, folha "No centro" com a altura do conteúdo e Biblioteca › Outros.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Tamanho pequeno do botão | `Botao tamanho="pequeno"` (32 px dentro de alvo de 44) e `IconeBotao compacto` com `moldura`; opcional, o padrão não muda | Claude, em 25/11, porque o pedido do Gustavo o supunha existente |
| D2 | "Copiar link" do convite pendente (Equipe) | Não feito: a API guarda só o hash e nunca devolve o link; "Renovar" termina na folha "Convite criado" | Claude, a confirmar pelo Gustavo |
| D3 | Busca por CPF nas Cobranças | Nunca existiu (a API filtra só pelo nome); só a exibição mudou | Claude |
| D4 | Cobranças 1280 | Linha de uma altura só em 1920; em 1280 as vencidas ficam com 2 linhas (atraso embaixo do selo) | Claude, a confirmar |
| D5 | Catálogo: filtros no servidor | `modalidade`, `imagem`, `unidade` e `naBiblioteca` em `/catalogo/*` (sem migration); sem filtro de vídeo, Fonte ou Preparo, sem "Selecionar todas" | Claude |
| D6 | Selo "Vencida" da lista de alunos | "Cobrança vencida": é a única origem (`/financeiro/alunos-em-atraso`) | Claude |
| D7 | Editor de questionário: faixas pela área do editor | Índice a partir de ~1570 px de janela (menu aberto), três colunas a partir de ~1900; em 3440 sobra vão no meio | Claude, a confirmar |
| D8 | "Água" do treinador | Barras em neutro forte (não há cor de categoria da água); treinos neutros, sem o azul no marcador (`CartaoDeIndicador` não tem como) | Claude |

## Passos
- [x] T-001 Configurações em alvenaria (`Alvenaria`, `dominio/alvenaria`, `colunasDoHub`)
- [x] T-002 Selos e tags na mesma linha da lista de alunos (`SelosETagsDaLinha`, `selosDaLinhaDeAluno`)
- [x] T-003 Equipe: Perfis em grade, Membros com coluna lateral (`LateralDosMembros`)
- [x] T-004 Cobranças: coluna Aluno só com o nome; atraso ao lado do selo
- [x] T-005 Biblioteca › catálogo no padrão das abas (app e `CatalogoController`)
- [x] T-006 Ficha › Acompanhamento: indicadores e gráfico da água
- [x] T-007 `ListaDeDados`: divisórias e botão pequeno
- [x] T-008 Editor de questionário: índice e prévia ao vivo
- [x] T-009 Folha "No centro", cartões da Vitrine, Editar alimento (FC/FCc) e Outros
- [ ] Verificação final e push — commit/run: —

## Fora do escopo
- Botão e ícone pequenos fora da `ListaDeDados` (o `Botao` padrão não muda).
- Remoção da prop `alturaDoConteudo` da `Folha` (sem efeito; ainda passada pela importação).

## O que ficou para trás
- Prop no `CartaoDeIndicador` para pintar só a bolinha (azul dos treinos da ficha).
- `mostrarAbaixoDaBarra` (`TelaDoEditor`) mede a barra onde ela está e rola ~96 px a mais; afeta também os inspetores do treino e da dieta.
- Teto do editor na ultralarga do questionário (vão de ~1300 px em 3440): decidir entre teto maior, prévia de 720 px ou aceitar.
- `ValoresDaDieta` com prop `tracos` e "complemento do título" na `LinhaDaLista` (ambos hoje contornados com `shortcut:`).
- Linha tracejada da meta da água só conferida na web.
