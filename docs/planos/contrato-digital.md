# Contrato digital do aluno

Situação: Em andamento · Onde: `main` · Atualizado: 26/11/2026

## Objetivo
O treinador gera o contrato de prestação de serviço do aluno dentro do app, a partir de um modelo com campos preenchidos
pela contratação ou de um PDF próprio, e o aluno (ou o responsável, quando houver) assina no celular ou na web com um
aceite que guarda as evidências. Quem não assina no prazo fica com o acesso travado até assinar. Hoje o contrato fechado
existe no Financeiro, mas nada é assinado.

Referência de mercado: Sponte (rematrícula com "Assinar contrato" no app) e DataFitness (contrato gerado, enviado ao aluno,
"controle de acesso após 7 dias").

## Decisões

| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Quem assina | O aluno, logado no app. Se o aluno tem **responsável financeiro** (V092), quem assina é o responsável, por um link sem conta. O treinador pode trocar na hora de gerar (ex.: adulto cujo pai paga, mas quem assina é o aluno) | Gustavo, 26/11 |
| D2 | Forma de assinar | **Aceite com evidências**, sem desenho na tela e sem provedor externo: caixa "Li e concordo", nome completo digitado (conferido sem acento, caixa nem espaços sobrando) e gravação de conta (ou link), data e hora, IP, aparelho (user-agent) e **sha256 do documento exato** que foi mostrado | Gustavo, 26/11 |
| D3 | Não assinou | **Trava o acesso depois de N dias**, como a pausa por atraso: só a lista fechada de rotas e a tela própria. Volta sozinho ao assinar | Gustavo, 26/11 |
| D4 | Origem do texto | **As duas**, escolhidas pelo treinador ao gerar: (a) modelo da consultoria com campos preenchidos e congelados; (b) PDF próprio enviado pelo treinador. As duas passam pelo mesmo fluxo de assinatura | Gustavo, 26/11 |
| D5 | Como a trava é decidida | **Calculada a cada requisição**, não gravada: aluno com contrato `PENDENTE` e `prazo_ate` já passado é barrado. Não usa a coluna `acesso_desativado_motivo` (ela guarda um motivo só, e um aluno em `ATRASO` com contrato pendente ficaria com dois). Assinar, cancelar ou prorrogar libera na hora, sem rotina agendada nem update de volta | Claude, confirmado pelo Gustavo em 26/11 |
| D6 | Prazo | Configuração da consultoria `contrato_prazo_dias` (1 a 60; nulo = não trava, só pendência). Fixado no contrato ao enviar (`prazo_ate` = fim do dia de Brasília, envio + N). O treinador pode **prorrogar** um contrato | Claude, confirmado pelo Gustavo em 26/11 |
| D7 | Alunos que já existem | Nada automático: a função não cria contrato sozinha. O prazo só começa quando o treinador gera e envia um contrato. Ligar a chave não trava ninguém | Claude, confirmado pelo Gustavo em 26/11 |
| D8 | Menor esperando o responsável | O aluno é travado igual (o contrato é do aluno). A tela de bloqueio diz "Aguardando a assinatura do responsável" e não oferece nada ao aluno; o treinador vê o pendente na ficha, reenvia o link ou prorroga | Claude, confirmado pelo Gustavo em 26/11 |
| D9 | Campos do modelo | Lista fechada: `{aluno_nome}`, `{aluno_cpf}`, `{aluno_endereco}`, `{responsavel_nome}`, `{responsavel_cpf}`, `{consultoria}`, `{plano}`, `{valor_total}`, `{parcelas}`, `{vigencia_inicio}`, `{vigencia_fim}`, `{data}`. Campo desconhecido no modelo = erro ao salvar. Campo usado e sem valor **impede gerar** e lista o que falta ("Falta o CPF do aluno"): texto jurídico nunca sai com "—" | Claude, confirmado pelo Gustavo em 26/11 |
| D10 | Contrato x contratação | O contrato pode apontar para uma contratação (`contratacao_id`, nulo no PDF solto). Os campos financeiros (`plano`, `valor_total`, `parcelas`, vigência) vêm dela por um método de `PagamentosDoAluno` (o `ArquiteturaTest` proíbe ler `ContratacaoAluno` fora de `pagamentos/`) e exigem `FINANCEIRO_LER` de quem gera | Claude, confirmado pelo Gustavo em 26/11 |
| D11 | Identidade do responsável | O link vale como posse (código de 144 bits no fragmento, uso único, até o prazo ou 30 dias). Para gerar contrato para o responsável, o **CPF dele precisa estar cadastrado**, e a página pública pede o CPF digitado e o confere. Sem CPF, o app oferece cadastrar antes de gerar | Claude, confirmado pelo Gustavo em 26/11 |
| D12 | Responsável com o financeiro desligado | O responsável financeiro mora em `pagamentos/` (atrás de `TREINOS_PAGAMENTOS_HABILITADO`). Desligado, só o aluno assina | Claude, confirmado pelo Gustavo em 26/11 |
| D13 | A outra parte (consultoria) | O contrato registra quem gerou e quando (membro da equipe). Não há assinatura do treinador nesta versão: é contrato de adesão, a consultoria propõe ao gerar e o aluno aceita | Claude, aceito pelo Gustavo em 26/11 (sem consulta ao jurídico) |
| D14 | PDF próprio | Só `application/pdf` conferido pelos bytes (`%PDF-`), até **900 KB** (o corpo da API tem 1 MiB), guardado no banco como a logo. Servido com `Content-Disposition: attachment`, `no-store`. Na web é **baixado** (`blob:` + link com `download`, "Baixar o PDF"; mudado em 26/11 no passo 3: a CSP de produção tem `object-src 'none'`, herdada pelo `blob:`, que pode barrar o visualizador do Chrome numa guia nova, e a guia aberta depois de um `await` cai no bloqueio de janelas); no celular abre no visualizador do sistema pela pasta `cache/compartilhar` ("Abrir o PDF"). Não é reescrito: o hash é o do arquivo enviado | Claude, confirmado pelo Gustavo em 26/11 |
| D15 | Contrato assinado é imutável | Mudou algo, gera outro; o anterior continua assinado. Só o `PENDENTE` se cancela (com motivo). Renovação de plano não gera contrato sozinha nesta versão | Claude, confirmado pelo Gustavo em 26/11 |
| D16 | Anonimização e "Excluir minha conta" | Apagam o pendente e o cancelado. O **assinado fica** (texto, PDF e evidências), pela base de exercício regular de direitos (LGPD art. 7º, VI), guardado por **5 anos depois do fim do contrato** (cobrança de dívida de contrato escrito, Código Civil art. 206, § 5º, I; cobre os 3 anos da reparação) e depois apagado ou anonimizado por rotina | Claude, aceito pelo Gustavo em 26/11 (sem consulta ao jurídico) |
| D17 | Chave e permissões | `TREINOS_CONTRATOS_HABILITADO` (padrão `false`; desligada = 503 `CONTRATOS_INDISPONIVEL`, `GET /eu` traz `contratosHabilitados`). Permissões novas `CONTRATO_LER` (depende de `ALUNO_LER`) e `CONTRATO_ALTERAR` (depende de LER), **sensíveis** (o texto leva CPF e endereço), só no Administrador por padrão | Claude, confirmado pelo Gustavo em 26/11 |
| D18 | Celular e lojas | O contrato pode mostrar o valor (é informação), mas nunca botão, link nem frase de pagamento no celular com a chave da loja desligada | regra que já existe (D7 do Financeiro) |
| D19 | Treino feito offline antes da trava | Não pode se perder. Hoje a pausa por atraso desenha a tela **antes** do `AlunoProvider` (`app/aluno/_layout.tsx`), então nada sincroniza enquanto ela dura (o 403 genérico deixa o registro `LOCAL`, não `FALHOU`: `offline/sincronizacao.ts`, `enviarEmLotes`), e um "Sair" na tela de bloqueio apaga a fila sem o aviso de "treinos não enviados". Na trava do contrato: (a) as quatro rotas de envio ficam na lista liberada: `POST /aluno/execucoes/lote`, `/aluno/mobilidade/registros`, `/aluno/agua` e `/aluno/sessoes-concluidas`; (b) a tela de bloqueio do contrato fica **dentro** do `AlunoProvider`, que continua sincronizando, e o "Sair" dela mostra o mesmo aviso. Falta conferir se a pausa por atraso também precisa disso (pendência separada, abaixo) | Claude, confirmado pelo Gustavo em 26/11 |
| D20 | Exceção à regra "nada bloqueia o aluno sozinho" | Esta é a **segunda exceção explícita**, e mais forte que a do `ATRASO` (aquela é manual; esta dispara sozinha no prazo). Vale só para contrato pendente vencido; cobrança vencida continua nunca bloqueando (`CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest` segue verde). Registrada no `AGENTS.md` no passo 5, junto da regra | Gustavo (D3), registro do Claude |
| D21 | Aluno em `ATRASO` e com contrato vencido | As rotas do contrato ficam liberadas nas duas travas (senão ele não consegue assinar). A tela mostrada é a do contrato primeiro, com a frase da pausa abaixo; assinado, cai na tela da pausa por atraso como hoje | Claude, confirmado pelo Gustavo em 26/11 |
| D22 | O que o hash cobre | No `MODELO`, os bytes UTF-8 do texto já preenchido, em NFC e com quebras de linha normalizadas para `\n`, exatamente como gravado em `contrato_aluno.texto` (o app mostra e devolve esse hash; o comprovante o imprime). No `PDF`, os bytes do arquivo como enviado | Claude |
| D23 | "Gerar" é o envio | Não há rota de envio separada: gerar o contrato já o deixa visível ao aluno (ou abre o link do responsável) e começa o prazo em `gerado_em` | Claude |
| D24 | `CONTRATO_LER` depende também de `ALUNO_SENSIVEL_LER` | O texto leva CPF e endereço; sem isso, um perfil com contrato e sem dado sensível leria pelo contrato o que a ficha esconde (achado da revisão de 26/11) | Claude, pela revisão |
| D25 | Contrato assinado não some com o aluno | `fk_contrato_aluno` sem `ON DELETE CASCADE`: apagar o aluno com contrato (ex.: "Desfazer importação") é recusado e o desfazer o mostra como `EM_USO`. A anonimização não apaga a linha do aluno, então não muda | Claude, pela revisão |
| D27 | Cláusula de aceite eletrônico | Todo modelo leva a cláusula: as partes concordam com o aceite pelo app (nome completo e "li e concordo"), registrado com data, hora, IP, aparelho e código de verificação, e o reconhecem como válido (MP 2.200-2/2001, art. 10, § 2º; Lei 14.063/2020). O app a põe no texto de exemplo do modelo | Claude, aceito pelo Gustavo em 26/11 |
| D28 | Menor de idade | Menor de 16: só o responsável assina (representa). De 16 a 17: o aluno e o responsável assinam (assistência), então o contrato pode ter dois aceites. O responsável informa nome e CPF e declara ser o responsável legal; o registro guarda quem declarou | Claude, aceito pelo Gustavo em 26/11 (sem consulta ao jurídico) |
| D26 | Valor do contrato para quem só tem `CONTRATO_LER` | **Aceito:** o contrato é um documento, e quem lê contrato vê o texto inteiro, com valor e parcelas, mesmo sem `FINANCEIRO_LER`. Só gerar com campos financeiros exige `FINANCEIRO_LER` (D10) | Gustavo, 26/11 |

