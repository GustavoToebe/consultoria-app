# Pausar o acesso do aluno por atraso (Fase 2 pós-piloto)

Situação: Planejando (só documento; sem código) em 24/11/2026 · Onde: `main` · Atualizado: 24/11/2026 · Ordem: depois da Fase 1 ([contrato-fechado.md](contrato-fechado.md)) e da Fase 3 ([ficha-rapida-pos-whatsapp.md](ficha-rapida-pos-whatsapp.md))

Fonte: roteiro do Saraiva de 24/11/2026 ("se atrasar e for conversado, continuo o trabalho; sem motivo plausível, perde acesso até quitar") e as correções do Gustavo na mesma data. Validade: leitura do código de 24/11/2026 sobre `9918601b`; reler `AuthService`, `JwtAuthenticationFilter` e `UsuariosDoApp` antes de começar. **Esta fase reabre uma regra permanente** (abaixo): antes de executar, o Gustavo reconfirma.

## Objetivo
O treinador pausa o acesso de um aluno em atraso, na hora que decidir. O aluno pausado faz login e vê só a tela de pagamento ("Seu acesso está pausado. Quite aqui."), paga pelo link e é reativado sozinho quando não sobra nada vencido. Nunca é automático e nunca começa no primeiro dia de atraso.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Estado próprio | Separado de inativar: inativar bloqueia o link com `ALUNO_INATIVO` e mexe em grupo, vaga, agenda e cobranças; pausar não mexe em nada disso | Gustavo, 24/11 |
| D2 | O aluno pausado entra | Faz login e vê só a tela de pagamento; paga pelo link; reativa sozinho quando não resta cobrança vencida (baixa manual e webhook) | Gustavo, 24/11 |
| D3 | Sempre manual | Pausar é ação do treinador, nunca regra automática; até a fase existir, inativar é o paliativo | Gustavo, 24/11 |
| D4 | Regra permanente reaberta | Hoje vale "pagamento atrasado nunca bloqueia nada do aluno" (D6 de [financeiro-em-fases.md](financeiro-em-fases.md); `CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest`; `ArquiteturaTest`, que proíbe ler `CobrancaAluno*` e `ContratacaoAluno*` fora de `pagamentos/`; a regra das lojas de aplicativo: no celular "Pagar" só com `pagarNoIos`/`pagarNoAndroid`). A decisão de 24/11 muda isso para o caso manual. Reconfirmar na execução e ajustar o teste e o `AGENTS.md` junto | Gustavo, 24/11; a reconfirmar |

## O que o código faz hoje (leitura de 24/11)
- O aluno só tem `ativo` (`Aluno.java:75`); o usuário, `ativo` e `credenciaisVersao` (`auth/Usuario.java`). Não existe "pausar" nem "suspender" para o aluno; "pausar" só existe na contratação do Financeiro e não mexe no acesso. Inativar tem efeitos que não se desfazem (cancela agenda futura, tira do pod, encerra a contratação, cancela cobranças a vencer, passa pela vaga do plano ao reativar).
- Sessão e `cv`: `Autenticador.encerrarSessoes` é do módulo `plataforma-comum-auth` (fora do repositório); `JwtAuthenticationFilter:58-90` não autentica quando o `cv` falha (401) e confere `Usuario::isAtivo` (`:75`) e `AcessoPorDireitos` (`:80`); login e renovação passam por `AuthService.liberarAcesso` (`:268-273`, 403 `ACESSO_BLOQUEADO` só por consultoria).
- App: não há tela "acesso bloqueado"; no refresh recusado (`SessaoProvider.tsx:246-250`) o app apaga os dados locais e volta ao Entrar sem dizer o motivo; sem internet abre com o perfil salvo.
- Quitação: `BaixaDeCobranca.baixar` e `baixarDoProvedor` são o ponto único, e **não existem eventos** (`publishEvent`/`@TransactionalEventListener`) no projeto: a reativação precisa de um gancho ali.
- Link de pagamento: nasce de cobrança de aluno e `LinkDePagamentoService` recusa aluno inativo; o aluno pausado precisa de rota própria (a tela de pagamento) sem abrir o resto do app.

## Passos
- [ ] 1. Reconfirmar com o Gustavo a mudança da regra permanente (D4) e decidir onde vive o estado (coluna em `aluno` ou no usuário), com auditoria de resumo fixo
- [ ] 2. API: pausar e reativar manualmente, 403 com código próprio no login e no filtro, reativação automática no ponto único de quitação, rotas do aluno pausado limitadas à tela de pagamento — executor
- [ ] 3. App do aluno: tela "Seu acesso está pausado. Quite aqui." com o link; app do treinador: "Pausar acesso até quitar" e "Reativar" (`PainelConfirmacao`) na ficha e na folha da cobrança vencida — `executor-front`
- [ ] 4. Revisão independente (autenticação, sessão, dinheiro), `AGENTS.md`, Ajuda e guias

## Fora do escopo
- Pausa automática por dias de atraso; mudar a regra das lojas; mexer no que inativar já faz.

## O que ficou para trás
- A decisão D4 aguarda o Gustavo antes de qualquer código.
