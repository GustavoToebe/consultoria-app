# Composição visual: padrões compartilhados (modais, formulários, opções, prévia, mensagens)

Situação: Em andamento (4a, 4b e 4c feitos; 5 e 6 abertos) · Onde: `main`, commits locais (4a `04cb44ea`, 4b `6a726e29`, 4c `f9790e2c`) · Atualizado: 10/11/2026

## Objetivo
A mesma função tem o mesmo alinhamento, espaçamento, hierarquia e comportamento em todas as telas: modal com cabeçalho,
corpo rolável e rodapé; formulário, filtro e intervalo de datas; seleção de opções; prévia de mídia com exportação;
legenda, aviso e motivo de ação indisponível. Corrige-se a peça de `ui/`, não margem por tela.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde moram os padrões | `docs/design-e-front.md` seção 4.6 (P1 a P5), com status Peça existe, Proposto ou Verificado | Gustavo, 10/11 |
| D2 | Conferência | Seção 6.4 ganhou o bloco "Composição" (alinhamento, espaços vazios, ações, rolagem, mensagens, consistência) | Gustavo, 10/11 |
| D3 | Exigência | Uma linha no `AGENTS.md` e o procedimento no `executor-front.md`, só com link, sem repetir as regras | Gustavo, 10/11 |
| D4 | Skill `referencias-front` | Só princípios gerais; o detalhe do app fica no projeto | Gustavo, 10/11 |
| D5 | Quem implementa | `executor-front` (Opus), uma tela representativa por chamada | roteamento do Gustavo |

## Evidências do guia (PDF de 10/11) e o padrão de cada uma
Fonte: `C:\Users\GustavoToebe\Desktop\orientacoes-correcao-visual-front.pdf` (oito prints do Gustavo). Os prints mostram **sintoma**; a causa se confirma na tela (as "hipóteses" da 4.6 são só de leitura do código).

| # | Tela | Padrão | O que corrigir |
| --- | --- | --- | --- |
| 01 | Comparação de fotos (`fotos/CartaoFotos`) | P4, P5 | Par próximo, largura controlada, áreas equivalentes, proporção preservada, data e peso junto de cada foto, resumo abaixo do par; variação de peso sem sentido bom ou ruim atribuído sem contexto |
| 02 | Gerar imagem: prévia e rodapé | P4, P1 | Prévia e configurações lado a lado no PC (empilhadas no celular), altura da prévia limitada mantendo a proporção, ação no rodapé fixo, prévia fiel ao arquivo |
| 03 | Gerar imagem: controles | P4, P3, P5 | Coluna de configurações, switch da logo colado ao rótulo, formato no componente de seleção do projeto, autorização como status textual discreto (uma vez), foco distinto da seleção |
| 04 | Gerar imagem: dois formatos e rodapé | P4, P1, P5 | Explicação logo abaixo do seletor com "Os dois", rodapé estável nas variantes, rótulo "Baixar imagens (.zip)", alternar formato não desloca a ação, fim da rolagem sem sobreposição |
| 05 | Editar exercício (Biblioteca) | P1 | Investigar a faixa vazia entre "Tirar da biblioteca" e o rodapé (padding, altura mínima, área segura, compensação do rodapé); remoção como ação secundária de risco separada dos campos; Cancelar e Salvar no rodapé comum |
| 06 | Ação indisponível com motivo ("Criar e editar", "Informe o nome do modelo.") | P5, P1 | Grupo ação + mensagem padronizado, motivo sempre visível e colado, quebra de linha, sem tooltip, sem salto; conferir os outros rodapés com motivo |
| 07 | Mover interessado | P3, P1 | Lista de ações de largura uniforme, mudar de etapa separado de aceitar e de encerrar; **manter o comportamento atual** (se hoje confirma, continua confirmando; se é imediato, continua imediato) |
| 08 | Filtros de data dos Interessados | P2 | Rótulos e altura padronizados, De e Até como grupo, base comum com Responsável e Origem, nome acessível inequívoco ("Entrada: data inicial"), sem data comprimida nem calendário cortado |

