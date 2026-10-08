# Instruções para o Claude local: atualizar para a `main`, subir e deixar pronto para o Gustavo testar

Você está no PC do Gustavo (Windows, Docker Desktop). O objetivo é:
1. trocar para a `main` atualizada;
2. subir tudo no Docker;
3. deixar o app do celular rodando pelo Expo Go;
4. passar ao Gustavo o roteiro de teste da seção 6.

A demonstração para o Saraiva é no **domingo 11/10/2026 às 16:30**. Leia o `AGENTS.md` antes de mexer em qualquer coisa.
Os comandos abaixo funcionam no Git Bash, que é o shell do Claude Code no Windows. Os que só funcionam no PowerShell
estão marcados.

## 0. Regras desta tarefa

- **Não altere código.** Esta tarefa é só atualizar, subir e testar. Se algo quebrar, descreva o erro ao Gustavo
  (comando, saída, o que você acha que é) e pergunte antes de corrigir.
- **Nunca** mostre, copie ou commite o conteúdo do `.env`: ele tem as senhas. Para conferir se está completo, use o
  `docker compose config -q` (seção 3), que não imprime os valores.
- Não descarte alterações locais (`git reset --hard`, `git checkout -- .`, `git stash drop`, `git clean`) sem o
  Gustavo autorizar.
- Não rode `docker compose down -v` sem perguntar: ele apaga o banco local (volta ao seed de demonstração).
- Não faça `git push`, não crie branch nova e não abra PR.
- Não apague `backend/` nem `mobile/`: são o protótipo antigo e ficam como referência.

## 1. Conferir a pasta antes de trocar de branch

```bash
cd <pasta do Saraiva-api>        # normalmente Documents/Saraiva-api (OneDrive)
git status
git branch --show-current
```

- Se o `git status` mostrar arquivos alterados ou novos (fora o `.env`, que é ignorado), **pare** e mostre a lista ao
  Gustavo. Pergunte se pode guardar com `git stash push -u -m "antes da main 08/10"` ou se ele quer outra coisa.
- Se estiver limpo, siga em frente.

## 2. Trocar para a `main` e atualizar

```bash
git fetch origin
git switch main                      # se a main local não existir: git switch -c main --track origin/main
git pull --ff-only origin main
git log --oneline -3
```

- O topo da `main` precisa ser o commit `869894a` ("App: aba ativa só com sublinhado...") **ou mais novo**, e este
  arquivo precisa existir. Se o `pull --ff-only` recusar (a main local divergiu), pare e mostre o
  `git log --oneline main origin/main -5` ao Gustavo; não force nada.
- A `main` já tem tudo: catálogo TACO + exercícios em português, Parte A (acabamento e animações), Parte B (React
  Native Reusables com Uniwind) e Parte C (descanso, progresso da semana, números animados, esqueleto, folha com
  arraste).
- A etiqueta `demo-parte-a` guarda a versão anterior às partes B e C. Ela é o plano B (seção 8).

## 3. Conferir as ferramentas e o `.env`

```bash
docker version --format '{{.Server.Version}}'   # se der erro, o Docker Desktop não está aberto: pedir ao Gustavo
node -v                                         # esperado v24.21.0 (app/.nvmrc). Com nvm-windows: nvm use 24.21.0
ls .env                                         # se não existir: cp .env.example .env e pedir ao Gustavo os valores
docker compose config -q && echo ".env ok"
```

- O `docker compose config -q` falha com "defina POSTGRES_PASSWORD no .env" (ou `TREINOS_JWT_SEGREDO`, `DEMO_SENHA`)
  quando falta alguma variável obrigatória. Nesse caso, peça ao Gustavo para preencher; não invente senha por ele.
- `DEMO_SENHA` é a senha das 4 contas de demonstração (mínimo de 8 caracteres).

## 4. Subir no Docker

```bash
docker compose up -d --build
docker compose ps
```

