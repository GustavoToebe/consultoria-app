# Roteiro do WhatsApp oficial: Meta, VPS e teste do piloto

Situação: Planejando (roteiro escrito, nada executado) · Onde: worktree `whatsapp-piloto` (só documentação) · Atualizado: 27/11/2026 (segunda rodada: teste numa consultoria de teste, regras da VPS lidas em `deploy/`, aviso de compromisso por ocorrência, avulsa fora)

Fonte: decisão do Gustavo de 27/11/2026 (C19, C24 e C25 de [contato-da-consultoria.md](contato-da-consultoria.md)), pedido do Gustavo de 26/11/2026 (primeiro teste numa consultoria de teste; avulsa fora do piloto) e leitura do código do worktree `whatsapp-piloto` sobre `origin/main` `cb8c6fec` (`api/.../whatsapp/`, `pagamentos/ConferenciaDoLembreteWhatsApp`, `LembretesDeCobranca`, `app/src/treinador/whatsapp/TelaWhatsApp.tsx`, `app/src/dominio/whatsapp.ts`, `application.yml`). As regras da VPS vêm de `../central/central-api-back/deploy/` (`README.md` seções 4, 5, 11 e 12; `gravar-segredo.sh`, `recriar.sh`, `comum.sh`, `apps/consultoria/docker-compose.yml`) e de `central-api-back/docs/release-rollback.md`, lidos sem executar nada. Validade: vale enquanto o pacote `whatsapp/`, os textos de `ModelosDeTexto`, a versão `v23.0` da Graph API (fixa em `MetaCliente`) e os scripts de `deploy/` não mudarem; refazer a leitura antes de usar. **Tudo o que descreve a interface, as permissões, os prazos, os custos, a categoria e as regras da Meta não vem do nosso código: está marcado "(conferir na documentação atual da Meta)" e foi escrito de memória, sem acesso à internet.** Nenhuma chamada à Meta e nenhum comando na VPS foram executados para escrever este roteiro.

## Objetivo
Pôr o aviso de cobrança e de compromisso pelo WhatsApp oficial para rodar, **testando primeiro numa consultoria de teste**, com o número do Gustavo como aluno fictício. Só depois de o teste ser aprovado é que se conecta a consultoria do Saraiva e se libera aos alunos dele. O Gustavo e o Saraiva fazem os passos da Meta; **quem digita segredo e roda comando no servidor é sempre o Gustavo** (o Claude só orienta).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| R1 | Conta e número | São do treinador, que paga a Meta direto (C24) | Gustavo, 27/11/2026 |
| R2 | Aplicativo no piloto | O aplicativo da Meta é o da conta Meta do Saraiva; o app secret dele vai em `TREINOS_WHATSAPP_META_APP_SECRET` (C25). Longo prazo: um aplicativo só, o da plataforma (C19) | Gustavo, 27/11/2026 |
| R3 | Antes do segundo treinador | Verificar a empresa na Meta e aprovar o aplicativo da plataforma: pendência do Gustavo (README, "Pendências soltas") | Gustavo, 27/11/2026 |
| R4 | Onde é o primeiro teste em produção | Numa **consultoria de teste**, com o número do Gustavo, **nunca** na do Saraiva. A consultoria do Saraiva só é conectada depois do teste aprovado | Gustavo (pedido da rodada de 27/11/2026) |
| R5 | Ordem na VPS | Chaves → variáveis **junto com** `TREINOS_WHATSAPP_HABILITADO=true` → recriar a API → webhook → conexão e modelos da consultoria **de teste** → teste → só então a consultoria do Saraiva (ver Partes 4 a 6: o webhook só responde com a chave ligada) | Claude (a partir do código e de `deploy/`), a confirmar pelo Gustavo |
| R6 | Lembrete de cobrança avulsa pelo WhatsApp | **Fora do piloto**; hoje só a mensalidade. Reabrir depois do piloto | Gustavo, pedido de 26/11/2026 |
| R7 | Aviso de compromisso (mudança no código, definida e **em implementação pelo coordenador**; coluna `ocorrencia`, migration V109 provisória) | Cada fato vira uma linha **nova** na fila. O mesmo fato repetido em até 10 minutos depois de a mensagem do mesmo tipo sair (mesmo aluno, mesmo compromisso) **não reenvia**; fato igual ainda pendente vira uma mensagem só. Reabrir um compromisso cancelado manda "marcado" de novo. O histórico da exportação LGPD passa a ter uma linha por mensagem | Gustavo (definido pelo coordenador) |

## Como ficam as peças (em linguagem simples)
- **A chave da plataforma** (`TREINOS_WHATSAPP_HABILITADO=true`, na VPS) liga o recurso no servidor, **para todas as consultorias**. Sozinha ela não faz ninguém receber nada.
- **Cada consultoria tem a própria conexão** (token, ID do número e ID da conta do WhatsApp) e os próprios seis modelos, cadastrados na tela `/treinador/whatsapp`.
- **Cada aluno liga o próprio interruptor** "Receber avisos pelo WhatsApp" (Conta › Aparência e preferências). O interruptor só aparece e só liga se a **consultoria dele** está conectada.
- **Nada entra na fila sem as três coisas juntas, na própria consultoria:** conexão gravada, modelo do tipo e interruptor ligado do aluno. Por isso, com o teste na consultoria de teste e a do Saraiva ainda sem conexão, **nada muda para os alunos do Saraiva**, mesmo com a chave ligada na plataforma. Único efeito visível lá: o administrador do Saraiva passa a ver, em Configurações, o cartão "WhatsApp oficial" ("Não conectada"). Combine com ele de **não conectar** antes da hora.
- **O webhook é um só** (`https://overtraining.app/api/publico/whatsapp/meta`) para a plataforma toda, e o **app secret é uma variável só**. No piloto, esse segredo é o do aplicativo da conta Meta do Saraiva (C25).
- **A consultoria de teste precisa existir em produção.** O cadastro público de treinador é fechado por padrão (`TREINOS_CADASTRO_ABERTO=false`: `POST /auth/cadastro-treinador` responde 404, `AGENTS.md`), e consultoria nova em produção entra **pela Central** (provisionamento: `POST /integracao/v1/instancias`, que cria a consultoria e manda o convite do administrador, `docs/integracao-central.md`, seção 3). **O Gustavo precisa criar (ou já ter) essa consultoria pelo caminho da Central; isso está fora deste roteiro.** Cuidado citado em `docs/integracao-central.md`: e-mail do administrador digitado errado adota a consultoria errada. O `AGENTS.md` registra que a limpeza da produção (V059) apagou uma consultoria de teste antiga do Gustavo; conferir se há outra.

