# Auditoria de UI/UX: cores por situação

Situação: Planejando · Onde: branch `auditoria-cores` (worktree `wt-auditoria-cores`, saída da `main` em `3d65e04b`) · Atualizado: 03/11/2026

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
| D2 | Cor de status | Uma cor por situação, a mesma no aluno e no treinador. A cor segue a situação do registro, não quem olha; muda só o texto. | Gustavo, 03/11 (N25 da 2ª passada) |
| D3 | Visual do desabilitado | Fundo `superficie3`, borda `borda`, texto e ícone `textoSuave`. Sem opacidade, sem a marca e sem token novo. O pior contraste do texto é 5,42 (escuro). | Proposta (Claude, 03/11), vale até o Gustavo dizer outra coisa |
| D4 | Fundo do selo | Sempre opaco, com o `tingido` da própria cor, porque o selo transparente sobre a `faixaForte` fica abaixo de 4,5:1. O pior caso fica em 5,14. | Proposta (Claude, 03/11) |
| D5 | Tom do aviso de rodapé | O `useAviso` ganha o tom `atencao`, para o alerta que não é erro. | Proposta (Claude, 03/11) |

## Inventário (03/11, sobre `3d65e04b`)

**A marca fora da lista fechada:**
- `treinador/treino/CartaoSessao.tsx`: barra lateral de 4 px na cor da marca. O comentário diz "identidade, não
  status" (protótipo de 30/10). Ver a dúvida 4.
- `dominio/cartaoDoTreino.ts` e `aluno/CartaoDoTreino.tsx`: o dia treinado aparece na cor da marca no cartão para
  compartilhar, e "dia treinado" é status. Ver a dúvida 5.

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

| Situação | Aluno | Treinador | Proposta |
| --- | --- | --- | --- |
| Atualização enviada | `sucesso` "Enviada" (`atualizacao.ts`, `paraFazer.ts`) | `atencao` "Para revisar" | `atencao` nos dois (dúvida 2) |
| Anamnese enviada | `sucesso` "Enviada" (`anamnese.ts`) | `atencao` "Para revisar" | `atencao` nos dois (dúvida 2) |
| Atualização aberta | `atencao` "Responda até" (`statusAtualizacao`) e `neutro` "Até dd/mm" (`paraFazer`) | `neutro` "Hoje" ou "Em N dias" | `atencao` nos dois (dúvida 2) |
| Atualização adiada | `atencao` (`statusAtualizacao`) e `neutro` (`paraFazer`) | `atencao` "Adiada para" | `atencao` |
| Cobrança em aberto | `atencao` no "Meu plano" e `neutro` "Vence dd/mm" na pendência do Início (`paraFazer`) | `atencao` "Em aberto" | `atencao` |
| Cobrança vencida | `perigo` no "Meu plano" e `atencao` na pendência do Início (`paraFazer`) | `perigo` "Vencida" | `perigo` (dúvida 1) |
| Coisa futura marcada | `neutro` nos avisos de compromisso (`paraFazer`, "Novo", "Remarcado") | `atencao` "Agendado" (`agendaPresencial`, `lembretesDeCobranca`) e `neutro` na atualização futura | `neutro` (dúvida 3) |

