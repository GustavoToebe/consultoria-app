# Auditoria de UI/UX: ficha, Início, Novo aluno, menu e login (frente 6)

Situação: Planejando (só plano, sem código) · Onde: branch `auditoria-ficha` (saída da `main` em `3d65e04b`) · Atualizado: 03/11/2026

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
| D4 | Rótulo do trilho | O nome inteiro do item, sem abreviar, em 12 px; o trilho passa de 72 para 88 px. Só entra `rotuloCurto` nos itens que o e2e medir cortados ("Planejamento" já tem "Planos"). | Claude (a confirmar) |
| D5 | Trilho minimizado por escolha no PC | Continua só com ícone e dica ao passar o mouse, como hoje ("PC não muda"). O rótulo vale só no trilho de 768 a 1023 px. | Claude |
| D6 | Grupos do menu: quais itens | Início fica fora de grupo, no topo. Alunos e acompanhamento: Alunos, Atualizações, Agenda, Biblioteca, Planejamento. Negócio: Interessados, Financeiro, Números. Configurações: Perfil (só no tablet nativo), Equipe, Importação, Ajuda, Auditoria. Grupo sem item visível (permissão) some com o título. No trilho de ícones o título vira um fio divisor. | Claude (a confirmar) |
| D7 | Ordem de `ITENS` | Reordenar o array do menu do treinador para agrupar; a ordem relativa de Início, Alunos, Biblioteca, Planejamento e Perfil não muda, então a barra do celular fica igual. | Claude |
| D8 | N21 | Sem `ALUNO_CONVITE`, os campos "Senha" e "Convite" do cartão "Acesso ao app" somem (não ficam com rótulo solto nem com "—"). | Claude |
| D9 | N22 | Sem a permissão de alterar pasta, o próximo passo troca o fim da frase por "Peça ao responsável para renovar" e não oferece o botão. | Claude |
| D10 | N12 | "Desde 24/09/2026 (em aberto)" sem fim; "Até 30/09/2026" sem início; com as duas, "24/09/2026 a 30/09/2026"; nenhuma, "Sem datas". | Claude |
| D11 | Água vazia | Sem nenhum dia registrado nos 7 dias: uma linha, "Sem registro de água nesta semana." Com algum registro, nada muda. | Claude |
| D12 | Título da Folha da pasta | Título "Pasta <nome>"; a primeira linha do conteúdo passa a ser "<aluno> · Período: <período>". Sem mexer em `ui/Folha.tsx` (é da frente Peças). | Claude |
| D13 | Início: números | Pergunta aberta ao Gustavo (ver o relatório). Recomendada: só unificar os cartões "deitados" (`largo` e `linha`: mesma caixa, mesmo tamanho de número, rótulo à esquerda e número à direita) e manter os mini-cartões "em pé" aprovados em 30/10. Alternativa: todos deitados (muda o visual aprovado). O tom de cor e o zero cinza ficam nas duas. | A confirmar (Gustavo) |
| D14 | Início: Agenda vazia | Sem compromissos na semana, o bloco vira uma linha: "Nada na agenda esta semana." (o bloco conta segunda a domingo, não "7 dias"). | Claude |
| D15 | Início: Primeiros passos | Abre recolhido só abaixo de 768 px, numa linha "Primeiros passos · N de M"; o toque abre. De 768 px para cima nada muda. Sem gravar a escolha. | Claude |
| D16 | "Ver N alunos" | O botão da folha de filtros mostra a contagem com o rascunho dos filtros ("Ver 12 alunos", "Ver 1 aluno", "Nenhum aluno"). Conta pelo `total` do `listarAlunos` que já existe, com 300 ms de atraso, sem rota nova. Custo: cada troca de filtro na folha faz uma consulta de página (30 itens) e alguns filtros (atualização, pasta, registro) a API calcula em memória; só vale no celular e com a folha aberta. | Claude (a confirmar) |
| D17 | N11 | O cliente lê o `Retry-After` do 429 (o login passa por `requisicao` em `api/rotas.ts:372`, então `tratar` em `api/cliente.ts` pega) e troca "Aguarde e tente novamente." por "Tente de novo em N minutos." (até 90 segundos, "N segundos"). Fica em `api/cliente.ts`, então vale para toda tela, não só o login. | Claude |
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
- [ ] 6. Menu do tablet, código compartilhado: rótulo embaixo do ícone no trilho de 768 a 1023 px (executor-front) — commit: —
  - Aceite: em 900 px todo item do menu tem texto visível embaixo do ícone, sem corte nem rolagem horizontal; em 768 px também. Em 1280 px e em 390 px o menu é igual ao de hoje. O aluno (barra inferior em qualquer largura) não muda. A largura do trilho (72 px) mora só em `ui/Navegacao.tsx` (não há token), então não depende da frente Peças; a dica `left: 64` do hover é ajustada junto. Conferir `e2e/links-do-menu.spec.ts` (usa o nome completo do link, que não muda).
- [ ] 7. N29, código compartilhado: o `Navegacao` aceita `grupo` em cada item e desenha o título (PC expandido) ou um fio divisor (trilho) (executor-front) — commit: —
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
- [ ] 13. Menu: ligar os grupos e os rótulos (executor) — espera o merge da frente Treinador (`app/treinador/_layout.tsx`) — commit: —
  - Edita só o array `ITENS`: `grupo` em cada item, a reordenação do D7 e, se o e2e medir algum rótulo cortado, `rotuloCurto`.
  - Aceite (N29): em 1280 px o menu tem os títulos "Alunos e acompanhamento", "Negócio" e "Configurações" com os itens do D6; em 900 px os grupos ficam separados por um fio, sem título; em 390 px a barra inferior é a de hoje (Início, Alunos, Biblioteca, Planos, Perfil). Grupo sem nenhum item permitido não mostra nem o título.
  - e2e em 900 px (menu do tablet) e 1280 px (grupos), arquivo novo `e2e/menu-do-treinador.spec.ts`.

### Documentação (junto do último passo de código de cada tema; espera o merge do PR B porque ele também mexe nestes arquivos)
- [ ] 14. `AGENTS.md`: só dois parágrafos, "Menu do treinador (`ui/Navegacao`)" (rótulo no trilho de 768 a 1023 px e grupos com título no menu lateral) e "Início do treinador" (padrão dos números, Agenda vazia, Primeiros passos recolhidos abaixo de 768 px); `docs/design-e-front.md` (pontos de quebra, linha ~165). O PR B também altera o `AGENTS.md`; por isso depois do merge dele — commit: —
- [ ] 15. Ajuda (`ajuda/conteudo.ts`) e guias em PDF: o bloco "Primeiros passos" do Início e o passeio pelo menu, se o texto citar o que mudou; os dois são do PR B — espera o merge do PR B — commit: —

## Fora do escopo
- "Finalizar pasta" como primário, treinos no topo da folha e "Renovar" em destaque: decisão pendente com o Saraiva (lote 1). C3 (foco e diálogos da Folha) é da frente Peças.
- Os 18 ícones dos blocos do Início ("Ver todos ›", um "Atualizar" só): o pedido desta frente é só números, Agenda e Primeiros passos.
- Ordem da ficha, índice de seções e `?aba=`: passo 2 de `telas-do-aluno-visual.md`.
- Lápis da linha de alunos, N23 (vazio da lista), N1 e N2 (permissões e equipe, item 3).
- Migrations e API: nenhuma. Não se mexe em `api/rotas.ts`, `api/tipos.ts` nem em `e2e/api-falsa.ts` (frente Treinador); os e2e simulam a API com `page.route` no próprio spec.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
