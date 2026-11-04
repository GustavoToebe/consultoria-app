# Auditoria de UI/UX: ficha, Início, Novo aluno, menu e login (frente 6)

Situação: Em andamento: menu do tablet e N29 (passos 6, 7 e 13) prontos para revisão; o resto espera · Onde: branch `auditoria-ficha` (saída da `main` em `3d65e04b`) · Atualizado: 03/11/2026

## Objetivo
Fechar os achados pequenos da auditoria de 03/11 que moram na ficha do aluno, no Início e na lista de alunos do treinador, no
Novo aluno, no menu lateral e no limite de login. Relatórios: [auditoria-ui-ux-2026-11-03.md](auditoria-ui-ux-2026-11-03.md) (C.2 e
E.4) e a 2ª passada com dados lançados (N11, N12, N15, N21, N22, N29). Só mexe no app; nada muda na API nem no banco.
Esta frente depende do PR B do lote 1 ([auditoria-ui-ux-lote-1.md](auditoria-ui-ux-lote-1.md)) e das frentes Aluno, Peças e
Treinador da mesma auditoria; cada passo diz de quem espera.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo da frente | N21, N22, N12, água vazia numa linha, título da Folha da pasta, Início do treinador (números, Agenda vazia, Primeiros passos recolhidos), Novo aluno (ajuda dos dias e N15), "Ver N alunos", N11, menu do tablet e N29. | Gustavo, 03/11 |
| D2 | Menu do tablet (o "D11" do plano do lote 1) | De 768 a 1023 px o trilho mostra um rótulo curto embaixo de cada ícone. PC (1024 px ou mais) e celular não mudam. e2e em 900 px. | Gustavo, 03/11 |
| D3 | N29, junto do menu do tablet | Menu lateral do treinador em grupos com título: "Alunos e acompanhamento", "Negócio" e "Configurações". A barra inferior do celular não muda. | Gustavo, 03/11 |
| D4 | Rótulo do trilho | Rótulo curto, como na barra inferior: o `rotuloCurto` quando existe ("Planejamento" vira "Planos") e o nome inteiro nos outros, em 12 px e uma linha. O trilho do tablet passa de 72 para 88 px (o PC minimizado fica em 72). `rotuloCurto` novo só em item `soLateral` que o e2e medir cortado (em item da barra, mudaria o celular). | Gustavo, 03/11 (rótulo curto); largura e medida decididas pelo Claude e aceitas pelo Gustavo, 03/11 |
| D5 | Trilho minimizado por escolha no PC | Continua só com ícone e dica ao passar o mouse, como hoje ("PC não muda"). O rótulo vale só no trilho de 768 a 1023 px. | Claude |
| D6 | Grupos do menu: quais itens e nomes | Nomes do D3, sem trocar ("Alunos e acompanhamento", "Negócio", "Configurações"). Início fica fora de grupo, no topo. Alunos e acompanhamento: Alunos, Atualizações, Agenda, Biblioteca, Planejamento. Negócio: Interessados, Financeiro, Números. Configurações: Perfil (só no tablet nativo), Equipe, Importação, Ajuda, Auditoria. Grupo sem item visível (permissão) some com o título. No trilho de ícones (tablet e PC minimizado) o título vira um fio divisor; o leitor de tela ouve o nome do grupo nos dois. | Decidido pelo Claude e aceito pelo Gustavo, 03/11 |
| D7 | Ordem de `ITENS` | Reordenar o array do menu do treinador para agrupar; a ordem relativa de Início, Alunos, Biblioteca, Planejamento e Perfil não muda, então a barra do celular fica igual. | Claude |
| D8 | N21 | Sem `ALUNO_CONVITE`, os campos "Senha" e "Convite" do cartão "Acesso ao app" somem (não ficam com rótulo solto nem com "—"). | Claude |
| D9 | N22 | Sem a permissão de alterar pasta, o próximo passo troca o fim da frase por "Peça ao responsável para renovar" e não oferece o botão. | Claude |
| D10 | N12 | "Desde 24/09/2026 (em aberto)" sem fim; "Até 30/09/2026" sem início; com as duas, "24/09/2026 a 30/09/2026"; nenhuma, "Sem datas". | Claude |
| D11 | Água vazia | Sem nenhum dia registrado nos 7 dias: uma linha, "Sem registro de água nesta semana." Com algum registro, nada muda. | Claude |
| D12 | Título da Folha da pasta | Título "Pasta <nome>"; a primeira linha do conteúdo passa a ser "<aluno> · Período: <período>". Sem mexer em `ui/Folha.tsx` (é da frente Peças). | Claude |
| D13 | Início: números | Só unificar os cartões "deitados" (`largo` e `linha`: mesma caixa, mesmo tamanho de número, rótulo à esquerda e número à direita) e manter os mini-cartões "em pé" aprovados em 30/10 (a opção que menos muda o que o treinador já vê). Fica de fora a alternativa "todos deitados", que mudaria o visual aprovado. O tom de cor e o zero cinza não mudam. | Decidido pelo Claude e aceito pelo Gustavo, 03/11 |
| D14 | Início: Agenda vazia | Sem compromissos na semana, o bloco vira uma linha: "Nada na agenda esta semana." (o bloco conta segunda a domingo, não "7 dias"). | Claude |
| D15 | Início: Primeiros passos | Abre recolhido só abaixo de 768 px, numa linha "Primeiros passos · N de M"; o toque abre. De 768 px para cima nada muda. Sem gravar a escolha. | Claude |
| D16 | "Ver N alunos" | O botão da folha de filtros mostra a contagem com o rascunho dos filtros ("Ver 12 alunos", "Ver 1 aluno", "Nenhum aluno"). Conta pelo `total` do `listarAlunos` que já existe, com 300 ms de atraso, sem rota nova. Custo: cada troca de filtro na folha faz uma consulta de página (30 itens) e alguns filtros (atualização, pasta, registro) a API calcula em memória; só vale no celular e com a folha aberta. Se a consulta falhar, o botão volta a "Ver alunos" (sem número), sem aviso. | Decidido pelo Claude e aceito pelo Gustavo, 03/11 |
| D17 | N11 | O cliente lê o `Retry-After` do 429 (o login passa por `requisicao` em `api/rotas.ts:372`, então `tratar` em `api/cliente.ts` pega) e troca "Aguarde e tente novamente." por "Tente de novo em N minutos." (até 90 segundos, "N segundos"). Fica em `api/cliente.ts`, então vale para toda tela, não só o login. | Claude |
| D19 | Qual "D11" é esta frente | O "D11" do pedido de 03/11 ("frente 6: N29 e D11") é o D11 do plano do lote 1 (menu do tablet, aqui D2 e D4, passos 6, 7 e 13), não o D11 deste plano (água vazia, passo 3, que segue aberto). | Claude, 03/11 |
| D20 | Menu lateral que não cabe na altura | Com os títulos dos grupos e os rótulos do trilho, o menu passa da altura de uma janela de 720 px: a lista de itens rola e o "Minimizar"/"Expandir" fica fixo embaixo, nos três modos (aberto, trilho do tablet e PC minimizado). Corrigido em 03/11 (`28b26c5b`): antes, no PC minimizado a lista não rolava e o "Expandir" saía da tela abaixo de uns 780 px. Para a dica do nome não ser cortada pela rolagem, ela passou a ser desenhada pelo próprio trilho, fora da lista (`useDicaDoTrilho` em `ui/Navegacao.tsx`: mede o item com `measureLayout` ao passar o mouse ou focar e de novo ao rolar). Ficou de fora encolher os itens ou os fios: o alvo de 44 px não muda e os fios somam só uns 39 px. e2e em 1280×720 minimizado no `menu-do-treinador.spec.ts`. | Gustavo, 03/11 (corrigir); solução do Claude |
| D21 | Passo 13 antes do merge da frente Treinador | Feito já: a frente Treinador (`auditoria-treinador`) mexe no `_layout.tsx` só nos imports e numa função nova logo depois do array; esta frente só mexe nas linhas do array `ITENS`. O merge das duas deve dar no máximo um conflito trivial na última linha do array. | Claude, 03/11 |
| D22 | Ordem do passeio pelo menu | O passeio segue a ordem do `ITENS` novo (D6): Início, Alunos, Atualizações, Biblioteca, Planejamento, Interessados, Perfil, Marca, Equipe, Importação, Ajuda e Primeiros passos. Sem passo novo: Agenda, Financeiro, Números e Auditoria não tinham passo e continuam sem. Marca (no menu do usuário) fica junto do Perfil. O e2e do menu confere a ordem. | Decidido pelo Claude e aceito pelo Gustavo, 03/11 |
| D23 | Nome acessível do rótulo curto (WCAG 2.5.3) | Onde o menu mostra o rótulo curto (trilho do tablet e barra do celular), o nome acessível começa pelo texto visível: "Planos (Planejamento)". O texto visível não mudou. | Decidido pelo Claude e aceito pelo Gustavo, 03/11 |
| D24 | "Todas as telas" e a busca | Usam os grupos do menu lateral (D6), na ordem dele: o Início no topo sem título, depois "Alunos e acompanhamento", "Negócio" e "Configurações". A ordem, o grupo e o `tambem` de cada item moram só em `MENU_DO_TREINADOR` (`dominio/gruposDoMenu.ts`): o menu do layout sai por `naOrdemDoMenu` e a seção de cada tela do catálogo é calculada pelo caminho (`posicaoNoMenu`). Telas fora do menu lateral: Meus dados, Segurança, Ajustes, Assinatura e faturas e Marca (abertas pelo Perfil, que é de Configurações no D6) e Termos e privacidade (aberta pela Ajuda) ficam no fim de Configurações, depois dos itens do menu; a seção "Sua conta" deixou de existir. Na busca, a legenda é o grupo ("Ação · <grupo>" nas ações; "Tela inicial" no Início) e o nome do grupo também acha as telas. Permissões e `podeAcessarTela` não mudam; os favoritos são guardados pelo id da tela e continuam valendo. Corrigido em 03/11 (`9987f2e5`). | Gustavo, 03/11 (corrigir); onde ficam as telas fora do menu, Claude |
| D18 | N15 | O asterisco de CEP, rua, número e cidade só aparece depois que algum campo do endereço é preenchido; em pergunta de endereço obrigatória (anamnese e atualização) fica sempre. | Claude |

