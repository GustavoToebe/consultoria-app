# Roteiro do WhatsApp oficial: Meta, VPS e teste do piloto

Situação: Planejando (roteiro escrito, nada executado) · Onde: worktree `whatsapp-piloto` (só documentação) · Atualizado: 27/11/2026

Fonte: decisão do Gustavo de 27/11/2026 (C19, C24 e C25 de [contato-da-consultoria.md](contato-da-consultoria.md)) e leitura do código do worktree `whatsapp-piloto` sobre `origin/main` `cb8c6fec` (`api/.../whatsapp/`, `pagamentos/ConferenciaDoLembreteWhatsApp`, `LembretesDeCobranca`, `app/src/treinador/whatsapp/TelaWhatsApp.tsx`, `app/src/dominio/whatsapp.ts`, `application.yml`, `deploy/` da Central). Validade: vale enquanto o pacote `whatsapp/`, os textos de `ModelosDeTexto` e a versão `v23.0` da Graph API (fixa em `MetaCliente`) não mudarem; refazer a leitura antes de usar. **Tudo o que descreve a interface, as permissões, os prazos, os custos, a categoria e as regras da Meta não vem do nosso código: está marcado "(conferir na documentação atual da Meta)" e foi escrito de memória, sem acesso à internet.** Nenhuma chamada à Meta e nenhum comando na VPS foram executados para escrever este roteiro.

## Objetivo
Pôr o aviso de cobrança e de compromisso pelo WhatsApp oficial para rodar no piloto, com a conta e o número do Saraiva, e testá-lo com um aluno fictício antes de liberar aos alunos. O Gustavo e o Saraiva fazem os passos da Meta; quem digita segredo é sempre o Gustavo.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| R1 | Conta e número | São do treinador, que paga a Meta direto (C24) | Gustavo, 27/11/2026 |
| R2 | Aplicativo no piloto | O aplicativo da Meta é o da conta Meta do Saraiva; o app secret dele vai em `TREINOS_WHATSAPP_META_APP_SECRET` (C25). Longo prazo: um aplicativo só, o da plataforma (C19) | Gustavo, 27/11/2026 |
| R3 | Antes do segundo treinador | Verificar a empresa na Meta e aprovar o aplicativo da plataforma: pendência do Gustavo (README, "Pendências soltas") | Gustavo, 27/11/2026 |
| R4 | Ordem na VPS | Chaves → variáveis **junto com** `TREINOS_WHATSAPP_HABILITADO=true` → recriar a API → webhook → conexão e modelos → teste (ver "A ordem na VPS": o webhook só responde com a chave ligada) | Claude (a partir do código), a confirmar pelo Gustavo |

## Antes de começar: o que o código exige (e o que ele faz com a Meta)
- **Quem faz o quê:** o Saraiva é dono da conta comercial da Meta (Meta Business); o Gustavo precisa ser administrador do aplicativo, ou os dois fazem juntos, para o Gustavo ver o app secret e criar o token. O app secret e o token **nunca vão por chat, e-mail ou mensagem**: o app secret vai à VPS pelo `gravar-segredo.sh` e o token entra só na tela `/treinador/whatsapp`, digitado por quem o tem.
- **Número:** precisa ser um número que a Meta aceite como número da Cloud API (em geral, um número que não esteja em uso no aplicativo comum do WhatsApp) (conferir na documentação atual da Meta). O telefone do **aluno** vem do usuário de acesso dele, e o código só aceita número brasileiro completo (DDD mais 8 ou 9 dígitos, com ou sem o 55); sem isso o aviso é cancelado com `SEM_TELEFONE`, nunca enviado a um destino adivinhado.
- **Quem vê a tela:** `/treinador/whatsapp` (Configurações › "WhatsApp oficial") é só do Administrador (permissão `WHATSAPP_ALTERAR`) e só aparece com `TREINOS_WHATSAPP_HABILITADO=true`.
- **Chamada à Meta:** o app usa a Graph API na versão `v23.0` (fixa no código, `MetaCliente.VERSAO_DA_API`; quando a Meta aposentar a versão, é troca no código, conferir na documentação atual da Meta), em `https://graph.facebook.com`.

