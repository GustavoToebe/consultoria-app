# Cobranças acumuladas e tempo mínimo de permanência

Situação: Planejando (sem decisão de implementar o acúmulo; do Saraiva falta só a pergunta 2, pausar na mão; a saída antes do tempo mínimo é do P1.5 e não depende dele) · Onde: `main` (nada implementado) · Atualizado: 15/11/2026

## Objetivo
O aluno que não paga continua sendo cobrado mês a mês: a cobrança do mês seguinte nasce mesmo com a anterior em aberto, até um limite que o treinador configura. Junto, o plano mensal passa a ter um tempo mínimo de permanência. É regra de negócio do Saraiva Team e do Gustavo (13/11); **este arquivo só registra, não há código nem migration nesta etapa**.

## Contexto no código (leitura de 13/11, base local sem commit desta frente)
- `GeradorDeCobrancas.garantirSeguinte` (`api/.../pagamentos/GeradorDeCobrancas.java:40-47`) só gera a seguinte quando a cobrança de MAIOR competência **não** está `ABERTA`. Com a anterior em aberto não gera nada: o comportamento atual contradiz a regra 1 para o Saraiva.
- Quem chama: `BaixaDeCobranca` (`:83` e `:130`, ao pagar/cancelar), `ContratacaoService` (`:96` ao criar/retomar e `:156`). **Não há agendador de cobranças**: a próxima só nasce por uma dessas ações. Os agendadores que existem no pacote são o `ConciliadorInfinitePay` (`:62`) e o `LembretesDeCobranca` (`:77`), de outras funções.
- `AGENTS.md` (item "Pagamentos do aluno ao treinador") documenta hoje: "a seguinte é gerada sempre que a cobrança de MAIOR competência não está aberta", "retomar nunca gera competência dentro de período pago nem de cobrança aberta" e "pausar e encerrar mantêm as cobranças abertas e o app avisa quantas são". As três frases mudam se a regra 1 for implementada.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Cobranças acumulam: a do mês seguinte é gerada mesmo com a anterior em aberto | Regra de negócio; exige agendador novo (hoje a próxima só nasce ao pagar, cancelar ou retomar) | Saraiva e Gustavo, 13/11 |
| 2 | Limite configurável "gerar a próxima com até N cobranças em aberto" | `0` = só depois de pagar (comportamento de hoje); `N` = acumula até N; vazio = sem limite. Padrão na consultoria e ajuste por aluno (contratação) | Saraiva e Gustavo, 13/11 |
| 3 | Parar o acúmulo na mão | Pelas ações que já existem: pausar ou encerrar a contratação | Saraiva e Gustavo, 13/11 |
| 4 | Tempo mínimo de permanência no plano mensal | Padrão configurado pela consultoria, ajustável por aluno | Saraiva e Gustavo, 13/11 |

## Atualização de 13/11 (resposta do Saraiva)

A saída antes do tempo mínimo (pergunta 1) e o que fazer com as abertas ao encerrar e ao inativar (parte da pergunta 2) foram decididos e ficaram em [saida-e-tempo-minimo.md](saida-e-tempo-minimo.md): o app não codifica multa nem percentual; o treinador escolhe a cobrança de saída na hora de encerrar; inativar cancela só o que ainda não venceu. A decisão 4 da tabela acima (tempo mínimo "padrão da consultoria, ajustável por aluno") foi **substituída** pelo tempo mínimo no plano comercial com `minimo_ate` por contratação. Continua em aberto só: pausar na mão mantém ou cancela as abertas, e se o acúmulo mês a mês será implementado.

## Em aberto (só o Saraiva responde)
1. ~~**Saída antes do tempo mínimo:** o aluno paga os meses que faltam, paga multa ou não pode encerrar?~~ **Resolvida pelo P1.5** (decisão do Gustavo de 13/11, marcada aqui em 15/11/2026): a regra é **configurável pelo treinador** (tempo mínimo e lembrete da regra de saída no plano comercial; ao encerrar, ele escolhe se cobra a saída e quanto), sem multa nem percentual codificados e sem bloqueio de encerramento. **Não depende mais de resposta do Saraiva.** Desenho em [saida-e-tempo-minimo.md](saida-e-tempo-minimo.md).
2. **Pausar ou encerrar na mão:** as cobranças em aberto ficam ou são canceladas? (hoje ficam, e o app avisa quantas são). Com acúmulo, isso decide se "parar" também limpa o que já acumulou.

