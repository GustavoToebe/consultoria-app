# S5. Lista de alunos e ficha do aluno

Prévia: `treinador-alunos.html` · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
- **Lista:** tudo cinza; a situação do aluno é um ponto pequeno no cabeçalho do grupo; o selo "SEM ACESSO" se repete em
  quase toda linha e vira ruído.
- **Ficha, aba Resumo:** um cartão ralo (avatar, pasta, "Próximo passo: Tudo em dia.") e mais de metade da tela vazia.
- **Ficha, aba Planos:** selos contornados pequenos; "Revisar atualização" e "Renovar" com o mesmo peso.

## A proposta

### Lista
1. Filtro rápido por situação no topo, com contagem: "Todos 42 · Para revisar 3 · A renovar 2 · Sem registro 5".
   A contagem maior que zero leva a cor do status.
2. Coluna "Situação" com selo **tingido** (fundo do status a ~16% + letra do status), no lugar do contornado.
   Ajuste de 10/11 ("Dose de cor" no plano): só quem pede ação leva selo colorido; "Em dia" é texto de apoio, e a
   contagem dos filtros fica em `texto`.
3. "Sem acesso" vira ícone de cadeado com rótulo acessível e dica; o selo de texto fica só no filtro.
4. Linha inteira clicável, com realce `superficie2` no hover e anel de foco na `marcaTexto`.
5. Coluna "Último registro": "há 9 dias" em âmbar quando passa do limite que o painel já usa (7 dias).

### Ficha
1. **Cabeçalho com quatro métricas** ao lado do nome: adesão da semana (3 de 4), último treino (há 2 dias), último
   peso, dias até renovar. Cada uma só aparece com a permissão que já a mostra hoje; sem dado é "—".
2. **"Próximo passo" como faixa de destaque** com a ação: fundo tingido do status, botão principal da ficha à direita.
   "Tudo em dia" fica discreto (uma linha, selo verde).
3. **Resumo preenchido:** "Treino de hoje" (nome da sessão + `BarraDeComposicao` do S2), "Semana" (7 dias com a letra
   da divisão feita), "Atividade recente" em linha do tempo.
4. **Planos:** uma ação principal por pasta (a do próximo passo); o resto em secundário ou no ⋯; selos tingidos.

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/app/treinador/alunos/index.tsx` | filtro rápido (reaproveita `dominio` dos filtros avançados de 31/10), coluna Situação |
| `app/src/ui/Selo.tsx:18-26` | já tinge (`tingido(cor, superficie)`): conferir se a variante contornada ainda tem uso; se não, remover |
| `app/src/ui/LinhaDaLista.tsx:93` | realce de hover e foco |
| `app/src/treinador/iconesDosSelos.ts` | ícone do "Sem acesso" |
| `app/src/app/treinador/alunos/[id].tsx` | cabeçalho com métricas |
| `app/src/treinador/ResumoDoAluno.tsx:82-85` | faixa do Próximo passo; hoje já tem a borda esquerda na cor do status |
| `app/src/treinador/AtividadeRecente.tsx`, `CartaoTreinosConcluidos.tsx`, `CartaoFrequencia.tsx` | entram no Resumo (já existem na aba Acompanhamento; reaproveitar, não duplicar consulta) |
| `app/src/treinador/CartaoPastas.tsx:188-201` | uma principal por pasta |

## API
As métricas do cabeçalho saem de rotas que a ficha já chama (`atividade-recente`, `sessoes-concluidas`, pesos, pasta
vigente). Se a aba Resumo passar a disparar quatro consultas a mais, vale uma rota de resumo única; decidir depois de
medir, não antes.

## Testes
- Regra pura da métrica "adesão da semana" (reaproveitar `dominio/progressoSemana`).
- E2e da lista e da ficha em 390 e 1280, com perfil sem `ALUNO_SENSIVEL_LER` (o peso não aparece).
