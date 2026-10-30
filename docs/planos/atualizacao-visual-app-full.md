# Atualização visual do app inteiro e pendências da análise de 29/10

Situação: Planejando (o Claude local implementa) · Onde: branch `atualizacao-visual-app-full` (renomeada da `claude/saraiva-api-direcionamento-treinos-dv10io`) · Atualizado: 30/10/2026

## Objetivo
Levar todas as telas do app (treinador, aluno e públicas) para o estilo do editor de treino (`docs/design-e-front.md`,
seção 4.1) e fechar as pendências da análise do vídeo de 29/10 que ficaram fora da frente
[clareza-do-treinador.md](clareza-do-treinador.md). O editor de treino ([editor-de-treino-visual.md](editor-de-treino-visual.md))
e as telas de aluno do treinador ([telas-do-aluno-visual.md](telas-do-aluno-visual.md)) têm frente própria e ficam fora daqui.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Nome da branch | `atualizacao-visual-app-full` (sem acento nem espaço); a antiga só é apagada depois de o Claude da nuvem conferir | Gustavo, 30/10 |
| D2 | Como levar o estilo às telas | Primeiro pelas peças comuns de `app/src/ui/` (vale para todas as telas de uma vez); depois tela por tela, só arrumação (blocos, faixas, selos com ícone, ações na faixa). Nenhuma regra, rota, permissão ou texto de negócio muda por causa do visual | Gustavo, 30/10 |
| D3 | Telas novas de desenho (painel novo e orientação do primeiro uso) | Protótipo em HTML em `docs/prototipos/` (dados fictícios) aprovado pelo Gustavo antes do código, como foi com o editor e os alunos | Gustavo, 30/10 |
| D4 | A12, categorias dos suplementos | Migration nova troca "Suplementos / X" por "X" só onde a categoria ainda é exatamente a do catálogo padrão (o que o treinador editou fica); o `heavysuppz.json` passa a vir sem o prefixo para as consultorias novas | Análise de 29/10 |
| D5 | A02, importar plano de PDF ou Google Docs | Nesta rodada só o plano escrito (opções, riscos de LGPD, o que fica no servidor); sem código até o Gustavo decidir | Gustavo, 30/10 |

## Passos
- [ ] 0. Renomear a branch (D1) e atualizar o "Onde" dos planos que citam a antiga — commit/run: —
- [ ] 1. Peças comuns no estilo novo (`Cartao`, `Tabela`, `LinhaDaLista`, `ItemDeLista`, `Abas`, `FaixaDeChips`, `Campo`, `EscolhaEmFolha`, `Folha`, `PainelConfirmacao`, `Estados`, `Cabecalho`), com capturas antes e depois — commit/run: —
- [ ] 2. Telas do treinador (lista na mensagem), em lotes paralelos — commit/run: —
- [ ] 3. Telas do aluno e telas públicas, em lotes paralelos — commit/run: —
- [ ] 4. A06: textos da dieta (modelo × plano do aluno, nome dos complementos) — commit/run: —
- [ ] 5. Lista de compras: rótulos "Conforme a dieta" e "Estimativa para compra" (D7 de clareza-do-treinador, que ficou só nos selos) — commit/run: —
- [ ] 6. A12: migration das categorias dos suplementos (D4), com teste de integração — commit/run: —
- [ ] 7. Importação: escolher a linha do cabeçalho (API, tela e testes) — commit/run: —
- [ ] 8. Painel novo do Início do treinador (Próximo passo, Acompanhamento, Planejamento): protótipo, aprovação, código — commit/run: —
- [ ] 9. A01: orientação guiada no primeiro uso: protótipo, aprovação, código — commit/run: —
- [ ] 10. A02: plano escrito em `docs/planos/importar-plano-de-documento.md` (D5) — commit/run: —
- [ ] 11. Ajuda, guias PDF, AGENTS.md, Jest, lint, typecheck, `mvn verify` (passos 6 e 7), e2e completo em 390 e 1280 — commit/run: —

## Fora do escopo
- Editor de treino e telas de aluno do treinador (frentes próprias).
- Comunidade, ranking e XP.
- A04 (falha da planilha na reunião): espera os nomes das colunas e abas.

## O que ficou para trás
- (nada ainda)