## Parte 1. No Meta for Developers e no Gerenciador de Negócios (Gustavo e Saraiva)

Os nomes de menu abaixo são os que costumam existir; a Meta muda a interface com frequência. Se algum nome não bater, vale o objetivo do passo, não o nome (conferir na documentação atual da Meta, em todos os passos desta parte).

### 1.1 Criar o aplicativo
1. Entrar em developers.facebook.com com a conta do Saraiva (ou uma conta que ele tenha adicionado como administrador) (conferir na documentação atual da Meta).
2. "Meus aplicativos" › "Criar aplicativo". Escolher o caso de uso/tipo **Empresa (Business)**, o que permite o produto WhatsApp (conferir na documentação atual da Meta).
3. Dar um nome ao aplicativo (por exemplo, o nome do produto) e **vincular à conta empresarial (Meta Business) do Saraiva** (conferir na documentação atual da Meta).
4. Anotar para você, sem escrever em nenhum documento do projeto: o **ID do aplicativo** e onde fica a **Chave secreta do aplicativo (app secret)**, em Configurações do aplicativo › Básico (conferir na documentação atual da Meta). O app secret é o valor de `TREINOS_WHATSAPP_META_APP_SECRET`.

### 1.2 Adicionar o produto WhatsApp e ligar o número
1. No painel do aplicativo, "Adicionar produto" › **WhatsApp** (conferir na documentação atual da Meta).
2. Escolher ou criar a **conta do WhatsApp Business (WABA)** do Saraiva, a mesma da conta empresarial (conferir na documentação atual da Meta).
3. Adicionar o **número de telefone** do Saraiva: informar o número e o **nome de exibição** (o nome que o aluno vê), e confirmar o número pelo código que a Meta manda por SMS ou ligação (conferir na documentação atual da Meta). O nome de exibição passa por uma análise da Meta (conferir na documentação atual da Meta).
4. A empresa pode precisar estar **verificada** na Meta para enviar além dos limites iniciais; a verificação é a pendência R3 para o aplicativo da plataforma, e para a conta do Saraiva fica a conferir (conferir na documentação atual da Meta).
5. Enquanto o aplicativo estiver em modo de desenvolvimento, a Meta pode só enviar a números cadastrados como destinatários de teste (conferir na documentação atual da Meta). O número do Gustavo, usado no teste de baixo, talvez precise ser adicionado assim.

### 1.3 Criar o token permanente (usuário do sistema)
O token que aparece na tela de teste do aplicativo vale poucas horas (conferir na documentação atual da Meta). O app precisa de um token que **não vence**:
1. Gerenciador de Negócios (business.facebook.com) › Configurações da empresa › Usuários › **Usuários do sistema** › Adicionar. Criar um usuário do sistema com função de **Administrador** (conferir na documentação atual da Meta).
2. Atribuir ao usuário do sistema os **ativos**: o **aplicativo** e a **conta do WhatsApp (WABA)**, com controle total (conferir na documentação atual da Meta).
3. "Gerar novo token": escolher o aplicativo, escolher **nunca expirar** (sem validade), e marcar as permissões **`whatsapp_business_messaging`** (enviar mensagens) e **`whatsapp_business_management`** (ler e gerir a conta e os modelos) (conferir na documentação atual da Meta: nomes e se há permissões a mais).
   - Por que as duas, segundo o nosso código: o envio usa `POST /{phone_number_id}/messages` (mensagens) e a tela lê os modelos com `GET /{waba_id}/message_templates` (gestão). Sem a de gestão a tela mostra os modelos como "Não conferido" (`INDISPONIVEL`); sem a de mensagens nenhum aviso sai.
4. **Copiar o token na hora**, pois a Meta o mostra uma vez (conferir na documentação atual da Meta), e guardá-lo no gerenciador de senhas. Ele entra só na tela `/treinador/whatsapp` (campo "Token de acesso da Meta"), que o cifra com a chave da VPS; nunca em chat, nunca neste repositório.

