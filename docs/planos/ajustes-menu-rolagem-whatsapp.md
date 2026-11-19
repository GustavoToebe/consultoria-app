# Ajustes de 19/11: rolagem que piscava, menu, títulos dos grupos, símbolo do WhatsApp e aviso do Renegociar

Situação: Feito e commitado em 19/11/2026, sem push (um commit só, "ajustes-menu-rolagem-whatsapp"; `git log -- docs/planos/ajustes-menu-rolagem-whatsapp.md`) · Onde: `main` · Atualizado: 19/11/2026

## Objetivo
Parar a oscilação da barra de rolagem em Comunidade › Vídeos, levar o menu ao comportamento de minimizar e expandir do treino.io, dar mais legibilidade aos títulos dos grupos, pôr o símbolo do WhatsApp nos botões que o abrem e avisar "alunos diferentes" antes de abrir a renegociação.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Rolagem | `scrollbar-gutter: stable` só na web, só nas telas (`preencher`) e de 768 px para cima; folha e celular não mudam (a faixa vazia deixava 32 px à direita contra 16 à esquerda na folha, e 15 px a menos quebrava a barra de filtros de 390 px) | Sessão, 19/11/2026 (o Gustavo pediu a correção no elemento rolável, sem esconder a barra) |
| D2 | Botão do menu | "Minimizar menu" à direita da marca; minimizado, "Expandir menu" revelado por mouse, toque ou foco do teclado no lugar da logo, sem expandir sozinho | Gustavo, 19/11/2026 |
| D3 | Títulos dos grupos | 14 px semibold (`textoSuave`); com texto Grande ou Extra e grupo recolhido com contagem, a contagem e a seta descem para a linha de baixo (13 px evitaria no Grande) | Gustavo (sugestão de 14 px), 19/11/2026 |
| D4 | WhatsApp | Símbolo no verde de `sucesso`; cinza no botão desabilitado | Gustavo, 19/11/2026 |
| D5 | Renegociar com alunos diferentes | Item do "Mais ações" apagado com o motivo, como no caso da Kiwify | Gustavo, 19/11/2026 |

## Passos
- [x] 1. Rolagem: `ui/RolagemComTopo`, teste `e2e/rolagem-sem-oscilar.spec.ts` (falha sem a correção em 800 e 1280 px) — commit: o do lote
- [x] 2. Menu e títulos: `ui/Navegacao`, `e2e/menu-do-treinador.spec.ts` — commit: o do lote
- [x] 3. Símbolo do WhatsApp: `ui/IconeWhatsApp` nos seis botões — commit: o do lote
- [x] 4. Aviso antes do Renegociar: `dominio/renegociar`, `AcoesDoLote`, `e2e/financeiro-renegociar.spec.ts` — commit: o do lote

## Fora do escopo
- Folha com altura que depende da largura e perto da altura máxima ainda pode piscar (nenhuma conhecida; `shortcut:` no componente).
- Claro areia, contraste alto, nativo e tablet de toque do menu só têm teste de tokens.

## O que ficou para trás
- E2E inteiro depois da faixa da barra de rolagem (rodados: comunidade, ficha, menu, ajuda, financeiro-renegociar).
