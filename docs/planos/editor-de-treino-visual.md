# Editor de treino: visual do protótipo de 30/10

Situação: Em andamento · Onde: branch `claude/saraiva-api-direcionamento-treinos-dv10io` · Atualizado: 30/10/2026

## Objetivo
Deixar claro onde cada bloco do editor de treino começa e termina, e qual série está pronta, com aviso ou com erro,
sem mudar nenhuma regra do plano. As escolhas saíram de um protótipo em HTML (fora do repositório, dados fictícios)
que o Gustavo ajustou e devolveu com "Copiar meus ajustes".

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Fundo da página | Quase branco: claro `#F7F7F8`, claro areia `#FAF9F6` (o cinza `#EAEAED` se confundia com a faixa dos cartões); escuro não muda | Gustavo, 30/10 |
| D2 | Bordas | Bloco (cartão, sessão, exercício, tabela) com 2 px; linha de 3 px (`bordaCampo`) embaixo da faixa do título e do topo da Folha; grupo de séries com 2 px | Gustavo, 30/10 (protótipo) |
| D3 | Cantos | 12 px em tudo (`RAIO`, `--radius-md`) | Gustavo, 30/10 (protótipo) |
| D4 | Sessão | Barra de 4 px na cor da marca à esquerda do cartão da sessão (identidade, não status) | Gustavo, 30/10 (protótipo) |
| D5 | Exercício | Faixa mais forte (`faixaForte`), número e nome, grupo muscular da biblioteca, selo de estado (Pronto / N avisos / N problemas a corrigir / Sem séries) e Trocar, ↑, ↓, lixeira e abrir na faixa, com moldura | Gustavo, 30/10 (protótipo) |
| D6 | Séries | Uma aberta por vez; número da série (escuro na aberta); selo Pronta (verde) / Atenção (âmbar) / Corrigir (vermelho) com ícone, pela validação da publicação; "Editar" na fechada; seções em caixinhas; Esforço e Descanso lado a lado no PC; "Para o aluno" com fundo leve na cor do estado | Gustavo, 30/10 (protótipo) |
| D7 | Topo do editor | Contadores de sessões, exercícios e séries e "N problemas para publicar · ir ao primeiro" (ou "Pronto para publicar"), ao vivo, sem travar nada | Gustavo, 30/10 (protótipo) |
| D8 | Fim da sessão | Bloco tracejado "Adicionar próximo exercício" com Modelos prontos, Criar grupo e Adicionar exercício | Gustavo, 30/10 (protótipo) |
| D9 | Menu lateral | Item ativo preenchido com a cor da marca (texto `sobreMarca`) | Gustavo, 30/10 (protótipo) |
| D10 | Selo com ícone | Fundo opaco (`tingido`: a cor com alfa 0x18 sobre a `superficie`); translúcido, sobre a `faixaForte`, o texto ficava abaixo de 4,5:1 | Teste de contraste, 30/10 |
| D11 | Painel de ajustes no app | Não entra: as escolhas valem para todos; o que é pessoal continua em Perfil › Preferências | Recomendação, 30/10 |
| D12 | Bordas reforçadas | Só esta opção vai para Perfil › Preferências: borda mais escura (`bordaCampo`) e bloco com 3 px; desligada por padrão | Gustavo, 30/10 |

## Passos
- [x] 1. Cores e medidas comuns (fundo, `RAIO`, `BORDA_BLOCO`, `LINHA_DA_FAIXA`, `BORDA_ITEM`, `faixaForte`, `tingido`) com os testes de contraste — commit/run: —
- [x] 2. Peças comuns: `Cartao`, `CabecalhoDeGrupo` (`linha`, `inicio`, selo com ícone), `Folha`, `Tabela`, `IconeBotao moldura`, `Selo` com ícone, menu lateral — commit/run: —
- [x] 3. Editor: sessão, exercício, séries, contadores e "Adicionar próximo exercício" — commit/run: —
- [x] 4. "Bordas reforçadas" em Perfil › Preferências (D12) — commit/run: —
- [x] 5. Jest (2618), lint, typecheck, e2e completo (344/344 em 390 e 1280), capturas do editor real e AGENTS.md — commit/run: e07bf45, fc67824 e o seguinte (selo logo depois do título)
- [ ] 6. Teste do Gustavo no PC com o Claude local (`mensagem-claude-local-editor.md`), ajustes, PR e CI — commit/run: —

## Fora do escopo
- O mesmo tratamento no editor de dieta, de mobilidade e de questionário (o fundo, as bordas, os cantos e o menu já mudam em todo o app; o resto fica para depois de o Gustavo usar o de treino).
- Abrir sozinha a série com erro ao "ir ao primeiro" (hoje abre o exercício e rola até ele).

## O que ficou para trás
- (nada ainda)
