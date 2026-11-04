# Inscrição do Saraiva

Situação: Aguardando revisão (PR aberto) · Onde: branch `inscricao-saraiva` · Atualizado: 04/11/2026

## Objetivo
O Saraiva (Saraiva Team) recebe interessados pelo link "Quero ser aluno" com o formulário dele: as origens que ele usa
(YouTube, TikTok, influenciador, aluno do time), a opção "Tô só de passagem" na previsão de início e 14 perguntas próprias,
sem os campos fixos que ele não quer. O formulário entra na consultoria por um script (como a anamnese do Saraiva), não à mão.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Menores de idade | O Saraiva atende menores de idade. Isso **substitui** a decisão de 20/10 ("a consultoria não atende menores de 18"). O `AGENTS.md` foi corrigido; o termo de uso e o aviso de privacidade (`resources/termos/*.md`; a pendência antiga era dizer "18+" ali, o que não vale mais, e hoje os textos não falam de idade) e a anamnese (sem responsável legal) **não** mudam nesta frente: vão para a revisão jurídica (Pendências soltas). | Gustavo, 04/11 |
| D2 | "Hormonizado ou natural" | A pergunta fica na inscrição pública, como o Saraiva quer. É dado de saúde num formulário sem login (a D7 da frente de perguntas da inscrição pedia o contrário). Fica registrada como pendência de LGPD. | Gustavo, 04/11 |
| D3 | Novas origens | `YOUTUBE`, `TIKTOK`, `INFLUENCIADOR` e `ALUNO_DO_TIME` em `Crm.OrigemInformada` **e** em `Crm.Origem` (a origem da equipe começa pela respondida: `Origem.valueOf(informada.name())`, então as duas listas têm de ter os mesmos valores). A coluna é `varchar(20)`: os nomes cabem. | Claude, a pedido do Gustavo |
| D4 | Origem pelo link | `?origem=youtube`/`yt` → `YOUTUBE` e `?origem=tiktok`/`tt` → `TIKTOK`. Os outros nomes continuam como estavam (outro valor válido = `CAMPANHA`). | Claude, a pedido do Gustavo |
| D5 | Rótulos no app | "YouTube", "TikTok", "Influenciador(a) ou atleta do time" e "Aluno do time". | Gustavo, 04/11 |
| D6 | Previsão de início | Entra `SO_DE_PASSAGEM`, rótulo "Tô só de passagem". As outras opções ficam. | Gustavo, 04/11 |
| D7 | Migration | V057 refaz os três CHECK da V045 (`origem_informada`, `origem`, `previsao_inicio`) com os valores novos. Sem mudar coluna nem dado. | Claude |
| D8 | Script | `scripts/questionario/inscricao-saraiva.mjs` (+ `-lib.mjs` e teste), no molde da anamnese do Saraiva: login só por ambiente, simula sem `--gravar`, exige `QUESTIONARIO_ALTERAR` e `INSCRICAO_ALTERAR`, cria ou reaproveita pelo nome "Inscrição Saraiva Team", publica, define como padrão da inscrição, esconde SEXO, OBJETIVO, INTERESSE e MODALIDADE e troca só o texto do link. Idempotente. Nunca roda em produção por este trabalho. | Gustavo, 04/11 |
| D9 | Texto do link com `**negrito**` | A API guarda o texto como veio, mas a página pública o mostrava como texto simples (os asteriscos apareceriam). A página passa a usar o `TextoFormatado` (o mesmo formato do questionário). | Claude |

## Passos
- [x] 1. Plano, índice e decisões no `AGENTS.md` (menores de idade) — commit/run: `598b601a`
- [x] 2. API: origens e previsão novas, `origemDoLink`, migration V057, testes de integração — commit/run: `faabb8b8`
- [x] 3. App: tipos, rótulos, filtro, indicadores, página pública e e2e — commit/run: `faabb8b8`
- [x] 4. Script `inscricao-saraiva.mjs` com teste (API falsa em 127.0.0.1) — commit/run: `b00968af`
- [x] 5. Verificação local (`mvn verify`, typecheck, lint, jest, e2e, script contra a API local) e PR — commit/run: `mvn verify` 2112 testes, jest 5229, script contra a API local (simular, `--gravar`, de novo sem escrita) e a página `/inscricao/<codigo>` conferida

## Fora do escopo
- Termo de uso e aviso de privacidade para menores, e responsável legal na anamnese (revisão jurídica).
- Rodar o script em produção (só o Gustavo, depois de revisar o PR).
- Imagem nas perguntas e destino no cadastro (a inscrição não aceita, ver `inscricao-com-perguntas-proprias.md`).

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