### 1.4 Onde achar o `phone_number_id` e o `waba_id`
No painel do aplicativo, WhatsApp › **Configuração da API** (ou "Primeiros passos"): aparecem o **ID do número de telefone** (`phone_number_id`) e o **ID da conta do WhatsApp Business** (`waba_id`) (conferir na documentação atual da Meta). **Não confundir** com o número de telefone em si, com o ID do aplicativo nem com o ID da conta empresarial. Os dois são só números e vão nos campos "Phone Number ID" e "WABA ID (Conta do WhatsApp Business)" da tela (até 40 caracteres cada). Nenhum dos dois é segredo, mas não os copie para este repositório.

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
- Só a **mensalidade** gera lembrete pelo WhatsApp: a cobrança avulsa pode entrar na fila e é cancelada na conferência com o motivo `NAO_E_MENSALIDADE`. Por isso o texto fala "mensalidade", ao contrário do e-mail, que troca para "cobrança" na avulsa. Não é erro do roteiro; é como o código está hoje.
- Regras da Meta sobre o texto (variável no começo ou no fim, exemplos de valor para cada variável na hora de enviar o modelo para análise, tamanho) (conferir na documentação atual da Meta).

### 2.3 Como cadastrar nome e idioma no app
No app, como Administrador: Configurações › **WhatsApp oficial** (`/treinador/whatsapp`).
1. Bloco da conexão: preencher "Phone Number ID", "WABA ID (Conta do WhatsApp Business)" e "Token de acesso da Meta" e tocar em **Conectar WhatsApp**. A API grava o token cifrado (nunca o devolve; a tela só mostra "token gravado em ..."). **Salvar a conexão não confere nada na Meta**: o erro só aparece quando a tela lê os modelos ou quando um aviso é enviado. Para trocar o token depois, o campo vira "Novo token de acesso (opcional)" (em branco mantém o gravado); **Desconectar** apaga a conexão e cancela os avisos que ainda não saíram (`CONEXAO_REMOVIDA`).
2. Bloco "Modelos de mensagem": são seis cartões. Em cada um, **Configurar modelo** abre uma folha com o texto sugerido e a ordem das variáveis; preencher "Nome do modelo na Meta" e "Idioma" (`pt_BR`) e tocar em **Salvar modelo**. Depois a tela pergunta à Meta, na hora, a situação de cada modelo e mostra um selo: Aprovado (`APPROVED`), Em análise (`PENDING`), Recusado na Meta (`REJECTED`, `DISABLED` ou `PAUSED`), Não encontrado na Meta (nome ou idioma não batem) ou Não conferido (sem conexão, token recusado ou Meta fora do ar). Só os aprovados enviam de fato.
3. A tela lê só os primeiros 250 modelos da conta (`MODELOS_POR_CHAMADA`, `shortcut:` no código): conta com mais que isso mostra "Não encontrado" para o que ficou de fora.

## Parte 3. O webhook

Para que serve: a Meta avisa a nossa API que a mensagem foi entregue, lida ou falhou, e a fila troca a situação (ENVIADO, ENTREGUE, LIDO, FALHOU). Sem webhook, os avisos **saem** mesmo assim, mas ficam em ENVIADO.

