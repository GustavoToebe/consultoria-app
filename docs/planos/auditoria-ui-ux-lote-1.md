# Auditoria de UI/UX, lote 1 (quick wins 1 a 6)

Situação: Em andamento · Onde: branch `auditoria-ui-ux-lote-1` (PR próprio) · Atualizado: 03/11/2026

## Objetivo
Aplicar os seis "quick wins" da seção E.2 do relatório da auditoria de UI/UX: ordem dos campos no Cluster, botão de
concluir com a chave desligada, guarda de saída no cadastro do aluno, trilha, área de toque do `IconeBotao` e tela de
módulo desligado. Só o app; nada muda na API.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | O que é o "lote 1" | Os itens 1 a 6 da E.2 (Quick wins) do relatório, copiados abaixo. A mensagem original com a lista não foi achada na conversa; se for outra lista, este plano muda antes do PR. | Claude (suposição avisada ao Gustavo em 03/11) |
| D2 | C7 (guarda de saída no `FormAluno`) | Entra neste lote, porque o passo 3 de `telas-do-aluno-visual.md` ainda está aberto; ao terminar, aquele passo cita este commit. | Claude, pela regra do item 3 da E.2 |
| D3 | Arquivos compartilhados com o item 3 (`supervisao-da-equipe`) | Este lote é dono do `FormAluno` e do `AcoesEmLote`; o item 3 trata o 409 novo por `dominio/erroDoPlano.ts`/`ui/useAvisoDoPlano`, sem tocar neles. | Claude |

### Itens (texto da E.2, literal)
1. **Ordem kg → reps → ✓ no Cluster** (P1) — `CartaoSerieComEtapas.tsx` (Sonnet).
2. **"Concluir treino" com a chave desligada vira "Voltar à lista do dia" secundário** (P1) — `[exercicio].tsx:183` (Sonnet).
3. **C7 guarda de saída no `FormAluno`** (P1) — se o passo 3 de `telas-do-aluno-visual.md` não for agora (Sonnet).
4. **C1 trilha sem papel de título** (P2) — `Cabecalho.tsx:73` (Sonnet).
5. **C2 `IconeBotao` com moldura em 44 px** (P2) — `IconeBotao.tsx:45`; conferir capturas do editor e da ficha depois (Sonnet).
6. **C4 tela de módulo desligado** (P2) — `Estados.tsx`, `Permitido.tsx` (Sonnet).

### Itens acrescentados pelo Gustavo em 03/11
7. **Início do aluno, dia de descanso.** Embaixo de "Hoje é dia de descanso." aparece a linha "Próximo treino: <dia> · <nome da divisão>" e um link secundário, "Treinar mesmo assim", que abre `/aluno/treino`.
   - O próximo treino é a próxima sessão com dia fixo, pela mesma regra de semana que o cartão já usa.
   - Plano sem dia fixo não mostra a linha.
   - A regra fica em `dominio/inicioDoAluno.ts`, com teste jest.
   - Aceite: o teste jest cobre o próximo dia na mesma semana, a virada da semana e o plano sem dia fixo. O e2e, em 390 e 1280 px, mostra a linha e o link e confere que o link abre `/aluno/treino`.
8. **Sessão do aluno (`/aluno/sessao/[uid]`).** "Começar treino" fica logo abaixo do cartão HOJE e "Outras datas" desce para depois dele. "Outras datas" continua como está; só a ordem muda.
   - Aceite: em 390×844, "Começar treino" aparece sem rolar. O e2e confere isso em 390 e 1280 px.
9. **Primeiros passos do Início do treinador.** "Abrir Metodologias" abre o Planejamento já com o chip Metodologias selecionado. Hoje o botão cai na Biblioteca.
   - Aceite: o toque leva a `/treinador/planejamento` com o chip Metodologias ativo.
   - A pendência do README que trata disso ("Abrir Metodologias" leva à Biblioteca) é riscada com o commit.

### Decididos em 03/11, sem código
- Metodologias continuam dentro da aba Treino do Planejamento, sem aba própria. (Gustavo)
- O "Quero ser aluno" continua numa página só. Reavaliar depois do teste com 5 alunos, olhando os Indicadores de Interessados. (Gustavo)

### Decisões pendentes
- **Folha da pasta:** treinos no topo, "Finalizar" discreto e "Renovar" em destaque perto do fim. A pergunta foi mandada ao Saraiva e ainda não tem resposta. Não mexer até a resposta.
- **Para o Gustavo decidir depois:**
  - menu do tablet com rótulos;
  - inscrição em duas partes;
  - C10 (passeio guardado no servidor).

## Passos
- [ ] 1. Itens 1 a 9 no app, com o e2e das telas mexidas em 390 e 1280 px — commit: —

## Fora do escopo
- Os demais itens do relatório (E.1 e o resto da E.2) ficam para os próximos lotes.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
