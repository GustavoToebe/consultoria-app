# Entrada por público: `/aluno/entrar` e `/treinador/entrar`

Situação: Em andamento (só a etapa inicial; intermediária e avançada são propostas) · Onde: `main`, local, sem commit · Atualizado: 10/11/2026

## Objetivo
Cada público abre direto o formulário dele, sem escolher "Sou aluno" ou "Sou treinador", com título, texto e links próprios.
A entrada genérica `/entrar` continua para quem não recebeu um link específico. Formulário, lógica e estados são uma
implementação só (o `Entrar` de `app/src/app/entrar.tsx`), parametrizada pelo público.

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
- [ ] 1. Rotas: `/aluno/entrar` e `/treinador/entrar` abrem sem login (hoje `app/aluno/entrar.tsx` está sob o `GuardaDePapel` do layout do aluno e manda o anônimo de volta para `/entrar`); `/entrar` vira a escolha; o `GuardaDePapel` e o "Sair" mandam para a entrada do público certo; links antigos preservados — responsável: `executor-front` — commit: —
- [ ] 2. Textos, composição e posição dos links (D4, D5 e a ordem acima) em um `Entrar` só — `executor-front` — commit: —
- [ ] 3. Estados (lista acima) e aviso de entrada errada depois de autenticar (D6) — `executor-front` — commit: —
- [ ] 4. e2e (rotas, estados, entrada errada, teclado, preenchimento) e ajuste dos e2e que usavam o seletor "Sou aluno/Sou treinador" (`entrar-perfil`, `senha-provisoria`, `paginas-publicas`, `telas-publicas-erros`) — `executor-front` — commit: —
- [ ] 5. Conferência em 390, 768, 1280 e 1920, claro e escuro, de ambas as entradas, com teclado e preenchimento automático (sem salvar imagem); revisão independente dos pontos de D6 antes de declarar pronto — sessão principal + `advisor` — commit: —
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
- Nada implementado ainda. Validade: a leitura do código é de 10/11/2026 (`entrar.tsx`, `aluno/entrar.tsx`, `GuardaDePapel`).
