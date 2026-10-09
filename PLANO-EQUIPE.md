# Plano: equipe da consultoria (usuários, perfis e permissões) + auditoria

> Para o Sonnet ou o Codex executar **depois** do `PLANO-CHECKIN.md`. Se o check-in ainda não existir, pule as
> permissões `ATUALIZACAO_*`. Leia o `AGENTS.md` antes.
>
> Mesmo modelo do Servirea (`servirea-api-front/src/app/features/acesso`: catálogo de permissões por módulo, perfis com
> lista de permissões, perfil de sistema, usuários com convite, "Meu perfil"), adaptado à consultoria. Antes de
> reimplementar, leia lá como as telas de **Perfis** e **Usuários** e o "Meu perfil" foram feitos.
> Tudo local por enquanto: nada de servidor, e-mail ou cobrança.

## 0. Como trabalhar

1. **Ponto seguro:** `git switch main && git pull --ff-only origin main && git tag antes-equipe && git push origin antes-equipe`.
2. **Commits:** um commit por item (E1, E2…).
   - API: `mvn verify`.
   - App: `npm run typecheck && npm run lint && npm test`.
3. **Ao fim:** relatório da seção 9. Push só com autorização do Gustavo.
4. **A regra mais importante deste plano:** permissão é conferida **no servidor**, a cada requisição. A tela só esconde
   o que a pessoa não pode usar; esconder nunca é a proteção.

## 1. Decisões

- **Aluno não muda:** o papel `ALUNO` continua igual e só vê os próprios dados.
- **Equipe:** o papel `TREINADOR` passa a significar "membro da equipe". O que cada membro pode fazer vem do **perfil**
  dele (`usuario.perfil_id`), não do papel.
- **Formato das permissões:** `MODULO_ACAO`, como no Servirea (`USUARIO_ALTERAR`, `PESSOA_CUIDADOS_LER`).
- **Perfil de sistema "Administrador":**
  - `acesso_total = true`, não pode ser editado nem apagado;
  - a consultoria precisa ter **sempre pelo menos um administrador ativo**, e a API recusa o que deixaria zero: 409
    `ULTIMO_ADMINISTRADOR`.
- **Migração dos dados atuais:**
  - todo usuário `TREINADOR` existente vira **Administrador**;
  - quem cria uma consultoria nova (cadastro de treinador) também vira Administrador.
- **Perfis prontos** em toda consultoria nova e criados pela migration nas existentes: Administrador, Treinador,
  Nutricionista e Assistente (seção 3). São editáveis, menos o Administrador. A consultoria pode criar ou duplicar
  perfis.
- **Dado sensível exige permissão própria** (`*_SENSIVEL_LER`): lesões, peso, respostas da atualização e observações
  do aluno. O perfil Assistente vem **sem** essas permissões. É o princípio da LGPD de cada um ver só o que precisa.
- **Todos os alunos da consultoria são visíveis** para quem tem `ALUNO_LER`.
  - Existe o campo **"Treinador responsável"** no aluno, com o filtro "Meus alunos" nas listas e no painel.
  - **Limitar** cada um aos próprios alunos fica para depois (seção 8), porque mexe em toda consulta.
- **Sem permissão = 403 `PERMISSAO_NEGADA`. Recurso de outra consultoria continua 404.** Nunca confiar em permissão
  vinda do cliente ou do token: as permissões do usuário são lidas do banco a cada requisição, pelo perfil (com um cache
  curto, se precisar), e mudar o perfil vale na hora.

## 2. Catálogo de permissões

O catálogo fica fixo no código da API (`equipe/CatalogoPermissoes`) e é exposto em `GET /permissoes/catalogo` para a tela
montar as caixas por seção e módulo, como no Servirea.