- **URL de retorno (Callback URL):** `https://overtraining.app/api/publico/whatsapp/meta`
- **Token de verificação (Verify token):** é **nosso**, não da Meta: vale o que o Gustavo gerar, e ele é o valor de `TREINOS_WHATSAPP_META_VERIFY_TOKEN`. Para gerar um valor aleatório, no PC do Gustavo: `openssl rand -hex 32` (64 caracteres de 0 a 9 e a a f, sem símbolo, sem espaço e sem `+`, `/` ou `=`, que atrapalham no endereço). **Não escreva o valor em nenhum arquivo do projeto, chat ou documento**; guarde-o no gerenciador de senhas e digite o mesmo valor, uma vez, no `gravar-segredo.sh` na VPS e, uma vez, no campo da Meta.
- **Como a API verifica (código `WhatsAppWebhookService.verificar`):** a Meta chama `GET` com `hub.mode=subscribe`, `hub.verify_token` e `hub.challenge`. A API devolve o `hub.challenge` só se o modo for `subscribe` e o token bater (comparação em tempo constante); senão responde **403**. O desafio precisa ter só letras, números, `_` e `-` (até 200); fora disso, 400.
- **Campos a assinar:** o código lê o corpo no formato `entry[].changes[].value.statuses[]` e usa `id` (o id da mensagem na Meta) e `status`: `delivered` vira ENTREGUE, `read` vira LIDO e `failed` vira FALHOU (com o código de erro da Meta, sem texto); `sent` e o resto são ignorados, e **mensagem recebida do aluno é ignorada** (nada é gravado). Isso corresponde ao campo **`messages`** do objeto **WhatsApp Business Account** (conferir na documentação atual da Meta: é nele que a Meta manda os `statuses`). Assinar mais campos que esse não ajuda: o código descarta.
- **Assinatura:** em todo `POST` a Meta manda o cabeçalho `X-Hub-Signature-256: sha256=<hex>`, que é o HMAC-SHA256 do corpo **cru** usando o **app secret do aplicativo** como chave (conferir na documentação atual da Meta). A API confere isso **antes** de interpretar o corpo, em tempo constante, com `TREINOS_WHATSAPP_META_APP_SECRET`; assinatura ausente, malformada ou errada dá **401** sem gravar nada. Corpo acima de 64 KiB é recusado. **Por isso o app secret da variável tem de ser o do aplicativo onde o webhook foi cadastrado** (no piloto, o do Saraiva, C25). App secret trocado ou de outro aplicativo = todos os avisos de status dão 401 (os avisos continuam saindo; só o status não atualiza).
- **Limite conhecido:** se o aviso de status chegar antes de a API gravar o id da mensagem, ele não acha a linha e é ignorado (o código documenta a corrida); a situação pode ficar uma etapa atrás.
- Onde cadastrar na Meta: painel do aplicativo › WhatsApp › Configuração › Webhook › Editar (URL e token de verificação) e depois assinar o campo (conferir na documentação atual da Meta).

## Parte 4. A ordem na VPS

As variáveis são cinco. A API **não sobe ligada** se faltar uma das quatro secretas; desligada, sobe sem nenhuma (`WhatsAppProperties`).

| Variável | O que é | Formato |
| --- | --- | --- |
| `TREINOS_WHATSAPP_HABILITADO` | liga o recurso inteiro | `true` (sem a variável vale `false`) |
| `TREINOS_WHATSAPP_CHAVES` | chaves que cifram o token de cada consultoria | lista separada por vírgula de `<id>:<base64 de 32 bytes>`; o id é um nome curto à escolha (sem `:` nem vírgula), único; cada chave sai de `openssl rand -base64 32` |
| `TREINOS_WHATSAPP_CHAVE_ATIVA` | qual chave cifra o que é gravado agora | o **id** de uma das chaves de `TREINOS_WHATSAPP_CHAVES` (o id não é segredo) |
| `TREINOS_WHATSAPP_META_APP_SECRET` | o app secret do aplicativo da Meta; assina o webhook | o texto que a Meta mostra, sem espaço |
| `TREINOS_WHATSAPP_META_VERIFY_TOKEN` | a senha da verificação do webhook | o valor aleatório gerado na Parte 3 |

Outras duas existem, mas **não se grava nenhuma agora**: `TREINOS_WHATSAPP_META_URL` (padrão `https://graph.facebook.com`; só muda em teste) e `TREINOS_WHATSAPP_ENVIO_AGENDADO` (padrão ligado). Além disso, o aviso de cobrança só nasce com `TREINOS_PAGAMENTOS_HABILITADO` ligado (conferir em produção; o aviso de compromisso não depende dele).

