# Pausar o acesso do aluno por atraso (Fase 2 pós-piloto)

Situação: Em andamento (refeita sobre "Desativar acesso": API feita em 26/11, app pendente) · Onde: `financeiro-fases-2-e-3` · Atualizado: 26/11/2026 · Ordem: depois da Fase 1 ([contrato-fechado.md](contrato-fechado.md)) e da Fase 3 ([ficha-rapida-pos-whatsapp.md](ficha-rapida-pos-whatsapp.md))

Fonte: roteiro do Saraiva de 24/11/2026 ("se atrasar e for conversado, continuo o trabalho; sem motivo plausível, perde acesso até quitar") e as correções do Gustavo na mesma data. Validade: leitura do código de 24/11/2026 sobre `9918601b`; reler `AuthService`, `JwtAuthenticationFilter` e `UsuariosDoApp` antes de começar. **Esta fase reabre uma regra permanente** (abaixo): antes de executar, o Gustavo reconfirma.

## Objetivo
O treinador pausa o acesso de um aluno em atraso, na hora que decidir. O aluno pausado faz login e vê só a tela de pagamento ("Seu acesso está pausado. Quite aqui."), paga pelo link e é reativado sozinho quando não sobra nada vencido. Nunca é automático e nunca começa no primeiro dia de atraso.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Estado próprio | Separado de inativar: inativar bloqueia o link com `ALUNO_INATIVO` e mexe em grupo, vaga, agenda e cobranças; pausar não mexe em nada disso | Gustavo, 24/11 |
| D2 | O aluno pausado entra | Faz login e vê só a tela de pagamento; paga pelo link; reativa sozinho quando não resta cobrança vencida (baixa manual e webhook) | Gustavo, 24/11 |
| D3 | Sempre manual | Pausar é ação do treinador, nunca regra automática; até a fase existir, inativar é o paliativo | Gustavo, 24/11 |
| D5 | Pausa = "Desativar acesso" com motivo `ATRASO` | Sai `aluno.acesso_pausado_em`; a pausa vira `acesso_desativado_motivo = 'ATRASO'` (V104 refaz o CHECK com MANUAL e ATRASO). MANUAL bloqueia o login; ATRASO não mexe no usuário e só limita as rotas. Quitar só tira o ATRASO; pausar quem está MANUAL = 409 `ACESSO_JA_DESATIVADO`; desativar quem está em ATRASO troca para MANUAL | Gustavo, 26/11 |
| D4 | Regra permanente reaberta | Hoje vale "pagamento atrasado nunca bloqueia nada do aluno" (D6 de [financeiro-em-fases.md](financeiro-em-fases.md); `CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest`; `ArquiteturaTest`, que proíbe ler `CobrancaAluno*` e `ContratacaoAluno*` fora de `pagamentos/`; a regra das lojas de aplicativo: no celular "Pagar" só com `pagarNoIos`/`pagarNoAndroid`). A decisão de 24/11 muda isso para o caso manual. Reconfirmada em 25/11 e ajustados o teste e o `AGENTS.md` junto | Gustavo, 24/11; reconfirmado em 25/11 |

## O que o código faz hoje (leitura de 24/11)
- O aluno só tem `ativo` (`Aluno.java:75`); o usuário, `ativo` e `credenciaisVersao` (`auth/Usuario.java`). Não existe "pausar" nem "suspender" para o aluno; "pausar" só existe na contratação do Financeiro e não mexe no acesso. Inativar tem efeitos que não se desfazem (cancela agenda futura, tira do pod, encerra a contratação, cancela cobranças a vencer, passa pela vaga do plano ao reativar).
- Sessão e `cv`: `Autenticador.encerrarSessoes` é do módulo `plataforma-comum-auth` (fora do repositório); `JwtAuthenticationFilter:58-90` não autentica quando o `cv` falha (401) e confere `Usuario::isAtivo` (`:75`) e `AcessoPorDireitos` (`:80`); login e renovação passam por `AuthService.liberarAcesso` (`:268-273`, 403 `ACESSO_BLOQUEADO` só por consultoria).
- App: não há tela "acesso bloqueado"; no refresh recusado (`SessaoProvider.tsx:246-250`) o app apaga os dados locais e volta ao Entrar sem dizer o motivo; sem internet abre com o perfil salvo.
- Quitação: `BaixaDeCobranca.baixar` e `baixarDoProvedor` são o ponto único, e **não existem eventos** (`publishEvent`/`@TransactionalEventListener`) no projeto: a reativação precisa de um gancho ali.
- Link de pagamento: nasce de cobrança de aluno e `LinkDePagamentoService` recusa aluno inativo; o aluno pausado precisa de rota própria (a tela de pagamento) sem abrir o resto do app.

