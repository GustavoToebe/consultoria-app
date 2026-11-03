# Libras (lb) na carga: fase 1, regra pura e lado do aluno (N04)

Situação: Em andamento · Onde: branch `libras-fase-1` · Atualizado: 03/11/2026

## Objetivo
O aluno que pensa em libras escolhe `lb` em Perfil › Preferências e passa a digitar e ler as cargas em libras, sem que
nada do que está guardado mude: a carga continua em **kg** no aparelho, na fila offline, na API e no banco. Entra
**desligado** (`TREINOS_UNIDADE_CARGA_HABILITADA`, padrão `false`); desligado, a escolha não aparece e o app inteiro segue em kg.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Unidade canônica | A carga é guardada SEMPRE em kg. Libra só na exibição e na digitação (borda da tela). O que vai à fila offline e à API é kg | Gustavo, 03/11 |
| 2 | Preferência | `unidadeDeCarga: 'kg' \| 'lb'` em `app/src/dominio/preferencias.ts`, padrão `kg`, só no aparelho (como tema e contraste). Não vai a servidor, sem migration | Gustavo, 03/11 |
| 3 | Regra pura | `dominio/unidadeDeCarga.ts`: kg↔lb, arredondar para exibir sem trocar o valor guardado, ida e volta sem derivar (digitar 100 lb e ler de volta em lb dá 100), com teste | Gustavo, 03/11 |
| 4 | Plano publicado | É imutável: trocar a unidade nunca reescreve plano nem registro | Gustavo, 03/11 |
| 5 | Progressão | Nunca é automática por consequência da conversão | Gustavo, 03/11 |
| 6 | Quem vê | Histórico, PDF, exportação, sincronização offline e relatório leem kg e mostram na unidade de QUEM VÊ: o aluno na dele; o PDF e o relatório do treinador na do treinador | Gustavo, 03/11 |
| 7 | Fases | Fase 1 = plano, regra pura e lado do aluno. Fase 2 (treinador) fica para depois | Gustavo, 03/11 |
| 8 | Chave | `TREINOS_UNIDADE_CARGA_HABILITADA` (padrão `false`), no padrão de `TREINOS_RETORNO_HABILITADO`: propriedade, `GET /eu` traz `unidadeDeCargaHabilitada`, `application-test.yml` liga, teste do desligado. Desligada, a escolha some e toda carga fica em kg | Gustavo, 03/11 |
| 9 | Precisão | A gravação mantém 2 casas em kg (`numeric(7,2)` no banco). Em libra, mostra e digita **1 casa** (máscara do campo); `lb → kg` arredonda a 2 casas. Com isso, para todo valor de 0,1 lb, ida e volta devolve o mesmo número (erro de até 0,011 lb < 0,05) | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 10 | Fator | 1 lb = 0,45359237 kg (definição legal), sem aproximar para 0,4536 | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 11 | Botões −/+ | O passo continua o `arredondamentoKg` da metodologia, aplicado ao valor em kg; só o rótulo é convertido (ex.: 0,5 kg aparece "1,1 lb", com 2 casas, para não mentir em 0,25 kg = "0,55 lb"). Nada de passo novo em libras inteiras: isso criaria valor novo | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 12 | "Sim, X?" do painel do ✓ | Mostra a sugestão em libras e grava a sugestão **em kg, sem passar por libra** (o valor do plano não muda) | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 13 | Quem escolhe | Só o aluno vê a escolha nesta fase; a do treinador entra na fase 2. Treinador continua em kg em todas as telas | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 14 | Peso corporal | Fora: peso do aluno (atualização, avaliação, fotos, dieta) segue em kg. "Libras" aqui é só carga de exercício | decidido pelo Claude em 03/11, conferir com o Gustavo |

## Passos
- [x] 1. Plano e índice (este arquivo) — commit: ver `git log` da branch
- [ ] 2. Regra pura `dominio/unidadeDeCarga.ts` com teste (ida e volta, arredondamento, passo, zero e vazio, enormes, negativos, "62,5") e preferência em `preferencias.ts`
- [ ] 3. API: `TREINOS_UNIDADE_CARGA_HABILITADA` (propriedade, `GET /eu`, `application-test.yml`, teste do desligado); app lê `unidadeDeCargaHabilitada` no perfil
- [ ] 4. Aluno: escolha em Preferências (só com a chave ligada) e carga na execução, dica, Anterior, recordes, histórico, relatório e PDF de cargas do aluno
- [ ] 5. e2e `unidade-de-carga.spec.ts` (390 e 1280 px): digitar em lb, ver, recarregar, o corpo enviado à API está em kg; chave desligada = sem a escolha
- [ ] 6. Lista final dos lugares de "kg" tratados e dos que ficam para a fase 2 (abaixo) e `AGENTS.md`

## Lugares de "kg" de carga
Tratados na fase 1 e adiados para a fase 2: preenchido ao fim do passo 4.

## Riscos
- Esquecer um lugar e o aluno ver "kg" onde esperava "lb": a lista acima é a garantia; o que sobrar de aluno vira correção.
- Valor em kg com mais de 2 casas vindo de importação: em libra aparece arredondado a 1 casa; o guardado não muda.
- Aluno que troca de aparelho: a preferência é do aparelho, ele escolhe de novo (como tema e contraste).

## Roteiro de conferência para o Gustavo
1. Com a chave ligada no local, entrar como aluno fictício e abrir Perfil › Preferências: aparece "Unidade da carga" (kg / lb). Desligada, não aparece.
2. Escolher lb, abrir um exercício: o campo de peso diz "lb", os botões −/+ dizem "1,1 lb" (para 0,5 kg), "Sugestão" e "Última vez" saem em lb.
3. Digitar 100 lb, marcar a série, recarregar: continua 100 lb; no histórico também. Voltar para kg: a mesma série mostra 45,36 kg.
4. Conferir que o plano (visto pelo treinador) não mudou.

## Fora do escopo
- Fase 2: preferência e telas do treinador (editor de carga fixa, PDF e relatório do treinador, progresso, recordes da semana, treino ao vivo). Ver "Pendências soltas" do README.
- Unidade `lb` por exercício no plano (a unidade do exercício continua `kg` ou `nenhuma`).

## O que ficou para trás
- Fase 2 (treinador): ver README.
