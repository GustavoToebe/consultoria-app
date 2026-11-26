# Fechamento de 26/11: Complementos sem teto, motivo ATRASO só com FINANCEIRO_LER e acabamentos dos editores

Situação: Concluída em 26/11/2026 (rodadas 2 e 3 incluídas) · Onde: main (`749f191d` e `3091eb89`) · Atualizado: 26/11/2026

## Objetivo
Lote de fechamento pedido pelo Gustavo depois de aprovar o relatório de 26/11 ([ajustes-de-26-11.md](ajustes-de-26-11.md), [pausar-acesso-por-atraso.md](pausar-acesso-por-atraso.md)): Complementos da dieta usam toda a largura na ultralarga; quem não tem `FINANCEIRO_LER` nunca vê "pausado" nem atraso; erro de cobrança indisponível vira toast; opção personalizada da refeição não vira letra; Espaço e Enter escolhem no radiogroup; exclusão igual nos três editores; Configurações sem vão em 3440; limites reais na área de soltar; limpeza de branches. Só app, exceto o item 2 (API).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Sem `FINANCEIRO_LER`, a API devolve `MANUAL` no lugar de `ATRASO` (listagem e ficha de alunos, `MotivoDoAcessoDesativado.paraEquipe`); `/eu` do próprio aluno não muda | o app mostra "● Acesso desativado" neutro | Gustavo (pedido), contrato fixado pela sessão |
| D1b | Efeito do mascaramento: `/acesso/reativar` com motivo real ATRASO exige `FINANCEIRO_ALTERAR` (403 `PERMISSAO_NEGADA` neutro), senão quem só tem `ALUNO_CONVITE` despausava um aluno que via como "desativado" | regra nova no `AGENTS.md` | sessão, com revisão independente; a confirmar pelo Gustavo |
| D2 | Trava `PESSIMISTIC_WRITE` da importação só depois da checagem `IGNORAR` (decisão 4 do relatório) | linha ignorada não trava o aluno | Gustavo |
| D3 | Rótulo da opção é "padrão" se for uma letra A–F, número ou vazio; só esses seguem a posição | "Opção Principal" se mantém ao reordenar; o círculo mostra a inicial (`letraDoMarcador`) | Gustavo |
| D4 | Exclusão: `Botao tipo="perigo"` tonal visível ao lado do ⋯ nos três editores | "Excluir refeição", "Excluir exercício", "Excluir seção", "Excluir sessão" (no lugar de "Remover sessão") | Gustavo; "Excluir sessão" escolhido pela sessão |
| D5 | E2e só das specs das telas tocadas (pedido do Gustavo), mesmo com o `ToggleGroupItem` (peça compartilhada) alterado | suíte completa não rodada | Gustavo |
| D6 | Toast de erro do app usa o tipo `perigo` (`erro` não existe em `ui/Aviso`) | texto exato do pedido | sessão |
| D7 | Complementos: a aba Outros também perdeu o teto (o pedido dizia "dos Complementos") | campos esticados em 3440, a decidir | sessão; a confirmar pelo Gustavo |

## Passos
- [x] 1. Complementos na ultralarga sem teto (tabela 28/12/10%, Dose e Horário com máximo, 2 linhas sem alça, leitura ~72ch), capturas 1920 e 3440 em `capturas/26-11-fechamento/complementos-*` — spec `complementos-orientacoes-e-suplementos` verde; commit `749f191d`; run da CI: conferir no GitHub (não apareceu na lista no momento do push)
- [x] 2. Motivo ATRASO só com `FINANCEIRO_LER` (API e app) e trava da importação depois do IGNORAR — `mvn verify` 3.470 testes, 0 falhas; revisão independente feita (brechas conhecidas em Pendências soltas)
- [x] 3. 503 `FINANCEIRO_INDISPONIVEL` ao pausar acesso vira toast de erro, sem erro inline nem mudança no cartão — `acesso-pausado-fase2.spec.ts`
- [x] 4. Rótulo personalizado da opção da refeição não vira letra — jest `dieta`, `opcoesDaRefeicao`, `CartaoRefeicao`; sem e2e do fluxo personalizado
- [x] 5. Espaço (e Enter) escolhem nos radiogroups — `ToggleGroupItem`, `EscolhaEmFolha`, `PainelDeAgendas`; `escolha-teclado.spec.ts` e `Escolha.test.tsx`
- [x] 6. Exclusão igual nos três editores — `editor-clareza`, `editor-mobilidade`, `dieta-opcoes-e-preparo`; capturas `capturas/26-11-fechamento/excluir-*` e `dieta-excluir-refeicao.png`
- [x] 7. Configurações em 3440 sem vão (o teto próprio de cada tela de item saiu) — `configuracoes`, `tela-larga-equipe-ajuda-ajustes` com 3440 em Automática e Limitada; capturas `configuracoes-*`
- [x] 8. Limites reais na área de soltar: a assistida já mostrava "20 arquivos, 900 KB cada e 8 MB no total" (spec `importacao-assistida:605`); a da planilha ganhou "XLSX ou CSV · até 900 KB" — `importacao.spec.ts`
- [x] 9. Apagar as branches `treino-academia`, `ficha-24-11`, `tela-larga-revisao` — feito na rodada 2 (abaixo), depois da autorização do Gustavo

