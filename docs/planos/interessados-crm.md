# Interessados: correções e CRM da consultoria

Situação: Pronta na branch, falta a conferência do Gustavo · Onde: branch `claude/saraiva-api-direcionamento-treinos-dv10io` (sem PR, sem `main`) · Atualizado: 29/10/2026

## Objetivo
Corrigir os sete problemas da análise de 29/10 (`analise-interessados-2026-10-29.md`, fora do repositório) na tela
Interessados e transformar a fila num CRM simples: motivo de perda, proposta negociada, retornos, respostas prontas para o
WhatsApp, histórico, Kanban, busca, reabertura, qualificação no formulário, origem e indicadores. O atendimento continua
humano: nada é enviado, cobrado nem cadastrado sem um clique explícito.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo | Tudo da análise (seções 4 e 9), em lotes, um push por lote na branch | Gustavo, 29/10 |
| D2 | B1 (aceite simultâneo com o mesmo e-mail) | O aceite trava a consultoria antes da inscrição (ordem consultoria → inscrição, a mesma do `PlanoDaConsultoria`) e confere o e-mail dentro da trava. Sem índice único no e-mail do aluno | Claude (análise) |
| D3 | B2 (texto lido) | `GET` público devolve `textoVersao` (sha256 do texto); o `POST` devolve o mesmo valor; diferente ou ausente com texto = 409 `TEXTO_ALTERADO`, a tela recarrega o texto e pede a ciência de novo | Claude (análise) |
| D4 | B3 (nota e retenção) | Nota, retorno, mensagem preparada e qualquer evento renovam a atividade (`ultima_atividade_em`, gravada por UPDATE na própria linha, sem subir a versão); a retenção usa essa coluna. A regra continua "180 dias sem atividade" | Claude (análise, regra documentada de inatividade) |
| D5 | B4 (teto diário) | O envio público trava a linha do link (`inscricao_configuracao`) antes de contar; não trava a consultoria inteira | Claude |
| D6 | Encerrar | Recusar e "desistiu" passam por `POST /inscricoes/{id}/encerrar` com motivo (lista fixa) e detalhe curto; o andamento só move entre as etapas abertas; sair de encerrada só por "Reabrir" | Claude (análise 9.3 e 9.7) |
| D7 | Motivos | Preço, Sem retorno, Momento inadequado, Escolheu outro serviço, Serviço incompatível, Outro. Registros antigos: "Não informado" | Análise 9.3 |
| D8 | Proposta | Campos na inscrição (plano, modalidade, periodicidade, valor de referência, valor proposto, condições), em centavos; o plano comercial do Financeiro só preenche a cópia quando o Financeiro está ligado; nada cria cobrança | Análise 9.4 |
| D9 | Respostas prontas | Modelos por consultoria, editados com `INSCRICAO_ALTERAR`; variáveis `{primeiro_nome}`, `{consultoria}`, `{plano}`; o app só prepara (copiar ou abrir o WhatsApp) e registra "mensagem preparada", nunca "enviada" | Análise 9.5 |
| D10 | Retornos | Tabela própria (descrição, data, responsável, concluir); só na tela, sem notificação nova | Análise 9.10 |
| D11 | Histórico | Tabela de eventos com resumo fixo (sem texto livre além do que a equipe já escreveu); as notas continuam na tabela delas; a tela junta os dois | Análise 9.10 |
| D12 | Kanban | Colunas abertas (Novas, Em contato, Em negociação) e encerradas recolhidas; cada coluna pagina no servidor; arrastar e "Mover para" pelo menu; "Aceita" abre a confirmação do aceite | Análise 9.9 |
| D13 | Origem | Pergunta opcional no formulário ("Como conheceu"), parâmetro `?origem=` do link (só `[a-z0-9_-]{1,40}`) e correção manual da equipe; as três ficam guardadas | Análise 9.10 |
| D14 | Migrations | V044 (última atividade) e V045 (CRM). A agenda usa V042 e V043 na branch dela: quem mesclar por último na `main` renumera e acerta o total dos testes | Claude |
| D15 | Planos do Financeiro na proposta | `GET /inscricoes/planos-de-referencia` com `INSCRICAO_ALTERAR` (só nome, valor e periodicidade; arquivados fora); vazio com o Financeiro desligado | Claude |
| D16 | WhatsApp com texto | "Abrir WhatsApp" com o texto preparado vai em `wa.me/...?text=` (como os lembretes de cobrança); o "Abrir WhatsApp" sem modelo continua sem texto | Análise 9.5 |
| D17 | Busca | Colunas geradas no banco: `nome_busca` (sem acento, letras do português) e `whatsapp_digitos` | Claude |

## Passos
- [x] 1. Lote 1, estabilidade: B1, B2, B3, B4, F1, F2, F3 com testes — commit: 3be90bf (`mvn clean verify` 1555 testes, Jest 2341, lint, e2e novos; os testes novos falham sem as correções)
- [x] 2. Lotes 2 a 6, API (base comercial, atendimento diário, Kanban/busca/contagens, qualificação/reabertura/transição, origem/indicadores) — commit: 84b5022 (`mvn clean verify` 1564 testes, 0 falhas; `InscricoesCrmIntegrationTest`)
- [x] 3. Lotes 2 a 6, app: visões Lista, Kanban (arrastar e "Mover para") e Indicadores, retornos, respostas prontas, proposta, histórico, encerrar/reabrir, mesma pessoa, qualificação e origem no formulário, "Conferir antes de aceitar" e "Próximos passos" — commit: o seguinte a 84b5022 (Jest 2355, lint, typecheck, e2e `inscricao`, `interessados-estabilidade` e `interessados-crm` 33 casos em 390 e 1280 px)
- [x] 4. AGENTS.md, Ajuda e guias PDF regerados — commits acima
- [ ] 5. Conferência do Gustavo na tela (web) e no celular; decidir o merge na `main` junto com a agenda (renumerar migrations)

## Fora do escopo
- Envio automático pelo WhatsApp ou confirmação de entrega (exige integração que não existe).
- Cobrança a partir da proposta (o Financeiro continua manual e separado).
- Notificação push para retornos atrasados.

## O que ficou para trás
- Retornos atrasados no Início do treinador (hoje só na tela Interessados).
- Kanban mostra até 100 cartões por coluna; acima disso, a tela pede busca ou a visão Lista.
- O `Botao` desabilitado não junta o `motivo` ao nome acessível ("Copiar" e "Abrir WhatsApp" da resposta pronta); o motivo aparece escrito na tela.
- Arrastar no Kanban testado na web (mouse); no celular (toque longo) ainda não.
- Gerar os guias em PDF num ambiente root pede o Chromium com `--no-sandbox` (o script não passa a opção).