| Seção | Módulo | Permissões |
|---|---|---|
| Início | Painel | `PAINEL_VER` |
| Alunos | Cadastro | `ALUNO_LER`, `ALUNO_ALTERAR` (criar, editar, inativar, responsável), `ALUNO_CONVITE` (gerar convite) |
| Alunos | Dados sensíveis | `ALUNO_SENSIVEL_LER` (observações, lesões, peso), `ALUNO_SENSIVEL_ALTERAR` |
| Alunos | Registros | `REGISTRO_LER` (cargas, histórico, PDF de cargas) |
| Planos | Pastas | `PASTA_ALTERAR` (criar, mudar período, replicar, finalizar) |
| Planos | Treino | `TREINO_LER`, `TREINO_ALTERAR` (rascunho), `TREINO_PUBLICAR` |
| Planos | Dieta | `DIETA_LER`, `DIETA_ALTERAR`, `DIETA_PUBLICAR` |
| Atualizações | Check-in | `ATUALIZACAO_LER` (inclui as respostas: exige também `ALUNO_SENSIVEL_LER`), `ATUALIZACAO_RESPONDER` (feedback) |
| Conteúdo | Biblioteca | `BIBLIOTECA_LER`, `BIBLIOTECA_ALTERAR` (exercícios, alimentos, importar CSV) |
| Conteúdo | Modelos | `MODELO_LER`, `MODELO_ALTERAR`, `MODELO_APLICAR` (aplicar ao aluno) |
| Consultoria | Marca e metodologia | `MARCA_ALTERAR`, `METODOLOGIA_ALTERAR` |
| Consultoria | Equipe | `EQUIPE_LER`, `USUARIO_ALTERAR` (convidar, editar, desativar), `PERFIL_ALTERAR` |
| Consultoria | Auditoria | `AUDITORIA_LER` |

**Dependências** (a tela marca sozinha e a API confere ao salvar o perfil):
- `*_ALTERAR` e `*_PUBLICAR` exigem o `*_LER` do mesmo módulo;
- `TREINO_PUBLICAR` e `DIETA_PUBLICAR` exigem `*_ALTERAR`;
- `ATUALIZACAO_RESPONDER` exige `ATUALIZACAO_LER`.

## 3. Perfis prontos

| Perfil | Permissões |
|---|---|
| **Administrador** (sistema) | Acesso total |
| **Treinador** | Tudo de Alunos, Planos, Atualizações e Conteúdo + `PAINEL_VER`. Sem Marca, Metodologia, Equipe e Auditoria |
| **Nutricionista** | `PAINEL_VER`, `ALUNO_LER`, `ALUNO_SENSIVEL_LER`, `REGISTRO_LER`, `TREINO_LER`, tudo de Dieta, `ATUALIZACAO_LER`, `ATUALIZACAO_RESPONDER`, `BIBLIOTECA_LER/ALTERAR`, `MODELO_LER/ALTERAR/APLICAR` |
| **Assistente** | `PAINEL_VER`, `ALUNO_LER`, `ALUNO_ALTERAR`, `ALUNO_CONVITE`, `TREINO_LER`, `DIETA_LER`, `BIBLIOTECA_LER`, `MODELO_LER`. **Sem dado sensível e sem respostas da atualização** |

## 3.1 Plano B (antes de executar)

O tag `antes-equipe` é o ponto de volta. Os perfis prontos são só dados: se algum não fizer sentido para o Saraiva, ele
edita ou apaga sem mexer no código.

## 4. API

### E1. Banco (migration nova: a próxima livre)

- **`perfil`** (`@TenantId`):
  - colunas: `id`, `consultoria_id`, `nome` (único na consultoria, sem diferenciar maiúsculas), `descricao`,
    `acesso_total bool`, `sistema bool`, `ativo`, `versao`, `criado_em`;
  - **`perfil_permissao`**: `perfil_id`, `codigo`, com primary key nas duas colunas.
- **`usuario`:**
  - `perfil_id uuid null references perfil` (obrigatório para `TREINADOR`, nulo para `ALUNO`: `check` na tabela);
  - `telefone varchar(20) null`.
- **`aluno`:** `responsavel_id uuid null references usuario`.
- **Migração:**
  - para cada consultoria: cria os 4 perfis da seção 3;
  - aponta todo `TREINADOR` existente para o Administrador;
  - em cada aluno, `responsavel_id` = o treinador mais antigo da consultoria.
