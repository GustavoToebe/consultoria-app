# Importação: escolha do tipo num modal

Situação: Pronta sem commit · Onde: main (sem commit até o Gustavo pedir) · Atualizado: 18/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Validade: vale enquanto `treinador/importacao/TelaImportacao.tsx` e as rotas `/treinador/importacao/nova` e `/treinador/importacao/assistida` não mudarem. Só app: sem API, sem migration.

## Objetivo
"Nova importação" passa a abrir um modal central para escolher entre "Importação manual" (planilha no modelo, destino e conferência coluna por coluna) e "Importação assistida" (PDF, DOCX, planilhas e texto colado, o app lê e sugere); a tela fica mais limpa.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Modal | Folha central que já existe; título "Nova importação", subtítulo "Escolha como quer importar"; dois cartões lado a lado (empilhados abaixo de ~600 px) com ícone num quadrado tonal, título e 3 tópicos baseados no que cada fluxo REALMENTE faz hoje; na assistida, um link discreto "Colar treino de PDF / Docs" (mesmo destino do botão de hoje) | Gustavo, 18/11 |
| D2 | Acessibilidade | Cartões são opções (`radio`, `aria-checked`, dentro de um `radiogroup` com nome); o escolhido usa `coresDaEdicao` (fundo `acaoSuave`, borda `acao`); setas trocam a opção e Enter continua; Esc e clique fora fecham | Gustavo, 18/11 |
| D3 | Rodapé | "Cancelar" (secundário) à esquerda e "Continuar" (primário) à direita, desativado até escolher; leva a `/treinador/importacao/nova` ou `/treinador/importacao/assistida` | Gustavo, 18/11 |
| D4 | Tela | Ficam só "Nova importação" (primário) e "Modelos de planilha" (secundário); saem o botão "Colar treino de PDF / Docs" e a linha "Importação assistida"; as rotas seguem funcionando por link direto | Gustavo, 18/11 |
| D5 | Entrega | Sem commit nem push até o Gustavo pedir | Regra da sessão |

## Passos
- [x] 1. Modal, tela e e2e (comentário "modal da importação (18/11)") — executor-front — commit: — (sem commit, estado local em 18/11/2026). Evidência: e2e `importacao-modal.spec.ts` 13/13 e 35/35 na rodada de 18/11 (local)

## Critérios de aceite
- "Nova importação" abre o modal; Continuar desativado até escolher; cada opção leva à rota certa; Esc e clique fora fecham; teclado (setas e Enter) funciona; a tela só tem os dois botões; capturas em 390 e 1280 px, claro e escuro.

## Fora do escopo
- Mudar os fluxos de importação em si.

## O que ficou para trás
- Capturas em 390 e 1280 px, claro e escuro: não constam na execução de 18/11; conferir antes do commit.