### O que o código mudou na ordem que se esperava
O webhook (`WhatsAppWebhookController`) está atrás de `@ExigeWhatsApp`: **com `TREINOS_WHATSAPP_HABILITADO=false`, a Meta recebe 503 na verificação**. Então não dá para conferir o webhook antes de ligar a chave. Ligar a chave junto das variáveis é seguro, porque nada é enfileirado sem conexão gravada, sem modelo do tipo e sem o aluno ter ligado o interruptor (a revisão de 23/11 já dizia: "Ligar não envia nada em lote"). A ordem fica:

1. **Gerar as chaves e o verify token no PC do Gustavo** (parte já descrita). Ter à mão o app secret do aplicativo do Saraiva (Parte 1.1).
2. **Gravar as cinco variáveis na VPS**, uma a uma, **pelo Gustavo**, com o `gravar-segredo.sh` da Central (arquivo de ambiente da consultoria, `consultoria.env`; o compose lê `../../../../consultoria.env`, conferir o caminho na VPS): `ssh -t usuario@vps bash /opt/ecossistema/central-api-back/deploy/gravar-segredo.sh <consultoria.env> TREINOS_WHATSAPP_CHAVES`, e o mesmo para `TREINOS_WHATSAPP_CHAVE_ATIVA`, `TREINOS_WHATSAPP_META_APP_SECRET`, `TREINOS_WHATSAPP_META_VERIFY_TOKEN` e, por último, `TREINOS_WHATSAPP_HABILITADO` (com `--regex '^true$'`). O script lê o valor sem eco (`read -rs`), recusa vazio e espaço e deixa o arquivo com permissão 600. **Faça uma cópia (snapshot) antes**, como a Central pede para mexer na VPS.
3. **Subir a API com as variáveis novas:** `bash /opt/ecossistema/central-api-back/deploy/recriar.sh consultoria api` (recria o contêiner na mesma release, lendo o `.env` novo). Conferir o `health`. Se a API não subir, a mensagem diz só o **nome** da variável que falta ou o formato inválido, nunca o valor.
4. **Cadastrar e verificar o webhook na Meta** (Parte 3). A Meta chama o `GET` na hora; "Verificar e salvar" tem de passar. Depois, assinar o campo `messages`.
5. **Salvar a conexão e os seis modelos** na tela `/treinador/whatsapp` (Parte 2.3). Cuidado: ver o aviso do teste abaixo.
6. **Fazer o teste da Parte 5.** Só depois, liberar aos alunos (cada um liga o interruptor dele).

**Quem faz o quê:** o Claude pode acompanhar o Gustavo passo a passo e conferir o resultado (saúde da API, tela da Meta, tela do app), mas **quem digita segredo é o Gustavo**: nenhum valor passa pelo chat. Nota: o item "Acesso do Claude à VPS" que o `AGENTS.md` deste repositório cita **não foi encontrado** no `AGENTS.md` da Central (`central-api-back`) nem em outro `.md` dela; o que existe de procedimento é o `deploy/README.md` (`gravar-segredo.sh`, `recriar.sh`, "só o dono executa"). Até o Gustavo apontar onde estão as regras, o Claude orienta e **não executa nada na VPS**.

## Parte 5. Teste com um aluno fictício (o número do Gustavo)

**Aviso importante:** assim que a conexão é salva na consultoria do Saraiva, o interruptor "Receber avisos pelo WhatsApp" **aparece para todos os alunos reais dele** (na Conta › Aparência e preferências, quando tem telefone). Ninguém recebe nada sem ligar o interruptor, mas a tela muda para todos. Onde fazer o teste (na consultoria do Saraiva ou numa de teste, com a conta e o número de quem testa) é decisão do Gustavo; o roteiro vale para qualquer uma.