## Antes de começar: o que o código exige (e o que ele faz com a Meta)
- **Quem faz o quê na Meta:** o Saraiva é dono da conta comercial da Meta (Meta Business) onde fica o aplicativo; o Gustavo precisa ser administrador do aplicativo, ou os dois fazem juntos, para o Gustavo ver o app secret e criar o token. O app secret e o token **nunca vão por chat, e-mail ou mensagem**: o app secret vai à VPS pelo `gravar-segredo.sh` e o token entra só na tela `/treinador/whatsapp`, digitado por quem o tem.
- **Número que envia:** precisa ser um número que a Meta aceite como número da Cloud API (em geral, um número que não esteja em uso no aplicativo comum do WhatsApp) (conferir na documentação atual da Meta). O telefone do **aluno** (quem recebe) vem do usuário de acesso dele, e o código só aceita número brasileiro completo (DDD mais 8 ou 9 dígitos, com ou sem o 55); sem isso o aviso é cancelado com `SEM_TELEFONE`, nunca enviado a um destino adivinhado.
- **Quem vê a tela:** `/treinador/whatsapp` (Configurações › "WhatsApp oficial") é só do Administrador (permissão `WHATSAPP_ALTERAR`) e só aparece com `TREINOS_WHATSAPP_HABILITADO=true`.
- **Chamada à Meta:** o app usa a Graph API na versão `v23.0` (fixa no código, `MetaCliente.VERSAO_DA_API`; quando a Meta aposentar a versão, é troca no código, conferir na documentação atual da Meta), em `https://graph.facebook.com`.

## Parte 1. No Meta for Developers e no Gerenciador de Negócios (Gustavo e Saraiva)

Os nomes de menu abaixo são os que costumam existir; a Meta muda a interface com frequência. Se algum nome não bater, vale o objetivo do passo, não o nome (conferir na documentação atual da Meta, em todos os passos desta parte). O **aplicativo** é sempre o da conta do Saraiva (C25); o **número que envia** no teste é a decisão principal do item 1.5.

### 1.1 Criar o aplicativo
1. Entrar em developers.facebook.com com a conta do Saraiva (ou uma conta que ele tenha adicionado como administrador) (conferir na documentação atual da Meta).
2. "Meus aplicativos" › "Criar aplicativo". Escolher o caso de uso/tipo **Empresa (Business)**, o que permite o produto WhatsApp (conferir na documentação atual da Meta).
3. Dar um nome ao aplicativo (por exemplo, o nome do produto) e **vincular à conta empresarial (Meta Business) do Saraiva** (conferir na documentação atual da Meta).
4. Anotar para você, sem escrever em nenhum documento do projeto: o **ID do aplicativo** e onde fica a **Chave secreta do aplicativo (app secret)**, em Configurações do aplicativo › Básico (conferir na documentação atual da Meta). O app secret é o valor de `TREINOS_WHATSAPP_META_APP_SECRET`.

### 1.2 Adicionar o produto WhatsApp e ligar o número
1. No painel do aplicativo, "Adicionar produto" › **WhatsApp** (conferir na documentação atual da Meta).
2. Escolher ou criar a **conta do WhatsApp Business (WABA)** à qual o número pertence (conferir na documentação atual da Meta).
3. Adicionar o **número de telefone que vai enviar**: informar o número e o **nome de exibição** (o nome que o aluno vê), e confirmar o número pelo código que a Meta manda por SMS ou ligação (conferir na documentação atual da Meta). O nome de exibição passa por uma análise da Meta (conferir na documentação atual da Meta). No teste, qual número é esse depende do item 1.5; o número do Saraiva só entra depois do teste aprovado (Parte 6).
4. A empresa pode precisar estar **verificada** na Meta para enviar além dos limites iniciais; a verificação é a pendência R3 para o aplicativo da plataforma, e para as contas usadas no piloto fica a conferir (conferir na documentação atual da Meta).
5. Enquanto o aplicativo estiver em modo de desenvolvimento, a Meta pode só enviar a números cadastrados como destinatários de teste (conferir na documentação atual da Meta). O telefone do Gustavo (quem **recebe** no teste) talvez precise ser adicionado assim.

### 1.3 Criar o token permanente (usuário do sistema)
O token que aparece na tela de teste do aplicativo vale poucas horas (conferir na documentação atual da Meta). O app precisa de um token que **não vence**:
1. Gerenciador de Negócios (business.facebook.com) › Configurações da empresa › Usuários › **Usuários do sistema** › Adicionar. Criar um usuário do sistema com função de **Administrador** (conferir na documentação atual da Meta).
2. Atribuir ao usuário do sistema os **ativos**: o **aplicativo** e a **conta do WhatsApp (WABA)** do número que envia, com controle total (conferir na documentação atual da Meta).
3. "Gerar novo token": escolher o aplicativo, escolher **nunca expirar** (sem validade), e marcar as permissões **`whatsapp_business_messaging`** (enviar mensagens) e **`whatsapp_business_management`** (ler e gerir a conta e os modelos) (conferir na documentação atual da Meta: nomes e se há permissões a mais).
   - Por que as duas, segundo o nosso código: o envio usa `POST /{phone_number_id}/messages` (mensagens) e a tela lê os modelos com `GET /{waba_id}/message_templates` (gestão). Sem a de gestão a tela mostra os modelos como "Não conferido" (`INDISPONIVEL`); sem a de mensagens nenhum aviso sai.
