# Entrada por público: `/aluno/entrar` e `/treinador/entrar`

Situação: Etapa inicial feita (passos 1 a 5; commit `dd1c0120`); intermediária e avançada são propostas · Onde: `main` · Atualizado: 10/11/2026

## Objetivo
Cada público abre direto o formulário dele, sem escolher "Sou aluno" ou "Sou treinador", com título, texto e links próprios.
A entrada genérica `/entrar` continua para quem não recebeu um link específico. Formulário, lógica e estados são uma
implementação só (`app/src/ui/EntradaDoPublico.tsx`), parametrizada pelo público.

## Decisões (Gustavo, 10/11, pedido do guia de login)
| # | Decisão | Valor |
| --- | --- | --- |
| D1 | Endereços | `/aluno/entrar` e `/treinador/entrar` no mesmo domínio; sem subdomínio nem domínio próprio por ora |
| D2 | Quem entra pelo `/treinador/entrar` | Todo `TREINADOR` (dono e equipe, cada um com as permissões que o servidor já dá) |
| D3 | `/entrar` genérica | Duas opções (Área do aluno, Painel da consultoria); os links antigos (`/convite`, `/esqueci-senha`, `/cadastro`, `/redefinir-senha`) seguem funcionando |
| D4 | Textos | Aluno: "Entre na sua área de aluno" / "Acesse seus treinos, alimentação e acompanhamento." Treinador: "Acesse sua consultoria" / "Organize planejamentos e acompanhe seus alunos." Só se o recurso existir para o público (conferir) |
| D5 | Primeiro acesso | A frase "use a senha que seu treinador enviou" sai da entrada; a orientação mora no fluxo de convite. O convite depende de um link recebido: **não** se cria campo de código sem suporte na API |
| D6 | Papel e permissão | A URL só diz qual área a pessoa quer; o servidor decide o que a conta pode. Entrada errada: depois de autenticar, orienta e abre a área da conta; antes da autenticação nada revela se o e-mail existe nem o papel dele |
| D7 | Fora do escopo | Tudo da "Etapa intermediária" e da "Etapa avançada" (seção Propostas futuras abaixo) |

## Ordem do formulário (D4 e pedido 3)
Marca, título e descrição, e-mail, senha (mostrar/ocultar; "Esqueci minha senha" junto do campo), verificação de segurança
(se exigida), "Entrar", "Primeiro acesso? Ativar convite" (explica o link recebido), link para a entrada do outro público
("É treinador? Acessar painel da consultoria" / "É aluno? Acessar minha área"), privacidade e termos. Largura controlada;
rolagem natural em tela baixa. Só tokens e peças de `ui/` (`TelaPublica`, `Campo`, `CampoSenha`, `Botao`, `LinkTexto`).

## Estados a prever e conferir
Campo vazio ou inválido; envio em andamento (botão com indicação, sem envio duplo, Enter incluso); credencial inválida;
falha de conexão (preserva o e-mail e diz como tentar de novo); verificação pendente, expirada ou com erro (não trava o botão
para sempre); acesso concluído. Colar, preenchimento automático e gerenciador de senhas funcionam; o mostrar/ocultar senha
tem nome acessível e estado.

## Passos
- [x] 1. Rotas: `/aluno/entrar` e `/treinador/entrar` abrem sem login; `/entrar` vira a escolha; o `GuardaDePapel` e o "Sair" mandam para a entrada do público certo; links antigos preservados — responsável: `executor-front` — commit: `dd1c0120`
- [x] 2. Textos, composição e posição dos links (D4, D5 e a ordem acima) em um `Entrar` só — `executor-front` — commit: `dd1c0120`
- [x] 3. Estados (lista acima) e aviso de entrada errada depois de autenticar (D6) — `executor-front` — commit: `dd1c0120`
- [x] 4. e2e (rotas, estados, entrada errada, teclado, preenchimento) e ajuste dos e2e que usavam o seletor "Sou aluno/Sou treinador" — `executor-front` — commit: `dd1c0120`

