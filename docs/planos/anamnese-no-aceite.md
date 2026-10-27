# Anamnese ao aceitar a inscrição

Situação: Concluída em 27/10/2026 · Onde: main · Atualizado: 27/10/2026

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
- [x] 4. Deploy verde — run: 40563980365 (success em 27/10/2026, `publicar` incluído)

## O que ficou para trás
- `AnamneseService.atribuir` transforma qualquer `DataIntegrityViolationException` em 409 `ANAMNESE_PENDENTE` (no aceite, uma FK por questionário excluído no meio viria com a mensagem errada; o rollback continua total). Conferir o nome da restrição, como o `QuestionarioService.gravar` já faz.
- Aceitar uma inscrição já aceita levando um questionário arquivado depois dá 409 `QUESTIONARIO_INDISPONIVEL` em vez de `INSCRICAO_JA_ACEITA` (só UX; a ordem das checagens está documentada no javadoc do `aceitar`).
- `EscolhaEmFolha` não recebe toque dentro de `PainelConfirmacao` (a folha abre num `Modal` fora do AlertDialog); o campo "Enviar anamnese" usa `Escolha`, também com muitas opções. Mexer em `Folha`/`PainelConfirmacao` só se aparecer outra tela com o mesmo caso.