- **Convite de equipe:** `usuario_convite` (`@TenantId`) com `id`, `consultoria_id`, `email`, `nome`, `perfil_id`,
  `codigo_hash`, `expira_em` (7 dias), `usado_em`, `criado_por`, `criado_em`.
  - Mesmo padrão do convite de aluno (`ConviteService`): o código aparece só uma vez, e gerar outro invalida o
    anterior.
- **`auditoria`** (`@TenantId`): `id`, `consultoria_id`, `usuario_id`, `acao varchar(60)`, `entidade varchar(40)`,
  `entidade_id uuid`, `resumo varchar(300)`, `ip varchar(45)`, `user_agent varchar(200)`, `criado_em`.
  - Índice `(consultoria_id, criado_em desc)`.
- Subir o total do `FlywayMigrationIntegrationTest`.

### E2. Autorização

- **`PermissoesDoUsuario`:**
  - lê as permissões do perfil do usuário autenticado (acesso total = todas);
  - expõe para o Spring como `GrantedAuthority` (`PERM_ALUNO_LER`…), junto com o papel;
  - **mudou o perfil ou a permissão, vale na próxima requisição**.
- **Rotas do treinador:** trocar cada `@PreAuthorize("hasRole('TREINADOR')")` pela permissão certa, por exemplo
  `hasAuthority('PERM_TREINO_PUBLICAR')`. Ler cada controller e escolher a permissão pela seção 2.
  - Rotas que leem dado sensível (lesões, peso, observações, respostas da atualização) exigem **também**
    `PERM_ALUNO_SENSIVEL_LER`.
  - Sem a permissão sensível, a ficha do aluno vem **sem esses campos** no DTO (não só escondidos na tela).
- **`ArquiteturaTest`:** nova regra para que toda rota fora de `/aluno/**`, `/auth/**`, `/publico/**` e `/actuator/**`
  use `hasAuthority('PERM_…')`, e não só `hasRole('TREINADOR')`. Exceção nova entra na lista com o porquê.
- **Erro:** 403 `PERMISSAO_NEGADA` com mensagem genérica, "Seu perfil não permite esta ação.".