4. **Copiar o token na hora**, pois a Meta o mostra uma vez (conferir na documentação atual da Meta), e guardá-lo no gerenciador de senhas. Ele entra só na tela `/treinador/whatsapp` (campo "Token de acesso da Meta"), que o cifra com a chave da VPS; nunca em chat, nunca neste repositório.

### 1.4 Onde achar o `phone_number_id` e o `waba_id`
No painel do aplicativo, WhatsApp › **Configuração da API** (ou "Primeiros passos"): aparecem o **ID do número de telefone** (`phone_number_id`) e o **ID da conta do WhatsApp Business** (`waba_id`) (conferir na documentação atual da Meta). **Não confundir** com o número de telefone em si, com o ID do aplicativo nem com o ID da conta empresarial. Os dois são só números e vão nos campos "Phone Number ID" e "WABA ID (Conta do WhatsApp Business)" da tela (até 40 caracteres cada). Nenhum dos dois é segredo, mas não os copie para este repositório.

### 1.5 Decisão principal do teste: de qual número e de qual aplicativo sai a mensagem
**Por quê:** o webhook confere a assinatura com **um** app secret (`TREINOS_WHATSAPP_META_APP_SECRET`, o do aplicativo da conta Meta do Saraiva no piloto). Ele só aceita os avisos de status (entregue, lido, falhou) **assinados pelo aplicativo dono desse segredo** (conferir na documentação atual da Meta: a Meta assina o webhook com o segredo do aplicativo onde ele foi cadastrado). Se o número do teste estiver ligado a **outro** aplicativo, o aviso **é enviado**, mas os status chegam com assinatura que não bate (401) e a linha **fica em ENVIADO** para sempre. Então o número que envia no teste tem de estar **ligado a esse mesmo aplicativo Meta**. Opções, a escolher pelo Gustavo (conferir na documentação atual da Meta se cada uma é possível):

| Opção | O que é | Status entregue e lido aparecem? | Observação |
| --- | --- | --- | --- |
| A. Número de teste da própria Meta, dentro do aplicativo do Saraiva | O produto WhatsApp costuma trazer um número de teste e uma conta de teste (WABA de teste) já ligados ao aplicativo; o telefone do Gustavo entra como destinatário autorizado | Sim (mesmo aplicativo) | Em geral só envia a poucos destinatários autorizados e usa modelos próprios da conta de teste; os seis modelos do teste são criados **nessa** conta de teste. Se a documentação atual permitir, é a mais simples e não usa número de ninguém |
| B. Um número próprio do Gustavo, ligado ao aplicativo do Saraiva | O Gustavo registra um número dele numa WABA e a liga ao aplicativo do Saraiva (compartilhamento entre empresas) | Sim (mesmo aplicativo) | Pede passos de compartilhamento entre a empresa do Gustavo e a do Saraiva; o token é de um usuário do sistema que enxerga o aplicativo e a WABA |
| C. Um aplicativo e um número só do Gustavo | Aplicativo próprio, com o app secret dele | **Não**, enquanto a variável tiver o segredo do aplicativo do Saraiva | Serve só para provar o envio (a linha fica em ENVIADO). Trocar a variável única só para o teste e depois voltar é arriscado: não faça sem decisão expressa |

Em qualquer opção, **os seis modelos são da conta (WABA) do número que envia**: o teste cadastra e aprova os seis nessa conta, e a conta do Saraiva exige os seus próprios depois (Parte 6) (conferir na documentação atual da Meta).

## Parte 2. Os seis modelos de mensagem (templates)

### 2.1 O que o código faz
- A API **não cria modelo na Meta**: o treinador cadastra e manda aprovar no Gerenciador do WhatsApp, e informa à tela o **nome** e o **idioma** de cada um (criação pela API está fora do escopo, [contato-da-consultoria.md](contato-da-consultoria.md)).
- **Nome aceito pela API:** só letras minúsculas, números e sublinhado (`^[a-z0-9_]{1,512}$`); a tela e a API recusam o resto. O nome tem de ser **igual ao da Meta**. Sugestão nossa, não exigida pelo código: `lembrete_cobranca_antes`, `lembrete_cobranca_no_dia`, `lembrete_cobranca_depois`, `compromisso_novo`, `compromisso_remarcado`, `compromisso_cancelado`.
- **Idioma:** o código do idioma como a Meta usa (`pt_BR`, `en_US` ou só `pt`; padrão da API: duas ou três letras minúsculas, mais, se houver, `_` e duas maiúsculas, até 10 caracteres). A tela já abre com `pt_BR`. O texto abaixo está em português do Brasil.
- **Categoria sugerida: Utilidade (UTILITY).** É a que a nossa tela pede (`TelaWhatsApp`: "na categoria Utilidade"); se a Meta aceita ou reclassifica esse texto como outra categoria é regra da Meta (conferir na documentação atual da Meta). Prazo de aprovação, custo por mensagem e janela de 24 horas também são da Meta (conferir na documentação atual da Meta); o código só envia por modelo (tipo `template`), nunca texto livre.
- **Variáveis são posicionais:** o envio manda `type: template`, `template.name`, `template.language.code` e, em `components`, um item `type: body` com `parameters`, cada um `{type: text, text: <valor>}` **sem nome**. Portanto o modelo na Meta deve usar variáveis numeradas `{{1}}`, `{{2}}`, ... (não nomeadas), na ordem da tabela (conferir na documentação atual da Meta). Os valores são de uma linha só, no máximo 100 caracteres, sem quebra de linha nem espaços repetidos; vazio vira um texto de reserva ("aluno", "sua consultoria" ou "-"). O modelo de compromisso tem **uma** variável; os de cobrança, **quatro**: modelo com número de variáveis diferente é recusado pela Meta e o aviso falha (código de erro da Meta, ver "O que a API faz com cada falha").

### 2.2 Os seis modelos, na ordem das variáveis que a fila envia
Texto sugerido copiado literal de `ModelosDeTexto.sugerido` (é também o que a tela mostra para o treinador). O texto que vale é o que a Meta aprovar.

