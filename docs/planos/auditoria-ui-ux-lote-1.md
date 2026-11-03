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

## Passos
- [ ] 1. Itens 1 a 6 no app, com e2e das telas mexidas em 390 e 1280 px — commit: —

## Fora do escopo
- Os demais itens do relatório (E.1 e o resto da E.2) ficam para os próximos lotes.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
