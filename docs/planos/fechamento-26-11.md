# Fechamento de 26/11: Complementos sem teto, motivo ATRASO só com FINANCEIRO_LER e acabamentos dos editores

Situação: Concluída em 26/11/2026 (item 9 bloqueado) · Onde: main · Atualizado: 26/11/2026

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
- [x] 1. Complementos na ultralarga sem teto (tabela 28/12/10%, Dose e Horário com máximo, 2 linhas sem alça, leitura ~72ch), capturas 1920 e 3440 em `capturas/26-11-fechamento/complementos-*` — spec `complementos-orientacoes-e-suplementos` verde; commit/run: `lote-fechamento` (ver `git log` da main)
- [x] 2. Motivo ATRASO só com `FINANCEIRO_LER` (API e app) e trava da importação depois do IGNORAR — `mvn verify` 3.470 testes, 0 falhas; revisão independente feita (brechas conhecidas em Pendências soltas)
- [x] 3. 503 `FINANCEIRO_INDISPONIVEL` ao pausar acesso vira toast de erro, sem erro inline nem mudança no cartão — `acesso-pausado-fase2.spec.ts`
- [x] 4. Rótulo personalizado da opção da refeição não vira letra — jest `dieta`, `opcoesDaRefeicao`, `CartaoRefeicao`; sem e2e do fluxo personalizado
- [x] 5. Espaço (e Enter) escolhem nos radiogroups — `ToggleGroupItem`, `EscolhaEmFolha`, `PainelDeAgendas`; `escolha-teclado.spec.ts` e `Escolha.test.tsx`
- [x] 6. Exclusão igual nos três editores — `editor-clareza`, `editor-mobilidade`, `dieta-opcoes-e-preparo`; capturas `capturas/26-11-fechamento/excluir-*` e `dieta-excluir-refeicao.png`
- [x] 7. Configurações em 3440 sem vão (o teto próprio de cada tela de item saiu) — `configuracoes`, `tela-larga-equipe-ajuda-ajustes` com 3440 em Automática e Limitada; capturas `configuracoes-*`
- [x] 8. Limites reais na área de soltar: a assistida já mostrava "20 arquivos, 900 KB cada e 8 MB no total" (spec `importacao-assistida:605`); a da planilha ganhou "XLSX ou CSV · até 900 KB" — `importacao.spec.ts`
- [ ] 9. Apagar as branches `treino-academia`, `ficha-24-11`, `tela-larga-revisao` — **bloqueado**: as três estão presas a worktrees e a remoção forçada dos worktrees foi negada pelo sistema; nada foi apagado

## Verificação
typecheck 0 erros; lint 0 erros (10 avisos antigos); jest 454 suítes, 11.052 testes; `mvn verify` 3.470 testes, 0 falhas, BUILD SUCCESS (38 min); e2e integrado das 23 specs das telas tocadas: 367 passaram, 2 puladas, 0 falhas (e passadas isoladas pelos agentes: `dieta-tabela:239` e `detalhes-abrem:132` falharam uma vez cada e passaram sozinhas).

## Fora do escopo
- Aparelho Android/iOS: nada conferido em nativo; tema escuro e larguras intermediárias (960 a 1100) dos editores sem captura.
- Suíte e2e completa (pedido do Gustavo; o `AGENTS.md` a pediria pela peça compartilhada `ToggleGroup`).

## O que ficou para trás
- Tudo em "Pendências soltas" do [README](README.md): brechas do acesso pausado, aba Outros, Marca e Termos em 3440, rótulo personalizado no aluno/PDF, formato do nome acessível, alça dos textareas, branches.
