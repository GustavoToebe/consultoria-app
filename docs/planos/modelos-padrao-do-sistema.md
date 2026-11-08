# Modelos padrão do sistema (Semanas, Dias, Séries, Mobilidades e Dietas)

Situação: V062 mesclada na main (PR #105, `88dfb654`, run 42443936995); V063 mesclada na main (PR #106, `e895a0e1`, run 42444911092) · Concluída em 08/11/2026

## Objetivo
Toda consultoria nova nasce com um conjunto maior de modelos de Planejamento prontos, **sem coleção** (`pastaId` nulo),
e as consultorias existentes recebem o que falta. Hoje o `ReceitasPadrao.todas()` cria só estrutura (Metodologia, as
Receitas de séries e 2 dietas vazias); o conteúdo gerado em 06/11 vira padrão.

## Pedido e fonte
Conversa de 06/11/2026: o Gustavo definiu o conjunto e aprovou o "Como eu faria" (JSON em recursos, `exercicioId` por nome,
migration para as existentes, bloco próprio). Base: `origin/main` em `74ac49c4`. Os dados foram gerados por IA fora do repositório
e carregados só no banco local (nada na produção).

## Conjunto
| Item | Quantidade | Origem |
| --- | --- | --- |
| Semanas de treino | 32 (8 divisões × 4 variações) | `receitas-padrao/semanas/` |
| Dias de treino | 37 (sessões de treino da Variação 1) | derivados em `SemanasPadrao` |
| Receitas de séries | 26 | já são padrão (`ReceitasPadrao`) |
| Mobilidades | 3 | `receitas-padrao/mobilidade/mobilidade.json` |
| Dietas | 13 = 11 novas + "5 refeições" e "3 refeições + 2 lanches" | V062 + as 2 de `ReceitasPadrao` |

Nomes das Semanas: `<DIVISÃO> - Variação N - <estilo>` (1 Equilibrada, 2 Máquinas e cabos, 3 Halteres e barras, 4 Equilibrada + técnica na última série).
Ficam **fora**: "Wellness - semanas 1 a 8" e "Torso & Limbs" (conteúdo importado do Saraiva).

Tamanho medido dos JSONs: 20 arquivos em `api/src/main/resources/receitas-padrao/` somando **2,86 MB** (11 em `dietas/` = 142,2 KB; 8 em `semanas/` = 2,71 MB; 1 em `mobilidade/` = 10,4 KB).
Conferido: `ReceitasPadrao.java` não mudou na `main` desde `74ac49c4` (apenas `ReceitaService.java` em `4ccdc882` para a biblioteca única).

## Decisões
| # | Decisão | Valor | Estado |
| --- | --- | --- | --- |
| D-001 | Formato dos dados | JSON `modelos-planejamento/1` em `api/src/main/resources/receitas-padrao/`, lido pelo `ReceitasPadrao`; não escrever o conteúdo à mão em Java | Aprovada |
| D-002 | `exercicioId` | Resolvido **por nome** (sem acento, minúsculas) na biblioteca de cada consultoria, como o carregador faz; sem par fica `null` (o formato aceita) | Aprovada |
| D-003 | Consultorias existentes | Migration em Java, só insere o que falta pelo nome (padrão V026/V034) | Aprovada |
| D-004 | Sem coleção | `pastaId` nulo; a coleção "Saraiva Team (...)" não entra | Aprovada |
| D-005 | Dias | Os Dias padrão são os Dias da Variação 1 de cada divisão (derivados das Semanas padrão); a quantidade é a que a conta der. Conferido em 07/11/2026: 37 Dias (em vez da hipótese inicial de 32). Cada um dos 37 Dias publica com 0 erros e o aviso "O plano não tem dia de descanso.", que foi aceito por ora sem alterar o validador | Aprovada (Gustavo, 07/11/2026; 37 conferidos na branch `modelos-padrao`) |
| D-006 | Dietas | Fase posterior (M-T6): dependem do bloco [biblioteca-unificada-alimentos-suplementos.md](biblioteca-unificada-alimentos-suplementos.md) (alimentos do catálogo e Whey) e da **revisão nutricional**; hoje são rascunhos de IA | Aprovada em 07/11/2026: o Gustavo antecipou. As 13 dietas entram neste bloco, depois da biblioteca unificada (Whey como item da refeição). Decisão do Gustavo (07/11/2026): revisão nutricional e técnica **não** são condição de merge; segue direto para a `main` |
| D-007 | Regra do `AGENTS.md` ("não inventar carga, repetição ou valor nutricional") e comentário do `ReceitasPadrao` ("nada que identifique outra consultoria"; "nenhum alimento é sugerido") | Dietas entram (D-006): mudar as duas no mesmo commit, só para as dietas do padrão do sistema; o sistema segue sem calcular, sugerir nem opinar sobre saúde; treino e mobilidade seguem a regra de nomes neutros | Aprovada em 07/11/2026 (consequência da D-006; commitada em `e9e4c540`) |
| D-008 | Origem das 3 Semanas e 2 mobilidades vindas de `scripts/importacao/dados/` | Gustavo confirmou em 07/11/2026 que tudo é do Saraiva (Plano 10, Plano 2.1, Plano 16 e as 2 mobilidades). Conteúdo de uma consultoria não vira padrão de todas (regra do `ReceitasPadrao`): **ficam fora** do padrão do sistema e seguem só na consultoria do Saraiva. Voltam só com nome neutro, descrição e orientações reescritas e autorização do Gustavo | Decidida (07/11/2026; consequência nos números a conferir na API local) |

## Passos
- [x] M-T1. Leitor de recursos no `ReceitasPadrao` + resolução de `exercicioId` por nome na criação da consultoria (`ReceitaService`, `InstanciaService`) · Concluído em `05085748`
- [x] M-T2. Dados: copiar para `receitas-padrao/` as 32 Semanas, 37 Dias e 3 Mobilidades (sem `colecao`; uids revisados) · Concluído em `6f55f1d9`
- [x] M-T3. Migration Java para as existentes (só insere por nome; nunca altera modelo que o treinador editou) · V063 em `65a36495`, revisão independente aprovada
- [x] M-T4. Testes: consultoria nova recebe o conjunto; migração idempotente; todos passam na validação de publicação (0 erros, aviso conhecido nos dias) · `33443b06` e `65717e83`
- [x] M-T5. Docs: `AGENTS.md`, comentário do `ReceitasPadrao`, este plano, índice · Concluído em `e9e4c540`
- [x] M-T6. Dietas (11) + alimentos do catálogo e Whey como suplemento · Entregue na V062, branch `dietas-padrao` (`2d778d1a`, PR #105 mesclado em `88dfb654`, run 42443936995 verde)

## Aceitação
- Consultoria nova tem 32 Semanas, 37 Dias, 26 Receitas de séries, 3 Mobilidades e 13 Dietas (11 novas + 2 existentes), todas sem coleção.
- Semanas e mobilidades válidas na publicação (0 erros, 0 avisos). Cada Dia publica com 0 erros e 1 aviso conhecido: "O plano não tem dia de descanso." O validador não foi alterado para silenciar; o Gustavo decide depois se trata.
- Consultoria existente ganha o que faltava sem duplicar e sem alterar o que já existe.
- `mvn verify` passa. O total de migrations é 63 (V062 + V063 mescladas na `main`).

## Evidências
- E-001 (06/11/2026, banco local sem commit): 35 Semanas (32 + 3), 37 Dias, 26 Séries, 5 Mobilidades e 13 Dietas conferidas por contagem na API local; as 32 Semanas, 3 mobilidades e 11 dietas novas passaram na validação de publicação com 0 erros e 0 avisos. As 3 Semanas e 2 mobilidades antigas não foram revalidadas.
- E-002 (06/11/2026): variações conferidas nos dados: V1 50% livres e 50% máquinas, V2 98% máquinas, V3 95% livres, V4 igual à V1 com drop set, rest pause e cluster.
- E-003 (06/11/2026): recarga simulada com os JSON renomeados deu 0 criados e 69 mantidos (idempotente).
- E-004 (07/11/2026–08/11/2026): conferência e entrega:
  - Branch `dietas-padrao`: PR #105 mesclado na `main` no commit `88dfb654`; deploy verde no run `42443936995`.
  - Branch `modelos-padrao`: PR #106 mesclado na `main` no commit `e895a0e1`; deploy no run `42444911092`.
  - 32 Semanas, 37 Dias e 3 Mobilidades adicionadas. `SemanasPadraoTest` (2/2 verdes): semanas e mobilidades com 0 erros e 0 avisos; cada Dia com 0 erros e o aviso "O plano não tem dia de descanso." (conhecido e aceito; validador intocado). Revisão independente da V062 e da V063 aprovadas; CI completo verde.
  - Tamanho dos JSONs em `receitas-padrao/`: 20 arquivos somando 2,86 MB (11 em `dietas/` = 142,2 KB; 8 em `semanas/` = 2,71 MB; 1 em `mobilidade/` = 10,4 KB).
  - `ReceitasPadrao.java` intocado na `main` desde `74ac49c4`; apenas `ReceitaService.java` alterado em `4ccdc882` para a biblioteca única.

## Pendências e retomada
- Frente 100% concluída e entregue em produção (08/11/2026).
- Conjunto em produção: 32 Semanas, 37 Dias, 26 Receitas de séries, 3 Mobilidades, 13 Dietas.
- Aviso conhecido e aceito: cada um dos 37 Dias publica com 0 erros e um aviso só, "O plano não tem dia de descanso." O `ValidadorTreino` não foi alterado. O Gustavo decide depois se trata.
- Conteúdo de IA sem revisão técnica (exercícios, prescrições e dietas): risco aceito pelo Gustavo em 07/11/2026.
