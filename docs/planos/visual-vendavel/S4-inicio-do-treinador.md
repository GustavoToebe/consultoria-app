# S4. Início do treinador: o que precisa de você vem primeiro

Prévia: `treinador-inicio.html` · Plano: [visual-vendavel.md](../visual-vendavel.md) · Relacionado: `docs/design-e-front.md` 5.6 ("Painel do treinador em blocos", ainda não começou)

## O problema
O topo é ocupado pelos "Primeiros passos". Os blocos (Atualizações, Interessados, Treinos, Pastas, Agenda, Alunos) têm o
mesmo peso, alturas diferentes e três ícones repetidos no cabeçalho (abrir, atualizar, filtrar). O que pede ação ("3
pastas a renovar em 7 dias") está no meio de um cartão, do mesmo tamanho de um "0".

## A proposta
1. **"Precisa de você hoje"** no topo: uma fila de até cinco linhas, cada uma com ícone, frase, contagem na cor do
   status e o botão da ação. Exemplos: "3 atualizações para revisar · Revisar", "2 pastas vencem em 7 dias · Renovar",
   "5 alunos sem registro há 7 dias · Ver". Sem pendência: uma linha "Tudo em dia" com selo verde. É o `ProximoPasso`
   de hoje, só que em lista e sempre visível.
2. **Faixa de KPIs** logo abaixo (alunos ativos, treinos concluídos na semana, atualizações no prazo, interessados
   novos): número grande com a regra de cor do S3.
3. **Blocos em grade com a mesma altura por linha**; cabeçalho com título e um "⋯" (atualizar e filtrar vão para dentro
   dele); o título inteiro é o link para a tela.
4. **Primeiros passos compactos:** uma linha com "3 de 5" e barra de progresso na `marcaTexto`; abre ao tocar. Some
   quando termina, como hoje.
5. **Cor:** a marca só na ação da primeira linha da fila (a mais urgente). O resto é status ou neutro.
   Ajuste de 10/11 ("Dose de cor" no plano): contagem da fila e número do KPI sempre em `texto`; a cor do status fica
   no quadrado do ícone da linha e, no KPI que pede atenção, numa linha de apoio com ícone e texto. "Tudo em dia" é
   texto de apoio, sem selo verde.

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/app/treinador/index.tsx:72-179` | ordem dos blocos; a fila substitui o `ProximoPasso` único |
| `app/src/treinador/painel/ProximoPasso.tsx:25` | vira a linha da fila (uma peça, várias instâncias) |
| `app/src/dominio/inicioTreinador` | hoje decide **uma** pendência; passa a devolver a lista ordenada por urgência (regra pura, teste primeiro) |
| `app/src/treinador/painel/BlocoDoPainel.tsx` | cabeçalho com "⋯"; altura igual por linha da grade (`grade.ts`) |
| `app/src/treinador/painel/CartaoMini.tsx`, `FaixaDoPainel.tsx` | KPI com a cor do S3 |
| `app/src/treinador/painel/BlocoPrimeirosPassos.tsx` | modo compacto recolhido por padrão depois do primeiro passo feito |

Nada novo na API: os números já vêm das consultas de `useFontesDoPainel.ts`.

## Testes
- Teste da regra da fila (ordem, permissões: cada linha só aparece para quem tem a permissão da tela de destino, como
  o Próximo passo de hoje).
- `e2e/` do Início em 390 e 1280; consultoria sem aluno continua com o Início enxuto (regra da Ajuda, `conteudo.ts:117`).

## Atenção
A pendência (a) da revisão do `painel-novo` (README, "Pendências soltas") mexe em `usePrimeirosPassosGuardados`:
resolver junto, já que o bloco muda.