| Tipo (na tela) | Variáveis, na ordem | Texto sugerido |
| --- | --- | --- |
| `ANTES` (Lembrete antes do vencimento) | `{{1}}` primeiro nome do aluno; `{{2}}` nome da consultoria; `{{3}}` valor, como `R$ 1.234,56`; `{{4}}` vencimento, `dd/MM` | `Olá, {{1}}. A mensalidade de {{2}} no valor de {{3}} vence em {{4}}.` |
| `NO_DIA` (Lembrete no dia do vencimento) | as mesmas quatro | `Olá, {{1}}. A mensalidade de {{2}} no valor de {{3}} vence hoje ({{4}}).` |
| `DEPOIS` (Lembrete após o vencimento) | as mesmas quatro | `Olá, {{1}}. A mensalidade de {{2}} no valor de {{3}} venceu em {{4}} e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.` |
| `COMPROMISSO_NOVO` (Compromisso marcado) | `{{1}}` nome da consultoria | `Seu compromisso com a {{1}} foi marcado. Abra o app para ver.` |
| `COMPROMISSO_REMARCADO` (Compromisso remarcado) | `{{1}}` nome da consultoria | `Seu compromisso com a {{1}} foi remarcado. Abra o app para ver.` |
| `COMPROMISSO_CANCELADO` (Compromisso cancelado) | `{{1}}` nome da consultoria | `Seu compromisso com a {{1}} foi cancelado. Abra o app para ver.` |

Observações tiradas do código:
- O compromisso não leva horário, local nem nome do responsável, de propósito (C17).
- O valor sai de `TextoDoLembrete.valor` (reais com ponto de milhar e vírgula, "R$ " na frente) e o vencimento de `ConferenciaDoLembreteWhatsApp` (dia e mês, `dd/MM`, sem ano).
- Só a **mensalidade** gera lembrete pelo WhatsApp: a cobrança avulsa pode entrar na fila e é cancelada na conferência com o motivo `NAO_E_MENSALIDADE`. É por isso que o texto fala "mensalidade". **Lembrete de cobrança avulsa pelo WhatsApp: fora do piloto, por decisão do Gustavo (R6); reabrir depois do piloto.**
- Regras da Meta sobre o texto (variável no começo ou no fim, exemplos de valor para cada variável na hora de enviar o modelo para análise, tamanho) (conferir na documentação atual da Meta).

### 2.3 Como cadastrar nome e idioma no app
No app, como Administrador: Configurações › **WhatsApp oficial** (`/treinador/whatsapp`).
1. Bloco da conexão: preencher "Phone Number ID", "WABA ID (Conta do WhatsApp Business)" e "Token de acesso da Meta" e tocar em **Conectar WhatsApp**. A API grava o token cifrado (nunca o devolve; a tela só mostra "token gravado em ..."). **Salvar a conexão não confere nada na Meta**: o erro só aparece quando a tela lê os modelos ou quando um aviso é enviado. Para trocar o token depois, o campo vira "Novo token de acesso (opcional)" (em branco mantém o gravado); **Desconectar** apaga a conexão e cancela os avisos que ainda não saíram (`CONEXAO_REMOVIDA`).
2. Bloco "Modelos de mensagem": são seis cartões. Em cada um, **Configurar modelo** abre uma folha com o texto sugerido e a ordem das variáveis; preencher "Nome do modelo na Meta" e "Idioma" (`pt_BR`) e tocar em **Salvar modelo**. Depois a tela pergunta à Meta, na hora, a situação de cada modelo e mostra um selo: Aprovado (`APPROVED`), Em análise (`PENDING`), Recusado na Meta (`REJECTED`, `DISABLED` ou `PAUSED`), Não encontrado na Meta (nome ou idioma não batem) ou Não conferido (sem conexão, token recusado ou Meta fora do ar). Só os aprovados enviam de fato.
3. A tela lê só os primeiros 250 modelos da conta (`MODELOS_POR_CHAMADA`, `shortcut:` no código): conta com mais que isso mostra "Não encontrado" para o que ficou de fora.

## Parte 3. O webhook

Para que serve: a Meta avisa a nossa API que a mensagem foi entregue, lida ou falhou, e a fila troca a situação (ENVIADO, ENTREGUE, LIDO, FALHOU). Sem webhook funcionando, os avisos **saem** mesmo assim, mas ficam em ENVIADO.

- **URL de retorno (Callback URL):** `https://overtraining.app/api/publico/whatsapp/meta`
- **Token de verificação (Verify token):** é **nosso**, não da Meta: vale o que o Gustavo gerar, e ele é o valor de `TREINOS_WHATSAPP_META_VERIFY_TOKEN`. Para gerar um valor aleatório, no PC do Gustavo: `openssl rand -hex 32` (64 caracteres de 0 a 9 e a a f, sem símbolo, sem espaço e sem `+`, `/` ou `=`, que atrapalham no endereço; o `gravar-segredo.sh` também recusa espaço). **Não escreva o valor em nenhum arquivo do projeto, chat ou documento**; guarde-o no gerenciador de senhas e digite o mesmo valor, uma vez, no `gravar-segredo.sh` na VPS e, uma vez, no campo da Meta.
- **Como a API verifica (código `WhatsAppWebhookService.verificar`):** a Meta chama `GET` com `hub.mode=subscribe`, `hub.verify_token` e `hub.challenge`. A API devolve o `hub.challenge` só se o modo for `subscribe` e o token bater (comparação em tempo constante); senão responde **403**. O desafio precisa ter só letras, números, `_` e `-` (até 200); fora disso, 400. **Com `TREINOS_WHATSAPP_HABILITADO=false` a resposta é 503** (o webhook está atrás de `@ExigeWhatsApp`): só dá para verificar depois de ligar a chave.
- **Campos a assinar:** o código lê o corpo no formato `entry[].changes[].value.statuses[]` e usa `id` (o id da mensagem na Meta) e `status`: `delivered` vira ENTREGUE, `read` vira LIDO e `failed` vira FALHOU (com o código de erro da Meta, sem texto); `sent` e o resto são ignorados, e **mensagem recebida do aluno é ignorada** (nada é gravado). Isso corresponde ao campo **`messages`** do objeto **WhatsApp Business Account** (conferir na documentação atual da Meta: é nele que a Meta manda os `statuses`). Assinar mais campos que esse não ajuda: o código descarta.
- **Assinatura:** em todo `POST` a Meta manda o cabeçalho `X-Hub-Signature-256: sha256=<hex>`, que é o HMAC-SHA256 do corpo **cru** usando o **app secret do aplicativo** como chave (conferir na documentação atual da Meta). A API confere isso **antes** de interpretar o corpo, em tempo constante, com `TREINOS_WHATSAPP_META_APP_SECRET`; assinatura ausente, malformada ou errada dá **401** sem gravar nada. Corpo acima de 64 KiB é recusado. **Por isso o app secret da variável tem de ser o do aplicativo onde o webhook foi cadastrado, e o número que envia tem de estar ligado a esse aplicativo** (item 1.5). App secret trocado ou de outro aplicativo = todos os avisos de status dão 401 (os avisos continuam saindo; só o status não atualiza).
- **Limite conhecido:** se o aviso de status chegar antes de a API gravar o id da mensagem, ele não acha a linha e é ignorado (o código documenta a corrida); a situação pode ficar uma etapa atrás.
- Onde cadastrar na Meta: painel do aplicativo › WhatsApp › Configuração › Webhook › Editar (URL e token de verificação) e depois assinar o campo (conferir na documentação atual da Meta).