## Passos
- [x] 1. Padrões P1 a P5 em `docs/design-e-front.md` 4.6 e conferência em 6.4 (só documento; nada verificado na tela) — commit: —
- [x] 2. Linha no `AGENTS.md`, procedimento no `executor-front.md`, princípios na skill — commit: — (a skill e o agente ficam em `~/.claude`, fora do repositório)
- [x] 3. Prints recebidos (PDF acima) e mapeados nos padrões (tabela acima) — commit: —
- [ ] 4. Implementação pelo `executor-front`, **uma chamada por vez** (os e2e compartilham `dist-e2e`; entra depois da troca de seleções e da ficha em abas): confirmar a causa na tela e corrigir na peça compartilhada, nunca margem por tela — commit: —
  - [x] 4a. P1 + P5: rodapé único da `Folha` e do `PainelConfirmacao` com `LinhaDeAcoes`, grupo ação + motivo (evidências 05 e 06 e as folhas equivalentes) — commit: `04cb44ea`
    - Feito: `ui/LinhaDeAcoes` ganhou `RodapeDeAcoes` (PC: status à esquerda, ações à direita com a principal na ponta;
      celular: status em cima e ações em coluna, principal em cima e cheia) e o contexto de arranjo que o `Botao` lê
      (motivo colado sob a ação, alinhado à mesma borda; `cheio` automático no rodapé empilhado); `Folha` com
      `statusDoRodape` e corpo que preenche até o rodapé quando há `largura` (fim da faixa vazia, evidência 05);
      `PainelConfirmacao` no mesmo rodapé (motivo sob a ação, uma vez só, evidência 06); `RolagemComTopo` só reserva a
      folga do botão "voltar ao início" quando dá para rolar mais de 400 px (era 68 px fixos de vazio em folha curta).
      Telas ajustadas ao `statusDoRodape`: `FolhaCompromisso`, `FolhaEvento`, `PainelDeAgendas`, `FolhaGerar`.
    - Verificação (10/11, porta 8110): `app/e2e/composicao-rodape.spec.ts` (novo) + `comparacao-de-fotos` +
      `interessados-composicao`: 87 verdes; `typecheck` e `lint` sem erro; `npm test` 6333 verdes. Suíte e2e inteira
      (porta 8111): 1223 verdes, 10 skipped, 10 falhas **que não vêm do 4a** (specs antigos, abaixo). Sem capturas.
    - Não conferido: celular nativo (só web); folhas que não passam pelos specs acima (leitura do código).
    - Validade: árvore local de 10/11/2026 sem commit; refazer o e2e se `ui/Folha`, `ui/LinhaDeAcoes`, `ui/Botao`,
      `ui/PainelConfirmacao` ou `ui/RolagemComTopo` mudarem.
  - [x] 4b. P4 (+ P1, P3, P5): `fotos/CartaoFotos`, `FolhaGerar` e comparação (evidências 01 a 04) — commit: `6a726e29`
    - Causas confirmadas na tela: 01 = célula com `flexGrow` e foto de 400 px fixos à esquerda (vão de ~86 px em 1280 e
      ~406 em 1920) e altura fixa com `cover` (proporção mudava com a largura); 02/04 = botão no fim do corpo rolável,
      fora da janela em 390 (borda em 915 com janela de 844) e com rolagem em 1280, prévia de altura fixa 460; 03 =
      switch longe do rótulo pelo `flex:1` do rótulo no `Interruptor` (rótulo de 948 px), autorização duplicada (texto e
      `motivo`). O `Escolha` já separa foco (anel do `:focus-visible`) de seleção (invertida).
    - Feito: `fotos/CartaoFotos.tsx` (grade de largura controlada, 280 px no máximo, 3:4 com `contain`, legenda e resumo
      no bloco do par; `FolhaGerar` com `rodape` da `Folha`, lado a lado a partir de 640 px úteis, altura da prévia
      calculada pelo Feed para não mover nada ao trocar o formato, `Escolha distribuida`, `Interruptor` numa caixa do
      tamanho do conteúdo, status "Aluno autorizou em" ou o motivo do botão, erro no rodapé, "Baixar imagens (.zip)");
      novo `fotos/PreviaDaImagem.tsx` (geometria do `layoutDaImagem`, sem moldura, `#000` comentado, logo com a
      proporção real).
    - Verificação: `app/e2e/comparacao-de-fotos.spec.ts` (28 casos, verdes duas vezes seguidas em 10/11, porta 8102):
      composição em 390, 768, 1280 e 1920 no claro e escuro e em 390 e 1280 no areia e contraste alto; sem autorização,
      erro 500, 409 de autorização e carrossel em 390 e 1280; foco por seta. Os specs passaram a abrir `?aba=evolucao`
      (ficha em abas). Sem capturas.
    - Não conferido: faixa vazia abaixo do rodapé em 768 e 1920 (defeito da `Folha`, abaixo); celular nativo; o switch
      da logo sem logo na consultoria; prévia com logo de proporção não quadrada (só leitura do código).
    - Para o 4a (peças compartilhadas, não mexidas): `Folha` com `largura` fixa a altura em 90% e a área do corpo não
      cresce (sobra faixa embaixo do rodapé quando o corpo é curto); rodapé da `Folha` sem arranjo de status + ação nem
      botão cheio no celular (montado na `FolhaGerar` com `shortcut:`); `motivo` do `Botao` alinhado à esquerda num
      rodapé alinhado à direita; `Interruptor` com rótulo `flex:1` afasta o switch; `ImagemProtegida` sem variante sem
      moldura (por isso o `Quadro` local da `PreviaDaImagem`).
    - Validade: árvore local de 10/11/2026 sem commit; refazer o e2e se `ui/Folha`, `ui/Escolha`, `ui/Interruptor`
      (`Campos.tsx`), `ui/Botao` ou `dominio/comparacaoDeFotos` mudarem.
  - [x] 4c. P2 + P3: `treinador/interessados` (evidências 07 e 08) — commit: `f9790e2c`
    - Causas confirmadas na tela: 08 = `CamposDePeriodo` com dois níveis de rótulo e base de 280 px por célula (De e Até
      empilhados até em 1280 e 768), seletor de 52 px com rótulo dentro ao lado de data de 44 px com rótulo em cima,
      nomes "De"/"Até" repetidos; 07 = botões de larguras diferentes, sem grupo, e a faixa vazia no fim vem do
      `paddingBottom` de 68 px do `ui/RolagemComTopo` (o mesmo de toda `Folha`, provável causa da evidência 05).
    - Feito: `treinador/interessados/PeriodoDoFiltro.tsx` (par local, `shortcut:` até o passo 6), grade de duas linhas
      em `app/treinador/interessados.tsx` (Responsável | Origem; Entrada | Última atividade), "Mover para" com
      `ItemDeLista` em dois grupos em `QuadroKanban.tsx` (comportamento igual: etapa na hora; aceitar, recusar,
      desistiu e reabrir abrem a confirmação), Responsável e Origem da `FolhaDaInscricao` com a mesma largura.
    - Verificação: `app/e2e/interessados-composicao.spec.ts` (33 casos: filtros em 390 e 1280 nos 4 temas, 768 e 1920
      no claro e escuro, Kanban e Lista; Mover em 390 e 1280 nos 4 temas; encerrada), `interessados-crm`,
      `interessados-estabilidade` e o caso Interessados de `filtros-nas-listas`, todos verdes em 10/11 (porta 8103).
      `inscricao`, `inscricao-perguntas` e
      `banco-vazio` verdes. Sem capturas. Não conferido: tela sem Responsável/Origem (não existe: nenhuma permissão os
      esconde); alinhamento da `FolhaDaInscricao` só por leitura.
    - Para o 4a/passo 6 (peças compartilhadas, não mexidas): promover o par ao `CamposDePeriodo` e apagar o local;
      `paddingBottom` do `RolagemComTopo`; alturas e idiomas de rótulo de `SelecaoMultiplaSuspensa`/`EscolhaSuspensa`
      (52, dentro), `Campo`/`CampoData` (44, em cima) e `EscolhaEmFolha` (44, em linha); "Abrir calendário" sem o nome
      do campo (`ui/Calendario`).
    - Validade: árvore local de 10/11/2026 sem commit; refazer o e2e se `ui/Folha`, `ui/ItemDeLista`, `ui/CampoData`
      ou `CamposEmLinha` mudarem.
  - Aceite (Gustavo, 10/11: **sem capturas de tela**): conferir a renderização em 390, 768, 1280 e desktop amplo (1920, pois os prints 01 a 04 mostram distribuição ruim em tela larga), temas claro e escuro, de cada tela e de uma equivalente, por e2e com asserções de posição e tamanho (rodapé visível, ações na mesma borda, sem sobreposição) e inspeção no navegador, sem salvar imagem; verificações rodadas com resultado.
