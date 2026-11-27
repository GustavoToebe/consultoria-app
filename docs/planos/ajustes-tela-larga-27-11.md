# Ajustes de tela larga e páginas públicas (27/11)

Situação: Em andamento · Onde: main · Atualizado: 27/11/2026

## Objetivo
Cinco frentes pedidas pelo Gustavo em 27/11: aba Mobilidade na prévia dos PDFs, Personalizar documentos em tela larga com
miniaturas dos modelos, Configurações › Marca enxuta com prévia grande, Auditoria com painel de detalhe e resumo útil, e
sugestão de planos nas páginas públicas "Quero ser aluno" e Ficha rápida com layout de computador e celular.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Auditoria: a API passa a devolver `objetoNome` e `origem` (sem sensível); antes/depois não existem na API e ficam fora | decidido no briefing | Gustavo (pedido) e sessão (contrato) |
| D2 | Inscrição: `planoComercialId` e `mostrarPrecoDosPlanos` (desligado por padrão), preço só com a opção ligada | decidido no briefing | Gustavo (pedido) e sessão (nomes) |
| D3 | Marca: "Contato" e "Padrões do acompanhamento" saem do formulário da Marca e viram telas próprias do hub | decidido no briefing | Gustavo |

## Passos
- [x] 1. Aba Mobilidade na prévia (exemplo fictício pelo gerador real, e2e em 4 combinações) — commit: fb57efa9 (já no origin/main)
- [x] 2. Personalizar documentos: tela larga, miniaturas, barra de estado e toast — feito, sem commit ainda (27/11)
- [ ] 3. Marca compacta, Contato e Padrões do acompanhamento — em andamento, sem commit
- [ ] 4. Auditoria: API (`objetoNome`, `origem`) e tela (painel, dia, categoria, chips) — em andamento, sem commit
- [ ] 5. Inscrição pública: planos, opção de preço, layout compartilhado (migration provisória, API e app) — em andamento, sem commit
- [ ] 6. App do aluno no PC (tela larga do aluno, apoio 380/420/440) — em andamento, sem commit

Capturas: `capturas/27-11-*`.

## Fora do escopo
- Antes/depois e aparelho na auditoria: a API não guarda; fica como pendência se o Gustavo quiser.

## O que ficou para trás
- (preencher na entrega)