## Parte 4. A ordem na VPS (quem digita e roda é o Gustavo; o Claude só orienta)

### 4.1 O que as regras de `deploy/` determinam
Lidas em `C:\Users\gusta\Documents\central\central-api-back\deploy\` (no repositório do app, `../central/central-api-back/deploy/`); **nada foi executado**.
- **Onde ficam os segredos do consultoria-app:** `/opt/ecossistema/consultoria.env`, `chmod 600`, fora do git (comentário de `apps/consultoria/docker-compose.yml`; o serviço `consultoria-api` o lê por `env_file: ../../../../consultoria.env`). O `environment:` do compose só fixa perfil, `DB_URL` e o cookie; **todo `TREINOS_*` chega pelo `consultoria.env`**, então não precisa mexer no compose (diferente do `docker-compose.yml` local do repositório do app, que repassa as variáveis uma a uma).
- **Segredo nunca por chat, histórico do shell ou lista de processos:** entra só por `deploy/gravar-segredo.sh` (README §11 e §12, "só o dono executa"), por `ssh -t` (para o terminal não ecoar). O script lê o valor com `read -rs` (sem eco), recusa vazio ou com espaço (ou fora do `--regex`), grava com arquivo 600 e só imprime quantas linhas `NOME=` o arquivo tem: o valor nunca é impresso. **Nunca ponha o valor como argumento de comando**: o script pergunta; o argumento apareceria no histórico e na lista de processos. O nome da variável tem de ser maiúsculas, números e `_`. Colar do Windows é tolerado (o `\r` é tirado).
- **Cada segredo é diferente:** o README §4 manda nunca reaproveitar o mesmo segredo em dois lugares.
- **Recriar a API para ler o `.env` novo:** `deploy/recriar.sh consultoria api` (cabeçalho do script: "para ele ler de novo o .env alterado na VPS (chave nova, variável ligada)"). Recria só o `consultoria-api` com a **mesma release** (`releases/consultoria/atual.env`), com `--no-deps --force-recreate --wait --wait-timeout 180`, espera a API ficar saudável e **não altera os registros de release**. **Não use `atualizar.sh` com o mesmo commit no lugar** (ele grava o estado atual como "anterior" e o `rollback.sh` perderia o alvo). Pega uma trava de deploy (só um por vez; espera até 30 min), recusa rodar com o projeto antigo `ecossistema` no ar e registra a saída em `/opt/ecossistema/logs/deploy.log`.
- **Snapshot antes:** as etapas de VPS de `deploy/README.md` §11 e §12 pedem "snapshot antes"; faça o mesmo aqui.
- **Publicar código novo é outro caminho:** o deploy de uma versão nova da API (por exemplo, a mudança do aviso de compromisso, com a migration V109 provisória) é o do CI na `main`; à mão, só `atualizar.sh consultoria api <sha12>` com uma imagem já publicada (README §5). `rollback.sh` **recusa voltar** se a migration avançou (`docs/release-rollback.md`). Para só desligar o WhatsApp, não use rollback: grave `TREINOS_WHATSAPP_HABILITADO=false` e recrie.
- **O que não existe lá:** não achei, em `deploy/` nem em `central-api-back/docs/`, texto sobre **acesso do Claude** à VPS. O que existe é "só o dono executa" e "ninguém digita nem vê o segredo". Adotei o mais restritivo: **o Claude só orienta; quem roda comando na VPS e quem digita segredo é o Gustavo.** A seção 7 do README ("WhatsApp (EvolutionGo)") é do WhatsApp não oficial do Servirea e da Central, **outro assunto**, não deste.

### 4.2 As cinco variáveis

| Variável | O que é | Formato |
| --- | --- | --- |
| `TREINOS_WHATSAPP_HABILITADO` | liga o recurso inteiro, para todas as consultorias | `true` (sem a variável vale `false`) |
| `TREINOS_WHATSAPP_CHAVES` | chaves que cifram o token de cada consultoria | lista separada por vírgula de `<id>:<base64 de 32 bytes>`; o id é um nome curto à escolha (sem `:` nem vírgula), único; cada chave sai de `openssl rand -base64 32` |
| `TREINOS_WHATSAPP_CHAVE_ATIVA` | qual chave cifra o que é gravado agora | o **id** de uma das chaves de `TREINOS_WHATSAPP_CHAVES` (o id não é segredo) |
| `TREINOS_WHATSAPP_META_APP_SECRET` | o app secret do aplicativo da Meta (no piloto, o do Saraiva); assina o webhook | o texto que a Meta mostra, sem espaço |
| `TREINOS_WHATSAPP_META_VERIFY_TOKEN` | a senha da verificação do webhook | o valor aleatório gerado na Parte 3 |

Existem mais duas, **sem gravar nenhuma agora**: `TREINOS_WHATSAPP_META_URL` (padrão `https://graph.facebook.com`; só muda em teste) e `TREINOS_WHATSAPP_ENVIO_AGENDADO` (padrão ligado). O aviso de cobrança só nasce com `TREINOS_PAGAMENTOS_HABILITADO` ligado (conferir em produção; o aviso de compromisso não depende dele). A API **não sobe ligada** se faltar uma das quatro secretas (a mensagem diz só o nome); desligada, sobe sem nenhuma.

