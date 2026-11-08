# Biblioteca unificada: Alimentos e Suplementos numa tabela só

Situação: V061 mesclada na main (PR #104, `ea2c2559`, run 42434144981); V062 mesclada na main (PR #105, `88dfb654`, run 42443936995) · Concluída em 08/11/2026

## Objetivo
O treinador cadastra e escolhe suplemento (Whey, creatina...) na **mesma biblioteca** dos alimentos. Um suplemento com
kcal e macros (Whey) entra como item da refeição e **soma na dieta**; hoje ele fica numa tabela à parte, sem valor
nutricional, e nunca entra na conta. Fase de desenvolvimento: sem camada de compatibilidade com o legado.

## Pedido e fonte
Conversa de 06/11/2026 com o Gustavo: ele propôs juntar Alimentos e Suplementos e aprovou a opção A abaixo, com
"Manter a seção" de Suplementação na dieta. Base: `origin/main` em `74ac49c4`.

## Decisões
| # | Decisão | Valor | Estado |
| --- | --- | --- | --- |
| D-001 | Tabela única | `alimento` ganha `tipo` (`ALIMENTO` ou `SUPLEMENTO`, padrão `ALIMENTO`) e as colunas opcionais `marca`, `link`, `cupom`, `sabores` (jsonb), `porcoes_por_embalagem` | Aprovada |
| D-002 | Categoria do suplemento | Reaproveita `grupo` (sem coluna nova) | Aprovada |
| D-003 | Tela | Aba única da Biblioteca com filtro Alimentos / Suplementos | Aprovada |
| D-004 | Dieta | O Whey é item normal da refeição (soma kcal, macros, PDF, lista de compras). O bloco `suplementacao` **fica** só para o que não é refeição (creatina, vitaminas); o "Escolher da biblioteca" dele filtra `SUPLEMENTO` | Aprovada |
| D-005 | Suplemento sem valor nutricional | Fica sem kcal; vale o aviso de "0 kcal" que já existe | Aprovada |
| D-006 | Banco | Migration **nova** (copia `suplemento` → `alimento` com `tipo = SUPLEMENTO`, depois remove a tabela). Não editar migrations antigas. Feita na V061 e mesclada na main (PR #104, `ea2c2559`, deploy verde no run 42434144981). A V062 das dietas padrão foi mesclada no PR #105 (`88dfb654`, deploy verde no run 42443936995) | Feita na V061 (07/11/2026); V062 mesclada em PR #105 (08/11/2026) |
| D-007 | Fora de escopo | Item de dieta apontando para duas tabelas; tabela filha para os campos de suplemento | Aprovada |

## Passos
- [x] A-T1. Migration `alimento` + `tipo` e colunas; cópia das linhas de `suplemento`; remoção da tabela e do `SuplementosPadrao` (os 23 padrões passam para os alimentos padrão). **Revisão independente obrigatória (schema)** · Concluído na V061 (PR #104)
- [x] A-T2. API: `Alimento*` com `tipo` e filtro; remover `Suplemento*`; importador de planilha (aba "Suplementos" grava `alimento` tipo `SUPLEMENTO`); testes (`SuplementoIntegrationTest` migra para o alimento) · Concluído no PR #104
- [x] A-T3. App: `biblioteca.tsx` aba única com filtro; `FolhaSuplementos` lê `tipo = SUPLEMENTO`; `tipos.ts`, `rotas.ts`, `abasDaBiblioteca`, ajuda e e2e · Concluído no PR #104
- [x] A-T4. Verificar a lista de compras e a tela/PDF do aluno com suplemento como item de refeição · Concluído e verificado na CI / deploy
- [x] A-T5. Docs: `AGENTS.md` (biblioteca), este plano, índice · Concluído

## Aceitação
- Whey cadastrado como suplemento (30 g = 124 kcal, P 24, C 2,3, G 2,1, valores do rótulo) aparece no "Adicionar alimento" e soma no total do dia.
- Nenhuma referência a `suplemento` (tabela) resta no código; `mvn verify` e os testes do app passam.
- Suplementação continua listando suplementos pela biblioteca única.

## Evidências
- E-001 (06/11/2026, local sem commit): o `Suplemento` guarda só nome, marca, categoria, porção em texto, sabores, link e cupom, sem valor nutricional (`SuplementoDaBiblioteca` em `app/src/api/tipos.ts`); o `Alimento` guarda kcal, macros, FC, FCc e `grupo`. A dieta soma por `alimentoId`.
- E-002 (07/11/2026, foto do rótulo enviada pelo Gustavo; a marca não aparece na foto): Whey, porção de 30 g (2 dosadores), cerca de 33 porções por embalagem: 124 kcal, carboidratos 2,3 g (açúcares totais 1,7 g, adicionados 0 g), proteínas 24 g, gorduras totais 2,1 g (saturadas 0,8 g, trans 0 g), fibras 0 g, sódio 47 mg. Estes são os valores do Whey da Aceitação e vão para `kcal`, macros e `porcoes_por_embalagem` (D-001). Aminoácidos, açúcares, saturadas, sódio e %VD do rótulo não têm coluna no `alimento` e ficam de fora. Origem: rótulo, nada calculado nem estimado.
- E-003 (07/11/2026, branch `biblioteca-unificada`, commit `4ccdc882`, PR #104): a V061 copia `suplemento` para `alimento` e remove a tabela. O CI do PR passou.
- E-004 (07/11/2026, `origin/main` `ea2c2559`; branch `dietas-padrao` `2d778d1a`): o PR #104 foi mesclado e o deploy passou (run 42434144981). A `dietas-padrao` juntou a `origin/main` sem rebase. A V062 foi mesclada na `main` no PR #105 (`88dfb654`) com deploy verde no run 42443936995.

## Pendências e retomada
- Frente 100% concluída e entregue em produção (08/11/2026).
- V061 (tabela única) e V062 (11 dietas padrão do sistema) em produção.
- Alimento Whey no padrão do sistema segue com a frente de modelos padrão ([modelos-padrao-do-sistema.md](modelos-padrao-do-sistema.md)).
