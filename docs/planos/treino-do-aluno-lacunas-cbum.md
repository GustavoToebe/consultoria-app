# Treino do aluno: lacunas (Lote A)

Situação: Em andamento (plano escrito antes do código, 16/11/2026) · Onde: main · Atualizado: 16/11/2026

Fonte: pedido do Gustavo de 16/11 (Lote A) e mapa do código em 16/11/2026, base `0fa84b91`. Validade: vale enquanto `FaixaDoTreino`, `useSessaoDoDia` e o pacote do aluno (`recordes`, `anteriores`) não mudarem.

## Objetivo
Fechar quatro lacunas da tela de treino do aluno: ±15 s no descanso, folha "Histórico" por exercício, "Equipamentos para hoje" e a faixa "Treino em andamento".

## O que existe hoje (conferido)
- **±15 s existe**: `BarraDescanso.tsx:36-37`, `ajustarDescanso` (`dominio/descanso.ts:45`, nunca abaixo de 0, testado em `descanso.test.ts:8-13`), `Botao` com `minHeight: ALVO_TOQUE` (44, `tokens.ts:570`). A largura real do botão ainda não foi medida.
- Histórico por exercício **não existe** na tela de execução (`[exercicio].tsx`); `historico.tsx:189` usa `CartaoProgresso`; `GET /aluno/progresso?exercicioId=` já é chamado (`rotas.ts:1072`). Com `retornoHabilitado` desligado, `recordes` e `anteriores` não vêm no pacote.
- `Exercicio.equipamento` só existe na biblioteca; o conteúdo do treino publicado **não** tem o campo. `PlanoDietaService.paraPublicar` (:97-108) é o modelo (copia fatores da biblioteca por id); `PlanoServiceBase.paraPublicar` (:97) é o gancho; a conferência de que `PlanoTreinoService` não o sobrescreve ainda é pendente.
- Faixa: `FaixaDoTreino.tsx` só com `retornoHabilitado`. Desmarcar série = mesmo registro com `concluida=false` (`ExecucaoUpsert`), sem teste nomeado.
- `TREINOS_RETORNO_HABILITADO`: padrão `false` (`application.yml:109-111`, `docker-compose.yml:82`). Os docs se contradizem sobre produção: `engajamento.md:21` e `auditoria-ui-ux-lote-1.md:21` dizem ligada (03/11, 12:39); `README.md:237` pendência "ligar … autorizado em 11/11"; `execucao-referencia-e-progressao.md` diz desligada. **Não conferi a VPS.** Desligada, a faixa e a folha ficam invisíveis.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Item 1 | só medir a largura a 390; corrigir se der menos de 44; sem mudança, sem commit | recomendação desta sessão |
| D2 | Item 2 | folha "Histórico" em `sessao/[uid]/[exercicio]`: offline mostra anteriores e recordes do pacote; online chama `GET /aluno/progresso` com as peças do `CartaoProgresso`; retorno desligado = recordes somem | pedido do Gustavo |
| D3 | Item 3 | `equipamento` copiado da biblioteca no `paraPublicar` do treino; sem equipamento no dia a seção não aparece; versões já publicadas não têm o campo | pedido do Gustavo + recomendação |
| D4 | Item 4 | teste de integração de desmarcar série primeiro; "Concluir ou descartar": "Continuar" sai sem decisão, "descartar" só se o significado couber sem decidir (senão vira pergunta) | recomendação desta sessão |

## Passos
- [ ] 1. Plano e entrada no README — commit: este
- [ ] 2. Item 1: medir a largura dos botões ±15 a 390 — commit: —
- [x] 3. Item 2: folha "Histórico" (`aluno/HistoricoDoExercicio`; recordes só com retorno ligado; "Por data" só online) — commit: ver `git log` ("Trocar só hoje, equipamentos e histórico"); e2e não rodou
- [ ] 4. Item 3: "Equipamentos para hoje" (API `paraPublicar`, `formatoDoPacote`, tela) — feito: API, pacote e regra pura `dominio/equipamentosDoDia` (commit: ver `git log`, "Equipamento no exercício do treino publicado"; `PlanosIntegrationTest` ainda não rodou); tela feita em 16/11 ("Equipamentos para hoje" em `sessao/[uid]/index.tsx`; e2e `treino-do-aluno-lacunas` rodou em 16/11 e passa em 390 e 1280 (achou um bug real: `normalizarTreino` do editor descartava o `equipamento`, corrigido em `useSessaoDoDia`)) — commit da tela: ver `git log` ("Trocar só hoje, equipamentos e histórico")
- [ ] 5. Item 4: teste de desmarcar série e faixa "Treino em andamento" — commit: —

## Fora do escopo
- Ligar a chave do retorno em produção (decisão do Gustavo).

## O que ficou para trás
- (preencher na entrega e copiar para "Pendências soltas")
