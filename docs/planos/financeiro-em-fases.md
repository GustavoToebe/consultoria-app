# Financeiro em fases (geração todo mês, cobrança avulsa e formas de recebimento)

Situação: Planejando (plano feito em 17/11/2026; o código da Fase 1 só começa depois de o lote de 17/11 ser publicado e com `treinador/financeiro/` e `pagamentos/` sem trabalho de outra sessão) · Onde: `main` · Atualizado: 17/11/2026 · Base: `4a7748fc` (local, lote de 17/11 ainda sem push)

Fonte: decisões do Gustavo de 17/11/2026 (frente nova "Financeiro, fase 1"). Validade: vale até o Gustavo mudar uma decisão; as D1 a D4 não se reabrem. **Substitui** [cobrancas-acumuladas.md](cobrancas-acumuladas.md) (marcado como substituído) e fecha a pergunta 2 do Saraiva e a pendência do dia 31.

## Objetivo
O treinador cobra o aluno sem esquecer ninguém: a mensalidade nasce todo mês, paga ou não; ele lança uma cobrança avulsa para vários alunos de uma vez; e escolhe como o aluno paga (InfinitePay, link próprio, Pix copia e cola ou manual). Nada disso bloqueia o aluno por atraso.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Geração (substitui a pergunta 2 de `cobrancas-acumuladas.md`) | A mensalidade é gerada todo mês, paga ou não. A anterior em aberto não impede a seguinte. Sem limite N de abertas | Gustavo, 17/11 |
| D2 | Pausar | Mantém as cobranças em aberto (o treinador cancela se quiser) e para de gerar mensalidades novas; retomar volta a gerar pela regra que já existe | Gustavo, 17/11 |
| D3 | Responsável financeiro | Entra na Fase 2 | Gustavo, 17/11 |
| D4 | Formas de recebimento, em dois níveis | **Nível 1, sem integração (Fase 1):** link de pagamento próprio no plano comercial, Pix copia e cola e Manual, além da InfinitePay que já existe. **Nível 2, baixa automática:** um fornecedor por vez e só quando alguém for usar: Kiwify primeiro (espera o Saraiva dizer como vende lá), depois Eduzz e Inter | Gustavo, 17/11 |
| D5 | Valor vindo do corpo | A cobrança avulsa é a **segunda exceção** à regra "o valor da cobrança é sempre do servidor", ao lado da saída `OUTRO`. Registrar no `AGENTS.md` | Gustavo, 17/11 |
| D6 | Regra permanente | "Pagamento atrasado nunca bloqueia nada do aluno" continua (`CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest`, `ArquiteturaTest`) | regra do projeto |
| D7 | Lojas de aplicativo | A regra de `comoPagar` não muda: no celular o "Pagar" só aparece com `pagarNoIos`/`pagarNoAndroid` | regra do projeto |
| D8 | Sem compatibilidade | Sem flag de transição; a regra de geração antiga (`garantirSeguinte` só com a última não aberta) é trocada, não mantida | regra do projeto |

## Fase 1 (agora)
Limites: no máximo 3 agentes; dois agentes nunca no mesmo arquivo; subagente não commita (um commit por item); push uma vez no fim, com tudo verde; não tocar `docs/teste-infinitepay-16-11-2026.md`. Migrations: o **próximo número livre na hora** (V085 e V086 são do lote de 17/11 e a V087 está reservada à N2 do contato; conferir `ls api/src/main/resources/db/migration`); o B1 e o C1 compartilham **uma** migration, escrita por um agente só (o B1).

### Onda 1 (em paralelo)
- [ ] A. API, `executor`: **geração todo mês e dia 31.**
  - Rotina diária (`@Scheduled`, Brasília, idempotente pelo índice único da competência, lease e trava como o resto de `pagamentos/`) que garante a toda contratação ATIVA uma cobrança para cada competência até a primeira com vencimento a partir de hoje, sem olhar se as anteriores estão pagas. Pausada e encerrada não geram; parcela única fica como está. Chave de ligar e desligar no padrão das outras rotinas, desligada nos testes, que chamam a rotina à mão.
  - Dia 31 (e 29, 30): no mês sem o dia, vence no último dia do mês; o período coberto segue contínuo, sem buraco (resolve a pendência do dia 31; `CalculoDaSaidaTest.ancoraNoDia31DeixaTresDiasSemMesVigenteEmMarco` se inverte).
  - Rever o que muda com várias abertas por aluno (lista de `cobrancas-acumuladas.md`): inadimplentes e percentual (dizer se contam cobrança ou aluno e manter o texto da tela coerente); lembretes (no máximo **um e-mail por aluno por dia**, o da cobrança mais antiga, com o texto dizendo quantas estão em aberto); retomar e encerrar.
  - Testes de integração: três meses sem pagar = três abertas; pausada não gera; dia 31 em fevereiro e em ano bissexto; rodar duas vezes no mesmo dia não duplica; `CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest` segue verde.
  - Dono dos arquivos: `GeradorDeCobrancas`, `ContratacaoService`, `BaixaDeCobranca` (só a chamada de `garantirSeguinte`), `CalendarioDeCobranca`, `LembretesDeCobranca`/`LembretesRepositorio`/`TextoDoLembrete`, `FinanceiroService` (inadimplentes) e os testes respectivos. · commit: —