- O `--build` é obrigatório desta vez: as dependências do app mudaram (Uniwind, Tailwind 4, `@rn-primitives/*`,
  `expo-haptics`) e a API ganhou as migrations V007/V008 do catálogo. A imagem da API compila com Maven e a da web roda
  `npm ci` + `expo export`, então a primeira vez demora alguns minutos.
- Espere `db` e `api` ficarem `healthy` e `web` ficar `running`. Depois confira:

```bash
curl -s http://localhost:8088/api/actuator/health     # esperado: {"status":"UP"...}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/   # esperado: 200
```

- **Banco já existente:** o Flyway aplica sozinho as migrations novas ao subir, e não há nada a fazer. Para o ensaio da
  demonstração, o README recomenda recomeçar do zero (`docker compose down -v && docker compose up -d --build`).
  **Pergunte ao Gustavo antes**, porque isso apaga o que ele cadastrou localmente.
- Se a API não ficar saudável, rode `docker compose logs api --tail 150` e mostre ao Gustavo só o erro (stack trace),
  sem colar variáveis de ambiente.

## 5. Subir o app no celular (Expo Go)

O celular e o PC precisam estar no **mesmo Wi-Fi**, e o Expo Go do celular precisa ser o do **SDK 57**.

```bash
ipconfig                       # anotar o IPv4 do Wi-Fi (ex.: 192.168.0.15)
cd app
npm ci                         # obrigatório: dependências novas
npx expo start
```

- O Gustavo lê o QR code com o Expo Go. O app acha a API sozinho em `http://IP-DO-PC:8088/api`. Se não achar
  (login fica girando ou dá "sem conexão"), pare o Metro e rode
  `EXPO_PUBLIC_API_URL=http://IP-DO-PC:8088/api npx expo start` com o IP anotado.
- **Firewall:** o celular precisa alcançar as portas 8088 (web/API) e 8081 (Metro). Se o Windows bloquear, peça ao
  Gustavo para rodar no **PowerShell como administrador** (você não deve abrir isso sozinho):
  `New-NetFirewallRule -DisplayName "Treinos demo" -Direction Inbound -Protocol TCP -LocalPort 8088,8081 -Action Allow -Profile Private`
- Rede que bloqueia aparelho com aparelho (empresa, hotel): use `npx expo start --tunnel`. A API continua precisando
  responder no IP do PC; se não der, teste o aluno pelo navegador do celular em `http://IP-DO-PC:8088`.
- A web também abre no navegador do celular em `http://IP-DO-PC:8088`, sem Expo Go.

Opcional, se o Gustavo pedir conferência automática (só leitura, não muda nada):

```bash
cd app && npm run typecheck && npm run lint && npm test     # esperado: 20 suítes, 110 testes passando
```

## 6. Roteiro de teste para passar ao Gustavo

Contas (senha de todas = `DEMO_SENHA` do `.env`): `saraiva@demo.local` (treinador), `aluno@demo.local` (aluno),
`exemplo@demo.local` (outro treinador, tema claro), `aluno2@demo.local` (aluno da outra consultoria).

### 6.1 O que **só dá para testar no celular** (ainda não foi testado em aparelho)

Teste com `aluno@demo.local` no Expo Go. Como hoje é quinta (dia Off no seed), abra pelos chips de data das divisões
(ex.: `05/10` da Segunda - Costas).

1. Marcar uma série: o botão afunda e volta com mola, e o celular **vibra leve**. Na **última** série do exercício,
   a vibração é de "sucesso". Desmarcar não vibra.
2. **Descanso manual:** na tela do exercício, botão "Descanso" → folha com 60/90/120/180 s → escolher 60 s. A barra
   aparece acima do menu inferior, com o anel diminuindo.
3. Com o descanso correndo: navegar para outro exercício e para a tela inicial. O tempo continua certo.
4. Mandar o app para o **segundo plano** por 20–30 s e voltar: o tempo descontou o período fora. Ao terminar, vibra
   (só com o app aberto; não há notificação com o app fechado, e isso é de propósito).
