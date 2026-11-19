# Fibra do alimento

Situação: Em andamento · Onde: main (passos 0 a 5 feitos, sem push; passo 6 em andamento) · Atualizado: 18/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Base: `main` em `9443481e` (local, sem commit desta frente). Validade: vale enquanto `Alimento`, `BibliotecaService`, `ConteudoDieta.Item`, `scripts/catalogo/gerar_taco.py` e `dominio/dieta.ts` não mudarem; se mudarem, refazer "Conferido no código".

## Objetivo
O treinador informa a **fibra** (g) do alimento e a vê onde já vê os macros: total da opção, da refeição e do dia no editor da dieta, na dieta do aluno e no PDF. O catálogo traz a fibra da TACO. Só a fibra: os demais nutrientes ficam para depois (Pendências soltas do README).

## Conferido no código (18/11/2026)
- Financeiro Fase 1 publicado: run 44197560097 na `main` com `testar-api`, `imagem-api` e `publicar` em sucesso; V087 é a última migration; sem V088 ou maior em nenhum branch remoto nem PR aberto.
- **V088 é da frente "Coleções" (`comunidade-playlists.md`, passo 4), em curso; esta frente usa a V089.** Migration tem um dono por vez: esta frente só escreve a migration depois que o passo 4 da outra estiver commitado.
- TACO: `dados/fontes/taco/Taco-4a-Edicao.xlsx`, aba "CMVCol taco3" tem o cabeçalho "Fibra" na coluna **J** (kcal D, proteína F, gordura G, carboidrato I em `scripts/catalogo/gerar_taco.py:30-33`). Fibra não existe hoje em nenhum código nem migration. O texto do pedido diz "Fibra Alimentar (g)"; confirmar o texto completo do cabeçalho e as casas impressas no PDF (`taco_4_edicao_ampliada_e_revisada.pdf`) na hora de gerar.
- Mapa dos macros (explorador, 18/11): `Alimento` e `CatalogoAlimento`; `BibliotecaService` (`valores`, `kcalDoAlimento`, `importarCatalogoAlimentos`, seed e Whey); `AlimentoRequest`/resposta em `BibliotecaDtos`; `ConteudoDieta.Item` (posicional, 13 campos: construtor de 10, `comDadosDaBiblioteca`, `comUidsNovos`) e `ImportacaoAssistidaService:500`, `ValidadorDieta:236`; planilha em `ImportacaoService:67`, `GravadorDaImportacao:411`, `importacao/completa/Campo`; migrations Java `V060` e `V062` leem JSON de dieta; app: `api/tipos.ts`, `dominio/dieta.ts`, `treinador/biblioteca/AbaAlimentos.tsx`, `treinador/dieta/CartaoRefeicao.tsx` e `TotalDoDia.tsx`, `ui/ValoresDaDieta.tsx`, `aluno/DietaDoAluno.tsx`, `pdf/pdfDieta.ts`. Versões de dieta já publicadas não têm `fibra`: o campo novo lê como ausente ("—"), sem migração do JSON. Pontos a confirmar na hora: onde a publicação copia os macros da biblioteca para o item (não achado em `PlanoDietaService`).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo | Só a fibra (`fibra`, numérica, nula). Minerais, vitaminas e ácidos graxos ficam para o futuro | Gustavo, 18/11 |
| D2 | Ausência | Ausente é "—", nunca zero; nada inventado. Totais seguem exatamente a regra que os macros já usam para valor ausente | Gustavo, 18/11 (regra do `AGENTS.md`) |
| D3 | Kcal | A fibra **não** entra na conta da kcal (`kcalDosMacros` e `BibliotecaService.kcalDoAlimento` não mudam) | Gustavo, 18/11 |
| D4 | Catálogo | `gerar_taco.py` lê "Fibra Alimentar (g)" da aba de composição e trata `Tr`/`NA` como os macros; o SQL gerado nunca se edita à mão | Gustavo, 18/11 |
| D5 | Retroativo | A migration preenche a fibra dos alimentos da biblioteca vindos do catálogo e sem ela, pela regra de correspondência da V038 (uma única correspondência por nome, sem sobrescrever) | Gustavo, 18/11 |
| D6 | Compatibilidade | Sem camada de compatibilidade com o antigo (regra do `AGENTS.md`) | Regra do projeto |

