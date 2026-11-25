# Ajustes de layout de 24 e 25/11 (lote com nove frentes)

Situação: Concluída em 25/11/2026 · Onde: main · Atualizado: 25/11/2026

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
- [x] Verificação final — commit `f0e119f3`: `tsc` 0 erros, lint 0 erros (11 avisos antigos), jest 418 suítes e 9785 testes, e2e das áreas (1009 passaram, 70 de captura pulados, 0 falhas; a suíte completa não rodou, por limite pedido pelo Gustavo em cada pedido), `mvn verify` 3328 testes, 0 falhas, `folha-no-centro.spec.ts` 3 passaram
- [x] Push e CI — run 45546575527 (Testar e publicar) verde, 23 min; push em `ac0e5875`

## Fora do escopo
- Botão e ícone pequenos fora da `ListaDeDados` (o `Botao` padrão não muda).
- Remoção da prop `alturaDoConteudo` da `Folha` (sem efeito; ainda passada pela importação).

## O que ficou para trás
- Prop no `CartaoDeIndicador` para pintar só a bolinha (azul dos treinos da ficha).
- `mostrarAbaixoDaBarra` (`TelaDoEditor`) mede a barra onde ela está e rola ~96 px a mais; afeta também os inspetores do treino e da dieta.
- Teto do editor na ultralarga do questionário (vão de ~1300 px em 3440): decidir entre teto maior, prévia de 720 px ou aceitar.
- `ValoresDaDieta` com prop `tracos` e "complemento do título" na `LinhaDaLista` (ambos hoje contornados com `shortcut:`).
- Linha tracejada da meta da água só conferida na web.

## Fechamento (25/11)
Pedido do Gustavo: marcador só com cor (T-010), Cobranças com atraso no selo (T-011), editor de questionário com limiares 1000/1440 (T-012), TelaDoEditor, prop morta da Folha (T-013), seletor de categoria compartilhado (T-014), "+N" das tags com teclado e toque (T-015), suíte e2e completa.
- [x] T-010 `corDoMarcador` no `CartaoDeIndicador` + "Treinos esta semana"
- [x] T-011 Cobranças: "Vencida há N dias" no selo, linha de 53 px em 1280 e 1920, Competência só MM/AAAA
- [x] T-012 Editor de questionário (índice a partir de 1000 px de área, três colunas a partir de 1440) e `mostrarAbaixoDaBarra` corrigido
- [x] T-013 prop `alturaDoConteudo` removida
- [x] T-014 `treinador/SeletorDeCategoria` em Outros e na Vitrine
- [x] T-015 "+N" das tags como botão (teclado, toque, Esc)
- [x] T-018 regressão achada pela suíte completa: `comparacao-de-fotos.spec:421` (a ação do rodapé descia quando o erro aparecia na folha centralizada) corrigida em `ui/Folha.tsx` + `ui/ancoraDoRodape.ts`
- [x] Suíte e2e COMPLETA: 2996 passaram, 282 pulados (captura), 0 falhas na rodada do T-018; na primeira rodada, `painel.spec:391` falhou e passou isolada (intermitência já conhecida)
- Commit/run: ver "Passos" do README ao publicar.

## Limpeza dos textos do topo (25/11)
Pedido do Gustavo: descrição do cabeçalho vira ⓘ (T-019), Financeiro sem frases soltas e com a ação na linha da busca (T-020), Biblioteca sem o link "Importar da sua planilha" (T-021).
- [x] T-019 `ui/AjudaDoCabecalho` + `dominio/ajudaDaTela` (balão com "Saiba mais" → `?secao=`); ~21 telas passam `descricao` no lugar de `subtitulo`
- [x] T-020 Financeiro: `AcaoDaBusca` na `BarraDeFiltros`, texto das abas e `AvisoDoHistoricoParcial` removidos
- [x] T-021 Biblioteca: link do topo removido; estado vazio com "Importar de planilha" (`ImportarDePlanilha`)
- [x] Verificação: e2e das áreas (biblioteca, financeiro, cabeçalho, configurações) 498 passaram, 0 falhas; tsc, lint e jest na árvore final (ver relatório)
- Pendências: balão ⓘ não conferido no nativo; `AcaoDaBusca` vira variante nomeada da `BarraDeFiltros` se for reutilizada; remover a ressalva de histórico parcial também do Início do treinador (decisão do Gustavo).
- Commit/run: ver "Passos" do README ao publicar.
