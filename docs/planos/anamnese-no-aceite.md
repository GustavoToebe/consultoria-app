# Anamnese ao aceitar a inscrição

Situação: Em andamento · Onde: main · Atualizado: 27/10/2026

## Objetivo
Ao aceitar uma inscrição em Interessados, o treinador já envia a anamnese ao aluno criado, sem passo extra na ficha.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Qual anamnese | Escolha no painel "Aceitar inscrição?", com a padrão marcada e "Não enviar agora" | Gustavo |
| D2 | Contrato | `AceitarRequest.anamneseQuestionarioId` opcional; `AceiteResponse.anamneseId` | Claude (revisão) |
| D3 | Permissões | ANAMNESE_LER + ANAMNESE_ALTERAR + ALUNO_SENSIVEL_LER, conferidas antes de criar o aluno; sem elas o campo não aparece | Claude (revisão) |
| D4 | Sem convite | A anamnese fica pendente até o aluno entrar (convite ou "Definir e-mail e senha") | Claude (revisão) |

## Passos
- [x] 1. API, testes de integração, tipos do app — commit: 1f1aa20
- [x] 2. Painel do aceite, regra da opção inicial em `dominio/inscricoes.ts`, e2e — commit: 1f1aa20
- [x] 3. AGENTS.md e Ajuda — commit: 1f1aa20 (guia do treinador em PDF regerado junto)
- [ ] 4. Deploy verde — run: 40563980365 (em andamento em 27/10/2026)

## O que ficou para trás
