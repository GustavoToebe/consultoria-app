# Expo SDK 58

Situação: Planejando · Onde: — (branch própria quando começar) · Atualizado: 02/11/2026

## Objetivo
Subir o app do Expo SDK 57 para o 58 (React Native 0.88). É a correção de fundo dos avisos de segurança que hoje ficam
aceitos com validade no `.trivyignore` e no plano [dependabot-28-10.md](dependabot-28-10.md): o expo-router 58 não usa mais o
`query-string`, então o `decode-uri-component` sai do app, e as ferramentas do Expo trazem versões novas de `glob`,
`minimatch`, `uuid` e `zod`. Também mantém o app num SDK que as lojas aceitam.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Quando | Depois do teste com os 5 alunos ([teste-5-alunos.md](teste-5-alunos.md)): a atualização mexe em tudo que roda no celular e não pode se misturar com o retorno dos alunos | Gustavo, 02/11 |
| 2 | Onde | Branch própria saída da `main`, um PR só, sem outra mudança junto | Claude, 02/11 |
| 3 | Dependências | Só `npx expo install` (no PC: a rede da nuvem não alcança o servidor do Expo). O `@plataforma/web` segue fora disso, pela URL da Release | AGENTS.md |

## Passos
- [ ] 1. Ler as notas do SDK 58 e do React Native 0.88 e listar o que mexe no app: expo-router 58 (navegação, `+not-found`, parâmetros da rota, histórico das Folhas na web), Reanimated 4.7 e worklets 0.13, react-native-screens 4.30 ou 5, safe-area 5.11, expo-notifications, expo-sqlite, expo-image, expo-print e o módulo local `modules/excluir-do-backup`. Conferir também a versão de Node pedida (`app/.nvmrc`) e o Uniwind — commit: —
- [ ] 2. Branch nova; `npx expo install expo@^58 --fix` e `npx expo-doctor`; acertar o que quebrar no typecheck e no lint — commit: —
- [ ] 3. `npm test` inteiro e os e2e (`npm run e2e`), com atenção a navegação, Folhas e voltar do navegador (`ui/historicoDasFolhas`), guarda de saída e aluno offline — commit: —
- [ ] 4. `npx expo export --platform web` e `--platform android`; imagem web local com o `app/Dockerfile` (fotos do catálogo e CSP) — commit: —
- [ ] 5. APK de teste (`npx eas-cli build --profile preview --platform android`) e o roteiro de `docs/build-celular.md`; iPhone quando houver build — Gustavo
- [ ] 6. `npm audit` e `trivy fs` de novo: tirar do `.trivyignore` as exceções que deixaram de valer (`CVE-2026-118664` do `decode-uri-component`; `CVE-2023-54404` do `zod`, se o `@expo/cli` 58 já usa o zod 4.6.6) e fechar as decisões 3, 4, 11 e 12 do plano do Dependabot — commit: —
- [ ] 7. AGENTS.md (versões do Stack) e PR; merge e publicar só com o ok do Gustavo — commit/run: —

## Riscos
- Navegação na web: o histórico das Folhas e a guarda de saída dependem de como o expo-router regrava o `history`. São as partes mais sensíveis a mudança de versão.
- Animações: Reanimated e worklets mudam juntos; o React Compiler exige `.get()`/`.set()`.
- O celular só recebe a versão nova num APK/IPA novo; a web muda no publicar.

## Fora do escopo
- Funcionalidade nova junto com a atualização.
- Subir a API (Java/Spring), que segue a biblioteca `plataforma`.

## O que ficou para trás
- (nada ainda)