### 4.3 A ordem
O webhook está atrás de `@ExigeWhatsApp`: com a chave desligada a Meta recebe 503 na verificação. Então a chave liga **junto** das variáveis. É seguro: nada é enfileirado sem conexão, modelo do tipo e interruptor do aluno, e a consultoria do Saraiva ainda não está conectada.

1. **Consultoria de teste pronta** em produção, pelo caminho da Central (fora deste roteiro); administrador dela com acesso.
2. **Meta:** aplicativo, produto WhatsApp, número que envia (item 1.5), token e IDs (Parte 1), e os seis modelos enviados para análise (Parte 2).
3. **Gerar no PC do Gustavo** (nada vai para o chat nem para arquivo do projeto): `openssl rand -base64 32` para a chave (o valor final é `<id>:<resultado>`, com o id escolhido por ele, por exemplo um nome curto) e `openssl rand -hex 32` para o verify token. Ter à mão o app secret do aplicativo.
4. **Snapshot da VPS.**
5. **Gravar as variáveis, uma a uma, pelo Gustavo** (os valores são digitados no prompt, sem eco; `usuario@vps` é o mesmo acesso que ele usa nas demais etapas do README):
   - `ssh -t usuario@vps bash /opt/ecossistema/central-api-back/deploy/gravar-segredo.sh /opt/ecossistema/consultoria.env TREINOS_WHATSAPP_CHAVES`
   - o mesmo, trocando o último argumento, para `TREINOS_WHATSAPP_CHAVE_ATIVA`, `TREINOS_WHATSAPP_META_APP_SECRET` e `TREINOS_WHATSAPP_META_VERIFY_TOKEN`;
   - por último, `... TREINOS_WHATSAPP_HABILITADO --regex '^true$'` (o script só aceita `true`).
   Cada execução imprime só `OK: ... tem 1 linha(s) NOME preenchida(s)`.
6. **Recriar a API:** `bash /opt/ecossistema/central-api-back/deploy/recriar.sh consultoria api` (na VPS). Esperar o `--wait` terminar e o `ps` mostrar o `consultoria-api` saudável. Se a API não subir, a mensagem do log diz só o **nome** da variável que falta ou o formato inválido, nunca o valor.
7. **Cadastrar e verificar o webhook na Meta** (Parte 3): "Verificar e salvar" tem de passar; depois assinar o campo `messages`.
8. **Conectar a consultoria de teste e cadastrar os seis modelos** na tela dela (Parte 2.3). O interruptor aparece **só para os alunos dessa consultoria**.
9. **Teste da Parte 5.** Reprovou ou duvidou: não conecte a do Saraiva.
10. **Só depois do teste aprovado:** Parte 6 (conectar a consultoria do Saraiva).

**Desfazer:** `gravar-segredo.sh ... TREINOS_WHATSAPP_HABILITADO --regex '^false$'` e `recriar.sh consultoria api`. As conexões e os pendentes ficam guardados; com a chave desligada o job não faz nada.

## Parte 5. Teste na consultoria de teste, com um aluno fictício (o número do Gustavo)

O teste roda **só na consultoria de teste** (R4). A do Saraiva continua sem conexão: nada muda para os alunos dele. Quem **envia** é o número escolhido no item 1.5; quem **recebe** é o telefone do Gustavo, no aluno fictício. Anote o telefone só no seu aparelho, nunca no repositório.

1. **Criar o aluno fictício** na consultoria de teste (nome fictício) e dar acesso a ele pelo cadastro do acesso, com o **telefone do Gustavo** (o telefone vem do usuário de acesso do aluno).
2. **Entrar como esse aluno**, em Conta › Aparência e preferências, e **ligar** "Receber avisos pelo WhatsApp". O interruptor só fica ligável com a consultoria conectada e o telefone no cadastro.
3. **Conferir a conexão e os seis modelos** como Administrador na tela do WhatsApp: os seis devem estar **Aprovado**. Modelo "Em análise" ainda não envia.
4. **Compromisso** (na Agenda, com o aluno fictício; compromisso que já terminou não avisa). Depende da mudança R7, em implementação: confira se ela já está publicada antes de testar.
   - **Marcar** um compromisso futuro: chega "foi marcado".
   - **Remarcar**: chega "foi remarcado".
   - **Remarcar de novo em menos de 10 minutos**: **não** chega outra mensagem (remarcar duas vezes em menos de 10 minutos manda **uma** mensagem só; se a primeira ainda estava na fila, as duas viram uma). Para ver uma segunda mensagem de "remarcado", espere mais de 10 minutos.
   - **Cancelar**: chega "foi cancelado".
   - **Reabrir** o compromisso cancelado: chega "foi marcado" **de novo** (o aluno recebeu "cancelado" no meio, então não é fato repetido).