- [ ] 5. Conferência visual e promoção de **Proposto** para **Verificado** na 4.6, com o e2e ou a conferência que a sustenta (sem capturas) — commit: —
- [ ] 6. Aplicar às demais ocorrências (Grep pela peça, tela por tela) — commit: —

## Fora do escopo
- Mudar token, tipografia ou tema; regra de negócio, permissão, contrato da API, fila offline.
- Tela nova ou redesenho de fluxo.

## O que ficou para trás
- Nada foi conferido na tela: os status "Peça existe" vêm só de leitura do código em 10/11/2026
  (`Folha`, `PainelConfirmacao`, `BarraDeFiltros`, `CamposEmLinha`, `Campo`, `Botao`, `LinhaDeAcoes`, `Estados`,
  `Escolha`, `GradeDeOpcoes`, `OpcaoCartao` e `FolhaGerar` em `fotos/CartaoFotos.tsx`).
- As "hipóteses de causa" da 4.6 precisam dos prints para confirmar.
- Não lidos: `Cartao`, `Aviso`, `EscolhaEmFolha`, `SelecaoMultiplaSuspensa`, `Campos.tsx` além do `CampoData`.
- Validade: decisões valem sobre a árvore local de 10/11/2026 sem commit; reconfira os arquivos acima antes de implementar.
- Suíte e2e inteira em 10/11 (após o 4a): 10 falhas, todas de spec desatualizado, nenhuma do 4a. `opcao()` procura
  `button` onde a `Escolha` é `radio` (commit 6fe06a1e): `agenda-calendario` (533 e 594, 390 e 1280),
  `agenda-presencial:409` (390 e 1280), `unidade-de-carga:85` (390 e 1280), `cores-por-situacao:55` (o "Aumentar" da
  meta do peso). `painel:187` espera a URL sem `?aba=acompanhamento` (ficha em abas, a97aa6ae). Próximo responsável:
  quem cuida desses specs (troca mecânica `button` → `radio` e a URL).
- Fora do 4c, achado em 10/11: `e2e/filtros-nas-listas.spec.ts` falha em 8 casos (Cobranças, Lançamentos, Importação e
  Planejamento › Atualização, 390 e 1280): o `opcao()` do spec procura `button`, e a `Escolha` passou a `radio` no
  commit 6fe06a1e (09/11). A mesma causa derruba 5 casos de `e2e/filtros-do-endereco.spec.ts` (`opcao()` na linha 22;
  Interessados `?retornos=` e `?etapas=`, Financeiro `?situacao=VENCIDA` e valores desconhecidos). Não vem do 4c;
  próximo responsável: quem cuida desses specs.