## Impactos a analisar antes de implementar
- **Agendador novo** (`@Scheduled`, no molde do `LembretesDeCobranca`: lease com `for update skip locked`, fora do `TenantContext` com `consultoria_id` explícito, trava aluno → contratação → cobrança de `Travas`, idempotente pela chave `(contratação, competência)`, parado nos testes por propriedade): quando roda, o que faz com contratação pausada e encerrada, e o que acontece se ficar parado dias (gera todas as que faltam? limitado por N?). Ligar a flag em produção sem criar cobrança retroativa inesperada.
- **Limite N:** onde mora (coluna na consultoria e na contratação, `null` = sem limite, `0` = hoje), como o "vazio" se distingue de `0`, validação (teto razoável), auditoria da mudança, tela do Financeiro (Planos/contratação) e da ficha do aluno. Migration nova; aviso de que Flyway não aceita `out-of-order` (ordem V072/V073 já registrada).
- **Tempo mínimo:** coluna de padrão na consultoria e na contratação (em meses); só vale para periodicidade mensal; o plano comercial (`PlanoComercial`) e a contratação não têm hoje nenhum campo para isso (ver resposta abaixo). **Substituído pelo P1.5** ([saida-e-tempo-minimo.md](saida-e-tempo-minimo.md)): o mínimo mora no plano comercial e em `minimo_ate` da contratação, e o efeito ao encerrar já está decidido lá.
- **Inadimplentes:** com várias abertas por aluno, `inadimplentes.itens`, "em atraso" (valor e quantidade), `percentual` de inadimplência e "a receber" mudam de tamanho; conferir se contam cobrança ou aluno, e o texto da tela.
- **Números e painel:** `previsto`, receita recorrente mensal, `alunosPagantes`, `valorMedioPorAluno`, séries mensais e o contrato de nulo/zero (`FinanceiroService`): cobranças acumuladas em aberto não são receita; conferir que não inflam "a receber" nem o previsto do mês corrente de forma enganosa. `GET /numeros` também lê.
- **Lembretes por e-mail:** a chave `(consultoria, cobrança, tipo)` já é por cobrança, então um aluno com várias abertas recebe **vários e-mails** (um por cobrança, nos três momentos). Decidir se agrupa, limita por aluno por dia ou mantém; o texto fixo (`TextoDoLembrete`) fala de uma cobrança só. A "folga" de 2 dias evita lembrete de cobrança antiga, mas cobranças acumuladas geram atraso real de várias.
- **Pausar, encerrar e retomar:** `retomar` hoje começa em `max(hoje, fim do período da última cobrança que não é CANCELADA nem ESTORNADA)` e nunca gera dentro de cobrança aberta; com acúmulo, retomar com várias abertas precisa de regra. Parcela única não recorre e fica fora.
- **Regra permanente "pagamento atrasado nunca bloqueia nada do aluno"** (treino, dieta, mobilidade, atualização, anamnese; `CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest`, `ArquiteturaTest`): continua valendo com N abertas e com tempo mínimo. Nem o tempo mínimo nem o acúmulo podem virar bloqueio de acesso; o que o tempo mínimo faz é só financeiro (cobrança/encerramento).
- **Aluno que sai** (inativado, anonimizado, excluiu a conta): hoje encerra a contratação e cancela as abertas. Com acúmulo, o tempo mínimo e o "paga o que falta" não podem prender quem exerce o direito de excluir a conta (LGPD): decidido no P1.5 (decisões 4 e 5: inativar mantém só o vencido e a cobrança de saída; anonimizar e "Excluir minha conta" cancelam tudo).
- **Pagamento e InfinitePay:** link por cobrança, baixa idempotente e conferência seguem por cobrança; várias abertas por aluno não podem confundir `order_nsu`/`transaction_nsu`.
- **Tela e Ajuda:** textos que dizem "a próxima nasce ao pagar" (Ajuda do Financeiro, AGENTS.md) e o aviso de "N cobranças em aberto" ao pausar/encerrar.
- **Sem compatibilidade com legado** (regra vigente até o primeiro cliente real): não manter o comportamento antigo por flag de transição; o padrão `0` já reproduz o de hoje.

## Passos
- [ ] 1. Resposta do Saraiva à pergunta 2 (pausar na mão). A pergunta 1 foi resolvida pelo P1.5 (15/11/2026, [saida-e-tempo-minimo.md](saida-e-tempo-minimo.md)) — responsável: Gustavo (cobrar a resposta) — evidência: —
- [ ] 2. Plano técnico detalhado (modelo de dados, agendador, impactos acima) e revisão independente (`revisor`: dinheiro, concorrência, LGPD) — responsável: sessão principal + `revisor` — evidência: —
- [ ] 3. API: limite N e tempo mínimo (migration, DTOs, validação, auditoria), agendador, ajustes de inadimplentes/painel/números, testes — responsável: executor — commit: —
- [ ] 4. App: configuração no Financeiro (Planos/contratação), ficha do aluno, avisos de pausar/encerrar, textos e Ajuda — responsável: executor (ajuste de componente existente) ou executor-front se houver tela nova — commit: —
- [ ] 5. AGENTS.md (três frases do item de pagamentos), Ajuda e este plano — responsável: sessão principal — commit: —

## Fora do escopo
- Pagamento parcial, pagador separado e a geração das cobranças como está hoje enquanto o plano não for aprovado (decisões de 13/11 do lote do Financeiro, ver `nulo-e-cobertura.md`).
- Saída antes do tempo mínimo (cobrança de saída opcional, sem multa nem percentual no app, sem bloqueio de encerramento): é do P1.5, [saida-e-tempo-minimo.md](saida-e-tempo-minimo.md).
- Qualquer bloqueio de acesso do aluno por atraso ou por tempo mínimo (regra permanente).

## O que ficou para trás
- Resposta do Saraiva à pergunta 2 (pausar na mão), registrada também em "Pendências soltas" do README. A pergunta 1 saiu daqui: resolvida pelo P1.5.