## Passos
- [x] 1. Reconfirmar com o Gustavo a mudança da regra permanente (D4) e decidir onde vive o estado (coluna `acesso_pausado_em` em `aluno`, gravada via `@Modifying` igual ao `pod_id`), com auditoria de resumo fixo
- [x] 2. API: pausar e reativar manualmente, 403 com código próprio (`ACESSO_PAUSADO_POR_ATRASO`) no interceptor (mantendo login/refresh livres), reativação automática nos pontos únicos de quitação (`BaixaDeCobranca.baixar`/`cancelar` e `RenegociacaoService.confirmar`), rotas do aluno pausado limitadas à whitelist fechada (`6fb7ea22`, `77dd3d00`)
- [x] 3. App do aluno: tela "Seu acesso está pausado. Quite aqui." (ou "Seu acesso está pausado." quando `pagarNoIos`/`pagarNoAndroid` está desligado no celular) antes do `AlunoProvider`; app do treinador: "Pausar acesso até quitar" e "Reativar acesso" (`PainelConfirmacao`) na ficha e na folha da cobrança vencida (`4a3d7738`, `77dd3d00`)
- [x] 4. Revisão independente (autenticação, sessão, concorrência de `acesso_pausado_em`, dinheiro), `AGENTS.md`, Ajuda e guias (`d4584d24`, `3cb8fdaf`, `77dd3d00`)

- [x] 5. API refeita sobre "Desativar acesso" (D5) depois do merge de `origin/main` `89055688`: V104, `AcessoDoAlunoService` (`pausarPorAtraso`, `reativarPausadoPorAtraso`, `desativar` troca ATRASO por MANUAL), colunas só leitura na JPA com updates dirigidos, interceptor lendo o motivo, `/eu` e listas com `acessoDesativadoMotivo` (sem `acessoPausado`), testes `AtrasoEManualIntegrationTest` e `FichaRapidaEAtrasoMigrationTest` (26/11, sem push)
- [ ] 6. App sobre o contrato novo (`acessoDesativadoMotivo`; botões de pausa voltam ao `CartaoAcesso` da main; Ajuda e guias)

## Evidências e verificação (25/11/2026)
- **Commits na branch:** `6fb7ea22` (API), `4a3d7738` (app), `d4584d24` (E2E `acesso-pausado-fase2.spec.ts`, whitelist LGPD `/aluno/meus-dados`, Ajuda, guias PDF e `AGENTS.md`), `3cb8fdaf` (merge de `origin/main` `64c1ee40`), `77dd3d00` (correções pós-revisão independente: `@Column(insertable = false, updatable = false)` + `AlunoRepository.definirAcessoPausadoEm` eliminando corrida com `PUT /alunos/{id}`, regex estrito de UUID em `AcessoPausadoInterceptor` e título sem CTA de pagamento no celular com flag de loja desligada).
- **Baterias executadas sobre o merge com `origin/main` (`64c1ee40`):**
  - `api/`: `mvn verify` completo — **3.337 testes, 0 falhas, 0 erros** (JaCoCo aprovado), mais reexecução pós-revisão das 9 suítes afetadas (`EXIT=0`, incluindo teste de corrida concorrente `PUT /alunos/{id}` × pausa/reativação em `PausarAcessoPorAtrasoIntegrationTest`).
  - `app/`: `typecheck` (0 erros), `lint` (0 erros, 11 avisos pré-existentes), Jest completo (**433 suítes, 10.133 testes, 0 falhas**) e Playwright E2E completo.

## Fora do escopo
- Pausa automática por dias de atraso; mudar a regra das lojas; mexer no que inativar já faz.

## O que ficou para trás
- Conferência visual nos temas Areia e contraste alto e em aparelho nativo (Android/iOS).
