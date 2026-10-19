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

iOS (`--profile preview --platform ios`) exige conta paga no Apple Developer e que o iPhone esteja cadastrado
(`npx eas-cli device:create`); sem isso não há como instalar fora da loja.

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
   API, acrescente em `expo.ios.privacyManifests` e gere a build de novo.
7. **Revisão da loja**: a Apple e o Google pedem uma conta de teste (e-mail e senha de um aluno e de um treinador de demonstração).

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
