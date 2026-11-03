# Auditoria de UI/UX: cores por situação

Situação: Planejando (dúvidas respondidas em 03/11) · Onde: branch `auditoria-cores` (worktree `wt-auditoria-cores`, saída da `main` em `3d65e04b`) · Atualizado: 03/11/2026

## Objetivo
Cada cor passa a dizer uma coisa só:
- a cor da marca serve só para destaque e ação;
- erro e alerta têm tom próprio;
- desabilitado é cinza;
- cada situação tem uma cor só, a mesma no aluno e no treinador.

A regra escrita e a tabela "situação → cor", com o contraste medido, estão em `docs/design-e-front.md`, seção 4.5.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Uso da cor da marca | Só em destaque e ação, pela lista fechada da seção 4.5. Erro e alerta têm tom próprio (`perigo`, `atencao`) e desabilitado é cinza. | Gustavo, 03/11 (N24 da 2ª passada) |
| D2 | Cor de status | Uma cor por situação. Âmbar (`atencao`) só para quem precisa agir; quem espera vê neutro. O texto diz quem age: o aluno que enviou vê "Enviada · aguardando revisão" em neutro e o treinador vê "Para revisar" em âmbar. | Gustavo, 03/11 (N25; resposta 2) |
| D3 | Visual do desabilitado | Fundo `superficie3`, borda `borda`, texto e ícone `textoSuave`. Sem opacidade, sem a marca e sem token novo. O pior contraste do texto é 5,42 (escuro). | Gustavo, 03/11 (resposta 6: o botão desabilitado é cinza) |
| D4 | Fundo do selo | Sempre opaco, com o `tingido` da própria cor, porque o selo transparente sobre a `faixaForte` fica abaixo de 4,5:1. O pior caso fica em 5,14. | Proposta (Claude, 03/11) |
| D5 | Tom do aviso de rodapé | O `useAviso` ganha o tom `atencao`, para o alerta que não é erro. | Proposta (Claude, 03/11) |
| D6 | Cobrança vencida | `perigo` nos dois lados. Para o aluno, o texto é "Vencida há N dias" e continua calmo; nada é bloqueado. | Gustavo, 03/11 (resposta 1) |
| D7 | Coisa futura marcada | `neutro`, sempre com a data (compromisso, lembrete agendado, atualização daqui a N dias). | Gustavo, 03/11 (resposta 3) |
| D8 | Barra da marca na sessão do editor de treino (`CartaoSessao`) | Fica e entra na lista fechada da seção 4.5. | Gustavo, 03/11 (resposta 4) |
| D9 | Dia treinado no cartão para compartilhar (`cartaoDoTreino`) | Fica na cor da marca, como exceção escrita. | Gustavo, 03/11 (resposta 5) |
| D11 | Status de cobrança | Exceção ao D2: segue os três tons comuns aos apps, para quem paga e para quem espera. Em aberto `atencao`, Vencida `perigo`, Paga `sucesso`, Cancelada e Isenta `neutro` (`dominio/minhaConta.situacaoDaCobrancaParaTela` já faz assim; o Financeiro segue igual). Vale para qualquer marca: `sucesso`, `atencao` e `perigo` são fixos no tema e nunca vêm da cor da consultoria, e o status sempre leva texto e ícone. | Gustavo, 03/11 |
| D10 | Marca parecida com erro | Distinguir pela forma: o confirmar destrutivo ganha ícone e o rótulo do resultado; o erro continua com ícone e fundo `tingido`; a Marca ganha um aviso que não bloqueia o Salvar. | Gustavo, 03/11 (resposta 6) |

## Inventário (03/11, sobre `3d65e04b`)

**A marca fora da lista fechada:**
- `treinador/treino/CartaoSessao.tsx`: barra lateral de 4 px na cor da marca. O comentário diz "identidade, não
  status" (protótipo de 30/10). Fica (D8).
- `dominio/cartaoDoTreino.ts` e `aluno/CartaoDoTreino.tsx`: o dia treinado aparece na cor da marca no cartão para
  compartilhar, e "dia treinado" é status. Fica (D9).

