# Build do celular (EAS)

O app é um projeto Expo (SDK 57) só. A build do celular é feita na nuvem da Expo (EAS), com a **conta do Gustavo**.
Nada de segredo, token ou senha vai para o repositório: o login do EAS fica na máquina de quem roda o comando.

O que já está pronto no repositório:

- `app/eas.json` com três perfis. Os três usam a API de produção: `EXPO_PUBLIC_API_URL=https://consultoria.servirea.com.br/api`
  (é a variável que `app/src/api/cliente.ts` já lê; no celular ela entra na hora de montar o app).

  | Perfil | Para quê | Android | iOS |
  | --- | --- | --- | --- |
  | `development` | cliente de desenvolvimento (abre o app com o Metro do PC) | APK de desenvolvimento | build interna (precisa de aparelho cadastrado) |
  | `preview` | testar no celular de verdade | **APK**, instala direto | build interna (ad hoc) |
  | `production` | loja | **AAB** | build da loja (TestFlight / App Store) |

- `app/app.json` com os textos de câmera e fotos, `privacyManifests` do iOS e só as permissões que o app usa no Android.
  O iPhone tem a seção própria: [5. iPhone](#5-iphone).
- Ícone e abertura **provisórios** (letra T no fundo escuro do app). Ver "Antes da loja".

## 1. Primeira vez

Precisa de Node 24 (`app/.nvmrc`) e de uma conta gratuita em <https://expo.dev>.

```bash
cd app
npm ci
npx eas-cli login          # abre o navegador / pede e-mail e senha da conta Expo
npx eas-cli init           # cria o projeto no Expo e grava extra.eas.projectId no app.json
```

O `projectId` que o `init` grava no `app.json` **não é segredo**: pode (e deve) ser commitado. É a única mudança do
`init` no repositório. Se perguntar se deve criar o projeto `@sua-conta/treinos`, responda que sim.

## 2. APK para instalar no Android

```bash
cd app
npx eas-cli build --profile preview --platform android
```

- Na primeira vez o EAS oferece **gerar a keystore** do Android; aceite. Ela fica guardada nos servidores da Expo.
  Guarde uma cópia com `npx eas-cli credentials` (Android › Download existing keystore) num lugar seguro **fora do git**:
  sem ela não dá para atualizar um app já publicado com o mesmo certificado.
- Ao terminar (alguns minutos na fila gratuita), o comando mostra um link e um QR code. Abra no celular, baixe o `.apk` e
  instale (o Android pede para permitir "instalar apps desconhecidos" do navegador).
- O mesmo APK serve para quantos aparelhos quiser.

iPhone: não existe "APK" no iOS. O caminho para o piloto é o TestFlight; ver [5. iPhone](#5-iphone).

## 3. O que testar no celular

Use um aluno e um treinador de teste (dados fictícios). Marque cada item; anote o modelo do celular e a versão do Android.
Teste também num celular simples (pouca memória): abrir o app, trocar de aba e rolar a lista do dia não devem travar.

### Antes de começar
- [ ] Instalar o APK, abrir e ver a tela Entrar no tema do aparelho (claro ou escuro).
- [ ] No treinador (web), convidar o aluno de teste e abrir o link do convite no celular: o código some do endereço e o
  aceite cria a conta.

### Entrar e sessão
1. [ ] **Entrar, com e sem o Turnstile ligado.** O Turnstile é `TREINOS_TURNSTILE_HABILITADO` na API (`docs/turnstile.md`).
   - Desligado: entrar direto.
   - Ligado: o desafio aparece dentro do app (WebView), o botão só libera depois de resolver, e depois de cada envio o
     desafio renova. É o ponto que **nunca foi visto num aparelho**: conferir se o widget aparece inteiro, se não fica
     transparente nem cortado, se resolve de verdade e se o login passa. Se o widget não carregar, o login deve dar
     erro claro, nunca ficar travado. Conferir também o "esqueci a senha".
2. [ ] **Esqueci a senha** (com `TREINOS_EMAIL_HABILITADO=true`): pedir o link, abrir o e-mail no celular, trocar a senha e
   entrar com a nova.
3. [ ] **Passeio pelo menu** no primeiro acesso, logo depois de aceitar os termos: a tela escurece, cada item da barra de
   baixo fica em destaque, Pular/Anterior/Próximo funcionam e o balão não sai da tela (girar o celular também). Sair e
   entrar de novo não mostra outra vez; Ajuda › "Rever o passeio" mostra. Fazer com o aluno e com o treinador.
4. [ ] **Sessão derrubada sem perder treino**: registrar uma série sem internet, derrubar a sessão (entrar na web com a
   mesma conta e trocar a senha), voltar para a internet com o app aberto. O app volta para "Entrar"; ao entrar com o
   **mesmo aluno**, o treino registrado deve aparecer e ser enviado. Entrar com **outro** aluno não envia nada do primeiro.

### Treino do aluno
5. [ ] **Início:** cartão "Hoje" na cor da marca e, se houver dieta publicada, o cartão "Dieta" com as refeições e a água.
6. [ ] **Dia de treino:** a tela não apaga enquanto está aberta; −/+ da carga sobem e descem pelo arredondamento da
   metodologia; "Repetir a série anterior" copia carga e repetições; o descanso começa sozinho ao marcar a série (só se o
   treinador pôs "Descanso" no grupo) e vibra no fim.
7. [ ] **Andar fora de ordem:** "Próximo", "Anterior" e "Lista do dia" no rodapé, inclusive no último exercício.
8. [ ] **Cluster e rest pause:** o texto por extenso aparece antes das séries ("3 blocos de 2 repetições…").
9. [ ] **Registro offline e envio**: ligar o modo avião, registrar carga e repetições, fechar e abrir o app (os registros
   continuam), desligar o modo avião e conferir o selo de sincronização e o registro na ficha do treinador.
10. [ ] **Mobilidade:** a aba aparece só com mobilidade publicada; o vídeo abre fora do app.

### Fotos
11. [ ] **Foto de perfil:** Conta › Foto de perfil › "Escolher foto" (pede a permissão da galeria) e "Tirar foto" (pede a da
    câmera). A foto aparece na Conta, ao lado do "Olá" e na ficha do aluno no treinador. "Remover" pede confirmação e
    volta às iniciais. A foto **não** deve aparecer na galeria do celular. Sem internet: aviso de erro, nada trava.
12. [ ] **Fotos da atualização** (com `TREINOS_FOTOS_HABILITADO=true`): tirar uma foto, escolher da galeria, anexar sem
    internet e enviar depois. A foto não deve aparecer na galeria do celular; o treinador vê no detalhe da atualização.
13. [ ] **Negar as permissões** de câmera e galeria: o app avisa e segue funcionando.

### Atualização, PDF e avisos
14. [ ] **Atualização:** responder o questionário, sair no meio (o rascunho fica), voltar e enviar.
15. [ ] **Lembretes da atualização** (3 dias antes, no dia, 1 dia depois, às 9h): aceitar a permissão de notificações e
    conferir que chegam; negar a permissão e conferir que o app segue funcionando.
16. [ ] **PDF** (treino, dieta com a água, mobilidade, cargas): gerar e abrir o compartilhar do celular.

### Fim
17. [ ] Perfil › Preferências: tema claro/escuro, tamanho do texto e vibração.
18. [ ] **Sair da conta** com treino não enviado: o painel avisa "Você tem N treinos ainda não enviados".
19. [ ] Abrir o app sem internet depois de já ter entrado: o plano aparece (modo offline).
20. [ ] **Excluir minha conta** (só com um aluno de teste, que some de verdade): Conta › "Excluir minha conta". O botão
    final só libera com a senha e EXCLUIR; senha errada mostra o erro e nada muda. Ao confirmar, o app volta ao Entrar com
    "Conta excluída.", e o mesmo e-mail e senha não entram mais; na ficha, o treinador vê "Aluno anonimizado".

Qualquer erro: `npx eas-cli build:list` e o log da build no site da Expo; erro do app em execução, `adb logcat`.

## 4. O que muda para a loja

1. **Contas**: Google Play Console (Android) e Apple Developer Program (iOS). As duas são pagas e a Apple leva alguns dias
   para aprovar a conta.
2. **Identificador e nome: decidir antes da primeira build de loja.** Hoje o app usa `br.com.treinos.app` (Android e iOS).
   Depois de publicado, o identificador **não muda mais**. Proposta (a decisão é do Gustavo): nome na loja
   **"Treinos Servirea"** (sob o ícone, `expo.name`, pode ficar só "Treinos") e identificador **`br.com.servirea.treinos`**
   nas duas lojas, sob o domínio dele. Para trocar, edite `expo.ios.bundleIdentifier` e `expo.android.package` no
   `app/app.json` **antes** da primeira build de loja (o `preview` pode seguir com o atual). O esquema `treinos` não precisa mudar.
3. **Perfil `production`**:
   ```bash
   cd app
   npx eas-cli build --profile production --platform android   # gera o AAB
   npx eas-cli build --profile production --platform ios       # gera o IPA da loja
   ```
   O número da build sobe sozinho (`autoIncrement` com `appVersionSource: remote`). A versão visível ao usuário é o
   `expo.version` do `app.json`.
4. **Envio**: `npx eas-cli submit --platform android` e `--platform ios` (a primeira publicação no Google Play é feita à
   mão no console; depois o `submit` atualiza). Para o `submit` o EAS pede a chave de serviço do Google e a conta da Apple,
   também fora do git.
5. **Textos e fichas da loja** (a preencher nos consoles, não estão no repositório): descrição, capturas de tela, ícone
   final, política de privacidade e termos (os de `Termos.VERSAO` ainda são **rascunho** para revisão jurídica; a loja
   exige o endereço público da política), classificação etária, e as respostas de privacidade dos dados coletados
   (Apple "App Privacy" e Google "Data safety": o app guarda nome, e-mail, treino, dieta, peso e fotos de corpo da
   atualização, ligados à conta, para o funcionamento do serviço; nada de rastreamento nem anúncio).
6. **iOS**: `ITSAppUsesNonExemptEncryption=false` já está no `app.json` (o app só usa HTTPS do sistema). O
   `privacyManifests` declara `UserDefaults` e `FileTimestamp`; se a Apple avisar por e-mail que falta algum motivo de
   API, acrescente em `expo.ios.privacyManifests` e gere a build de novo. O resto (TestFlight, testadores, o que só a
   App Store pede) está em [5. iPhone](#5-iphone).
7. **Revisão da loja**: a Apple e o Google pedem uma conta de teste (e-mail e senha de um aluno e de um treinador de demonstração).

## 5. iPhone

Não precisa de Mac: o EAS compila na nuvem da Expo e manda para a Apple. Os passos com 🛑 só o Gustavo faz (conta,
senha, código de dois fatores, decisões); nada disso vai para o repositório nem para o chat.

### O que já está pronto no repositório

- **Identificador** `br.com.treinos.app` em `expo.ios.bundleIdentifier`, ainda **provisório** (ver 🛑 abaixo).
- **Só iPhone** (`supportsTablet: false`): no iPad o app abre em modo de compatibilidade, do tamanho de um iPhone, e a
  loja não pede capturas de iPad. Para atender iPad de verdade, mudar para `true` (e aí a Apple testa no iPad).
- **Permissões**: câmera e fotos com o texto do app (o plugin do `expo-image-picker`); sem microfone; sem Face ID
  (`faceIDPermission: false` no plugin do `expo-secure-store`: o app não usa biometria e o plugin punha um texto padrão em
  inglês, que a revisão da Apple costuma recusar). Os lembretes da atualização são notificações locais: não pedem chave
  no `Info.plist`, só a permissão na hora. O plugin do `expo-notifications` liga a capacidade de push
  (`aps-environment`) mesmo sem push; o EAS liga essa capacidade no identificador sozinho, sem chave de push nem custo.
- **Criptografia**: `ITSAppUsesNonExemptEncryption: false` (só o HTTPS do sistema), então o TestFlight não pergunta nada
  sobre exportação de criptografia.
- **Dado do aluno fora do backup do iCloud** (LGPD): o iOS manda a pasta `Documents` para o backup do iCloud. Ali ficam o
  banco do aluno (`Documents/SQLite`: plano, dieta, registros, rascunho da atualização) e as fotos da atualização ainda não
  enviadas (`Documents/fotos`). O módulo nativo local `app/modules/excluir-do-backup` (Swift, só iOS; o Expo não tem API
  para isso) marca as duas pastas como fora do backup (`isExcludedFromBackup`), pelo `app/src/offline/excluirDoBackup.ts`,
  depois de abrir o banco e de criar a pasta das fotos. O resto: o AsyncStorage (preferências, perfil salvo) a própria
  biblioteca já tira do backup; cache (PDFs, imagens) o iOS nunca copia; o refresh token fica no Keychain como "só deste
  aparelho" (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), então um backup restaurado noutro iPhone não leva a sessão. O Swift só
  compila na build do EAS (aqui não há Xcode): se a build falhar no passo "Install pods" ou "Build", o log aponta o
  arquivo.
- **Perfis do `eas.json`**: nenhum perfil novo. O TestFlight usa o `production` (é a mesma build que vai para a loja,
  com o número da build subindo sozinho); o `preview` no iOS é a distribuição ad hoc (só aparelhos cadastrados).

### 🛑 Antes da primeira build do iPhone

1. **Conta Apple Developer** (<https://developer.apple.com/programs/>): US$ 99 por ano, cobrados em reais. Pessoa física
   (o nome do Gustavo aparece como vendedor na loja) ou empresa (precisa do número D-U-N-S, que demora mais). O Apple ID
   precisa de autenticação de dois fatores. A aprovação leva de um a alguns dias. Depois, entrar no App Store Connect
   (<https://appstoreconnect.apple.com>) e aceitar os termos que aparecerem.
2. **Decidir o identificador** (item 2 de "O que muda para a loja"). No iPhone a decisão vem **antes do primeiro build
   para o TestFlight**: o app criado no App Store Connect fica preso ao identificador para sempre. Trocou, troque em
   `expo.ios.bundleIdentifier` (e `expo.android.package`, para ficarem iguais) e só então faça a build.
3. **Nome na loja**: precisa ser único na App Store inteira ("Treinos" sozinho dificilmente está livre). O nome sob o
   ícone (`expo.name`) pode continuar "Treinos".

### Primeira build e envio para o TestFlight

```bash
cd app
npx eas-cli build --profile production --platform ios
```

- 🛑 O EAS pede o login da Apple (Apple ID, senha e o código de dois fatores, digitados por ele no terminal). Com isso
  ele registra o identificador, cria o certificado de distribuição e o perfil de provisionamento e guarda tudo na Expo.
  Aceite as sugestões padrão. Nada disso vai para o repositório.
- Ao terminar (fila gratuita: de alguns minutos a mais de uma hora), envie para a Apple:

```bash
npx eas-cli submit --platform ios --latest
```

- 🛑 Na primeira vez o `submit` cria o app no App Store Connect (pergunta o nome da loja) e oferece criar e guardar na
  Expo uma chave de API do App Store Connect; aceite. Se baixar a chave (arquivo `.p8`), guarde fora do git (o `.gitignore`
  já recusa `*.p8`).
- A Apple processa a build (de 5 a 30 minutos) e manda um e-mail. Ela aparece em App Store Connect › o app › TestFlight.
- Da segunda vez em diante dá para fazer as duas coisas num comando:
  `npx eas-cli build --profile production --platform ios --auto-submit`.

### Testadores

| | Internos | Externos |
| --- | --- | --- |
| Quem | até 100 pessoas da equipe da conta no App Store Connect (Usuários e Acesso; qualquer papel) | até 10.000, por e-mail ou por um link público |
| Revisão da Apple | **não**: recebem assim que a build termina de processar | **sim** na primeira build de cada versão (revisão beta, em geral de horas a 2 dias); as builds seguintes da mesma versão normalmente passam direto |
| O que a revisão beta pede | — | descrição do que testar, e-mail de contato e uma **conta de demonstração** (e-mail e senha de um aluno e de um treinador fictícios) |
| Para quê | Gustavo, Saraiva e quem mais estiver na equipe | alunos do piloto |

- O testador instala o app **TestFlight** da App Store, abre o convite (e-mail ou link) e instala o Treinos por ele.
  Atualização nova chega pelo próprio TestFlight.
- Cada build do TestFlight vale **90 dias**; depois disso o app para de abrir até chegar uma build nova.
- Erro no app: o testador tira um print e usa "Enviar feedback" no TestFlight; as falhas (crashes) aparecem em App Store
  Connect › TestFlight › Falhas, sem precisar de Mac.

### Alternativa sem TestFlight: ad hoc (aparelhos cadastrados)

Serve para um teste rápido antes de abrir o TestFlight; para o piloto o TestFlight é melhor (não cadastra aparelho e
atualiza sozinho).

```bash
cd app
npx eas-cli device:create                              # gera um link/QR: abrir no iPhone e instalar o perfil
npx eas-cli build --profile preview --platform ios     # pergunta quais aparelhos entram
```

- O link de instalação abre no iPhone. No iOS 16 ou mais novo o iPhone pode pedir para ligar o **Modo de
  Desenvolvedor** (Ajustes › Privacidade e Segurança › Modo de Desenvolvedor, reinicia o aparelho).
- Aparelho cadastrado depois da build só instala numa build nova. A Apple limita a 100 iPhones por ano por conta.

### O que muda no roteiro de teste (seção 3) no iPhone

Use o mesmo roteiro, com estas diferenças. Anote o modelo do iPhone e a versão do iOS (Ajustes › Geral › Sobre).

- **Instalar**: pelo TestFlight (ou pelo link ad hoc), não por APK.
- **Turnstile (item 1)**: no iPhone o desafio roda num WKWebView com um iframe de `challenges.cloudflare.com`, o ponto que
  ainda não foi visto num aparelho. Conferir que o quadro aparece inteiro (nem transparente nem cortado), que resolve e
  que o botão libera; tocar em "Privacidade" ou "Termos" dentro do quadro não abre nada (bloqueado de propósito). Se ficar
  em "Verificando…" para sempre ou mostrar o erro com "Tentar de novo", anotar a versão do iOS e mandar print: sem Mac
  não dá para inspecionar o WebView.
- **Permissões (itens 11 a 13 e 15)**: o iOS pergunta **uma vez só**. Depois de negar, o app avisa e segue; para
  devolver a permissão é em Ajustes › Treinos. Na galeria o iOS oferece "Limitar acesso" (só algumas fotos): escolher
  foto tem de funcionar assim também.
- **Notificações (item 15)**: conferir os lembretes às 9h; ver também Ajustes › Notificações › Treinos. Modo Foco ou
  "Não perturbe" seguram o aviso.
- **Voltar**: o iPhone não tem botão físico; o voltar é arrastar da borda esquerda. Num editor com alteração não salva
  (treinador), arrastar para voltar tem de perguntar "Sair sem salvar?". Se voltar sem perguntar, anotar.
- **Teclado**: o teclado numérico do iPhone não tem tecla de confirmar. Conferir que dá para fechar o teclado (tocar fora)
  e chegar aos botões em carga, repetições, peso e nos campos do questionário.
- **Bordas da tela**: nada escondido atrás do entalhe/Dynamic Island nem da barra de gestos embaixo, na vertical.
- **PDF (item 16)**: abre a folha de compartilhar do iOS; "Salvar em Arquivos" deve funcionar.
- **Fotos (itens 11 e 12)**: a foto não aparece no app Fotos.
- **Backup do iCloud fora** (novo):
  1. Entrar como aluno, abrir o plano, registrar alguns treinos e, com a internet desligada, anexar 2 ou 3 fotos à
     atualização (ficam no aparelho).
  2. Com Wi-Fi, Ajustes › [seu nome] › iCloud › Backup do iCloud › **Fazer Backup Agora** e esperar terminar.
  3. Ajustes › [seu nome] › iCloud › Gerenciar Armazenamento (ou "Armazenamento da Conta") › Backups › este iPhone: na
     lista de apps, o **Treinos** deve aparecer com poucos KB (ou nem aparecer), não com o tamanho das fotos (centenas de
     KB cada). Se mostrar MB, o módulo não marcou as pastas: anotar e avisar.
- **Erro**: em vez do `adb logcat`, o "Enviar feedback" do TestFlight e as falhas no App Store Connect; o log da build está
  no site da Expo (`npx eas-cli build:list`).

### Antes da App Store (não precisa para o TestFlight interno)

- Tudo da seção 4 (textos, capturas de tela de iPhone, política de privacidade, "App Privacy", conta de demonstração).
- **Excluir a conta pelo app** (diretriz 5.1.1(v)): **atendido**. O aluno (quem cria conta ao aceitar o convite) tem
  Conta › "Excluir minha conta": pede a senha e a palavra EXCLUIR e apaga os dados pessoais na hora (a mesma anonimização
  que o treinador faz; `POST /aluno/conta/excluir`). Na revisão, se a Apple perguntar, o caminho é Conta › último cartão.
  O Google Play também pede, na "Data safety", um endereço na web para pedir a exclusão: a versão web do app
  (`https://consultoria.servirea.com.br`, entrar como aluno › Conta) faz o mesmo. A conta do **treinador** é da
  consultoria contratada pela Central e não se exclui pelo app (ele não cria conta pelo app: o cadastro público está fechado).
- Sem login social (Google etc.), então "Entrar com a Apple" não é exigido.

## Antes da loja: ícones

Os arquivos de `app/assets/images` são **provisórios**: uma letra "T" (fonte do título do app, Oswald Bold) em
`#F4F4F5` sobre `#0E0E10`. O app não tem marca própria (a marca é a de cada consultoria, carregada depois do login), então o
ícone final precisa ser decidido pelo Gustavo. Para trocar, substitua os arquivos mantendo os tamanhos:

| Arquivo | Tamanho | Regra |
| --- | --- | --- |
| `icon.png` | 1024×1024 | iOS e geral: **sem transparência** (RGB), cantos retos (o sistema arredonda) |
| `android-icon-foreground.png` | 1024×1024 | fundo transparente; o desenho fica no círculo central de ~66% |
| `android-icon-monochrome.png` | 1024×1024 | silhueta de uma cor sobre transparente (ícone temático do Android 13+) |
| `splash-icon.png` | 1024×1024 | desenho sobre transparente; o fundo `#0E0E10` e a largura (200) estão no plugin do `expo-splash-screen` |
| `favicon.png` | 48×48 | só a web |

O fundo do ícone adaptativo do Android é a cor `#0E0E10` (`android.adaptiveIcon.backgroundColor`).