## Verificação
typecheck 0 erros; lint 0 erros (10 avisos antigos); jest 454 suítes, 11.052 testes; `mvn verify` 3.470 testes, 0 falhas, BUILD SUCCESS (38 min); e2e integrado das 23 specs das telas tocadas: 367 passaram, 2 puladas, 0 falhas (e passadas isoladas pelos agentes: `dieta-tabela:239` e `detalhes-abrem:132` falharam uma vez cada e passaram sozinhas).

## Fora do escopo
- Aparelho Android/iOS: nada conferido em nativo; tema escuro e larguras intermediárias (960 a 1100) dos editores sem captura.
- Suíte e2e completa (pedido do Gustavo; o `AGENTS.md` a pediria pela peça compartilhada `ToggleGroup`).

## O que ficou para trás
- Tudo em "Pendências soltas" do [README](README.md): brechas do acesso pausado, aba Outros, Marca e Termos em 3440, rótulo personalizado no aluno/PDF, formato do nome acessível, alça dos textareas, branches.

## Rodada 2 (26/11, depois da aprovação do Gustavo)
Pedido: conferir a CI, rodar a suíte e2e completa, apagar as branches (autorizado), fechar a brecha do despausar em dois passos, Outros dos Complementos em colunas, Marca em 3440 e rótulo personalizado fora do editor.

| # | Item | Status | Evidência |
| --- | --- | --- | --- |
| 0 | CI do `749f191d` | ✅ | run 45810783600: todos os jobs verdes, inclusive `publicar` |
| 1 | Suíte e2e completa (peça compartilhada `ToggleGroup`) | ✅ com correção de teste | 3.305 passaram, 299 puladas, 5 falharam: `acesso-aluno:202` (1280) passou isolada (intermitência); `tela-larga:638` falhou em 4 larguras e **não era intermitência**: a frase vazia de Orientações passou a quebrar em 2 linhas (72ch), a página ficou ~20 px mais longa e o total sticky, no fim da página, não cabia 16 px abaixo da barra com a janela de 900; o teste passou a usar altura 1000. Também endurecidas com `toPass` a linha de P/C/G/Fibra (638) e a medida das três colunas da mobilidade (513), que oscilavam 1 em ~12 e 1 em ~40; depois 50 execuções seguidas verdes e o arquivo inteiro (25) verde |
| 2 | Remover worktrees e apagar branches | ✅ | `git status` de cada worktree: só `app/src/uniwind-types.d.ts` (gerado, diff vazio) e, no `treino`, as capturas; arquivo gerado restaurado, capturas copiadas para `capturas/treino-academia-worktree/` (54 arquivos, 14.245.297 bytes iguais) e movidas; `git worktree remove` sem `--force`; `git branch -d` nas três. Sobraram pastas com `app/node_modules` (ver README) |
| 3 | `desativar` de ATRASO exige `FINANCEIRO_ALTERAR` | ✅ | `AcessoDoAlunoService.exigirPermissaoDoAtraso`, 403 `PERMISSAO_NEGADA` "Sem permissão para alterar o acesso deste aluno" (a mesma no `reativar`); único caminho ATRASO→MANUAL; inativar aluno em ATRASO segue liberado; teste novo em `AtrasoEManualIntegrationTest`; `mvn verify` 3.471 testes, 0 falhas. Risco residual da inferência por tentativa aceito e registrado no plano da pausa e no AGENTS.md |
| 4 | Aba Outros com as colunas da Suplementação | ✅ | `colunasDosComplementos.ts` e `CampoDaTabela.tsx` compartilhados; captura 3440 em `capturas/26-11-fechamento/complementos-outros-3440-novo.png`; specs `complementos-orientacoes-e-suplementos` e `dieta-ajustes` |
| 5 | Marca em 3440 | ✅ | `marca/arranjoDaMarca.ts`: formulário de 640 px e prévia ao lado a partir de 1104 px medidos; capturas `marca-3440.png`, `marca-1920.png`, `marca-390.png`; casos novos em `configuracoes.spec.ts` |
| 6 | Rótulo personalizado fora do editor | ✅ | `totalDaOpcao` em `dominio/dieta.ts`; aluno, PDF e lista de compras; jest em `dieta`, `pdf` e `listaDeCompras` |

Commit da rodada 2: `3091eb89` (CI: run 45825003355, conferir no GitHub).

Verificação final: typecheck 0 erros; lint 0 erros; jest 455 suítes, 11.059 testes; `mvn verify` 3.471 testes, 0 falhas (21 min); e2e das 16 specs tocadas: 208 passaram, 2 puladas e as duas falhas de `tela-larga` corrigidas como descrito.

Não conferido: aparelho nativo, tema escuro das telas novas (Outros, Marca), faixa de 720 a 1000 px da aba Outros e de 880 a 1103 da Marca.