Os demais usos estão na lista fechada: `Botao`, `Abas`, `Navegacao`, `CartaoHoje`, `MarcaTitulo`, `Calendario`
(hoje, "Hoje" e "Limpar"), as prévias de `FormMarca` e `PreferenciasDoApp`, e os PDFs.

**A marca encosta no erro:** `Consultoria.java` nasce com a marca `#C62828`, que é exatamente o `perigoFundo` do
tema escuro, e o `e2e/api-falsa.ts` usa `#B91C1C`, que é quase o `perigo` do claro. Com essa marca:
- o botão primário e o botão de confirmar destrutivo do `PainelConfirmacao` ficam com o mesmo vermelho;
- no `CartaoSessao`, a barra da marca encosta na borda vermelha do "Corrigir".

**Desabilitado por opacidade (0,4 a 0,55) em vez de cinza:**
- base do RNR, por `className`: `components/ui/button.tsx` (`props.disabled && 'opacity-50'`, que se soma à
  opacidade do `Botao`), `input.tsx` (`editable === false`, usado pelo `Campo` e pela `BuscaGlobal`),
  `toggle-group.tsx` e `toggle.tsx` (usados pela `Escolha`), `label.tsx` (`peer-disabled`) e `tabs.tsx` (usado
  pelas `Abas`);
- peças: `ui/Botao.tsx` (a marca a 50%), `ui/TelaPublica.tsx` (`BotaoPublico`, com a cor da consultoria),
  `ui/IconeBotao.tsx`, `ui/Escolha.tsx`, `ui/EscolhaEmFolha.tsx`, `ui/CaixaSelecao.tsx` e
  `ui/SelecaoMultiplaSuspensa.tsx` ("Limpar");
- telas: `treinador/treino/EditorDeTreino.tsx`, `treinador/dieta/EditorDeDieta.tsx`,
  `treinador/questionarios/SecoesDoQuestionario.tsx`, `treinador/marca/FolhaDoCatalogo.tsx` e
  `aluno/atualizacao/QuestionarioAtualizacao.tsx`;
- `ui/BotaoMarcar.tsx`: na prévia, o ✓ desabilitado não muda de visual.

**Alerta pintado como erro:** o `ui/Aviso.tsx` só tem `sucesso`, `perigo` e `neutro`. Por isso estes alertas saem em
vermelho:
- `FormMarca`: "A marca foi alterada em outra aba";
- `VerificacaoEmDuasEtapas`: "Nenhum aplicativo autenticador abriu o link";
- `CartaoMeuPlano`: "O navegador bloqueou a nova aba";
- `RespostaComModelo`: "A mensagem foi preparada, mas não deu para registrar".

**A mesma situação com cores diferentes:**

| Situação | Aluno (antes) | Treinador (antes) | Decidido |
| --- | --- | --- | --- |
| Atualização enviada | `sucesso` "Enviada" (`atualizacao.ts`, `paraFazer.ts`) | `atencao` "Para revisar" | aluno `neutro` "Enviada · aguardando revisão", treinador `atencao` (D2) |
| Anamnese enviada | `sucesso` "Enviada" (`anamnese.ts`) | `atencao` "Para revisar" | aluno `neutro`, treinador `atencao` (D2) |
| Atualização aberta | `atencao` "Responda até" (`statusAtualizacao`) e `neutro` "Até dd/mm" (`paraFazer`) | `neutro` "Hoje" ou "Em N dias" | aluno `atencao` nos dois pontos, treinador `neutro` (D2) |
| Atualização adiada | `atencao` (`statusAtualizacao`) e `neutro` (`paraFazer`) | `atencao` "Adiada para" | aluno `atencao`, treinador `neutro` (D2: quem age é o aluno) |
| Cobrança em aberto | `atencao` no "Meu plano" e `neutro` "Vence dd/mm" na pendência do Início (`paraFazer`) | `atencao` "Em aberto" | `atencao` "Em aberto" nos dois lados e nos dois pontos do aluno (D11: exceção dos três tons da cobrança) |
| Cobrança vencida | `perigo` no "Meu plano" e `atencao` na pendência do Início (`paraFazer`) | `perigo` "Vencida" | `perigo` nos dois, "Vencida há N dias" no aluno (D6) |
| Coisa futura marcada | `neutro` nos avisos de compromisso (`paraFazer`, "Novo", "Remarcado") | `atencao` "Agendado" (`agendaPresencial`, `lembretesDeCobranca`) e `neutro` na atualização futura | `neutro` nos dois, sempre com a data (D7) |

