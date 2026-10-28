# Ciclo desligado: nada do ciclo na tela (frente J)

Situação: Concluída em 28/10/2026 (código no f72d173; run 40751695095 verde; celular só num APK novo) · Onde: main (um push) · Atualizado: 28/10/2026

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
- [x] 1. Causa: produção está com o ciclo desligado (nenhuma variável com CICLO no `consultoria.env` nem no contêiner da API; `GET /eu` dá `false` desde 27/10, 817b41b). Mesmo assim o log da API mostra seis 503 `CICLO_INDISPONIVEL_NO_APP` em 28/10 às 17:24–17:25 UTC: o aparelho tinha a chave verdadeira no perfil. Um perfil velho é a explicação que cabe: o `cicloHabilitado` só era regravado em `abrir()` (abertura a frio, login) e, para aluno, `recarregarPerfil` sai cedo; o `consultoria.env` foi alterado e o contêiner recriado em 28/10 15:37 UTC, então uma sessão aberta antes disso seguia com a chave ligada. **A origem exata do `true` no aparelho não foi confirmada** (não há como ver o perfil salvo de fora); a correção cobre qualquer origem — commit: f72d173
- [x] 2. 503 do ciclo nunca vira erro (aluna e treinador) + perfil atualizado: `aoCicloDesligado` no cliente → `SessaoProvider` põe a chave falsa no estado e no salvo; `useCicloDaAluna`/`ciclo.tsx`/`CartaoCiclo` não mostram nem avisam esse erro; `CicloNaFicha` ignora dado velho — commit: f72d173
- [x] 3. Correção da causa no perfil salvo: o mesmo callback regrava `CHAVE_PERFIL` com `cicloHabilitado:false` — commit: f72d173
- [x] 4. Restos do ciclo com a chave desligada: Início, Conta, Marca, busca e PDFs já escondiam; a Ajuda perdia só a frase "Sexo diferente de Feminino desliga o acompanhamento do ciclo" (`textoDoItem`) — commit: f72d173
- [x] 5. Testes (`ehCicloDesligado`, cliente, hook, e2e com chave falsa e com `/eu` ligado + 503) e `AGENTS.md` (item do ciclo). Local: typecheck, lint, 153 suítes/2056 testes, e2e do ciclo (23) e `expo export --platform android` verdes — commit: f72d173
- [x] 6. Publicar verde (web no ar com 511e8b5; a API não foi reconstruída); depois, o lote do Dependabot do consultoria e a frente K — run: 40751695095

## Fora do escopo
- Esconder ou mexer no `CartaoSexoDaAluna` (frente K, [meus-dados-do-aluno.md](meus-dados-do-aluno.md)).
- Ligar o ciclo em produção.

## O que ficou para trás
- O guia do usuário em PDF (`scripts/guias/gerar.mjs`, servido em `public/guias`) é estático e ainda traz a frase do ciclo na pergunta de sexo; **resolvido na frente K (28/10):** `scripts/guias/gerar.mjs` passa cada texto por `textoDoItem(..., false)` e os dois PDFs foram regerados sem a frase.
- A origem exata do `cicloHabilitado` verdadeiro no aparelho do teste não foi confirmada; teste de campo no relatório.
- (cada sobra também vai para "Pendências soltas" no README)