## Dúvidas para o Gustavo (cada uma com a opção recomendada)
1. **Cobrança vencida para o aluno: que cor?**
   - **(Recomendada)** Vermelho, como para o treinador. É a mesma situação. O texto continua calmo ("Fale com o seu
     treinador") e nada é bloqueado.
   - Âmbar nos dois, o treinador inclusive.
2. **Situação em que um lado age e o outro só espera** (atualização aberta, atualização enviada, anamnese enviada):
   - **(Recomendada)** A cor segue o registro: âmbar enquanto falta alguém agir, nos dois lados. O texto diz quem age
     ("Enviada. Aguardando o treinador" e "Para revisar").
   - Exceção: verde para o aluno depois de enviar, âmbar para o treinador. Isso quebra a D2 e ficaria escrito como
     exceção.
   - Efeito da recomendada: na lista de alunos, a atualização aberta cai no grupo "Em dia", que tem o marcador verde
     (`gruposDeAlunos`). O selo fica âmbar dentro de um grupo verde. O grupo mantém o tom dele, porque resume a
     lista, e não é a situação de um registro.
3. **Coisa futura marcada** (compromisso agendado, lembrete agendado, atualização daqui a N dias):
   - **(Recomendada)** Cinza (informativo). O âmbar fica para quando alguém precisa agir agora.
   - Âmbar em tudo o que ainda vai acontecer, a atualização futura inclusive.
4. **Barra da cor da marca à esquerda da sessão no editor de treino** (`CartaoSessao`, escolhida no protótipo de 30/10):
   - **(Recomendada)** Manter e pôr na lista fechada como destaque de "onde a sessão começa". Com problema, a borda
     vermelha e o selo "Corrigir" continuam distinguindo.
   - Trocar por `bordaCampo` (neutra).
5. **Dia treinado na cor da marca no cartão para compartilhar** ("Bom trabalho!", `cartaoDoTreino`):
   - **(Recomendada)** Manter. É uma imagem da marca para postar, sem outro status ao lado, e fica como exceção
     escrita.
   - Trocar pelo `sucesso`.
6. **Marca vermelha parecida com o erro** (a marca padrão `#C62828` e a do Saraiva):
   - **(Recomendada)** Distinguir pela forma:
     - o botão de confirmar destrutivo ganha ícone (lixeira ou alerta) e o rótulo do resultado;
     - o erro continua com ícone e fundo `tingido`;
     - a Marca ganha um aviso, que não bloqueia: "Parecida com a cor de erro: os avisos continuam com ícone e texto".
   - Bloquear, na Marca, as cores perto de `perigo`, `atencao` e `sucesso`. Isso exige que o Saraiva troque de cor.
   - Não fazer nada.

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
- [ ] 2. **Tom igual nos dois lados: domínio** (`executor`). Espera as respostas das dúvidas 1 a 3 e, só para
  `atualizacao.ts`, o merge da frente 5. Commit: —
  - Arquivos:
    - `app/src/dominio/paraFazer.ts` e `paraFazer.test.ts`;
    - `app/src/dominio/anamnese.ts` e `anamnese.test.ts`;
    - `app/src/dominio/atualizacao.ts` e `atualizacao.test.ts` (frente 5);
    - `app/src/dominio/agendaPresencial.ts` e `agendaPresencial.test.ts` (Agenda: conferir com a sessão principal se
      é da frente 5);
    - `app/src/dominio/lembretesDeCobranca.ts` e `lembretesDeCobranca.test.ts` (Financeiro: conferir se é da frente 5);
    - novo `app/src/dominio/corPorSituacao.test.ts`.
  - Aceite: o `corPorSituacao.test.ts` chama as funções do aluno e as do treinador para cada linha da tabela de
    divergências e confere que o tom é o mesmo. Nenhum texto muda. O `gruposDeAlunos.ts` não muda (ver a dúvida 2).
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
- [ ] 7. **Marca parecida com erro** (dúvida 6). Espera a resposta da dúvida. Commit: —
  - 7a (`executor`): `app/src/dominio/paletas.ts` e `paletas.test.ts`, com o aviso de cor perto de um status, pela
    distância já usada em `tokens.test.ts`.
  - 7b (`executor-front`): `app/src/treinador/marca/FormMarca.tsx` (o aviso) e `app/src/ui/PainelConfirmacao.tsx`
    (ícone no botão destrutivo).
  - Aceite: com a marca `#C62828`, o painel destrutivo e o primário se distinguem sem depender da cor; o aviso
    aparece na Marca e não bloqueia o Salvar.
- [ ] 8. **Exceções da marca** (dúvidas 4 e 5), só se a resposta for "trocar". Commit: —
  - Arquivos: `app/src/treinador/treino/CartaoSessao.tsx`; `app/src/dominio/cartaoDoTreino.ts` e
    `cartaoDoTreino.test.ts`; `app/src/aluno/CartaoDoTreino.tsx` (frente 3).
  - Se a resposta for "manter", só a lista fechada da seção 4.5 ganha a linha.
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