- [ ] B1. API, `executor`: **cobrança avulsa, totais e lote.**
  - Tipo novo `AVULSA` (ao lado de `MENSALIDADE` e `SAIDA`): 1 a 100 alunos de uma vez, tudo ou nada; descrição até 120, valor em centavos (1 a 1.000.000.000), primeiro vencimento e parcelas de 1 a 12 (mensais, "Parcela 2/3" na descrição); `FINANCEIRO_ALTERAR`; não exige contratação (conferir a FK; se precisar, nula só para AVULSA). Valor do corpo (D5). Lembretes, link, baixa, cancelar e exportação valem igual; auditoria com resumo fixo; migration com o próximo número livre para o CHECK do tipo (e, se o C1 precisar, as colunas do C1 na mesma migration).
  - `GET /financeiro/cobrancas`: totais (total, pago, em aberto, vencido) calculados pelo servidor sobre o filtro inteiro, não só a página.
  - Ações em lote no padrão da baixa em lote (resultado por item): cancelar, gerar link de pagamento, exportar só as selecionadas.
  - Dono dos arquivos: controller/serviço/DTOs da cobrança avulsa e do lote, `CobrancaAluno*`, `ExportacaoFinanceiraService`, a migration do B1 e do C1, `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` (totais) e testes novos. **Atenção:** `CobrancaAluno*` e `GeradorDeCobrancas` são vizinhos do A: o A só toca o gerador e o calendário; o B1 só as entidades e rotas novas, e `BaixaDeCobranca` fica com o A até o A terminar. · commit: —
- [ ] C1. API, `executor`: **formas de recebimento, nível 1.**
  - Link próprio: campo opcional "Link de pagamento" no plano comercial (https por `LinksExternos`, qualquer plataforma); o "Pagar" do aluno abre esse link fora do app, sem token; baixa manual.
  - Pix copia e cola: o treinador informa tipo e chave Pix, nome do recebedor e cidade; a chave pode ser CPF (**dado pessoal**: nunca em log, auditoria, mensagem de erro nem `toString`); o **servidor** monta o código Pix estático (BR Code EMV, com valor da cobrança, identificador curto da cobrança e CRC16) e o devolve na rota da cobrança do aluno; teste com o exemplo do manual do Banco Central; sem QR nesta fase e sem biblioteca nova; baixa manual.
  - Escolha das formas: o treinador liga uma ou mais (InfinitePay, Link próprio, Pix, Manual) e o "Pagar" do aluno mostra as ligadas. Regra das lojas inalterada (D7).
  - Dono dos arquivos: classe do BR Code e seu teste, configuração das formas (entidade, serviço, controller), campo do plano comercial; a migration é escrita pelo B1 (o C1 diz o que precisa). · commit: —

### Onda 2 (tela, depois da API de cada um; `executor-front`, um por vez no mesmo arquivo)
- [ ] B2. Tela: "Nova cobrança avulsa" na aba Cobranças em passo a passo de três etapas (alunos, descrição e valor, vencimento e parcelas); confirmação "Gerar N cobranças?" (`PainelConfirmacao`); totais no topo da lista; ações novas no menu da seleção; um primário por área; e2e em 390 e 1280 nos três temas. Depende de B1. · commit: —
- [ ] C2. Tela: escolha das formas na tela de Recebimento (tipo e chave Pix, nome, cidade, formas ligadas), campo "Link de pagamento" no plano, "Copiar código Pix" e "Pagar" do aluno (só com `comoPagar`); e2e em 390 e 1280. Depende de C1 e de B2 (os dois mexem no Financeiro: um `executor-front` só, em sequência). · commit: —