## Passos
Executor entre parênteses. "Espera" quer dizer que o passo toca arquivo de outra frente; não é feito antes do merge dela.

### Pode começar já (não toca arquivo de nenhuma outra frente)
- [ ] 1. N21: esconder "Senha" e "Convite" sem `ALUNO_CONVITE` (executor) — commit: —
  - Aceite: com um perfil sem `ALUNO_CONVITE`, o cartão "Acesso ao app" não tem rótulo solto; com a permissão, nada muda. e2e em 390 e 1280 px, no spec novo `e2e/ficha-auditoria.spec.ts` (perfil sem `ALUNO_CONVITE` por `page.route`). Conferir que `e2e/acesso-aluno.spec.ts` segue verde.
- [ ] 2. N12: período da lesão (executor) — commit: —
  - Aceite: lesão sem fim mostra "Desde 24/09/2026 (em aberto)". Regra em `dominio/periodoDaLesao.ts`, com jest em `dominio/periodoDaLesao.test.ts` nos quatro casos do D10 (e2e no `e2e/ficha-auditoria.spec.ts`).
- [ ] 3. Água vazia numa linha (executor) — commit: —
  - Aceite: sem dado, o cartão Água tem uma linha de texto e nenhuma das sete linhas "—"; com dado, igual a hoje. Jest em `aguaDoDia.test.ts`; e2e em 390 e 1280 px no `e2e/ficha-auditoria.spec.ts`.