## Contrato da API (proposta)

**Migration** `V105` (ou o próximo livre na hora), com `@TenantId` e FKs compostas `(consultoria_id, ...)` como no resto:
- `contrato_modelo`: `nome` (até 80, único entre os ativos), `texto` (até 50.000, com `**negrito**`, `__sublinhado__` e
  quebras, como o `TextoFormatado`), `arquivado_em`, `versao`, datas.
- `contrato_aluno`: `aluno_id`, `contratacao_id` (nulo), `origem` (`MODELO`|`PDF`), `modelo_id` (nulo), `titulo`, `texto`
  (o texto já preenchido, nulo no PDF), `sha256` (char 64), `signatario` (`ALUNO`|`RESPONSAVEL`), `situacao`
  (`PENDENTE`|`ASSINADO`|`CANCELADO`), `prazo_ate` (nulo = não trava), `gerado_por`, `gerado_em` (início do prazo, D23), `cancelado_em`,
  `motivo_cancelamento` (até 300), `pedido_id` (uuid, único por consultoria, idempotência do gerar), evidências (`assinado_em`, `assinado_por_usuario_id` ou nulo no link, `assinante_nome`,
  `assinante_cpf` (só do responsável), `assinante_ip`, `assinante_agente` (até 300)), `link_hash` e `link_expira_em`
  (só do responsável), `versao`. CHECKs: assinado com todas as evidências; texto só no `MODELO`; link só no `RESPONSAVEL`.
  Índice parcial `(consultoria_id, aluno_id) where situacao = 'PENDENTE'` para a trava.