## Dúvidas respondidas (Gustavo, 03/11)
1. Cobrança vencida para o aluno: vermelho, como para o treinador, com "Vencida há N dias" (D6).
2. Quem age e quem espera: âmbar só para quem precisa agir; quem espera vê neutro (D2, que mudou). A atualização aberta
   fica neutra para o treinador, então o grupo "Em dia" da lista de alunos não ganha selo âmbar. Exceção: o status de
   cobrança segue os três tons (D11), então a cobrança em aberto é âmbar também para o treinador.
3. Coisa futura: cinza (neutro), sempre com a data (D7).
4. Barra da marca no `CartaoSessao`: fica (D8).
5. Dia treinado no cartão para compartilhar: fica na marca (D9).
6. Marca parecida com o erro: distinguir pela forma, e o botão desabilitado vira cinza (D10 e D3).

## Passos
Executor de cada passo:
- `executor-front` (Opus): o que é visual;
- `executor` (Sonnet): o que tem regra nova em `dominio/`, que vem antes da tela.

Todo passo de tela fecha com typecheck, lint, jest e o e2e da tela em 390 e 1280 px, claro e escuro, pela trava na
porta 8106.

- [x] 1. Regra e tabela em `docs/design-e-front.md` (4.1 e 4.2 apontam para a 4.5), este plano e a linha no índice.
  Sem espera. Commit: —
  - Arquivos: `docs/design-e-front.md`, `docs/planos/auditoria-cores.md` e `docs/planos/README.md` (só a linha
    desta frente).
- [ ] 2. **Tom igual nos dois lados: domínio** (`executor`). Espera o merge da frente 5 (`atualizacao.ts`) e o da
  frente 3 (`paraFazer.ts`). Commit: —
  - Arquivos:
    - `app/src/dominio/paraFazer.ts` e `paraFazer.test.ts`;
    - `app/src/dominio/anamnese.ts` e `anamnese.test.ts`;
    - `app/src/dominio/atualizacao.ts` e `atualizacao.test.ts` (frente 5);
    - `app/src/dominio/agendaPresencial.ts` e `agendaPresencial.test.ts` (Agenda: conferir com a sessão principal se
      é da frente 5);
    - `app/src/dominio/lembretesDeCobranca.ts` e `lembretesDeCobranca.test.ts` (Financeiro: conferir se é da frente 5);
    - novo `app/src/dominio/corPorSituacao.test.ts`.
  - Aceite: o `corPorSituacao.test.ts` chama as funções do aluno e as do treinador para cada linha da tabela de
    divergências e confere o tom da coluna "Decidido" (quem age, `atencao`; quem espera, `neutro`; vencida, `perigo`).
    Textos novos: "Vencida há N dias" (aluno) e "Enviada · aguardando revisão" (aluno). O `gruposDeAlunos.ts` não muda.
- [ ] 3. **Desabilitado cinza nas peças** (`executor-front`). Espera o merge da frente 4 (`Botao.tsx` e
  `contrasteDasPecas.test.ts`). Commit: —
  - Arquivos: `app/src/ui/Botao.tsx`, `TelaPublica.tsx`, `IconeBotao.tsx`, `Escolha.tsx`, `EscolhaEmFolha.tsx`,
    `CaixaSelecao.tsx`, `SelecaoMultiplaSuspensa.tsx` e `BotaoMarcar.tsx`; `app/src/components/ui/button.tsx`,
    `input.tsx`, `toggle-group.tsx`, `toggle.tsx`, `label.tsx` e `tabs.tsx`; `app/src/ui/contrasteDasPecas.test.ts`;
    novo `app/e2e/cores-por-situacao.spec.ts`, que simula a API no próprio spec (`page.route`) e não mexe no
    `e2e/api-falsa.ts`, que é da frente 5.
  - Aceite:
    - nenhuma peça usa opacidade para desabilitar;
    - o jest confere `textoSuave` sobre `superficie3` ≥ 4,5 nos três temas e no contraste alto;
    - o e2e confere com `toHaveCSS` que um `Botao` primário desabilitado tem fundo `superficie3` e texto
      `textoSuave`, e não a marca.