- [ ] 4. N15: asterisco do endereço (executor) — commit: —
  - Muda a linha de ajuda junto: sem asterisco na tela, "(* obrigatório)" sai do texto de "Endereço (opcional)" e vira "Se preencher, informe CEP, rua, número, cidade e UF." Regra `enderecoComCampoPreenchido` em `dominio/cadastroDoAluno.ts`, com jest em `cadastroDoAluno.test.ts`.
  - O componente também aparece em Conta do aluno (`CartaoMeusDados`) e na anamnese/atualização (frente Aluno); não são editados, mas mudam de comportamento: o e2e confere os dois.
  - Aceite: no Novo aluno, com o endereço em branco, nenhum rótulo tem "*"; ao digitar o CEP, aparecem em CEP, rua, número e cidade. Na pergunta de endereço obrigatória da anamnese e da atualização, o "*" continua.
- [ ] 5. N11: "Tente de novo em N minutos" (executor) — commit: —
  - Aceite: 429 do login com `Retry-After: 300` mostra "Muitas tentativas de acesso. Tente de novo em 5 minutos."; sem o cabeçalho, o texto do servidor fica como está. Jest em `dominio/esperaDoLimite.test.ts` e em `api/cliente.test.ts`; e2e novo `e2e/login-limite.spec.ts` com `page.route` e o cabeçalho. O e2e novo do PR B (`telas-publicas-erros.spec.ts`) não confere o texto do 429, então não conflita.
