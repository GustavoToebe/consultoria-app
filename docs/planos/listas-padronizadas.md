# Listas padronizadas no treinador

Situação: Concluída · Onde: main · Atualizado: 27/10/2026

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
- [x] 1. Peça compartilhada + Planejamento sem mudança visual (Outros fica, D5) — commit: 2eadf76
- [x] 2. Telas da lista (D3) e frase repetida das Receitas de séries — commit: 2eadf76
- [x] 3. AGENTS.md (Grade só para blocos), e2e `listas-em-linha`, capturas — commit: 2eadf76
- [x] 4. Deploy verde — run: 40571872648

## O que ficou para trás
- Rótulos dos botões "Editar", "Aplicar ao aluno" (Planejamento), "Editar"/"Ver" (questionários) e "Ver produto" não dizem de qual item são para o leitor de tela; já era assim. Padrão: `rotuloAcessivel` como em `UsuariosEquipe.tsx`.
- Alunos: o `aria-label` do link ("Abrir {nome}. {atualização}") esconde Inativo, Sem acesso e o último registro; já era assim. Usar `rotuloDaLinha`.
- Catálogo: `esmaecido` (0,6) também apaga o selo "Já na biblioteca" e o título (contraste); já era assim.
- `metadadosDoQuestionario` e `selosDoQuestionario` são regra pura dentro de `ListaDeQuestionarios.tsx`, sem teste; mover para `dominio/` com teste.
- Sem e2e para Catálogo (marcar pela caixa e pelo nome), Questionários e Modelos em linha.
- Biblioteca › Outros e `ItemDeLista` ficaram como estão (D5, D6).