Passos:
1. **Criar o aluno fictício** (nome fictício) e dar acesso a ele pelo cadastro do acesso, com o **telefone do Gustavo** (o telefone vem do usuário de acesso do aluno). Anote o telefone só no seu aparelho, nunca no repositório.
2. **Entrar como esse aluno**, em Conta › Aparência e preferências, e **ligar** "Receber avisos pelo WhatsApp". O interruptor só fica ligável com a conexão gravada e o telefone no cadastro.
3. **Conferir a conexão e os seis modelos** como Administrador na tela do WhatsApp: os seis devem estar **Aprovado**. Modelo "Em análise" ainda não envia.
4. **Compromisso:** na Agenda, **marcar** um compromisso futuro com o aluno e conferir a mensagem no WhatsApp do Gustavo (texto "foi marcado"); **remarcar** (a mensagem "foi remarcado"); **cancelar** ("foi cancelado"); **reabrir** o compromisso cancelado (vira "marcado" de novo). Observação do código: o aviso de compromisso reabre a linha da fila quando o fato se repete, então a mensagem deve sair de novo (`on conflict do update` em `WhatsAppRepositorio.enfileirar`); a revisão de 23/11 dizia que o aviso de compromisso reaberto não saía de novo, e nesta leitura não há como confirmar, só testando. Compromisso que já terminou não avisa.
5. **Lembrete de cobrança:** exige, na ordem: financeiro ligado (`TREINOS_PAGAMENTOS_HABILITADO`, conferir em produção); lembretes **ligados** em Financeiro › Lembretes (sem a configuração, ficam desligados); o aluno com **contratação ativa** e uma **mensalidade** aberta (a avulsa não envia); o aluno **sem ter desligado** os lembretes na Conta dele. O job roda **de hora em hora, das 9h às 20h de Brasília, no minuto 7** (e só uma mensagem por aluno por dia); o lembrete "no dia" só sai no dia do vencimento, então **crie a mensalidade com vencimento hoje** (ou ajuste o "dias antes" ou "dias depois" para cair hoje) e espere o próximo minuto 7 dentro da janela. A fila do WhatsApp enche **mesmo com o e-mail desligado**. Conferir: a mensagem no WhatsApp do Gustavo, com o primeiro nome, a consultoria, o valor e o dia/mês certos.
6. **Conferir ENVIADO, ENTREGUE e LIDO.** **Nenhuma tela do app mostra a situação por envio** (a tela do WhatsApp só mostra conexão e modelos; relatório de entrega está fora do escopo). Duas evidências: (a) o próprio celular do Gustavo (a mensagem chegou e, se abriu, os dois risquinhos azuis); (b) a **exportação de dados do aluno** (Ficha › Privacidade › Exportar, permissão `ALUNO_EXPORTAR`; conferir o nome do botão na tela), cuja seção `avisosPeloWhatsApp` traz, por envio, tipo, situação (`PENDENTE`, `ENVIADO`, `ENTREGUE`, `LIDO`, `FALHOU`, `CANCELADO`) e datas, sem texto nem telefone. Se continuar em `ENVIADO` depois de a mensagem chegar e ser lida, o webhook não está chegando: ver "Parte 3" (campo assinado, app secret do aplicativo certo).
7. **Desligar o interruptor** como esse aluno e repetir um compromisso: **nada** deve chegar; um aviso que já estava na fila fica `CANCELADO` (`OPT_IN_DESLIGADO`).
8. Opcional: **Desconectar** na tela, e conferir que os pendentes ficam `CANCELADO` (`CONEXAO_REMOVIDA`) e o interruptor some para os alunos.
9. **Limpar:** apagar ou anonimizar o aluno fictício e conferir que o histórico dele some com ele (anonimizar zera o aceite e cancela os pendentes).

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
Preparação na Meta (Gustavo e Saraiva)
- [ ] Aplicativo do tipo Empresa criado na conta do Saraiva; produto WhatsApp adicionado
- [ ] Número adicionado, confirmado, com nome de exibição aprovado
- [ ] Gustavo é administrador do aplicativo (ou os dois estão juntos para os segredos)
- [ ] Usuário do sistema criado, com o aplicativo e a conta do WhatsApp atribuídos
- [ ] Token permanente (sem validade) gerado com `whatsapp_business_messaging` e `whatsapp_business_management`, guardado no gerenciador de senhas
- [ ] `phone_number_id` e `waba_id` anotados (só no aparelho de quem faz)
- [ ] Seis modelos criados na categoria Utilidade, com as variáveis `{{1}}...` na ordem da Parte 2.2, enviados para análise
- [ ] Os seis modelos com situação Aprovado