- [x] 6. Menu do tablet, código compartilhado: rótulo embaixo do ícone no trilho de 768 a 1023 px (executor-front) — commit: `6d3d2d4c`
  - Aceite: em 900 px todo item do menu tem texto visível embaixo do ícone, sem corte nem rolagem horizontal; em 768 px também. Em 1280 px e em 390 px o menu é igual ao de hoje. O aluno (barra inferior em qualquer largura) não muda. A largura do trilho (72 px) mora só em `ui/Navegacao.tsx` (não há token), então não depende da frente Peças; a dica `left: 64` do hover é ajustada junto. Conferir `e2e/links-do-menu.spec.ts` (usa o nome completo do link, que não muda).
- [x] 7. N29, código compartilhado: o `Navegacao` aceita `grupo` em cada item e desenha o título (PC expandido) ou um fio divisor (trilho) (executor-front) — commit: regra `50c62f30`, tela `6d3d2d4c`
  - Regra pura (agrupar mantendo a ordem do array e esconder grupo vazio) em `dominio/gruposDoMenu.ts`, com jest em `dominio/gruposDoMenu.test.ts`.
  - Sem `grupo` em nenhum item, o menu fica idêntico ao de hoje (por isso pode entrar antes do passo 13).

### Espera o merge do PR B (lote 1)
- [ ] 8. N22: próximo passo sem a permissão de pasta (executor) — espera o merge do PR B (`ResumoDoAluno.tsx`) — commit: —
  - Aceite: com o perfil sem `PASTA_ALTERAR`, o texto diz "Peça ao responsável para renovar" e não há botão; com a permissão, igual a hoje. Jest em `resumoDoAluno`.
- [ ] 9. Título da Folha da pasta (executor) — espera o merge do PR B (`CartaoPastas.tsx`) e o da frente Peças (o e2e de foco da Folha abre esta folha pelo nome) — commit: —
  - Aceite: o título da folha identifica a pasta e a primeira linha traz o aluno e o período. Os e2e `pasta-e-atualizacao`, `pasta-periodo` e `cores-historico-dieta` seguem verdes.
- [ ] 10. Novo aluno: ajuda do campo de dias (executor-rapido) — espera o merge do PR B (`FormAluno.tsx`) — commit: —
  - Aceite: a ajuda cabe em duas linhas em 390 px. Texto: "O fim das novas pastas já vem com esses dias. Vazio usa o padrão da consultoria."
- [ ] 11. Início do treinador: números num padrão só, Agenda vazia em uma linha, Primeiros passos recolhidos no celular (executor-front) — espera o merge do PR B (`e2e/painel.spec.ts` testa os Primeiros passos e os blocos em 390 px e é do PR B; o ajuste dele só depois) — commit: —
  - Aceite (390×844): o primeiro bloco do painel aparece sem rolar; todos os blocos usam rótulo à esquerda e número à direita; sem compromissos, o bloco Agenda tem a altura de uma linha.
  - Em 1280 px os Primeiros passos continuam abertos.

### Espera o merge da frente Treinador (5)
- [ ] 12. "Ver N alunos" (executor) — espera o merge da frente Treinador (`treinador/alunos/index.tsx` passa a função de contagem; `ui/BarraDeFiltros.tsx` não é de ninguém e a prop é opcional, então as outras listas não mudam) — commit: —
  - Aceite: no celular, a folha de filtros mostra "Ver N alunos" com a contagem dos filtros escolhidos; "Limpar filtros" volta ao estado inicial e a contagem acompanha. Jest da regra do rótulo (`dominio/filtrosDeAlunos.test.ts`); `e2e/lista-alunos-filtros.spec.ts` confere o botão pelo nome "Ver alunos" e passa a conferir "Ver N alunos" (não está em nenhuma lista; ajusto junto). e2e novo em 390 px no `e2e/ver-n-alunos.spec.ts`.