## Passos
Responsável por unidade de arquivo e dependência entre parênteses. Subagentes não comitam; a sessão principal comita e anota o commit aqui.

- [x] 0. Plano e índice (este arquivo, entrada no README e a pendência dos demais nutrientes) — sessão principal — commit: — (sem commit, estado local em 18/11/2026)
- [x] 1. Mapa dos pontos dos macros (explorador, só leitura) — commit: n/a
- [x] 2. API: migration **V089** (`fibra` em `alimento` e `catalogo_alimento`, nula), `gerar_taco.py` + SQL regenerado do catálogo, preenchimento retroativo pela regra da V038, DTO/criar/editar com faixa e 422 `ALIMENTO_INVALIDO` no campo, importar do catálogo copia, planilha com coluna opcional `fibra` (modelos regenerados por `node scripts/importacao/gerar-modelos.mjs`), `ConteudoDieta.Item.fibra` por todos os records que reconstroem (`comItens`, `comUidsNovos` e parecidos), totais de migration (87 → 88) — executor (depende do commit do passo 4 de `comunidade-playlists.md`) — commit: 8c173344
- [x] 3. Testes de integração: criar e editar com e sem fibra, faixa inválida, outra consultoria, catálogo para biblioteca, dieta publicada mantém a fibra — executor (junto do 2) — commit: 8c173344
- [x] 4. Regra pura e tipos no app (`dominio/dieta.ts`, tipos espelhados, `dominio/dieta.test.ts`) — executor (depende do 2) — commit: 085a739c
- [x] 5. Telas: campo "Fibras (g)" no formulário do alimento, totais no editor da dieta, dieta do aluno e PDF; e2e; 390 e 1280 px, claro e escuro — executor-front (depende do 4) — commit: 085a739c
- [ ] 6. `AGENTS.md` (catálogo e kcal, lista de migrations, campo do item da dieta) e fechamento: `mvn verify`, typecheck, lint, `npm test` e os e2e mexidos (um de cada vez; saída grande ao executor-rapido) — sessão principal — commit: — (em andamento, sem commit, estado local em 18/11/2026) (em andamento, sem commit, estado local em 18/11/2026)

## Critérios de aceite
- Alimento criado ou editado com e sem fibra; faixa inválida dá 422 `ALIMENTO_INVALIDO` no campo `fibra` sem repetir o valor; outra consultoria 404.
- Alimento importado do catálogo traz a fibra da TACO; `Tr`/`NA` seguem a regra dos macros; ausente aparece "—".
- A kcal não muda por causa da fibra.
- Dieta publicada mantém a fibra do item; copiar, replicar, modelo e pacote levam o campo.
- Totais da opção, da refeição e do dia, dieta do aluno e PDF mostram a fibra com a regra de ausente dos macros.
- `mvn verify`, typecheck, lint, `npm test` e os e2e mexidos verdes.

## Fora do escopo
- Demais nutrientes (minerais, vitaminas, ácidos graxos): Pendências soltas do README.
- Fibra no suplemento ou em meta de dieta: só se o Gustavo pedir.

## O que ficou para trás
- Decisão para o Gustavo: o NA da fibra gravado como 0 em 218 alimentos (regra dos macros) contraria a D2 (ausente é "—", nunca zero). Ver Pendências soltas do README.
- Decisão para o Gustavo: dieta gravada antes mostra "Fibra —" até ser editada, e o PDF antigo mostra "Fibra: —". Ver Pendências soltas do README.
