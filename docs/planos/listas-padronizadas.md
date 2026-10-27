# Listas padronizadas no treinador

Situação: Em andamento · Onde: main · Atualizado: 27/10/2026

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
| D5 | Biblioteca › Outros fica como está | Linha em colunas alinhadas com cabeçalho (tabela); a peça só serviria com um modo colunas | Claude |
| D6 | `ItemDeLista` fica | Tem modo botão, ícone, perigo e `direita`; usado em 14 arquivos fora destas listas | Claude |
| D7 | Selecionar | A caixa é irmã do link e só ela marca; tocar no nome abre a ficha | Gustavo |
| D8 | `selos[]` no lugar de `selo?` | Alunos pode ter dois selos ao mesmo tempo | Claude |

## Passos
- [ ] 1. Peça compartilhada + Planejamento e Outros sem mudança visual — commit: —
- [ ] 2. Telas da lista (D3) e frase repetida das Receitas de séries — commit: —
- [ ] 3. AGENTS.md (Grade só para blocos), e2e, capturas — commit: —
- [ ] 4. Deploy verde — run: —

## O que ficou para trás
