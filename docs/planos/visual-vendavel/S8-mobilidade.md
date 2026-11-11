# S8. Mobilidade: aluno e editor do treinador

Prévia: `aluno-mobilidade.html`, `treinador-mobilidade.html` · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
- **Aluno sem mobilidade:** "Sem mobilidade" e a tela inteira vazia. Parece defeito.
- **Aluno com mobilidade:** lista de itens com "Ver vídeo" e o marcar; a contagem do que foi feito é um número solto;
  as seções não se distinguem.
- **Editor:** três campos empilhados por item (Nome, Prescrição, Vídeo), todos com o mesmo peso; reordenar e remover
  competem com os campos.

## A proposta

### Aluno
1. **Progresso no topo:** "3 de 8 feitos hoje" com barra na `marcaTexto`; completo vira selo verde "Feito hoje".
2. **Seções como grupos** com rótulo de seção e contagem ("Antes do treino · 2 de 4"); recolhem quando completas.
3. **Item em uma linha:** botão de marcar (44 px) à esquerda, nome em semibold, prescrição em `textoSuave` na linha de
   baixo, ícone de vídeo à direita (abre fora do app, como hoje). Feito: nome riscado suave e ✓ verde.
4. **Estado vazio com orientação:** ícone, "Seu treinador ainda não publicou a mobilidade", uma frase do que é
   ("alongamentos e exercícios de mobilidade, com vídeo quando houver") e o atalho "Ver meu treino". Nada inventado:
   sem conteúdo de exemplo.
5. Sem cor de identificação aqui: mobilidade não tem tipo de série. A única cor é o verde do feito e a marca no progresso.

### Editor
1. **Item compacto:** nome e prescrição lado a lado em ≥ 768; o vídeo vira um campo que só aparece ao tocar em
   "Adicionar vídeo" (com link preenchido, mostra o ícone e "Vídeo adicionado").
2. **Alça de arrastar à esquerda, lixeira à direita**, as duas discretas até o foco ou o hover; no toque ficam visíveis.
3. **Cabeçalho da seção** com nome editável, contagem de itens e "⋯" (duplicar, mover, remover).
4. **Coluna de prévia em ≥ 1024:** como o aluno vê, com as mesmas peças do aluno (a mobilidade ainda não tem "Ver como
   o aluno"; isso seria funcionalidade nova e fica fora desta sugestão, a coluna da prévia HTML é só para conversa).

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/app/aluno/mobilidade.tsx:44-140` | progresso, grupos, linha do item, estado vazio (`:51`) |
| `app/src/app/aluno/treino.tsx:128` | o mesmo estado vazio (a aba Mobilidade dentro do Treino) |
| `app/src/ui/Estados.tsx:21` (`Vazio`) | já aceita `Icone` e `acao`: só passar |
| `app/src/treinador/mobilidade/ItemDeMobilidade.tsx:43-52` | item compacto, vídeo sob demanda |
| `app/src/treinador/mobilidade/SecoesDeMobilidade.tsx`, `EditorDeMobilidade.tsx` | cabeçalho da seção |

Nada na API nem no registro offline do "feito" (mesmo `BotaoMarcar`, mesma fila).

## Testes
- E2e da mobilidade do aluno (marcar, desmarcar, offline) em 390.
- Teste do editor: adicionar vídeo, remover item, publicar com link inválido continua recusando (`ValidadorMobilidade`).

## Tamanho
É a menor das sugestões. Boa candidata a ser a primeira tela aplicada depois do S1 e do S3, para validar o padrão num
lugar de baixo risco.