5. "+15 s", "−15 s" e "Pular" funcionam.
6. **Folha com arraste:** abrir a folha do "Descanso" e arrastar pelo **cabeçalho** para baixo. Arrastando pouco, ela
   volta; arrastando bastante, fecha. O "X" e o toque fora também fecham.
7. **Movimento reduzido:** ativar nas configurações de acessibilidade do celular ("Remover animações" no Android,
   "Reduzir movimento" no iPhone). As animações somem, e marcar série e o descanso continuam funcionando.
8. **Offline:** modo avião → marcar séries → selo "Sem conexão — salvo no aparelho" → fechar e abrir o app → tirar do
   modo avião → selo pisca "Enviando…" e fica "Sincronizado".
9. Tela inicial: o anel "N de 5 treinos" da semana sobe depois de marcar uma série num dia da semana atual.
10. Repetir rapidamente com o **tema claro** (Conta → tema) e com `aluno2@demo.local` (outra marca).

### 6.2 Roteiro completo da demonstração

Está no `README.md`, seção "Roteiro da demonstração" (itens 1 a 9: marca, editor de treino, publicar v2, replicar,
PDFs, offline no celular, cargas por divisão, isolamento entre consultorias, criar conta de treinador). Conferir
também:
- **Biblioteca → Catálogo:** busca sem acento (ex.: "feijao", "supino") e filtro por grupo.
- **Abas:** a ativa tem só o sublinhado na cor da marca, sem caixa em volta.
- **Confirmações:** Esc e "Cancelar" fecham, e o foco volta ao botão de origem.

### 6.3 Detalhes já conhecidos (não são erro de instalação)

- O descanso só começa **sozinho** quando o plano define o tempo de descanso da série. O plano de demonstração não
  define, então use o botão "Descanso".
- Embaixo de cada série aparece "Carga sugerida: X kg", repetindo o valor já preenchido no campo.
- "Sem registro há 7 dias" pode listar o aluno de demonstração, porque o histórico do seed termina em 30/09.

## 7. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `port is already allocated` na 8088 | Outro serviço usa a porta: `docker ps` e `netstat -ano \| findstr :8088`; mostrar ao Gustavo antes de parar qualquer coisa. |
| Login na web em `:8088` recusado (CORS/403) | Abrir pelo endereço exato `http://localhost:8088` ou `http://IP:8088`; conferir `APP_URL` no `.env` com o Gustavo. |
| Expo Go: "SDK incompatível" | Atualizar o Expo Go na loja (precisa do SDK 57). |
| Celular não conecta no Metro | Mesmo Wi-Fi? Firewall (seção 5)? Tentar `--tunnel`. |
| `npm ci` falha por versão do Node | `nvm use 24.21.0` (ou instalar essa versão) e repetir. |
| Tela branca na web depois de atualizar | Recarregar sem cache (Ctrl+Shift+R); se continuar, `docker compose logs web --tail 50`. |
| Build da API falha no Docker | `docker compose logs api` ou a saída do build; mostrar ao Gustavo. Não mexer no `Dockerfile`. |

## 8. Plano B: voltar para a versão sem as partes B e C

Só se o Gustavo decidir (por exemplo, se algo das partes B/C falhar no celular e não houver tempo de corrigir antes
de domingo):

```bash
git switch --detach demo-parte-a
docker compose up -d --build
cd app && npm ci && npx expo start
```

Para voltar depois: `git switch main`, depois `docker compose up -d --build` e `cd app && npm ci`.
Nada é apagado nessa troca.

## 9. O que relatar ao Gustavo no fim

- Commit em que a `main` ficou (`git log --oneline -1`) e se precisou guardar algo no stash.
- Estado do `docker compose ps` e resultado dos dois `curl` da seção 4.
- Endereço para o celular (`http://IP:8088`) e se o Expo Go abriu.
- Qualquer erro encontrado, com o comando e a saída (sem segredos).
- Depois do teste dele: a lista da seção 6.1 com ✅/❌ para cada item, para decidir entre seguir com a `main` ou
  usar o plano B.