5. **Lembrete de cobrança (só mensalidade; a avulsa está fora do piloto, R6):** exige, na ordem: financeiro ligado (`TREINOS_PAGAMENTOS_HABILITADO`, conferir em produção); lembretes **ligados** em Financeiro › Lembretes da consultoria de teste (sem a configuração, ficam desligados); o aluno com **contratação ativa** e uma **mensalidade** aberta; o aluno **sem ter desligado** os lembretes na Conta dele. O job roda **de hora em hora, das 9h às 20h de Brasília, no minuto 7** (uma mensagem por aluno por dia); o lembrete "no dia" só sai no dia do vencimento, então **crie a mensalidade com vencimento hoje** (ou ajuste "dias antes" ou "dias depois" para cair hoje) e espere o próximo minuto 7 dentro da janela. A fila do WhatsApp enche **mesmo com o e-mail desligado**. Conferir: a mensagem chegou com o primeiro nome, a consultoria, o valor e o dia/mês certos.
6. **Conferir ENVIADO, ENTREGUE e LIDO.** **Nenhuma tela do app mostra a situação por envio** (a tela do WhatsApp só mostra conexão e modelos; relatório de entrega está fora do escopo). Duas evidências: (a) o próprio celular (a mensagem chegou e, se abriu, os dois risquinhos azuis); (b) a **exportação de dados do aluno** (Ficha › Privacidade › Exportar, permissão `ALUNO_EXPORTAR`; conferir o nome do botão na tela), cuja seção `avisosPeloWhatsApp` traz, por mensagem (uma linha por mensagem depois da R7), tipo, situação (`PENDENTE`, `ENVIADO`, `ENTREGUE`, `LIDO`, `FALHOU`, `CANCELADO`) e datas, sem texto nem telefone. **Se continuar em `ENVIADO` depois de a mensagem chegar e ser lida, o webhook não está validando: o número que envia provavelmente não está ligado ao aplicativo dono do app secret** (item 1.5), ou o campo não foi assinado (Parte 3). Esse é o ponto principal a decidir e conferir antes de aprovar o teste.
7. **Desligar o interruptor** como esse aluno e repetir um compromisso: **nada** deve chegar; um aviso que já estava na fila fica `CANCELADO` (`OPT_IN_DESLIGADO`).
8. Opcional: **Desconectar** na tela, e conferir que os pendentes ficam `CANCELADO` (`CONEXAO_REMOVIDA`) e o interruptor some para os alunos da consultoria de teste.
9. **Limpar:** apagar ou anonimizar o aluno fictício e conferir que o histórico dele some com ele (anonimizar zera o aceite e cancela os pendentes).
10. **Decidir:** teste aprovado = envio, entrega e leitura refletidos, compromisso e lembrete certos, interruptor respeitado.

## Parte 6. Depois do teste aprovado: a consultoria do Saraiva
Só agora, e com o Saraiva (dono da conta Meta e do número):
1. Número do Saraiva ligado ao **aplicativo** (já é o dele, C25), confirmado, com nome de exibição aprovado; usuário do sistema e token permanente da conta dele (Partes 1.2 a 1.4); `phone_number_id` e `waba_id` do número dele.
2. Os seis modelos criados e **aprovados na conta (WABA) do Saraiva** (a conta de teste não vale para ele).
3. Na tela do WhatsApp da consultoria do Saraiva: **Conectar** e cadastrar os seis modelos. A partir daqui o interruptor aparece para todos os alunos dele (com telefone no cadastro); ninguém recebe nada sem ligar o próprio.
4. Combinar com o Saraiva como avisar os alunos. Só então liberar.
5. **Antes do segundo treinador:** a pendência R3 (verificar a empresa na Meta e aprovar o aplicativo da plataforma); com o segundo treinador, o segredo único e o aplicativo do Saraiva deixam de servir (C25).

## O que a API faz com cada falha
Tudo isto vem do código (`MetaCliente`, `WhatsAppDaFila`, `PreparoDoAviso`); só o **significado de cada código da Meta** é dela (conferir na documentação atual da Meta). Nunca vai a log ou ao banco o texto, o telefone ou o token: só um código curto.

- **Aceito (2xx com o id da mensagem):** vira `ENVIADO` com o id (que o webhook usa para achar a linha). Resposta 2xx **sem** o id vira `RESPOSTA_INVALIDA` e **tenta de novo**.
- **Falha que passa sozinha, tenta de novo:** HTTP 5xx, 408, 429, erro de rede (a classe do erro é o código) e os códigos da Meta de uma lista fixa (`1, 2, 4, 17, 32, 341, 368, 613, 80007, 130429, 131000, 131016, 131048, 131056`; o código diz que a lista foi escrita de memória da documentação, **conferir na documentação atual da Meta**). São **3 tentativas**, com **60 s** de espera; depois a linha vira `FALHOU` com o código (`META_<código>`, `HTTP_<status>` ou a classe do erro).
- **Falha definitiva, não tenta de novo:** qualquer outro erro 4xx (token inválido ou vencido, modelo inexistente ou não aprovado, parâmetros diferentes do modelo, número que não tem WhatsApp, etc.): vira `FALHOU` na hora, com o código `META_<código da Meta>`.
- **Antes de enviar, o aviso pode ser cancelado** (`CANCELADO` com o motivo, sem chamar a Meta): aluno inativo ou anonimizado (`ALUNO_INATIVO`), aluno sem o aceite (`OPT_IN_DESLIGADO`), lembretes desligados pelo aluno (`ALUNO_DESLIGOU`), sem conexão (`SEM_CONEXAO`), sem modelo do tipo (`SEM_MODELO`), sem telefone utilizável (`SEM_TELEFONE`), e, no lembrete, `FINANCEIRO_DESLIGADO`, `COBRANCA_NAO_ABERTA` (paga ou cancelada no meio), `NAO_E_MENSALIDADE`, `NAO_E_MAIS_DEVIDO` e `CONTRATACAO_NAO_ATIVA`. Conexão removida cancela os pendentes (`CONEXAO_REMOVIDA`).
- **Aviso parado:** um aviso pendente com mais de **24 horas** vira `CANCELADO` (a fila limpa a cada rodada); o histórico some 180 dias depois da última mudança.
- **Status que chega pelo webhook:** `delivered` e `read` só andam para a frente; `failed` depois de enviado vira `FALHOU` com o código `META_<código>` ou `META_FALHA`.
- **Aceita pela Meta mas a gravação falhou:** o id fica na memória e a nova tentativa só conclui, sem mandar a mensagem de novo (a API reiniciada nesse intervalo esquece e pode mandar de novo).
- **Nenhuma falha de aviso desfaz o compromisso ou a cobrança**, e pagamento atrasado nunca bloqueia nada do aluno.

## Lista de verificação (checklist)
Antes de tudo
- [ ] Consultoria de teste existe em produção (criada pela Central, fora deste roteiro) e a do Saraiva **não** será conectada antes do teste
- [ ] Gustavo escolheu a opção do item 1.5 (número que envia ligado ao aplicativo dono do app secret)