- `contrato_arquivo`: bytes do PDF (1:1 com o contrato `PDF`).
- `consultoria.contrato_prazo_dias` (smallint nulo, CHECK 1 a 60).

**Rotas** (todas `@ExigeContratos`):
- Equipe, `CONTRATO_LER`: `GET /contratos/modelos`, `GET /alunos/{id}/contratos`, `GET /contratos/{id}`,
  `GET /contratos/{id}/arquivo`.
- Equipe, `CONTRATO_ALTERAR`: `POST`/`PUT /contratos/modelos[/{id}]`, arquivar; `POST /contratos/modelos/{id}/previa`
  (dados fictícios); `POST /alunos/{id}/contratos/previa` (preenche e lista o que falta, sem gravar);
  `POST /alunos/{id}/contratos` (modelo) e o mesmo em multipart (PDF), com `pedidoId` idempotente como a cobrança avulsa;
  `POST /contratos/{id}/cancelar {motivo, versao}`; `POST /contratos/{id}/prorrogar {dias, versao}`;
  `POST /contratos/{id}/link` (gera ou renova o link do responsável; o código só nesta resposta);
  `GET`/`PUT /consultoria/contratos` (prazo).
- Aluno: `GET /aluno/contratos` (pendentes e assinados), `GET /aluno/contratos/{id}[/arquivo]`,
  `POST /aluno/contratos/{id}/assinar {sha256, nome, aceite}` (hash diferente = 409 `CONTRATO_ALTERADO`; nome que não
  confere = 422; já assinado = 200 sem regravar).
