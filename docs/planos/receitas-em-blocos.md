# Receitas em blocos e as receitas do treinador do piloto

Situação: Planejando · a janela agrupada (C16) é a parte 6 da [Frente G](cores-por-tipo-de-serie.md) e só vira código depois do ok da prévia; o cadastro das receitas (C17) aguarda a lista do treinador · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C16, C17

## Objetivo
O maior risco de adoção que apareceu na reunião: montar treino no app "é bem demorado" comparado a escrever. O caminho
combinado: o treinador manda por escrito as receitas que usa, e a janela "Usar receita" mostra as receitas organizadas
em blocos e por técnica.

## O que o código faz hoje (main 19b1fd6)
- Receitas próprias existem: "Nova receita de séries" no Planejamento (`ReceitaService`, `FolhaReceitas.tsx`).
- Receitas já têm coleções ("Organizar coleções") e busca (PR #26).
- Há um catálogo padrão e 2 receitas de exemplo (migrations V026 e V034, `ReceitasPadrao.java`).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde ficam as receitas enviadas pelo treinador | receitas da consultoria dele, não do catálogo global | proposta |
| D2 | Agrupamento na janela "Usar receita" | por coleção e por técnica, com a receita completa primeiro; mostrar a prévia (Frente G) antes do código | Gustavo (02/11) |
| D3 | Cadastro das receitas do Saraiva (C17) e dias prontos (C02) | só quando ele mandar a lista | Gustavo (02/11) |

## Passos
- [ ] 1. Receber a lista do treinador e mapear cada receita no modelo atual — Gustavo e executor — commit: —
- [ ] 2. Medir quantos toques leva montar aquecimento + 3 FS + WS + 2 Back off, antes da mudança — executor — commit: —
- [ ] 3. Janela "Usar receita" agrupada (D2), depois do ok da prévia — executor-front — commit: —
- [ ] 4. Cadastro das receitas enviadas, com conferência antes de valer — executor — commit: —
- [ ] 5. Medir de novo e registrar aqui — executor — commit: —

## Fora do escopo
- Modelos de treino prontos ("blueprints"): só depois das receitas.

## O que ficou para trás
- —