### Registro dos passos 1 a 4 (`executor-front`, 10/11/2026, base `0bd5846f` + mudanças locais sem commit)
- **Causa confirmada (passo 1):** `app/aluno/entrar.tsx` ficava sob o `_layout` do aluno, que monta a `GuardaDePapel`: anônimo era mandado para `/entrar`. A tentativa de isentar a rota pelo `usePathname` no layout quebrou (a pilha da raiz mantém o layout de baixo montado e o `usePathname` é global: `/aluno/entrar` aberto a partir de `/treinador/entrar` renderizava tela do aluno sem o `AlunoProvider`). Solução: grupo de rotas `app/(entrada)/aluno/entrar.tsx` e `app/(entrada)/treinador/entrar.tsx` (o grupo não entra na URL e fica fora dos layouts guardados); os dois `_layout.tsx` não mudaram.
- **Feito:** `ui/EntradaDoPublico.tsx` (o formulário único, com MFA, "Crie sua senha", verificação humana e erros por campo; sem a escolha de perfil); textos e links em `dominio/entradaPorPublico.ts` (+ teste); `app/entrar.tsx` virou a escolha "Área do aluno"/"Painel da consultoria" (logado vai para a área dele); `GuardaDePapel` manda o anônimo para `entradaDoPublico(papel)`; `ConfirmarSaida` e `CartaoExcluirConta` voltam à entrada do papel; "Já tenho conta"/"Já sou aluno" de `convite`, `convite-equipe`, `cadastro` e `inscricao/[codigo]` apontam para a entrada do público; títulos das duas rotas em `dominio/telas.ts`. Envio: trava por ref (Enter duplo e clique não duplicam). Entrada errada: depois do login, aviso "Sua conta é do painel da consultoria/da área do aluno. Abrimos a área certa." e a área sai do papel da sessão (a URL não vai à API). `CampoSenha` (peça compartilhada, 11 usos): nome fixo "Mostrar senha" e o estado em `aria-pressed` (web) / `checked` (nativo). "Criar conta de treinador" só na entrada do treinador e só com `cadastroAberto`. Convite: `/convite` já tem o campo "Código do convite" com suporte na API, então nada novo foi criado (D5). D4 conferido: o aluno tem treino, dieta e atualização; o treinador tem o Planejamento.
- **e2e:** `e2e/entrada-por-publico.spec.ts` (novo, 21 casos: composição e ordem em 390/768/1280/1920 claro e escuro, sem rolagem horizontal, início e fim alcançáveis em 390×600, `/entrar` e links de troca com voltar do navegador, "Sair" do aluno, rotas protegidas sem login, envio sem duplicar, 401 e sem conexão preservando o e-mail, verificação que não carrega com "Tentar de novo", mostrar senha com `aria-pressed` e tipo, entrada errada nos dois sentidos, já logado); `entrar-perfil.spec.ts` apagado (a escolha de perfil saiu); `senha-provisoria` e `telas-publicas-erros` passaram a abrir `/aluno/entrar`.
- **Verificação:** `entrada-por-publico` 21/21 ✅; `senha-provisoria` + `telas-publicas-erros` + `paginas-publicas` 30/30 ✅; `npm run typecheck` ✅; `npm run lint` ✅ (11 avisos antigos, nenhum nos arquivos tocados); jest `entradaPorPublico`, `telas`, `catalogoDeComponentes` e `src/sessao` ✅. Capturas não foram salvas (pedido).
- **NÃO conferido:** app nativo (Android/iOS: `checked` no olho, WebView da verificação, teclado "próximo"); temas areia e contraste alto; web local real em `:8088` (só a API simulada do e2e); o `name` dos inputs (o RN-web não repassa; o preenchimento usa `autocomplete` e `type=password`); a suíte e2e inteira.
- **Validade:** refazer os e2e acima se mudarem `ui/EntradaDoPublico.tsx`, `app/entrar.tsx`, `app/(entrada)/*`, `ui/GuardaDePapel.tsx`, `ui/CampoSenha.tsx`, `ui/ConfirmarSaida.tsx`, `dominio/entradaPorPublico.ts` ou os layouts de `app/aluno` e `app/treinador`.
- [x] 5. Conferência e revisão independente dos pontos de D6 — sessão principal + `advisor` — commit: `dd1c0120` (código); este registro em commit de docs
  - **Conferido (10/11/2026, base `dd1c0120`):** suíte e2e inteira (1240 passaram; as 10 falhas são as mesmas de antes da entrada: `button`→`radio` em agenda, cores, unidade de carga, e o `?aba=` de `painel:187`; nenhuma de entrada); jest 6337 ✅; lint 0 erros; `mvn verify` ✅ (exit 0, compilando a árvore com edições de outra conversa em `importacao/assistida`); larguras 390/768/1280/1920, claro e escuro, pelos 21 casos de `entrada-por-publico.spec.ts`.
  - **Revisão independente (`advisor`, D6):** sem defeito bloqueante: a URL não vai ao corpo do login, o aviso de entrada errada só aparece depois de autenticar, o erro de credencial é o mesmo nas duas entradas, `ConfirmarSaida` lê o papel antes do `sair()` e `CartaoExcluirConta` fixa ALUNO.
  - **Não conferido:** app nativo (`checked` do olho, WebView da verificação, grupo `(entrada)` no build nativo); temas areia e contraste alto; API real em `:8088`; teclado e preenchimento automático reais (só `autocomplete`/`type=password` testados); as 10 falhas antigas continuam sem dono (troca mecânica `button`→`radio`; `painel:187`).