- Público (`CONTROLLERS_PUBLICOS`, código **no corpo**, nunca no caminho, como o convite):
  `POST /publico/contratos/consultar {codigo}` (marca da consultoria, título, texto ou "tem arquivo", sha256),
  `POST /publico/contratos/arquivo {codigo}` (bytes), `POST /publico/contratos/assinar {codigo, sha256, nome, cpf, aceite}`.
  Código inexistente, vencido, usado ou de contrato cancelado = o mesmo 404. Limite próprio por IP
  (`LimiteTentativas.contratoPublico`); CPF errado conta tentativa.

**Trava** (D5): o `AcessoPausadoInterceptor` ganha a segunda regra (ou um interceptor irmão com a mesma lista): aluno com
contrato pendente vencido recebe 403 `CONTRATO_PENDENTE` fora da lista fechada. A lista ganha as rotas `/aluno/contratos*`,
**também para o aluno em `ATRASO`** (senão quem está pausado por atraso não consegue assinar), e, só na trava do contrato,
as quatro rotas de envio da fila (D19). `GET /eu` traz
`aluno.contratoPendenteVencido` para o app mostrar a tela certa offline.

**Auditoria** com resumo fixo, sem nome, CPF, valor nem texto: `CONTRATO_MODELO_CRIADO/ALTERADO/ARQUIVADO`,
`CONTRATO_GERADO`, `CONTRATO_LINK_GERADO`, `CONTRATO_ASSINADO` (ator = aluno, ou "Sistema" pelo link),
`CONTRATO_CANCELADO`, `CONTRATO_PRAZO_PRORROGADO`, `CONTRATO_PRAZO_CONFIGURADO` (espelho em `acoesAuditoria.ts`).

