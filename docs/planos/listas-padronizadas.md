# Listas padronizadas no treinador

Situação: Aguardando a anamnese no aceite · Onde: main · Atualizado: 27/10/2026

## Objetivo
Toda lista de registros do treinador no formato de linha do Planejamento por coleção (uma linha por item, largura toda,
ações à direita), no lugar dos cartões em 2 ou 3 colunas.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Peça única | `ui/LinhaDaLista` + `ui/ListaDeLinhas`, extraída da `LinhaDeModelo` | Claude (revisão) |
| D2 | Link × ações | Linha com `href` não tem botão dentro; caixa do Selecionar fica ao lado | Claude (revisão) |
| D3 | Telas | Alunos, Atualizações, Agenda, Planejamento › Atualização e Anamnese, Biblioteca (Exercícios, Alimentos, Suplementos, Catálogo) | Gustavo |
| D4 | Fora | Tabelas, blocos que não são lista, área do aluno | Claude (revisão) |

## Passos
- [ ] 1. Peça compartilhada + Planejamento e Outros sem mudança visual — commit: —
- [ ] 2. Telas da lista (D3) e frase repetida das Receitas de séries — commit: —
- [ ] 3. AGENTS.md (Grade só para blocos), e2e, capturas — commit: —
- [ ] 4. Deploy verde — run: —

## O que ficou para trás
