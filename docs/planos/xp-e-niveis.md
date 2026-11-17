# XP e níveis

Situação: Planejando (plano pronto, esperando as decisões do Gustavo; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: leitura do código em 16/11/2026 (mapa do explorador), base 1f33299d. Validade: vale enquanto `comunidade/RegrasDoPerfil`, `TipoConquista` e `ConquistaAluno` não mudarem; se mudarem, reconferir a seção "O que já existe".

## Objetivo
Dar ao aluno uma sensação de progresso contínua em cima do que o sistema já mede (treinos concluídos, conquistas, recordes), sem prometer resultado nem opinar sobre saúde. O XP é só uma pontuação de constância e de uso do app.

## O que já existe (conferido)
- Nível: `RegrasDoPerfil.nivel(treinosConcluidos) = 1 + treinos / 10` (`TREINOS_POR_NIVEL = 10`), calculado a cada leitura, sem coluna no banco.
- Conquistas (`comunidade/TipoConquista`, 9 tipos): PRIMEIRO_TREINO, TREINOS_10/25/50/100, SEMANA_COMPLETA, CONSTANCIA_4_SEMANAS, NOVO_RECORDE_CARGA, PLANO_EM_DIA. Gravadas em `ConquistaAluno`.
- Perfil do colega (`GET /aluno/comunidade/perfis/{autorId}`): `treinosConcluidos`, `nivel`, `conquistas` sem id nem horário, `destaques` (até 4), cor e moldura; perfil reservado mostra só nome e apelido. Menor de idade e quem não informou nascimento nasce reservado (escolha explícita do botão vale).
- Ranking atual (`{posicao, treinosConcluidos, pontuacao, participantes}`) só do próprio aluno, sem expor outros.
- App: `aluno/BadgeNivel.tsx`, hoje só no teste.
- Regra permanente: nada de opinião ou cálculo sobre saúde; ausência de dado é "—".

## Proposta (recomendada)
1. **XP derivado, sem tabela nova.** XP = soma calculada a cada leitura a partir de dados que já existem: treinos concluídos (completos valem mais que parciais), conquistas ganhas e semanas completas. Nada de XP por peso, medida, foto, dieta ou check-in de saúde. Sem migration.
2. **Nível** passa a sair do XP (hoje, de treinos/10). Curva simples e fixa, tabela no código (`dominio/xp.ts` com espelho em `comunidade/RegrasXp.java`, mesmo padrão do `RegrasDoPerfil`), com teste de paridade.
3. **Valores sugeridos** (ajustáveis nas decisões): treino concluído completo 10 XP, parcial 5 XP, semana completa +20, cada conquista +50, recorde de carga +15 (no máximo 1 por exercício por dia). Teto de 1 treino por dia contando XP (evita farmar com reabrir e concluir).
4. **Aparece** no início do aluno (barra "Nível N · falta X XP"), no perfil do próprio aluno e, para colegas, só o nível (não o XP bruto, que reflete quanto o colega treina). Perfil reservado continua mostrando nada além de nome.
5. **Sem prêmio, ranking novo ou comparação**: o ranking atual não muda.

## Decisões para o Gustavo
Recomendada primeiro em cada uma.

| # | Pergunta | Opções |
| --- | --- | --- |
| 1 | O que dá XP? | **(a) Só treino concluído, semana completa, conquistas e recorde de carga (recomendada)**; (b) também o uso do app (água, atualização enviada, anamnese); (c) só treino concluído |
| 2 | O que os colegas veem? | **(a) Só o nível (recomendada)**; (b) nível e XP; (c) nada (XP só do próprio aluno) |
| 3 | Menor de idade? | **(a) Igual aos outros, com o perfil reservado por padrão como já é (recomendada)**; (b) menor não ganha nível visível na comunidade; (c) menor sem XP |
| 4 | A curva do nível | **(a) Fixa e linear, 100 XP por nível (recomendada, igual ao ritmo de hoje de 10 treinos)**; (b) crescente (cada nível custa mais); (c) manter treinos/10 e usar o XP só como número extra |
| 5 | XP retroativo? | **(a) Sim, calculado do histórico (como é derivado, nasce certo) (recomendada)**; (b) começa do zero na data de lançamento |
| 6 | Exibir a palavra "XP" ou só "nível"? | **(a) Só "Nível N" e uma barra, sem a sigla XP (recomendada, menos jogo e mais constância)**; (b) "XP" visível |
| 7 | Quando o aluno desfaz uma conclusão (reabrir), o XP volta? | **(a) Sim, é derivado (recomendada)**; (b) não, mantém o ganho |

## Passos (depois das respostas)
- [x] 1. `dominio/xp.ts` + `comunidade/RegrasXp.java` + fixture de paridade e testes (executor) — feito (16/11): `RegrasXp`, fixture de paridade, `xp.ts`; jest verde, Maven não rodou — commit: `d735658e`
- [x] 2. API: `nivel` e `xp` no pacote do aluno e no perfil (sem migration), exportação/anonimização sem mudança (nada novo é gravado) (executor) — feito (16/11) sem migration: `XpService` (calcula a cada leitura), `GET /aluno/comunidade/ranking` traz `{nivel, xp, xpNoNivel, faltam}` só do próprio aluno; perfil/lista do colega só `nivel`; `RegrasDoPerfil.nivel` removido. Decisões: semana completa no servidor = sessões TREINO distintas com dia fixo da versão concluídas na semana (qualquer dia; o app olha séries/data/período da pasta, então os dois podem divergir); recorde só MAIOR_CARGA, vale 0 com `TREINOS_RETORNO_HABILITADO` desligada; sem janela no histórico (`shortcut:`); `obterRanking` deixou de ser `readOnly` porque grava as conquistas antes de calcular (o nível do colega pode ficar atrás até o dono abrir ranking/conquistas); reabrir tira XP do treino/semana mas a conquista gravada fica. Risco de carga: lista de colegas calcula XP por colega. Maven não rodou — commit: ver `git log` ("XP e níveis na API")
- [x] 3. App: barra de nível no início do aluno e no perfil, `BadgeNivel` na comunidade (executor-front) — feito (16/11): cartão "Seu nível" (`aluno/NivelDoAluno`, só com o retorno ligado, depois de "Sua semana"), no próprio perfil e `BarraProgresso` com `aria-*`; o colega só vê "Nível N"; e2e `nivel-do-aluno` escrito e NÃO rodado; **`BadgeNivel` não foi ligado** (faixas em inglês e cor neon contrariam a dose de cor e a decisão 6; conferir com o Gustavo: apagar ou trocar por selo neutro) — commit: ver `git log` ("XP: nível no Início e no perfil")
- [ ] 4. Ajuda e `AGENTS.md` — commit: —
- Revisão independente: não exige trio (não mexe em tenant nem em dado novo); uma revisão do `revisor` sobre o texto exibido (nada de promessa de saúde).

## Riscos
- Farm de XP por reabrir/concluir: teto de 1 treino/dia contando XP.
- Mudar o nível de quem já tem (treinos/10 → XP): aceito até o primeiro cliente real, e a decisão 5 mantém a conta coerente.
- Texto: nunca "emagreça", "ganhe massa" ou meta corporal.

## Fora do escopo
Prêmio, desconto, ranking entre alunos, XP por peso/medida/dieta, XP pago.

## O que ficou para trás
- (nada ainda)