**LGPD**: texto, PDF, IP e CPF do assinante nunca em log, auditoria, mensagem de erro nem `toString`. Exportação do aluno:
seção `contratos` (metadados, texto e evidências; o PDF só como metadado), com `CONTRATO_LER`. Anonimização: D16.

## Telas (proposta; tela nova → `plano-front` antes do `executor-front`)

- **Configurações › Contratos** (novo item do hub, abre à direita): lista de modelos, editor do texto com os campos
  clicáveis para inserir, prévia com dados fictícios, e "Prazo para assinar" (dias ou "Não travar o acesso").
- **Ficha do aluno › aba Ficha**, cartão "Contratos": "Gerar contrato" (`acao`) abre uma folha média com Origem (modelo ou
  PDF), Contratação (quando houver), Quem assina, prévia do preenchido com a lista do que falta; lista com selos
  Pendente (com o prazo, âmbar; vencido, vermelho), Assinado (verde), Cancelado (neutro); no ⋯: copiar link do responsável,
  "Enviar pelo WhatsApp" (`wa.me`, sem token nosso), prorrogar, cancelar (painel), baixar comprovante.
- **Aluno**: "Assinar contrato" em Suas pendências (vermelho só depois do prazo); tela `/aluno/contrato/[id]` com o texto
  (ou "Abrir o PDF"), nome digitado, "Li e concordo" e "Assinar contrato"; só com internet; Conta › "Meus contratos" com os
  assinados e o comprovante; tela de bloqueio com a variante do contrato (o botão leva à assinatura; para menor,
  "Aguardando a assinatura do responsável").
- **Página pública** `/contrato#codigo=...` (`ui/TelaPublica`, marca da consultoria, o fragmento é lido e limpo como no
  convite): texto ou PDF, CPF, nome, aceite e, no fim, "Baixar comprovante".