- Aceite: duas entradas claras, formulário consistente, fluxos existentes (convite, recuperação, senha provisória, MFA, verificação humana) preservados; nenhuma permissão sai da URL.

## Propostas futuras (não são recurso disponível nem condição da primeira entrega)
Registradas para decidir depois; nada abaixo está implementado nem aprovado.

### Etapa intermediária: primeiro acesso e continuidade
1. **Fluxo de convite**: separar "já tenho acesso", "recebi convite" e "esqueci a senha"; a ativação preserva a consultoria e o papel que o servidor autoriza; senha definida pela própria pessoa onde fizer sentido; convite expirado, usado ou inválido com mensagem e próxima ação específicas.
2. **Recuperação de senha com contexto**: quem começa pela área do aluno volta a ela, e o mesmo para o treinador; confirmação neutra ("Se houver uma conta correspondente, enviaremos as instruções"); conferir solicitação, link, validade, redefinição e retorno ao login.
3. **Retomar o destino depois do login**: guardar o destino de um link protegido e voltar a ele se a conta tem acesso; validar o destino (só caminhos internos) e tratar link inválido ou sem permissão.
4. **Turnstile menos visível**: avaliar o modo oficial que só mostra o desafio quando precisa; espaço e comportamento certos quando aparece; expiração, falha e nova tentativa sem travar o botão; a validação segue no servidor.
5. **Mais de um contexto**: se a mesma pessoa puder ser aluno e treinador ou estar em várias consultorias, escolher o contexto depois de autenticar, só com os autorizados. Hoje a conta tem um papel só: antes de propor, confirmar se esse cenário existe no produto.
6. **Medir dificuldades**: contadores operacionais (falha técnica de login, falha da verificação, problema na ativação de convite, abandono de etapa, uso do link de trocar de entrada), sem senha, token nem conteúdo sensível.

### Etapa avançada: personalização e recursos de acesso
1. **Entrada por consultoria**: `/c/<identificador>/aluno/entrar` com nome e logo da consultoria (logo já existe em `GET /publico/marcas/{id}/logo`), contraste garantido; a consultoria nunca é descoberta só pelo e-mail digitado.
2. **Subdomínios ou domínio próprio**: só com benefício concreto; antes, planejar sessão, cookies (`TREINOS_REFRESH` é de `/api/auth`), certificado, recuperação de senha, convites, redirecionamentos e a chave do Turnstile.
3. **Passkeys e mais MFA**: o MFA por aplicativo já existe para o treinador (`/eu/mfa`); passkeys pedem cadastro, uso, recuperação e perda do dispositivo, e prioridade a contas administrativas.
4. **Gerenciar sessões**: listar sessões e dispositivos que o sistema identifica com confiança; "Sair deste dispositivo" e "Encerrar outras sessões" (a API já encerra todas as sessões por `cv`; não lista nem encerra uma só).
5. **Troca de contexto dentro do produto**: seletor interno quando houver vários papéis ou consultorias, deixando claro qual está ativo e sem misturar dados.

## Fora do escopo desta frente
Mudar API, permissão, contrato de sessão, tokens ou temas; subdomínio; passkeys; gestão de sessões.

## O que ficou para trás
- Passo 5 (sessão principal + `advisor`): conferência visual com teclado e preenchimento automático e revisão independente de D6.
- Testar no Android/iPhone o olho da senha (`checked`) e o fluxo das duas entradas; temas areia e contraste alto.
