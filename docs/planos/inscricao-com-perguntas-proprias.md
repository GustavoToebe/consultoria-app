# "Quero ser aluno" com as perguntas do treinador

Situação: Planejando (começa depois de `ajustes-video-30-10`) · Onde: — · Atualizado: 31/10/2026

## Objetivo
Cada treinador monta as perguntas da página pública "Quero ser aluno", como já monta as da anamnese e da atualização.
Hoje as perguntas dessa página são fixas e iguais para todas as consultorias.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Quando | Depois do lote de ajustes da reunião de 30/10 (`ajustes-video-30-10`). É funcionalidade nova, e o combinado de 31/10 com o Saraiva é só ajustar o que existe até lá. | Gustavo, 31/10 |
| D2 | Motor | O questionário que já existe ganha uma terceira finalidade, `INSCRICAO`, ao lado de `ATUALIZACAO` e `ANAMNESE`. Mesmo editor, prévia, versões e condições, e uma aba "Inscrição" no Planejamento. Nada de construtor de formulário novo. | Claude, aceito pelo Gustavo em 31/10 |
| D3 | Campos que continuam fixos | Nome, WhatsApp, e-mail, aceite do texto de privacidade e verificação humana. O CRM depende deles para buscar, achar duplicidade e, no aceite, criar o aluno e mandar o convite. | Claude, aceito pelo Gustavo em 31/10 |
| D4 | Os outros campos fixos de hoje (sexo, objetivo, observação, "o que procura", modalidade, previsão de início, "como conheceu") | Proposta: ficam fixos, porque o sistema usa cada um (sexo e objetivo vão para o cadastro no aceite; os outros aparecem no CRM e nos indicadores), mas o treinador pode esconder cada um. As perguntas dele entram embaixo, no lugar das "Perguntas rápidas". | Gustavo decide |
| D5 | Tipos de pergunta permitidos | Proposta: todos, menos FOTOS, ENDERECO e PESO, e nenhum destino no cadastro (o destino continua só na anamnese). Quem preenche ainda não é aluno e não tem login. | Gustavo decide |
| D6 | Imagem nas perguntas | Proposta: fica de fora na primeira versão. As imagens hoje só saem para a equipe ou para o aluno logado; mostrar na página pública pede uma rota pública nova. | Gustavo decide |
| D7 | Dado de saúde | O editor desse tipo mostra um aviso fixo: "Não peça informação de saúde aqui; ela fica para a anamnese, depois do aceite." Não dá para impedir por regra, porque o texto da pergunta é livre. | Claude (LGPD) |
| D8 | Qual questionário a página usa | Proposta: escolhido na configuração do link de inscrição. A consultoria nasce com um padrão que reproduz as "Perguntas rápidas" de hoje. | Gustavo decide |
| D9 | Onde ficam as respostas | Na inscrição, com a versão do questionário fixada no envio e validadas pelas mesmas regras da atualização e da anamnese. Seguem as regras da inscrição: aparecem no detalhe do CRM, são apagadas com ela em 180 dias se for recusada, entram na exportação e na anonimização do aluno e nunca vão a log nem à auditoria. O aceite não copia as respostas para o cadastro. | Claude |

## Passos
- [ ] 1. API: finalidade `INSCRICAO` (migration, validação dos tipos permitidos), escolha do questionário na configuração do link, `GET /publico/inscricoes/{codigo}` devolvendo as perguntas e o envio público com as respostas (mesmos limites, Turnstile e teto diário). Testes de integração, inclusive de outra consultoria e de tipo proibido. — commit/run: —
- [ ] 2. App: aba "Inscrição" no Planejamento (o editor que já existe, com o aviso de D7), escolha na configuração do link e página pública mostrando as perguntas com o formulário que a anamnese já usa. — commit/run: —
- [ ] 3. CRM: respostas no detalhe da inscrição (`FolhaDaInscricao`) e na exportação. — commit/run: —
- [ ] 4. Ajuda, guias PDF, AGENTS.md e e2e da página pública em 390 e 1280. — commit/run: —

## Fora do escopo
- Anexo ou foto enviada pelo interessado.
- Pontuação ou regra automática que aceite ou recuse a inscrição.
- Vários formulários por consultoria, um por campanha (o `?origem=` do link já separa a campanha).
- Copiar respostas da inscrição para a anamnese.

## O que ficou para trás
- (nada ainda)