- **Comprovante** em PDF (`pdf/pdfContrato.ts`, `cabecalhoDoPdf`): o texto (ou a observação "Documento em PDF anexo, hash
  …") e uma página de evidências: quem assinou, data e hora de Brasília, IP, aparelho, hash, quem gerou.

## Passos

Cada passo fecha com typecheck, lint, Jest e `mvn verify` quando toca a API, e os e2e das telas mexidas.

- [x] 0. Jurídico: decidido pelo Gustavo em 26/11 sem consultar advogado, aceitando as recomendações do Claude (D13, D16, D27, D28). — commit/run: —
- [x] 1. API, núcleo: migration, chave, permissões (catálogo e espelho), modelos, gerar pelo modelo, assinar pelo aluno, evidências, auditoria, exportação, anonimização; testes de integração (outra consultoria 404, hash trocado, nome que não confere, idempotência do `pedidoId`, sem permissão sensível); totais do `FlywayMigrationIntegrationTest` e do `PapeisBancoIntegrationTest`. Executor (Sonnet) + revisão independente. — Feito localmente em 26/11, sem commit: `mvn verify` completo com 3.521 testes teve 2 falhas (Privacidade: faltava a seção `contratos` nas omitidas, corrigido; Comunidade: ordem de posts, intermitente, passou isolada); depois das correções da revisão passaram isolados `ContratosIntegrationTest` (12), `ContratosDesligadosIntegrationTest`, `CamposETextoDoContratoTest`, `CatalogoPermissoesTest`, `ContratoMigrationTest` (FK sem cascata, D25), `FlywayMigrationIntegrationTest`, `PapeisBancoIntegrationTest`, `ArquiteturaTest`, `PrivacidadeIntegrationTest` e `PlanilhaCompletaGravacaoIntegrationTest` (o desfazer da importação conta o contrato como ligação do aluno). `mvn verify` inteiro verde em 26/11 sobre a árvore do commit (3.521 testes, 0 falhas, cobertura atendida). — commit/run: `424b1f31` (local, sem push)
- [x] 2. App, núcleo: Configurações › Contratos, cartão na ficha (só modelo e aluno), pendência e tela de assinatura do aluno, "Meus contratos", comprovante em PDF; e2e em 390 e 1280. `plano-front` → `executor-front`. — Feito localmente em 26/11, sem commit: regras em `dominio/contratos.ts`, `api/contratos.ts`, `pdf/pdfContrato.ts` e `contratos/comprovante.ts`; telas em `treinador/contratos/` (Configurações › Contratos, editor do modelo, cartão da ficha, gerar, detalhe, cancelar e prorrogar) e `aluno/contratos/` (provider com o ponto do Início, pendência no ParaFazer, tela de assinatura, "Meus contratos" na Conta). Verificado: typecheck e lint limpos, Jest 456 suítes e 11.152 testes verdes, e2e `contratos`, `configuracoes`, `ajuda-do-cabecalho`, `ficha-dados`, `conta-do-aluno` e `inicio-aluno` 240 de 240 (contratos em 390, 1280 e 1920, um caso no escuro). Diferenças do plano de tela: comprovante da equipe com a marca da sessão (sem `GET /consultoria`); modelo único na folha de gerar como `CampoLeitura`. Não verificado: celular nativo (inclusive o comprovante pelo `expo-print`), leitor de tela, tema escuro fora da tela do aluno. — commit/run: `424b1f31` (local, sem push)
- [x] 3. PDF próprio (API e app): upload, conferência, abertura na web e no celular. — Feito localmente em 26/11, sem commit: API em `contratos/` (`ContratoArquivo`, `gerarPdf` no mesmo `gerarDe` do modelo, download da equipe e do aluno), `ContratosPdfIntegrationTest` (7) mais `ContratosIntegrationTest`, `ContratosDesligadosIntegrationTest`, `PrivacidadeIntegrationTest` e `ArquiteturaTest` verdes; app (`contratos/escolherPdf.ts`, `abrirPdf.ts`/`.web.ts`, folha de gerar com "Origem", "Abrir/Baixar o PDF" na equipe e no aluno, comprovante "Documento em PDF anexo."), typecheck e lint limpos, Jest 458 suítes e 11.190 testes, e2e `contratos` 37 de 37 em 390 e 1280. Não verificado: celular de verdade (escolher, enviar e abrir pelo compartilhar). — commit/run: `7afd0272` (local, sem push)
- [ ] 4. Responsável por link (API e app): link, página pública, limite, conferência do CPF, declaração de responsável legal e os dois aceites de 16 a 17 anos (D28); cláusula de aceite no texto de exemplo do modelo (D27); e2e da página. Revisão independente (rota pública). — commit/run: —
- [ ] 5. Trava por prazo (API e app): prazo da consultoria, prorrogar, regra no interceptor (também com `ATRASO`, D21), rotas da fila liberadas e tela dentro do `AlunoProvider` (D19), `GET /eu`, tela de bloqueio; testes: nenhuma rota fora da lista passa, treino offline de antes do prazo chega depois dele, `CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest` verde; exceção D20 no `AGENTS.md`. Revisão independente. — commit/run: —
- [ ] 6. Fechamento: rotina de guarda do assinado (D16: 5 anos depois do fim da contratação ligada, ou da assinatura sem contratação, para aluno anonimizado ou que excluiu a conta; depois apaga texto, PDF e evidências), Ajuda e guias em PDF, `AGENTS.md`, revisão final do diff inteiro, e2e completa (mexe em permissão e sessão). — commit/run: —

## Passo 3: contrato do PDF próprio (Claude, 26/11, a partir da D4, D14 e D22)

**API** (dono: executor; tudo `@ExigeContratos`):
- `POST /alunos/{id}/contratos` em `multipart/form-data` (mesma rota do modelo, outro `consumes`), `CONTRATO_ALTERAR`: parte
  `arquivo` (o PDF) e parte `dados` (JSON `{pedidoId, contratacaoId?, titulo, signatario?}`; `modeloId` não existe aqui).
  Grava `origem = PDF`, `texto` nulo, `sha256` = SHA-256 dos bytes como vieram (não reescreve, D14/D22) e a linha de
  `contrato_arquivo`. Resposta igual à do modelo: 201 com o `ContratoDetalhe`; o mesmo `pedidoId` = 200 com o mesmo corpo,
  sem gravar de novo; `contratacaoId` segue a D10 (exige `FINANCEIRO_LER`, contratação do mesmo aluno). O mesmo `pedidoId` com outro arquivo (ou outra origem) = 409 `PEDIDO_JA_USADO`; o app gera um pedido novo ao trocar o PDF ou a origem.
- Conferência: vazio, sem `%PDF-` no começo ou acima de 900 KB (921.600 bytes) = 422 `CONTRATO_INVALIDO` com `fieldErrors`
  no campo `arquivo` e mensagem fixa ("Envie um arquivo PDF." / "O PDF passa de 900 KB."); título vazio ou acima de 120 =
  o mesmo 422 no `titulo`. Nada do arquivo vai a log, auditoria, erro ou `toString`. Aluno inativo, anonimizado e outra
  consultoria como no modelo.
- `GET /contratos/{id}/arquivo` (`CONTRATO_LER`) e `GET /aluno/contratos/{id}/arquivo` (o próprio aluno; cancelado ou
  de outro aluno = 404): `application/pdf`, `Content-Disposition: attachment; filename="contrato.pdf"`,
  `Cache-Control: no-store`. Contrato `MODELO` = 404.
- `ContratoDetalhe` e `ContratoDoAlunoDetalhe` já trazem `origem`; o `texto` fica nulo no PDF. A assinatura do aluno
  manda o `sha256` lido do detalhe, como no modelo.
- Testes: gerar PDF, idempotência, PDF falso, grande demais, baixar pela equipe e pelo aluno, outra consultoria 404,
  aluno alheio 404, cancelado 404, assinar com o hash do arquivo, exportação só com metadado.

**App** (dono: executor-front; regras puras em `dominio/contratos.ts` com teste):
- `api/contratos.ts`: `gerarContratoPdf(alunoId, arquivo, dados)`, `baixarArquivoDoContrato(id)` e
  `baixarMeuArquivoDeContrato(id)`; `LIMITES_DO_CONTRATO` ganha o teto de 900 KB.
- Gerar: "Origem" (Modelo da consultoria | PDF próprio); no PDF, escolher o arquivo (`expo-document-picker`, só PDF,
  conferido no app antes de enviar), Título (obrigatório), Contratação opcional e o mesmo `pedidoId` por abertura.
- "Abrir o PDF" na folha da equipe e na tela do aluno: na web vira "Baixar o PDF" (bytes pelo cliente da API, `blob:` e link
  com `download`, D14); no celular grava em
  `cache/compartilhar` (`offline/arquivosTemporarios`) e abre pelo `expo-sharing`. Nunca guarda o PDF no aparelho além disso.
- Tela do aluno com PDF: no lugar do texto, "O contrato está no PDF. Abra e leia antes de assinar." + "Abrir o PDF".
- Comprovante: sem texto, "Documento em PDF anexo." e o código de verificação (o do arquivo).

## Fora do escopo

- Desenho da assinatura com o dedo, certificado ICP-Brasil e provedor externo (ZapSign, Clicksign, Autentique): fora por D2.
- Assinatura da consultoria e contrato com mais de dois signatários.
- Contrato gerado sozinho ao contratar ou renovar (fica a ideia de um atalho "Gerar contrato" na `FolhaDeContratacao`).
- Aviso por e-mail ao responsável: o treinador copia o link ou manda pelo WhatsApp; o e-mail entra quando o envio estiver
  ligado em produção (`EnviadorDeEmail`, como o convite de equipe).
- Cartão "Contratos pendentes" no Início do treinador.

## O que ficou para trás
- Revisão de 26/11 do passo 1, itens menores não feitos: testes de corrida (duas assinaturas, assinar × cancelar, mesmo `pedidoId` ao mesmo tempo, mesmo UUID em outra consultoria); evidência de IP/aparelho pode ficar vazia (`""`) quando o cabeçalho falta. Entram no passo 5.
- **Pausa por atraso pode apagar treino offline** (achado ao planejar, 26/11, sem teste): a `TelaAcessoPausado` fica fora do `AlunoProvider`, então a fila não sincroniza durante a pausa, e um "Sair" ali apaga os registros `LOCAL` sem o aviso de "treinos não enviados". Conferir e, se confirmar, aplicar a mesma saída da D19. Fora desta frente; vai para as Pendências soltas.
