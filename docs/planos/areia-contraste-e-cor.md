# Areia com contraste e os pedidos de cor

Situação: Planejando (plano pronto, esperando o Gustavo reconciliar os valores da Areia; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: pedidos da reunião de 15/11 (IDs R1115-Cxx) e leitura do código em 16/11/2026 (conferências abaixo). Validade: vale enquanto `AREIA` em `app/src/tema/tokens.ts` e os valores de `docs/design-e-front.md:188-195` não mudarem; **se mudarem, refazer a seção "Estado do código"**.

## Objetivo
O treinador do piloto só usa tema claro e, na paleta Areia, não distingue cartão, faixa do título e fundo (pedido da reunião de 15/11: fundo de uma cor e tudo o que está na frente claro). Pediu também mais destaque em controles que não enxerga. Ao fim: na Areia o cartão e o campo são brancos sobre a página areia, a faixa do título e a faixa do exercício se distinguem da página e do cartão (aprovado por ele olhando capturas) e os controles que ele não enxerga ganham o destaque mais barato que a regra de cor contida permite (nome, posição, `Botao primario` onde é a ação principal), **sem cor nova**.

## Estado do código (conferido em 16/11/2026, 21:27)
- **Divergência a resolver antes de tudo.** `AREIA` em `app/src/tema/tokens.ts:124-136` hoje tem `fundo`/`painel` `#F4F1EA`, `superficie` `#FFFFFF`, `superficie2` `#ECE7DD`, `superficie3` `#FFFFFF`, `faixaForte` `#DDD6C7`, `campo` `#ECE7DD`. Já `docs/design-e-front.md:188-195` e `docs/planos/areia-do-saraiva.md` (publicada em 14/11) dizem página `#CDCAC3`, cartão `#E6E5E1`, `faixaForte` `#CCC9C1`; `#CDCAC3` não aparece mais em nenhum arquivo de `app/src`. O arquivo foi gravado em 16/11 às 21:27, depois do rascunho (base `61dc3a5a`): **alguém mexeu na Areia depois da análise** (outra sessão ou o Gustavo; não sei quem nem por quê, e não uso git aqui). Conta minha (fórmula WCAG, não rodada em teste): cartão branco × página `#F4F1EA` dá cerca de 1,13:1, bem abaixo do 1,64:1 que o rascunho propunha para a página `#CDCAC3`.
- Cartão branco (`superficie` `#FFFFFF`) já vale no código; campo branco, faixa do título e faixa do exercício não batem com a proposta.
- Confirmado: `LARGURA_MAXIMA = 1800` (`tokens.ts:564`), `LARGURA_EDITOR_DUAS_COLUNAS` (`:580`) e `LARGURA_LISTA = 1800` (`:582`, literal, não derivada); `LARGURA_MENU_LATERAL = 768` (`:568`); `ALVO_TOQUE = 44` (`:563`); piso de contraste `superficie3 × fundo ≥ 1,1` em `tokens.test.ts:78-84`; `temaPadrao = Tema.CLARO` em `Consultoria.java:52`; `PlanejamentoIndex` usa `Abas` (`planejamento/index.tsx:115`) e `Escolha` segmentada (`:121`); botões "Receita de séries" (`treinador/treino/CartaoExercicio.tsx:144`), "Modelos prontos" (`treinador/dieta/EditorDeDieta.tsx:134`) e "Adicionar refeição" (`:312`), todos `secundario`; regra "um `primario` por área" (`docs/design-e-front.md:243`), lista fechada da marca (`:269-280`) e "sem sombra" (`:104`, `:148`).
- **Não conferido** (linhas do rascunho, que ficou na base antiga): `SUPERFICIE_AREIA` e `tingido(...)` da Areia (a constante não existe mais com esse nome), `tokens.test.ts:82` e `:272`, `contrasteDasPecas.test.ts:62`, `dominio/preferencias.test.ts:156-158`, `agenda-legivel.spec.ts:86,172-200`, usos de `<Cartao` (305), `<Abas` (21), `<Escolha` (189) e `Botao secundario` (379), `BlocoAdicionar.tsx:13`, `FolhasDoTreino.tsx:88`, `CartaoGrupo.tsx:114`, `ui/Estados.tsx:138`, `Agenda` em 1920, 2560 e 3440 px.

## Itens da reunião cobertos
| ID | Pedido | Situação hoje | Tipo de mudança | Passo |
| --- | --- | --- | --- | --- |
| R1115-C99 | Areia sem contraste: cartão, título e fundo da mesma cor; quer cartão branco puro | Para decidir (valores abaixo; o treinador aprova por captura) | Valor de token de paleta (design system), só estilo e teste | 1 a 6 |
| R1115-C100 | Só consegue usar tema claro | Respondido (falta o Gustavo conferir o tema padrão em produção) | Nenhuma de código | 7 |
| R1115-C94 | Cor em "Adicionar refeição" e "Modelos prontos" da dieta | Para decidir (sai da lista do treinador) | Apresentação, só a instância | 8, 9 |
| R1115-C96 | Um controle vermelho do editor de treino, não identificado | Aguardando (o treinador identifica) | Apresentação | 8, 9 |
| R1115-C97 | "Usar receita" (na tela: "Receita de séries") passa despercebido | Para decidir (o plano `editor-e-modelos-achar-as-coisas.md` trata nome e posição) | Apresentação e texto, só a instância | 8, 9 |
| R1115-C98 | Pôr cor no que ele não enxerga, começando pelas abas do Planejamento | Para decidir (sai da lista do treinador) | Apresentação; padrão de aba ou segmento = design system | 8, 9 |
| R1115-C130 | Layout não preenche bem tela ultra-wide | Testar de novo | Token de largura (uma constante), sem contrato | 10 |
| R1115-C101 | Cores aprovadas na Biblioteca/dieta e no Financeiro | Validado na reunião (não desfazer) | Nenhuma | — |
| R1115-C102 | Estética preto e branco do app de referência: gostou | Validado na reunião (não desfazer) | Nenhuma | — |

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Só a Areia muda. Claro, Lavanda, Céu, Rosa e as cinco escuras ficam como estão | `AREIA` em `tokens.ts:124`; as outras claras herdam do `CLARO` | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D2 | Na Areia o cartão e o campo são branco puro sobre a página areia | `superficie` já é `#FFFFFF` no código; `campo` hoje `#ECE7DD`, proposta `#FFFFFF` com o contorno `bordaCampo` separando | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D3 | Tom da página, faixa do título (`superficie2`) e faixa do exercício/grupo (`faixaForte`): partir da proposta da tabela abaixo (página `#CDCAC3`), que dá 1,64:1 de cartão × página; o piso novo no teste trava isso | Proposta calculada sobre `design-e-front.md:188-195`; **conflita com o `tokens.ts` de 21:27** (ver "Estado do código"): o Gustavo diz qual vale antes do passo 3 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D4 | Sem sombra. Contorno de 1 px e flat continuam a identidade | `docs/design-e-front.md:104,148`; `docs/planos/superficies-das-paletas-claras.md:19` (não reconferido), `ui/Cartao.tsx` | Regra do projeto |
| D5 | Mudar valor de token de paleta é design system: o plano lista as telas afetadas e há capturas antes/depois para o treinador aprovar olhando, antes do commit final | `AGENTS.md`/`design-e-front.md` (token compartilhado); `docs/planos/areia-do-saraiva.md` deixou a aprovação dele pendente | Regra do projeto |
| D6 | C100: nada de código. O padrão de consultoria nova é `CLARO`; o valor da consultoria do piloto em produção o Gustavo confere só lendo | `Consultoria.java:52` | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D7 | "Pôr cor": não criar cor nova. Primeiro fechar com o treinador a lista dos controles que ele não enxerga; depois, por controle, o destaque mais barato: nome claro, posição e, onde é a ação principal, `Botao primario` (cor da marca) | Marca só na lista fechada, "Qualquer outro lugar precisa de decisão nova" (`design-e-front.md:269-280`); um `primario` por área (`:243`) | Regra do projeto |
| D8 | Abas: melhorar o contraste do estado selecionado dentro do padrão, sem cor por aba | `ui/Abas.tsx` (existe; indicador de marca é da lista fechada) | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D9 | Refazer as medições dos controles com a Areia corrigida (parte do "não enxergo" pode ser a própria Areia) | Passo 9 depois do passo 5 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D10 | C130: manter o teto de 1800 px; só conferir renderizado em 1920, 2560 e 3440 px; mudar o teto é do Gustavo | `tokens.ts:564,580,582` | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D11 | C101 e C102 ficam como estão (cores P/C/G, cartões do Financeiro, estética flat de base neutra) | Validado na reunião | Reunião de 15/11 |
| D12 | Sem camada de compatibilidade: a Areia nova substitui a de 14/11, sem flag nem versão antiga | `AGENTS.md` (compatibilidade com o legado) | Regra do projeto |
| D13 | "Abas" do pedido: a linha Treino/Dieta/Pacotes (`Abas`, `planejamento/index.tsx:115`) ou a linha Semanas/Dias/Receitas (`Escolha`, `:121`)? Mostrar a Areia nova e perguntar por captura; a trilha do segmento usa `superficie2`, então a mudança já a destaca | Pergunta do passo 8 | Decidido pela recomendação em 16/11, conferir com o Gustavo |

### Proposta de valores (rascunho de 16/11, contas feitas por quem escreveu o rascunho com a fórmula WCAG do projeto; não reexecutadas aqui, conferir em captura e em teste)
| Token | Em `design-e-front.md` | Proposta | Razão de contraste (proposta) |
| --- | --- | --- | --- |
| `fundo` / `painel` (página) | `#CDCAC3` | igual | cartão × página 1,64 |
| `superficie` (cartão) e `campo` | `#E6E5E1` / `#F4F3F0` | `#FFFFFF` | `texto` × cartão 18,85; `bordaCampo` × campo 6,45 |
| `superficie2` (faixa do título, linhas, hover, trilha do segmento) | `#D9D6CF` | `#EDEBE7` | × cartão 1,19; × página 1,37 |
| `superficie3` (seleção) | `#D7D4CD` | igual | × página 1,11 (piso 1,1) |
| `faixaForte` (exercício e grupo no editor de treino) | `#CCC9C1` | `#C3C0B8` (alternativa `#C0BDB5`, `textoSuave` cai a 4,53) | × página 1,11; × cartão 1,82; `textoSuave` 4,68 (piso 4,5) |
| selos `sucessoSuave`/`atencaoSuave`/`perigoSuave` | tingidos sobre o cartão antigo | tingidos sobre `#FFFFFF` (saem sozinhos pela função `tingido`) | texto sobre selo 7,2 a 7,3 |
| `divisor`, `borda`, `bordaCampo`, `textoSuave`, status, fases | atuais | atuais | só ganham folga sobre o branco |

## Passos
- [ ] 1. Reconciliar o `tokens.ts` com a decisão D3 e registrar de onde veio o `AREIA` de 21:27 — executor: Gustavo (decide) com a sessão principal (conferir) · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Dizer se o `AREIA` atual é deliberado. Se for, este plano passa a medir o que está (cartão × página 1,13) e a discussão é se o treinador aprova; se não for, volta aos valores da proposta. Sem isso, os passos 3 a 6 ficam parados.
- [ ] 2. Capturas "antes" da Areia vigente — executor: executor-rapido · tamanho: P · migration: não · APK: não · API: nenhuma (dados fictícios) · commit: —
  - Reaproveitar `app/e2e/capturas-paletas.spec.ts` (existe; o rascunho diz que só roda com `CAPTURAS_PALETAS=<pasta>`, não reconferido). Telas, em 390 e 1280 px com a Areia: Planejamento, editor de modelo/treino, editor de dieta, Início, ficha do aluno, Agenda, Financeiro, Biblioteca, Equipe, Ajustes, Comunidade, Marca (prévia da Areia), mais contraste alto e bordas reforçadas do editor de treino. Capturas fora do git.
- [ ] 3. Tokens da Areia e testes — executor: executor-front · tamanho: M · migration: não · APK: não (só valor de token em JS; se o app nativo recebe por OTA ou exige APK novo não foi conferido, mas não há `expo-updates` em `app/package.json` nem `app/app.json`, então vale APK novo) · API: nenhuma · commit: —
  - Teste primeiro, em `app/src/tema/tokens.test.ts`: teste só da Areia que fixa a ordem e os pisos (cartão × página ≥ 1,5; `superficie2` ≥ 1,15 do cartão e ≥ 1,3 da página; `faixaForte` ≥ 1,1 da página e ≥ 1,6 do cartão). O piso do projeto hoje é só 1,1, por isso um contraste de 1,13 a 1,30 passa e o treinador não vê.
  - Depois os valores aprovados no passo 1 em `tokens.ts` (campo, `superficie2`, `faixaForte`, página). Não tocar nas outras paletas nem nas colunas `areia` das cores fixas. Atualizar o comentário do bloco `AREIA` ("cartão Nível 1 sempre #FFFFFF", `tokens.ts:121-123`).
  - Rodar sem afrouxar piso: `tokens.test.ts`, `ui/contrasteDasPecas.test.ts`, `treinador/agenda/contrasteDaAgenda.test.ts` (não conferido), `dominio/paletas.test.ts`, `dominio/preferencias.test.ts`, `tema/TemaProvider.semUsuario.test.tsx`, `npm run typecheck && npm run lint`.
- [ ] 4. Capturas "depois" e prancha antes/depois — executor: executor-front · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Mesmas telas e larguras do passo 2. Olhar a faixa do exercício e do grupo, a faixa do `Cartao`, a trilha do segmento do Planejamento, selos sobre o cartão branco e sobre a faixa, o `Alerta`, gráficos e barras de progresso dentro do cartão, o interruptor desligado e o campo sobre o cartão (só o contorno o separa).
- [ ] 5. Aprovação do treinador pelas capturas — executor: Gustavo · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - "Aprovado" fecha o C99; outro tom volta ao passo 3. Sem aprovação, não há commit final.
- [ ] 6. Documentação da Areia — executor: executor-rapido (texto já decidido) · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `docs/design-e-front.md:186-195` (valores e a frase "branco quente, não branco puro", desfeita), `AGENTS.md` (a frase da Areia na seção do tema, linha não conferida) e o cabeçalho de `docs/planos/areia-do-saraiva.md`. Arquivo gerado nunca à mão.
- [ ] 7. C100: conferir o tema padrão da consultoria do piloto em produção — executor: Gustavo (só leitura) · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Se não for Areia nem Claro, dizer a ele onde trocar (Marca ou Ajustes). Registrar o valor aqui, sem dado pessoal.
- [ ] 8. Lista fechada dos controles que o treinador não enxerga, vista na Areia nova — executor: Gustavo (com o treinador) · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Depois dos passos 4 e 5. Saída: tabela "controle · tela · o que ele quer ver", incluindo o controle vermelho (C96) e a resposta de D13.
- [ ] 9. Destaque por controle da lista — executor: sessão principal (instância) e executor-front (se tocar o padrão de `Abas` ou `Escolha`) · tamanho: P a M · migration: não · APK: não · API: nenhuma · commit: —
  - Candidatos conhecidos (confirmados no código): "Adicionar refeição" e "Modelos prontos" (secundários), "Receita de séries" (`CartaoExercicio.tsx:144`, secundário; na folha o título é "Usar receita"). Por controle: nome claro, posição e, onde é a ação principal, `Botao primario`.
  - Cuidado com "um `primario` por área": a barra do editor já tem "Salvar modelo" como primário; "Adicionar" só vira primário no estado vazio, nunca ao lado do Salvar. Vermelho avulso não cabe (é a marca e `perigo`).
  - Não mexer no tipo `secundario` (usado no app inteiro): só a instância. Padrão de aba ou segmento é design system: lista de telas e capturas antes/depois como no passo 4.
  - Medir o contraste de cada controle escolhido na Areia nova e registrar aqui.
- [ ] 10. C130: conferência renderizada em tela larga e, se o Gustavo decidir, mudar o teto — executor: executor-front (capturas) e Gustavo (decide) · tamanho: P a M · migration: não · APK: não · API: nenhuma · commit: —
  - Capturar Agenda e ficha do aluno em 1920, 2560 e 3440 px, em Claro e Areia, e olhar a largura das colunas internas da ficha. Se subir, `tokens.ts:564` e `:582` (o `:580` acompanha) e conferir todas as telas que usam `Tela` e `largura={LARGURA_LISTA}`; atualizar `docs/design-e-front.md` (capturas até 1920 px).

## Critérios de aceite
- Na Areia, `superficie` e `campo` são `#FFFFFF`; `superficie2`, `faixaForte` e a página seguem o valor aprovado, e os testes de contraste do passo 3 passam sem afrouxar piso. As outras paletas estão idênticas.
- Conferido a 390 px e a 1280 px, web e APK novo, nos temas claro (Claro e Areia) e escuro, com contraste alto e bordas reforçadas na Areia.
- Capturas antes/depois vistas pelo treinador, aprovação registrada aqui. Ele diz "resolvido" quando vê fundo de uma cor, cartão branco na frente e as duas faixas como faixas, sem sombra.
- Cada controle da lista do passo 8 tem destaque decidido e medido; nenhuma cor nova; um primário por área.
- C130: capturas em 1920, 2560 e 3440 px guardadas e a decisão do Gustavo sobre o teto registrada.
- `docs/design-e-front.md`, `AGENTS.md` e `areia-do-saraiva.md` sem a frase "branco quente, não branco puro".

## Riscos e revisão
- Quem escolheu Areia: a preferência pessoal "Claro areia" e consultorias com `temaPadrao` AREIA (`Consultoria.java:31`); mudar a paleta muda a aparência de todos de uma vez.
- Selos e gráficos sobre o cartão branco: os testes cobrem texto e fundo do selo, não a aparência; por isso o passo 4 olha capturas.
- `faixaForte` a 1,11:1 da página fica só 0,1 acima do piso; depende de captura (alternativa registrada).
- Outra sessão pode estar mexendo em `tokens.ts`: passo 1 evita duas versões da Areia.
- Tema do PDF próprio: hipótese, não conferida, de que nenhum PDF muda.
- Revisão: sem revisão independente (sem segurança, isolamento, migration nem contrato); basta o diff pela sessão principal e a aprovação pelas capturas.

## Fora do escopo
- Sombra no cartão: decidida contra (D4); reverter é decisão do Gustavo e custa token novo, mudança em `ui/Cartao.tsx` e reescrever regras de `design-e-front.md`.
- Tema escuro do Gustavo (a frase sobre fundo escuro do pedido contradiz o resto): sem ação.
- R1115-C95 (cartões de alimento cinza no escuro): é do escuro, outra frente.
- R1115-C103 e R1115-C104 (paleta neon e efeito de toque do app de referência): referência, sem pedido.
- `Botao tipo="secundario"` para todo o app, cor por aba ou nova cor de identificação: pedem decisão nova na regra de cor.

## O que ficou para trás
- (nada ainda)