Na VPS (Gustavo digita; snapshot antes)
- [ ] Chaves geradas (`openssl rand -base64 32`, formato `<id>:<base64>`) e verify token gerado (`openssl rand -hex 32`)
- [ ] `TREINOS_WHATSAPP_CHAVES`, `TREINOS_WHATSAPP_CHAVE_ATIVA`, `TREINOS_WHATSAPP_META_APP_SECRET` e `TREINOS_WHATSAPP_META_VERIFY_TOKEN` gravadas pelo `gravar-segredo.sh`
- [ ] `TREINOS_WHATSAPP_HABILITADO=true` gravada
- [ ] API recriada (`recriar.sh consultoria api`) e saudável
- [ ] `TREINOS_PAGAMENTOS_HABILITADO` conferida em produção (se o lembrete de cobrança será testado)
- [ ] Webhook cadastrado e **verificado** na Meta; campo `messages` assinado

No app
- [ ] Conexão salva na tela `/treinador/whatsapp`; seis modelos configurados e com selo Aprovado
- [ ] Decidido onde roda o teste (aviso: o interruptor aparece a todos os alunos da consultoria conectada)

Teste com o aluno fictício
- [ ] Aluno fictício com acesso e telefone do Gustavo; interruptor ligado por ele
- [ ] Compromisso marcado, remarcado, cancelado e reaberto chegaram ao WhatsApp
- [ ] Mensalidade com vencimento hoje e lembretes ligados: o lembrete chegou, com os quatro dados certos
- [ ] Entrega e leitura refletidas na seção `avisosPeloWhatsApp` da exportação (`ENVIADO`, `ENTREGUE`, `LIDO`)
- [ ] Interruptor desligado: nada mais chega
- [ ] (Opcional) Desconectar cancela pendentes e esconde o interruptor
- [ ] Aluno fictício apagado ou anonimizado

Antes de liberar aos alunos / antes do segundo treinador
- [ ] Gustavo decidiu liberar (cada aluno liga o dele)
- [ ] Pendência do Gustavo aberta: verificar a empresa na Meta e aprovar o aplicativo da plataforma (README dos planos)

## Fora do escopo
- Criar modelo na Meta pela API, cadastro embutido da Meta (Embedded Signup) e botão "enviar teste" (já fora no [plano do contato](contato-da-consultoria.md)).
- Resposta do aluno pelo WhatsApp e qualquer mensagem de texto livre (Nível 3, `whatsapp-atendimento.md`).
- Tela com a situação de cada envio (relatório de entrega).
- Ligar a chave em produção sem o ok do Gustavo; este roteiro não liga nada.

## O que ficou para trás
- **Como o treinador conecta a conta dele ao aplicativo da plataforma** (longo prazo, C19): a Meta costuma pedir um fluxo próprio para isso, e o cadastro embutido está fora do escopo. A conferir na documentação atual da Meta antes do segundo treinador, junto da verificação da empresa (pendência do Gustavo no README).
- **O app secret do Saraiva** é segredo dele: combinar como o Gustavo o acessa (administrador do aplicativo) sem passar por chat.
- Versão `v23.0` da Graph API fixa no código, e a lista de códigos passageiros escrita de memória (`MetaCliente`): conferir e trocar quando a Meta mudar.
- O item "Acesso do Claude à VPS" do `AGENTS.md` não existe no `AGENTS.md` da Central: o Gustavo aponta onde estão as regras ou o Claude segue só orientando.
- Aviso de compromisso reaberto: a revisão de 23/11 dizia que não sai de novo; o código desta leitura o reenfileira; confirmar no teste (passo 4 da Parte 5).
- Lembrete pelo WhatsApp só para mensalidade (a avulsa é cancelada na conferência), diferente do e-mail; o texto sugerido diz "mensalidade". Decidir se a avulsa deve ter modelo próprio é do Gustavo.
- Nada foi testado contra a Meta real: formato do JSON, permissões e campos do webhook estão conferidos só pelo código e por servidor de mentira (`MetaFalsa`).