## Rodada 3 (26/11, depois da aprovação da rodada 2)
Pedido: conferir a CI da rodada 2, a frase vazia de Orientações em 1 linha sem mexer na janela do teste, brecha do ATRASO, prova da trava da importação, frases "opção A" no aluno e PDF, `Campo` com 44 px, nome acessível da exclusão e as capturas que faltaram. Pedido adicional: fechar junto a correção do menu lateral recolhido (submenus no trilho) que o Gemini deixou sem commit.

| # | Item | Status | Evidência |
| --- | --- | --- | --- |
| 0 | CI do `3091eb89` | ✅ | run 45825003355: todos os jobs verdes, inclusive `publicar` |
| 1 | `tela-larga:643` (antes 638) com janela de 900 px | ✅ | `OrientacoesDaDieta.tsx`: estado vazio sem o teto de 72ch (`abaVazia`), texto igual; `altura: 900` de volta; 32 de 32 em `--repeat-each=8`; a frase mede 20 px (uma linha) em 1920 e 3440 (capturas) |
| 2 | Brecha do ATRASO | ⚠️ risco não é nulo, decisão do Gustavo | quem tem só `ALUNO_CONVITE` não vê o atraso em tela nem endpoint (listagem e ficha devolvem MANUAL, `/financeiro/alunos-em-atraso` exige `FINANCEIRO_LER`), mas distingue por `desativar`/`reativar` (403 × 200) e `PUT /acesso` (200 × 409); opções em Pendências soltas; nada implementado |
| 3 | Trava da importação não é tomada no IGNORAR | ✅ | `ImportacaoIntegrationTest.linhaIgnoradaNaoTomaATravaDoAluno` com `TravasDeAlunoNoSql` (StatementInspector conta `for update` em `aluno`; controle positivo com ATUALIZAR); falha provada tirando o `&& !ignorar` de `GravadorDaImportacao` (restaurado) |
| 4 | Frases "opção A" no aluno e no PDF | ✅ | `opcaoDoTotalDoDia` em `dominio/dieta.ts`; padrão igual, mesmo rótulo personalizado "Soma · <rótulo> de cada refeição" / "Total do dia · <rótulo> de cada refeição", mistura = "primeira opção"; jest `dieta` e `pdf`; sobra a frase fixa do editor (`TotalDoDia.tsx`) |
| 5 | `ui/Campo` com 44 px | ✅ | `Math.max(ALVO_TOQUE, …)`; `Campo.test.tsx` novo |
| 6 | Nome acessível da exclusão | ✅ | "Excluir seção: <título>" na mobilidade; `editor-mobilidade` 21 de 21 |
| 7 | Capturas que faltaram | ✅ com 3 correções | `capturas/fechamento-26-11/`: Outros (escuro 1920 e 3440, claro 720, lista 720 e 1000), Marca (escuro 3440 e 390, claro 880, 1103, 1920 e 3440), Orientações vazia. Mostraram defeitos reais, corrigidos: (a) campo de 1 linha nascia com 2 (estimativa de 9 px por caractere em `CampoDaTabela`: agora mede o textarea), (b) Observação cortada na 3ª linha (teto fixo de 2; Outros passa a 6 linhas inteiras, a Suplementação segue em 2), (c) Nome cortado na grade de 654 px; e a prévia da Marca em 3440 ficava centrada com vão de ~700 px (agora a 24 px do formulário, teto de 768) |
| 8 | Menu lateral recolhido (Gemini) | ✅ | `SubmenuDoTrilho.tsx`, `Navegacao.tsx`, `gruposDoMenu.ts` e testes: as três correções conferidas no código (`fechar()` zera `sobreSubmenu`, `focado` limpo ao desativar, mouse fora do trilho antes do resize); capturas em `capturas/menu-recolhido-26-11/` (escuro: hover, clique, troca rápida, diagonal, teclado, expandido, celular) sem defeito; `links-do-menu:89` falhava por corrida do teste (o popup nasce em `about:blank` e o teste lia o documento antes do real): corrigido com `expect.poll`, 60 de 60 com 4 workers |

Verificação (lote integrado, medida no mesmo dia): typecheck 0 erros (parte de 92 s com lint e jest); lint 0 erros (10 avisos antigos); jest 459 suítes, 11.084 testes, 42 s; `mvn verify` 3.472 testes, 0 falhas, 39 min (2.359 s); e2e completa 3.321 passaram, 299 puladas, 2 falhas em 35,6 min (2.142 s): `links-do-menu:89` (causa acima, corrigida) e `aniversarios:86` (390 px, 180 de 180 isolada, intermitência). Nível adotado: completo (peça compartilhada `Campo` e `Navegacao`, mais testes da API).

Não conferido: aparelho nativo (a medição de `CampoDaTabela` fora da web segue a estimativa por caractere), temas além do Escuro (Areia e outras paletas) nas capturas novas, tema claro do menu recolhido, capturas de 880 e 1103 da Marca refeitas depois da correção (só leitura de código e e2e).