- [x] 13. Menu: ligar os grupos e os rótulos (executor) — feito antes do merge da frente Treinador (D21) — commit: `6d3d2d4c`
  - Edita só o array `ITENS`: `grupo` em cada item, a reordenação do D7 e, se o e2e medir algum rótulo cortado, `rotuloCurto`.
  - Aceite (N29): em 1280 px o menu tem os títulos "Alunos e acompanhamento", "Negócio" e "Configurações" com os itens do D6; em 900 px os grupos ficam separados por um fio, sem título; em 390 px a barra inferior é a de hoje (Início, Alunos, Biblioteca, Planos, Perfil). Grupo sem nenhum item permitido não mostra nem o título.
  - e2e em 900 px (menu do tablet) e 1280 px (grupos), arquivo novo `e2e/menu-do-treinador.spec.ts`.
  - Feito: nenhum `rotuloCurto` novo; medido em Inter 600 de 12 px, o maior rótulo ("Atualizações", "Interessados") tem 75 px e o trilho dá 80. O e2e confere o corte (`scrollWidth`) em 900 e 768 px.

### Documentação (junto do último passo de código de cada tema; espera o merge do PR B porque ele também mexe nestes arquivos)
- [ ] 14. (Parte do menu feita junto do passo 13, em `6d3d2d4c`: parágrafo do `ui/Navegacao` no `AGENTS.md` e pontos de quebra no `docs/design-e-front.md`; falta o Início.) `AGENTS.md`: só dois parágrafos, "Menu do treinador (`ui/Navegacao`)" (rótulo no trilho de 768 a 1023 px e grupos com título no menu lateral) e "Início do treinador" (padrão dos números, Agenda vazia, Primeiros passos recolhidos abaixo de 768 px); `docs/design-e-front.md` (pontos de quebra, linha ~165). O PR B também altera o `AGENTS.md`; por isso depois do merge dele — commit: —
- [ ] 15. (Parte do menu feita em `6d3d2d4c`: "Menu e barra de topo" da Ajuda e o `guia-treinador.pdf` regerado; falta o Início.) Ajuda (`ajuda/conteudo.ts`) e guias em PDF: o bloco "Primeiros passos" do Início e o passeio pelo menu, se o texto citar o que mudou; os dois são do PR B — espera o merge do PR B — commit: —

## Fora do escopo
- "Finalizar pasta" como primário, treinos no topo da folha e "Renovar" em destaque: decisão pendente com o Saraiva (lote 1). C3 (foco e diálogos da Folha) é da frente Peças.
- Os 18 ícones dos blocos do Início ("Ver todos ›", um "Atualizar" só): o pedido desta frente é só números, Agenda e Primeiros passos.
- Ordem da ficha, índice de seções e `?aba=`: passo 2 de `telas-do-aluno-visual.md`.
- Lápis da linha de alunos, N23 (vazio da lista), N1 e N2 (permissões e equipe, item 3).
- Migrations e API: nenhuma. Não se mexe em `api/rotas.ts`, `api/tipos.ts` nem em `e2e/api-falsa.ts` (frente Treinador); os e2e simulam a API com `page.route` no próprio spec.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
- Passos 1 a 5, 8 a 12: não feitos nesta rodada (o pedido de 03/11 foi N29 e o menu do tablet).
- ~~Passeio pelo menu em janela baixa destacava item fora da tela (a lista do menu rola com os títulos dos grupos).~~ Resolvido em 2874708b: na web o passeio rola o alvo para a área visível antes de medir, e o item da tela aberta também (fora do PC minimizado); e2e em 1280×720 no `menu-do-treinador.spec.ts`.
- ~~PC minimizado por escolha em janela baixa: a lista não rolava e o "Expandir" saía da tela abaixo de uns 780 px de altura.~~ Resolvido em `28b26c5b` (D20): a lista rola, o "Expandir" fica fixo embaixo e a dica é desenhada pelo trilho, fora da rolagem; o passeio também rola o item para a tela nesse modo.
- ~~"Todas as telas" e a busca nas seções antigas (D24).~~ Resolvido em `9987f2e5`: os grupos do menu lateral, da mesma fonte (`MENU_DO_TREINADOR`).
- Conferir no tablet de verdade (Android, 768 a 1023 px de largura) o rótulo embaixo do ícone e a rolagem do menu.