Preparação na Meta (Gustavo e Saraiva)
- [ ] Aplicativo do tipo Empresa criado na conta do Saraiva; produto WhatsApp adicionado
- [ ] Número que envia no teste adicionado, confirmado, com nome de exibição aprovado (ou número de teste da Meta, se permitido)
- [ ] Telefone do Gustavo (quem recebe) autorizado como destinatário, se a Meta pedir
- [ ] Gustavo é administrador do aplicativo (ou os dois estão juntos para os segredos)
- [ ] Usuário do sistema criado, com o aplicativo e a conta do WhatsApp atribuídos
- [ ] Token permanente (sem validade) gerado com `whatsapp_business_messaging` e `whatsapp_business_management`, guardado no gerenciador de senhas
- [ ] `phone_number_id` e `waba_id` anotados (só no aparelho de quem faz)
- [ ] Seis modelos criados na categoria Utilidade, com as variáveis `{{1}}...` na ordem da Parte 2.2, enviados para análise
- [ ] Os seis modelos com situação Aprovado

Na VPS (Gustavo digita e roda; o Claude só orienta; snapshot antes)
- [ ] Chaves geradas (`openssl rand -base64 32`, formato `<id>:<base64>`) e verify token gerado (`openssl rand -hex 32`)
- [ ] `TREINOS_WHATSAPP_CHAVES`, `TREINOS_WHATSAPP_CHAVE_ATIVA`, `TREINOS_WHATSAPP_META_APP_SECRET` e `TREINOS_WHATSAPP_META_VERIFY_TOKEN` gravadas em `/opt/ecossistema/consultoria.env` pelo `gravar-segredo.sh` (sem valor em argumento, chat ou arquivo do projeto)
- [ ] `TREINOS_WHATSAPP_HABILITADO=true` gravada (`--regex '^true$'`)
- [ ] API recriada com `recriar.sh consultoria api` e saudável (nada de `atualizar.sh` com o mesmo commit)
- [ ] `TREINOS_PAGAMENTOS_HABILITADO` conferida em produção (se o lembrete de cobrança será testado)
- [ ] Versão da API com a mudança do aviso de compromisso (R7, V109 provisória) publicada pelo CI, se o teste do compromisso for feito
- [ ] Webhook cadastrado e **verificado** na Meta; campo `messages` assinado

Na consultoria de teste
- [ ] Conexão salva na tela `/treinador/whatsapp`; seis modelos configurados e com selo Aprovado
- [ ] Aluno fictício com acesso e telefone do Gustavo; interruptor ligado por ele
- [ ] Compromisso marcado, remarcado, cancelado e reaberto ("marcado" de novo) chegaram ao WhatsApp
- [ ] Remarcar duas vezes em menos de 10 minutos mandou **uma** mensagem só
- [ ] Mensalidade com vencimento hoje e lembretes ligados: o lembrete chegou, com os quatro dados certos
- [ ] Entrega e leitura refletidas na seção `avisosPeloWhatsApp` da exportação (`ENVIADO`, `ENTREGUE`, `LIDO`); se ficou em `ENVIADO`, o item 1.5 está errado
- [ ] Interruptor desligado: nada mais chega
- [ ] (Opcional) Desconectar cancela pendentes e esconde o interruptor
- [ ] Aluno fictício apagado ou anonimizado
- [ ] Teste aprovado pelo Gustavo

Depois do teste aprovado (consultoria do Saraiva)
- [ ] Número, token e seis modelos aprovados na conta do Saraiva
- [ ] Conexão e modelos cadastrados na tela da consultoria do Saraiva; alunos avisados
- [ ] Pendência do Gustavo aberta e andando: verificar a empresa na Meta e aprovar o aplicativo da plataforma (README dos planos), antes do segundo treinador

## Fora do escopo
- Criar a consultoria de teste (pela Central, `docs/integracao-central.md`), criar modelo na Meta pela API, cadastro embutido da Meta (Embedded Signup) e botão "enviar teste" (já fora no [plano do contato](contato-da-consultoria.md)).
- Resposta do aluno pelo WhatsApp e qualquer mensagem de texto livre (Nível 3, `whatsapp-atendimento.md`).
- Tela com a situação de cada envio (relatório de entrega).
- Lembrete de cobrança avulsa pelo WhatsApp (R6, fora por enquanto).
- Ligar a chave em produção sem o ok do Gustavo; este roteiro não liga nada.

## O que ficou para trás
- **Como o treinador conecta a conta dele ao aplicativo da plataforma** (longo prazo, C19): a Meta costuma pedir um fluxo próprio para isso, e o cadastro embutido está fora do escopo. A conferir na documentação atual da Meta antes do segundo treinador, junto da verificação da empresa (pendência do Gustavo no README).
- **O app secret do Saraiva** é segredo dele: combinar como o Gustavo o acessa (administrador do aplicativo) sem passar por chat.
- **Qual das opções do item 1.5** o teste usa, e se a Meta permite (número de teste da Meta; número do Gustavo ligado ao aplicativo do Saraiva): decisão do Gustavo, a conferir na documentação atual da Meta.
- **Regras de acesso do Claude à VPS:** não existe texto específico em `deploy/` nem em `central-api-back/docs/`; o roteiro adota "o Claude só orienta; o Gustavo roda e digita" (só o dono executa, `deploy/README.md` §11 e §12). Se o Gustavo quiser outro combinado, escreve-se onde ele disser.
- **Mudança do aviso de compromisso (R7):** em implementação pelo coordenador (coluna `ocorrencia`, V109 provisória, número a confirmar na hora de subir); este roteiro descreve o comportamento decidido, não o código lido. Conferir o passo 4 da Parte 5 contra o código publicado.
- Versão `v23.0` da Graph API fixa no código, e a lista de códigos passageiros escrita de memória (`MetaCliente`): conferir e trocar quando a Meta mudar.
- Nada foi testado contra a Meta real: formato do JSON, permissões e campos do webhook estão conferidos só pelo código e por servidor de mentira (`MetaFalsa`).
- A mensagem de lembrete diz "mensalidade", coerente com o fato de só a mensalidade enviar (R6).
