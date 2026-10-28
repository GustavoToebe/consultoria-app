# Ciclo desligado: nada do ciclo na tela (frente J)

Situação: Em andamento · Onde: main (um push) · Atualizado: 28/10/2026

## Objetivo
Com `TREINOS_CICLO_HABILITADO` desligado (como está em produção), nenhuma tela do app mostra o ciclo, nem erro dele: o aluno
via na Conta um cartão vermelho "O acompanhamento do ciclo não está disponível." com "Tentar de novo".

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | 503 `CICLO_INDISPONIVEL_NO_APP` | Nunca vira erro na tela: o cartão do ciclo some e o app atualiza o perfil para `cicloHabilitado` ficar falso. Vale para a aluna (`useCicloDaAluna`, `CartaoCiclo`) e para o treinador (`CicloNaFicha`, `CartaoCicloNoPeriodo` nos editores e na pasta) | Gustavo, 28/10 |
| 2 | `CartaoSexoDaAluna` ("Meus dados") | **Não mexer** nesta frente: vira o cartão "Meus dados" de verdade na frente K, depois desta | Gustavo, 28/10 |
| 3 | Causa | Confirmar a causa real do `cicloHabilitado` verdadeiro no app (perfil salvo no aparelho ou Conta montando antes do `/eu`) e corrigir se for do app | Gustavo, 28/10 |
| 4 | Agentes | `executor` (ajuste de comportamento, não tela nova); `executor-rapido` só roda testes | Gustavo, 28/10 |
| 5 | Entrega | Direto na `main`, um push, testes locais verdes antes; sem reexecutar workflow à mão (orçamento extra até 01/11) | Gustavo, 28/10 |

## Passos
- [ ] 1. Causa: variável de produção (VPS, só nomes) e origem do `cicloHabilitado` verdadeiro no app — commit/run: —
- [ ] 2. 503 do ciclo nunca vira erro (aluna e treinador) + perfil atualizado — commit/run: —
- [ ] 3. Correção da causa no perfil salvo, se for do app — commit/run: —
- [ ] 4. Restos do ciclo com a chave desligada (Início, Conta, Ajuda, textos) — commit/run: —
- [ ] 5. Testes (unitários, e2e com API falsa), `AGENTS.md` (item do ciclo) — commit/run: —
- [ ] 6. Publicar verde; depois, o lote do Dependabot do consultoria e a frente K — run: —

## Fora do escopo
- Esconder ou mexer no `CartaoSexoDaAluna` (frente K, [meus-dados-do-aluno.md](meus-dados-do-aluno.md)).
- Ligar o ciclo em produção.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