- [ ] 4. **Desabilitado cinza nas telas que pintam à mão** (`executor-front`). Espera o merge do PR B (editores) e
  da frente 3 (`QuestionarioAtualizacao`). Commit: —
  - Arquivos: `app/src/treinador/treino/EditorDeTreino.tsx` (PR B), `app/src/treinador/dieta/EditorDeDieta.tsx`
    (PR B), `app/src/treinador/questionarios/SecoesDoQuestionario.tsx`,
    `app/src/treinador/marca/FolhaDoCatalogo.tsx` e `app/src/aluno/atualizacao/QuestionarioAtualizacao.tsx`
    (frente 3).
  - Aceite: os mesmos tokens do passo 3; os e2e dos editores e da atualização continuam verdes.
- [ ] 5. **Selo opaco** (`executor-front`). Espera o merge da frente 4 (`contrasteDasPecas.test.ts`). Commit: —
  - Arquivos: `app/src/ui/Selo.tsx`, `app/src/ui/contrasteDasPecas.test.ts` e `app/e2e/editor-clareza.spec.ts`.
  - Aceite:
    - o jest confere cada tom sobre o próprio `tingido` ≥ 4,5 nos três temas;
    - o e2e confere com `toHaveCSS('background-color')` o selo "Cardio" na faixa do exercício, no claro e no escuro.
- [ ] 6. **Aviso de rodapé com tom de atenção** (`executor-front`). Espera o merge da frente 4 (`RespostaComModelo`)
  e da frente 3 (`CartaoMeuPlano`). Commit: —
  - Arquivos: `app/src/ui/Aviso.tsx`, `app/src/treinador/marca/FormMarca.tsx`,
    `app/src/treinador/seguranca/VerificacaoEmDuasEtapas.tsx`,
    `app/src/treinador/interessados/RespostaComModelo.tsx` (frente 4) e
    `app/src/aluno/financeiro/CartaoMeuPlano.tsx` (frente 3).
  - Aceite: os quatro alertas do inventário saem em âmbar, com ícone. O de erro continua vermelho e fica até ser
    fechado.
- [ ] 7. **Marca parecida com erro** (D10). Commit: —
  - 7a (`executor`): `app/src/dominio/paletas.ts` e `paletas.test.ts`, com o aviso de cor perto de um status, pela
    distância já usada em `tokens.test.ts`.
  - 7b (`executor-front`): `app/src/treinador/marca/FormMarca.tsx` (o aviso) e `app/src/ui/PainelConfirmacao.tsx`
    (ícone no botão destrutivo).
  - Aceite: com a marca `#C62828`, o painel destrutivo e o primário se distinguem sem depender da cor; o aviso
    aparece na Marca e não bloqueia o Salvar.
- [x] 8. **Exceções da marca** (D8 e D9: "manter"). Sem código: a lista fechada da seção 4.5 ganhou as duas linhas,
  no mesmo commit destas respostas. Commit: —
- [ ] 9. **Ponteiros** (`executor-rapido`). Espera o merge do PR B (`AGENTS.md`) e da frente 4 (`tokens.ts`).
  Commit: —
  - Arquivos: `AGENTS.md` (linha "Design": "tabela situação → cor em `docs/design-e-front.md` 4.5") e
    `app/src/tema/tokens.ts` (o comentário do topo aponta para a mesma tabela).

## Fora do escopo
- Os valores dos tokens de status: a medição passou em todas as superfícies, menos sobre a `faixaForte`, que o
  passo 5 resolve.
- As paletas de identificação (tipo de série, refeição, agenda e fases do ciclo) e a cor da variação do peso: já
  têm regra própria.
- Trocar a cor padrão da marca de consultoria nova (`Consultoria.java`): é decisão de produto e não foi pedida.
- Os PDFs: a marca aparece no título, na faixa e em valores em destaque, e o contraste sobre branco já é garantido
  pelo `avaliarMarca`.
- Central e Servirea (Angular).

## O que ficou para trás
- (nada ainda)
