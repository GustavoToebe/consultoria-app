# Folha da cobrança (só app)

Situação: Concluída em 23/11/2026 · Onde: `main` (árvore local, sem commit) · Atualizado: 23/11/2026

## Objetivo
A folha da cobrança diz em três segundos quem deve, de onde vem a cobrança, quanto e para quando, e junta num bloco
"Cobrar o aluno" o link de pagamento, o WhatsApp e os lembretes. O mesmo conteúdo serve à folha e ao painel fixo das
Cobranças na tela ultralarga (`financeiro-em-tela-larga.md`), por isso funciona em ~480 px.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Cabeçalho | Nome do aluno como link para a ficha (`?aba=ficha`, nome acessível "Abrir ficha de <nome>"; o botão "Abrir ficha do aluno" saiu); na própria ficha (sem `mostrarFicha`) o nome é texto. Selo da situação à direita (o selo do tipo saiu: a origem já diz); "Online" e "Cobrada pela Kiwify" ficam | Gustavo |
| D2 | Origem | `dominio/folhaDaCobranca.origemDaCobranca`: "Mensalidade · <plano>", "Cobrança de saída · <plano>", "Avulsa · <descrição> · Parcela k de n", "Parcela k de n do acordo"; só com o que a cobrança traz (sem periodicidade: a cobrança não tem o id do plano) | Gustavo; formato Claude |
| D3 | Prazo relativo | `prazoDaCobranca` (hoje de Brasília): "Vence em N dias" `textoSuave`; "Vence hoje", "Vence amanhã", "Vence em 2/3 dias" `atencao`; "N dias de atraso" `perigo` (dias da API); "Paga em DD/MM/AAAA · forma" `sucesso`; sem prazo nas demais | Gustavo |
| D4 | Datas | Competência, Vencimento, Emissão e Pagamento ("—" sem a data) numa linha quando cabem 4 × 96 px, senão 2 por linha (nunca 3 + 1) | Gustavo |
| D5 | Cobrar o aluno | Só em aberto ou vencida: "Copiar link de pagamento"; sem recebimento configurado, a frase "Configure o recebimento online para mandar o link." com o link "Configurar" na frase; "Enviar pelo WhatsApp" (nome acessível "Enviar pelo WhatsApp: abrir WhatsApp com a mensagem", que mantém o nome antigo) desabilitado sem telefone, com o motivo ao lado (uma vez, P5) e "Adicionar telefone" (só com `ALUNO_ALTERAR`, `?editar=1`); o histórico dos lembretes por e-mail logo abaixo | Gustavo; nome acessível Claude |
| D6 | Lembretes fora do aberto | A cobrança paga, cancelada etc. mantém a lista dos lembretes que já saíram, num grupo "Lembretes por e-mail" (antes aparecia em qualquer situação) | Claude |
| D7 | Pagamento | O grupo fica com "Baixa dada por" e "Transação no provedor"; a data vai nas Datas e (na paga) a forma no prazo; contestada e estornada mostram a forma | Claude |
| D8 | ID | "ID 5adb0f9b…e838" pequeno no fim e o botão de ícone "Copiar ID da cobrança" (copia o inteiro; se o navegador recusar, o inteiro fica selecionável) | Gustavo |
| D9 | Rodapé | O de hoje, sem o "Copiar link" (foi para o bloco). Paga: Marcar estorno, Desfazer baixa (manual), Marcar contestação | Gustavo |
| D10 | Peça | `treinador/financeiro/DetalheDaCobranca` com a casca como variante nomeada (`CascaDoDetalhe`: `Folha` ou painel); `FolhaDaCobranca` mantém as mesmas props | Claude |
| D11 | Retoque (23/11): linha do responsável | "Os lembretes vão ao responsável." sai de baixo do "Copiar link" e fica logo abaixo do título "Lembretes por e-mail"; com responsável o título aparece mesmo sem lembrete enviado (título, linha e histórico, um título só); fora do aberto, a linha entra no grupo do histórico | Gustavo |
| D12 | Retoque (23/11): rodapé do painel de 480 px | Duas linhas fixas (`CascaDoDetalhe.rodapeEmDuasLinhas`): a principal em cima, cheia ("Registrar pagamento"; sem ela, a última ação, como "Marcar contestação" na paga); as demais embaixo, duas por linha, meia largura, na ordem do rodapé; no modo baixa, "Registrar pagamento" em cima e "Voltar" embaixo. A folha (600 px e celular) não muda | Gustavo; casos sem principal Claude |

## Passos
- [x] 1. Regra pura `dominio/folhaDaCobranca.ts` + `folhaDaCobranca.test.ts` (11 casos) — commit: —
- [x] 2. `DetalheDaCobranca.tsx` (conteúdo) e `FolhaDaCobranca.tsx` (casca de folha) — commit: —
- [x] 3. E2e `e2e/financeiro-folha-da-cobranca.spec.ts` (3 cenários × 390 e 1280) e ajustes em `financeiro.spec.ts` ("Configurar", "Baixa dada por") e `financeiro-cobranca-avulsa.spec.ts` (origem) — commit: —
- [x] 4. Capturas 390, 1280 (folha) e 480 (painel), escuro e claro, nos três cenários — fora do repositório

## Fora do escopo
- Apelido abaixo do nome: a cobrança e a ficha do treinador (`AlunoDetalhe`) não trazem o apelido (só `GET /aluno/meus-dados`, do aluno). Precisa de campo na API.
- Periodicidade na origem ("Plano Cauã (Mensal)"): a cobrança traz só `planoNome`, sem o id do plano.

## O que ficou para trás
- Não conferido: temas Areia e contraste alto, leitor de tela e app nativo.