### Revisão
- [ ] R. `revisao-trio` (Correção, Segurança e Pendências, mais Front porque há tela) sobre o diff inteiro, porque mexe em dinheiro e em migration: duplicidade na geração, valor vindo do corpo, chave Pix como dado pessoal, isolamento por consultoria, código Pix correto. Corrigir o que achar. Depende de A, B2 e C2. · evidência: —

### Onda final
- [ ] F. Ajuda (`conteudo.ts`) e guias PDF (`node scripts/guias/gerar.mjs`), `AGENTS.md` (itens de pagamentos: as três frases de geração, a exceção do valor da avulsa, o Pix e o link próprio), `typecheck`, `lint`, `jest`, e2e do Financeiro, `mvn verify` (saída filtrada pelo `executor-rapido`). Prancha de capturas (fora do git): lista com totais, nova cobrança avulsa, tela de Recebimento com as formas e o Pix do aluno. Depende de R. · evidência: —
- [ ] P. Atualizar este arquivo com o que foi entregue (commit e evidência por passo), conferir que os itens "Fase 2", "Depois da N2" e "Fase 3" continuam abaixo como passos em aberto e, com tudo verde, `git push origin main` (uma vez). · evidência: —

## Fase 2 (só registrado; não executar agora)
- [ ] 2.1 Extrato de entradas e saídas — depende de a Fase 1 estar publicada e do Gustavo pedir; fonte: lançamentos e cobranças que já existem.
- [ ] 2.2 Renegociar várias cobranças em parcelas — depende de D1 (várias abertas por aluno) e da cobrança avulsa (B1) publicadas.
- [ ] 2.3 Responsável financeiro do aluno (D3) — **LGPD**: dado pessoal de terceiro (e do menor), pede desenho próprio, revisão independente e texto no aviso de privacidade; depende da revisão jurídica sobre menores (ver `inscricao-saraiva.md`).
- [ ] 2.4 "Continuar incluindo" no lançamento — depende só da tela de Lançamentos; mecânico, pode ir no `executor`.
- [ ] 2.5 Kiwify automática — depende da resposta do **Saraiva** sobre como ele vende lá; só começa quando alguém for usar (D4, nível 2).

## Depois da N2 (WhatsApp da Meta de cada treinador; o Saraiva já tem conta e número)
- [ ] N.1 Lembrete de cobrança automático pelo WhatsApp oficial, com o mesmo texto do e-mail e um modelo de mensagem aprovado pela Meta; o aluno que desligou os lembretes também não recebe por WhatsApp (`aluno.lembretes_cobranca_desligados_em`). Depende da N2 (`contato-da-consultoria.md`, B8) rodando com um número real e da regra de um lembrete por aluno por dia (passo A).

## Fase 3 (opcional, depois do WhatsApp e do Pix)
- [ ] 3.1 Taxa por forma de pagamento informada pelo treinador uma vez, para mostrar o "líquido estimado", sempre escrito como **estimado**. Não fere "não inventar valor", porque o número é do treinador. Depende do Pix e do WhatsApp publicados.
- [ ] 3.2 Eduzz e Inter automáticos — só quando um cliente for usar (D4, nível 2); um fornecedor por vez, depois da Kiwify.

## Fora do escopo (com o motivo)
- Plano de contas, conta contábil e rateio: é coisa de contador; as categorias de lançamento bastam.
- Boleto, CNAB e homologação bancária: o recebimento é por link (InfinitePay ou link próprio) e Pix.
- Conciliação OFX, cheque e várias contas bancárias: custo alto, uso quase nulo para treinador.
- Mais relatórios e gráficos: já tem mais do que um treinador sozinho usa.
- Nota fiscal: é outro mundo (prefeitura, certificado digital).
- Processo judicial.
- Cartão recorrente automático: a InfinitePay trabalha com link por cobrança; mudar isso é trocar de fornecedor.
- Limite configurável de cobranças em aberto (N) e tempo mínimo "padrão da consultoria": a D1 troca o limite pela geração sempre; o tempo mínimo já mora no plano comercial (`saida-e-tempo-minimo.md`).

## Critérios de aceite
- Três meses sem pagar = três mensalidades abertas; rodar a rotina duas vezes no mesmo dia não duplica; pausada e encerrada não geram.
- Aluno nenhum perde acesso a treino, dieta, mobilidade, atualização ou anamnese por atraso.
- Avulsa: tudo ou nada em 1 a 100 alunos; valor e descrição validados no servidor; chave Pix nunca aparece em log, auditoria ou erro.
- Código Pix igual ao do exemplo do manual do Banco Central (CRC16 incluído).
- No celular, "Pagar" só com a chave da loja ligada.

## O que ficou para trás
- (nada ainda)
