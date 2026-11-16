# Indicação de alunos

Situação: Planejando (plano-trio feito, esperando as decisões do Gustavo; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: plano-trio (Arquiteto, Guardião e Enxuto) e leitura do código em 16/11/2026, base 1f33299d. Validade: vale enquanto `inscricoes/` (`Crm`, `Inscricao`, `InscricaoService.registrarPublica`) e a anonimização do aluno não mudarem. A migration usa **V080 em diante** (a V078 é da N2 e a V079 é a F3; Flyway sem out-of-order, então não anda em paralelo com outra frente de migration).

## Objetivo
O aluno compartilha o link da inscrição com origem "indicação" e um identificador dele. O CRM mostra quem indicou. **Sem prêmio, desconto nem dinheiro** (decisão do Gustavo). O aluno nunca descobre se o amigo se inscreveu ou fechou.

## O que existe hoje (conferido)
- `Crm.OrigemInformada` já tem `INDICACAO` e `ALUNO_DO_TIME`; `Crm.origemLinkValida` aceita `[a-z0-9_-]{1,40}` e `origemDoLink` já mapeia `indicacao` para a origem INDICACAO. O link é `APP_URL/inscricao/<codigo>?origem=`.
- **Já existe um "quem indicou", em texto livre e sem conferência:** `inscricao.indicado_por` (V064, `varchar(120)`, `Inscricao.java:177`, `InscricaoDtos.java:87` `@Size(max=120)`, gravado cru em `InscricaoService.java:203`). O app só o envia com origem ALUNO_DO_TIME ou INFLUENCIADOR (`app/src/dominio/inscricoes.ts:381`).
- A inscrição pública não tem login, tem limite por IP (20 envios por 10 min, `LimiteTentativas.java:72-74`) e teto de 200 por dia por consultoria (`InscricaoService.java:174`). A consultoria sai do código do link (`InscricaoPublicaService.java:40-41`, `TenantContext.executarComo`), nunca do corpo. Resposta neutra: `InscricaoRecebida`.
- `aluno` tem `UNIQUE (consultoria_id, id)` (V017), então serve de alvo da FK composta.
- A anonimização (`AnonimizacaoRepositorio`) não toca na tabela `inscricao` hoje.
- Convite do aluno usa o fragmento da URL (`APP_URL/convite#codigo=`, `dominio/linkDeConvite`): padrão a reaproveitar.

## Desenho (síntese)
- **Identificador:** código separado do `aluno.id` (o id circula em rotas, exportação e auditoria; o link circula em WhatsApp e prints, sem como ser trocado). HMAC descartado (segredo novo na VPS, trocar a chave mata todos os links, e o UUID teria de ir no link). Recomendado: `aluno.codigo_indicacao uuid not null default gen_random_uuid()` com índice único `(consultoria_id, codigo_indicacao)`; a migration preenche os alunos existentes e o default cobre os novos; na JPA, `insertable=false, updatable=false`. Sem gerador em Java nem "sob demanda".
- **Link:** `APP_URL/inscricao/<código do link de inscrição>?origem=indicacao#indicacao=<código do aluno>`. O código vai no **fragmento** (fora do log do proxy, do histórico e do Referer, como no convite); a página lê, limpa o endereço, guarda o valor só no `sessionStorage` e o manda **no corpo**, campo novo `codigoIndicacao` (`String`, `@Size(max=64)`; String e não UUID, para um valor malformado não virar 400 diferente). O `?origem=indicacao` fica na query (não identifica ninguém). O código nunca vai dentro do `origem` (viraria "campanha" gravada para sempre em `origem_link`).
- **Quem indicou:** coluna `inscricao.indicado_por_aluno_id uuid` com FK composta `(consultoria_id, indicado_por_aluno_id) → aluno(consultoria_id, id)` e `ON DELETE SET NULL (indicado_por_aluno_id)` (a lista de colunas é obrigatória: sem ela o SET NULL tentaria anular `consultoria_id`, NOT NULL; exige PG 15+, o projeto usa o 18). Tabela `indicacao` não compensa (sem prêmio, é uma ligação por inscrição).
- **Validação:** em `registrarPublica`, já dentro do tenant do link: formato → busca JPQL por código (o `@TenantId` restringe à mesma consultoria) → exige aluno ativo e não anonimizado. **Qualquer falha grava nulo, sem recusar a inscrição e sem resposta diferente** (senão o envio vira oráculo para descobrir quem é aluno). O GET público da página nunca recebe nem resolve o código.
- **Rota do aluno:** `GET /aluno/indicacao` → `{link}` (`hasRole('ALUNO')`, sempre o aluno da sessão; 404 se a consultoria não tem link de inscrição aberto; 409 `ALUNO_ANONIMIZADO`). Só o link: nunca contagem, nome nem situação de quem se inscreveu.
- **CRM:** só no detalhe (bloco de origem da `FolhaDaInscricao`): com `ALUNO_LER` mostra "Indicado por <nome>"; sem ela, "Indicado por um aluno" (mesmo critério do `alunoId` em `Duplicidade`). O resumo da lista, o Kanban e os indicadores não mudam. O texto livre antigo continua separado, com rótulo próprio ("Informado pela pessoa, não conferido").
- **LGPD:** anonimização e "Excluir minha conta" (que é a mesma anonimização) precisam de um UPDATE explícito com `consultoria_id` no `AnonimizacaoRepositorio`: zerar `inscricao.indicado_por_aluno_id` das inscrições indicadas por ele (a FK `SET NULL` só vale em DELETE, e a anonimização não apaga a linha) e trocar o código do aluno por outro aleatório (o link antigo morre). Exportação do indicador: não leva a lista de indicados (são dados de terceiros: nome e WhatsApp de leads), no máximo o próprio código. Exportação do inscrito: não leva o nome do indicador. Auditoria: nada de código nem nome.

## Divergências do trio (resolvidas ou levadas às decisões)
- **Código base32 de 12 caracteres sob demanda + `POST` (Arquiteto, Guardião) × uuid com default + `GET` (Enxuto):** recomendo o do Enxuto, menor e sem corrida na geração. Custo da outra: gerador em Java, índice parcial, duas chamadas simultâneas precisam de retry ou trava (teste de concorrência).
- **Texto livre `indicado_por`:** Arquiteto e Enxuto mantêm, rotulado; o Guardião tira (a pergunta "como conheceu" já cobre, e dois campos confundem a equipe). Fica como decisão 2.
- **"Gerar novo link" (Guardião):** Enxuto deixa fora (sem prêmio, o dano de um link vazado é só uma indicação atribuída a outro aluno). Decisão 3.
- **Revisão:** o Guardião e o Enxuto dispensam `revisao-trio` (risco concentrado em segurança e LGPD); basta um revisor independente de segurança (`revisor`/advisor) olhando: tenant do código vindo só do link, resposta igual nos dois caminhos, fragmento limpo, recorte por `ALUNO_LER`, UPDATE nativo da anonimização com `consultoria_id`, FK com `SET NULL` de uma coluna só, exportação sem dados de terceiros.

## Decisões para o Gustavo
Recomendada primeiro.

| # | Pergunta | Opções |
| --- | --- | --- |
| 1 | Prêmio, desconto ou benefício para quem indica | **(a) Nenhum, como você decidiu (recomendada): só atribuir a origem**; (b) benefício do treinador, fora do sistema (o treinador combina com o aluno, o CRM só mostra quem indicou) |
| 2 | O texto livre antigo "quem indicou" (`indicado_por`) | **(a) Manter, rotulado "Informado pela pessoa, não conferido" (recomendada)**; (b) tirar (a regra de não ter compatibilidade permite; a pergunta "como conheceu" cobre) |
| 3 | O aluno pode gerar um link novo (derruba o antigo, se vazar)? | **(a) Não por enquanto (recomendada: sem prêmio, o dano é só atribuir uma indicação a outro aluno)**; (b) sim, botão "Gerar novo link" |
| 4 | O nome de quem indicou aparece para quem? | **(a) Só para quem tem `ALUNO_LER`; os demais veem "Indicado por um aluno" (recomendada)**; (b) a todos com `INSCRICAO_LER` |
| 5 | Qual link a consultoria compartilha quando há vários questionários de inscrição | **(a) O padrão publicado e aberto; sem ele, o cartão "Convidar um amigo" não aparece (recomendada)**; (b) o aluno escolhe |
| 6 | O aluno vê o resultado da indicação (contagem, "seu amigo se inscreveu")? | **(a) Não, nunca (recomendada: LGPD, e até uma contagem entrega o resultado)**; (b) só quando o próprio amigo autorizar (plano à parte) |
| 7 | O indicador entra na exportação do aluno? | **(a) Só o próprio código, sem lista de indicados (recomendada)**; (b) nada |
| 8 | Quando a inscrição vira aluno, o indicador é copiado para a ficha do aluno? | **(a) Não (recomendada)**; (b) sim, campo "Indicado por" na ficha |
| 9 | Menor de idade pode convidar? | **(a) Sim, o cartão aparece como para os outros alunos (recomendada: o link só atribui origem e o menor não recebe dado de ninguém)**; (b) não para menor |

## Passos (depois das respostas)
- [ ] 0. Este plano e a entrada no README — commit: —
- [ ] 1. API (`executor`, PR próprio por causa da migration): migration V080+ (`aluno.codigo_indicacao`, `inscricao.indicado_por_aluno_id`, índice e FK), `Aluno`, `Inscricao`, `InscricaoDtos` (`codigoIndicacao` no pedido, `indicadoPorAluno` no detalhe com o recorte por `ALUNO_LER`), `registrarPublica` com a validação em silêncio, `GET /aluno/indicacao`, UPDATE da anonimização, exportação e totais de migrations em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`; `AGENTS.md` no item do CRM. Testes de integração: código válido grava a FK; inexistente, malformado, de outra consultoria, de aluno inativo e anonimizado dão FK nula e status e corpo idênticos ao válido; detalhe só com a marca sem `ALUNO_LER`; GET devolve o código do próprio aluno e nenhum campo de contagem; anonimizar e excluir a conta zeram a FK e trocam o código; exportação sem lista — commit: —
- [ ] 2. App (`executor`, depende do 1): `corpoDaInscricao` envia `codigoIndicacao`; `lerIndicacaoDoFragmento` em `dominio/` com teste; a página pública lê e limpa o `#indicacao=` (`sessionStorage`, apagado ao enviar); "Indicado por…" na `FolhaDaInscricao` (ajuste no componente existente) — commit: —
- [ ] 3. Cartão "Convidar um amigo" na Conta do aluno (copiar e compartilhar), `executor-front`, depende de 1 e 2; só com internet — commit: —
- [ ] 4. Revisão independente de segurança; Ajuda e `AGENTS.md` — commit: —
- APK: sem dependência nativa (Share do RN e área de transferência que já existem); a web recebe no deploy. O cartão só chega ao Android sem APK novo se houver atualização remota (EAS Update), **não conferido**.

## Riscos
- Qualquer pessoa pode usar o código de outro aluno e atribuir uma indicação a ele. Sem prêmio não há dano financeiro; fica registrado.
- Duas fontes de "quem indicou" (texto livre e conferida) confundem a equipe se o rótulo não separar.
- Link copiado sem o fragmento só perde a indicação, sem erro.

## Fora do escopo
Prêmio, ranking, contagem, indicador na lista/Kanban/filtros/indicadores do CRM, rotacionar o código, copiar o indicador para a ficha do aluno.

## O que ficou para trás
- Não conferido: `FolhaDaInscricao.tsx` (bloco de origem), `linkDeConvite` (helper do fragmento), e se o app tem atualização remota.