### E3. Rotas da equipe

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /permissoes/catalogo` | `EQUIPE_LER` | Catálogo da seção 2 |
| `GET /perfis` | `EQUIPE_LER` | Perfis com contagem de usuários |
| `POST /perfis`, `PUT /perfis/{id}` | `PERFIL_ALTERAR` | Nome, descrição, permissões (confere dependências e códigos válidos); sistema → 409 `PERFIL_DE_SISTEMA` |
| `POST /perfis/{id}/duplicar` | `PERFIL_ALTERAR` | Cópia "Nome (cópia)" |
| `DELETE /perfis/{id}` | `PERFIL_ALTERAR` | Só sem usuários (409 `PERFIL_EM_USO`) e não sistema |
| `GET /usuarios` | `EQUIPE_LER` | Membros: nome, e-mail, perfil, ativo, "convite pendente", último acesso |
| `POST /usuarios/convites` | `USUARIO_ALTERAR` | `{nome, email, perfilId}` → código + link (7 dias). E-mail já usado → 409 |
| `PUT /usuarios/{id}` | `USUARIO_ALTERAR` | Nome, perfil, ativo. Desativar ou trocar perfil **sobe `credenciais_versao`** (derruba as sessões), como na troca de senha. Último admin → 409 `ULTIMO_ADMINISTRADOR` |
| `POST /publico/convites-equipe/{codigo}` | pública, com `LimiteTentativas` | Aceitar: define senha e cria o `usuario` `TREINADOR` com o perfil, na consultoria do convite. Mesmo cuidado transacional do convite de aluno (`TenantContext.executarComo`, transação dentro) |
| `GET /eu` (já existe) | autenticado | Passa a trazer `perfil` e `permissoes` (para a tela; o servidor continua conferindo) |
| `PUT /alunos/{id}/responsavel` | `ALUNO_ALTERAR` | `{usuarioId}` da mesma consultoria, ativo e `TREINADOR`, ou 404 |

### E4. Auditoria (`auditoria/Auditoria.registrar(...)`)

- Gravada **na mesma transação** da ação.
- `resumo` **sem dado sensível, senha, token, código de convite nem conteúdo** de lesão, peso, dieta ou resposta. Só o
  que aconteceu: "Publicou o treino 'Plano 17' v2", "Trocou o perfil de Fulano para Nutricionista".
- **Ações registradas:**
  - login com sucesso e bloqueio por excesso de tentativas;
  - convidar, editar, desativar e trocar perfil de usuário; criar, editar e apagar perfil;
  - criar, editar e inativar aluno; gerar convite de aluno; trocar responsável;
  - publicar treino e dieta; criar, replicar e finalizar pasta;
  - registrar ou alterar lesão e peso (sem os valores);
  - enviar e editar feedback de atualização;
  - alterar marca e metodologia;
  - importar CSV na biblioteca.
- **Tela:** `GET /auditoria?de=&ate=&usuarioId=&acao=` (`AUDITORIA_LER`), paginada (50 por página).
- **Retenção:** 1 ano, com uma limpeza diária pelo agendador simples do Spring (`@Scheduled`).
- **Bônus barato:** onde já existe `registrado_por` ou `criado_por`, mostrar o nome na tela ("Publicado por Fulano em
  dd/mm"). E no feedback da atualização, o aluno vê **quem** respondeu.

### E5. Testes da API

- Cada perfil pronto acessa só o que a seção 3 diz. Uma tabela de casos (rota × perfil → 200/403) num teste
  parametrizado.
- O Assistente **não** recebe lesões, peso, observações nem respostas: 403 nas rotas e campos ausentes no DTO da
  ficha.
- Trocar o perfil vale na hora; desativar derruba a sessão (refresh recusado).
- Último administrador: desativar, trocar perfil ou apagar → 409.
- Convite de equipe: aceitar uma vez; segunda vez, expirado ou código errado → 404 genérico; limite de tentativas.
- Outra consultoria: 404 em perfis, usuários, auditoria e responsável.
- A auditoria grava nas ações listadas, e nenhum `resumo` contém peso, texto de lesão ou de resposta (teste procura os
  valores fictícios usados no teste).
- `ArquiteturaTest` com a regra nova.

## 5. App (painel do treinador)

### E6. Menu e telas por permissão

- O `useSessao()` passa a ter `pode(codigo)`, lido de `GET /eu`.
- O **menu** esconde o que a pessoa não pode ver; botões de ação ("Publicar", "Novo aluno", "Editar marca") também.
- Tela aberta direto pela URL sem permissão: estado "Seu perfil não permite acessar esta tela.", sem erro vermelho.
- **Ficha do aluno sem `ALUNO_SENSIVEL_LER`:** os cartões Lesões, Peso e Observações **não aparecem**. É a regra "recurso
  que não existe não aparece".

### E7. Telas novas (copiar a estrutura do Servirea, com o visual do Saraiva)

- **Menu "Equipe"** (com `EQUIPE_LER`), em duas abas:
  - **Usuários:**
    - lista com nome, e-mail, perfil, selo Ativo/Inativo/Convite pendente e último acesso;
    - "+ Convidar membro" (folha com nome, e-mail e perfil → mostra código e link com copiar e compartilhar);
    - editar: perfil e ativo, com `PainelConfirmacao` ao desativar.
  - **Perfis:**
    - lista com o número de usuários;
    - editar: nome, descrição e as permissões em caixas **por seção**, com a explicação de cada uma, marcar a seção
      inteira e as dependências marcadas sozinhas;
    - selo "Dado sensível" nas permissões `*_SENSIVEL_*` e `ATUALIZACAO_LER`;
    - duplicar e apagar;
    - o Administrador aparece com "Acesso total · perfil do sistema", sem edição.
- **Aceitar convite de equipe:** página pública (como `/convite` do aluno) para definir a senha. Depois entra no painel.
- **Auditoria** (com `AUDITORIA_LER`): lista por data, com filtro por pessoa, ação e período.
- **Aluno:** campo "Treinador responsável" no cadastro e na ficha; filtro **"Meus alunos / Todos"** na lista e no
  painel. O padrão é "Meus alunos" para quem não é administrador.
- **Meu perfil** (já existe em Perfil): passa a mostrar o perfil e o telefone (opcional).

## 6. O que não fazer

- Não mudar nada do papel `ALUNO`, nem as rotas `/aluno/**`, nem o offline.
- Não confiar em `permissoes` do `/eu` ou do token para autorizar no servidor.
- Não gravar dado sensível na auditoria nem em log.
- Não limitar o aluno ao responsável (seção 8); por enquanto, só filtro.
- Não editar migrations antigas; nada de cobrança, limite de vagas nem e-mail (o convite é por link copiado ou
  compartilhado).
- Não apagar `backend/` ou `mobile/`. Não usar `alert()` ou `confirm()`.

## 7. AGENTS.md (atualizar junto)

- **Equipe:**
  - `TREINADOR` = membro, com o perfil em `usuario.perfil_id`;
  - permissões `MODULO_ACAO` (catálogo em `equipe/CatalogoPermissoes`) lidas do banco a cada requisição;
  - rota do treinador usa `hasAuthority('PERM_…')` (teste no `ArquiteturaTest`);
  - sem permissão = 403, outra consultoria = 404;
  - perfil Administrador do sistema, com pelo menos um ativo;
  - dado sensível exige `ALUNO_SENSIVEL_LER`, e o DTO omite os campos.
- **Auditoria:** `Auditoria.registrar` na mesma transação, sem dado sensível, retenção de 1 ano.
- **App:** `pode(codigo)` só para esconder; o menu e os cartões seguem as permissões.

## 8. Depois (não fazer agora)

- **Restringir cada membro aos próprios alunos:** perfil com escopo "Todos" ou "Só os atribuídos". Exige filtrar todas
  as consultas pelo responsável, com testes de isolamento como os de consultoria.
- **MFA (código de 6 dígitos)** para membros da equipe, copiando o da Central (`docs/mfa-operadores.md`,
  `biblioteca-comum`). Recomendado como obrigatório para Administrador quando houver dados reais.
- **E-mail do convite pelo Resend,** quando houver servidor.

## 9. Verificação

1. **Automático:** `mvn verify`, `npm run typecheck && npm run lint && npm test`, `npx expo export --platform web` e
   `--platform android`.
2. **Docker com o banco zerado:** `docker compose down -v && docker compose up -d --build` e reimportação do conteúdo.
3. **Na mão:**
   - [ ] `saraiva@demo.local` vê o menu Equipe, os 4 perfis e a si mesmo como Administrador;
   - [ ] convidar "Assistente Teste" (e-mail fictício) com o perfil Assistente, abrir o link numa janela anônima,
     definir a senha e entrar;
   - [ ] como assistente:
     - menu sem Marca, Equipe e Auditoria;
     - ficha do aluno sem Lesões, Peso e Observações;
     - "Publicar" não aparece;
     - abrir a URL do editor e tentar publicar pela API dá 403;
   - [ ] como Saraiva, trocar o assistente para Nutricionista: na próxima ação dele, a Dieta já pode ser publicada e o
     Treino é só leitura;
   - [ ] desativar o assistente derruba a sessão dele;
   - [ ] tentar desativar o único Administrador → mensagem de 409;
   - [ ] a Auditoria lista convite, aceite, troca de perfil, desativação e publicações, sem nenhum dado sensível no texto;
   - [ ] o filtro "Meus alunos" e o responsável funcionam;
   - [ ] `exemplo@demo.local` não vê nada da equipe do Saraiva (404).
4. **Roteiro da demonstração do README:** sem regressão.

**Relatório ao Gustavo:** a lista com ✅/❌, as tiradas de tela (Usuários, Perfis com as caixas de permissão, ficha vista
pelo Assistente, Auditoria) e o que ficou de fora.
