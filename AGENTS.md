# AGENTS.md — consultoria-app (plataforma de treinos e dieta)

Plataforma para **vários treinadores**, cada um com sua consultoria isolada, montarem treino e dieta dos alunos.
O aluno vê o plano e registra carga e repetições no celular ou na web, inclusive sem internet. O Saraiva
(Saraiva Team) é o primeiro treinador. Idioma do código, comentários, mensagens de erro, interface e commits:
**português**.

- Decisões de produto: monolito modular (uma API, um PostgreSQL, sem microsserviços); isolamento por `consultoria_id`
  com `@TenantId`; metodologia configurável por receitas e réplica do plano para o próximo ciclo; app único com a
  marca do treinador carregada depois do login; catálogo público importado para a biblioteca (`docs/catalogo.md`);
  o aluno vê o plano só leitura e registra carga e repetições, inclusive offline; PDF de treino e dieta; tema claro e
  escuro à escolha do usuário; um único app Expo (web, Android e iOS), com o papel vindo do login.
- Sem compatibilidade com o que é antigo: **até o primeiro cliente real**, nada precisa ser compatível com versões,
  formatos, dados, rotas, campos ou migrations antigas. Pode apagar, renomear e alterar; não crie código de transição
  nem leitura de formato velho. A regra deixa de valer quando o Gustavo disser que o primeiro cliente entrou.
- Padrões de segurança copiados da Central (`central-api-back`) e do Servirea (`servirea-api-front`,
  `destino-api.ts`). Ler o arquivo de lá antes de reimplementar algo equivalente.

## Manter este arquivo atualizado
Arquivo de instruções compartilhado entre ferramentas de IA; o `CLAUDE.md` só importa este (`@AGENTS.md`).
Edite **só aqui**. Mudança que invalida algo daqui atualiza este arquivo junto com a funcionalidade. Manter curto.

Trabalhar direto na `main` (decisão do Gustavo); não criar branch nova sem ele pedir. A tag `demo-parte-a` é o plano B da demonstração.

## Regras que não podem ser quebradas
- Um treinador **nunca** vê nem altera dado de outra consultoria; um aluno só vê os **próprios** dados. Toda leitura e
  escrita é autorizada no servidor; nunca confiar em id de consultoria ou aluno vindo do cliente. Recurso de outra
  consultoria responde 404.
- Isolamento por `consultoria_id` com `@TenantId` (Hibernate) preenchido do banco, nunca do token nem do corpo.
  `@TenantId` não protege SQL nativo: toda consulta nativa filtra `consultoria_id`/`aluno_id` explicitamente.
- Plano **publicado é imutável**: editar mexe só no rascunho; publicar cria versão nova. Registro do aluno aponta para
  a versão executada.
- Registro do aluno é **idempotente**: reenviar o mesmo registro não duplica.
- Peso, dieta, suplementação e observações são **dados sensíveis (LGPD)**: nunca em log, no git ou em outro serviço.
  Seed e testes só com dados fictícios.
- Segredos só em variável de ambiente, **sem valor padrão**. Nunca no git (`.env` ignorado; `.env.example` sem valores).
- O app anexa token e cookies **somente** à própria API (`destino-api.ts`). Link de vídeo abre fora do app, sem token.
- Nada de `alert()`, `confirm()` ou `Alert.alert`: confirmação é painel na tela.
- Não opinar nem calcular nada sobre saúde, suplementos ou protocolos. Não inventar carga, repetição ou valor
  nutricional: ausência de dado é "—". Recurso que não existe não aparece na tela.

## Stack
- `api/`: Java 21 · Spring Boot 4.1.1 · Hibernate 7 · Jackson 3 · PostgreSQL 17 · Flyway · Testcontainers · Maven.
  DTOs `record`, `ApiException` com `codigo`, `@Transactional` no service, `@PreAuthorize` em toda rota.
- `app/`: Expo SDK 57 (web, Android e iOS num app só, treinador e aluno), Expo Router, Node 24.21.0 (`app/.nvmrc`).
  Dependência só com `npx expo install`; React Native é o que o SDK fixa.
- Local: `docker-compose.yml` (Postgres + API + Caddy servindo a web em `:8088`, API em `/api`).

## API: convenções
- Equipe: `TREINADOR` é membro com perfil; autoridades `PERM_...` vêm do banco a cada requisição
  (`equipe/PermissoesDoUsuario`), nunca do JWT. Rotas de equipe declaram `hasAuthority` (ArchUnit).
  Dado sensível exige `ALUNO_SENSIVEL_LER`; a ficha omite objetivo e observações sem acesso. Escrita
  desses campos exige `ALUNO_SENSIVEL_ALTERAR`. O cadastro cria os quatro perfis na mesma transação
  por trigger da V018; o usuário nasce com Administrador obrigatório. Aluno continua sem perfil.
  `AcessoAtual.pode` nega sem usuário autenticado; o seed de demonstração roda dentro de `AcessoAtual.comoSistema` (só dados sensíveis). Só `SeedDemo` e `SeedHistoricoDemo` podem chamá-lo (regra do `ArquiteturaTest`).
  Administrador do sistema não pode ser editado/apagado; mutações de membros travam a consultoria
  para manter ao menos um administrador ativo. Trocar perfil ou desativar encerra sessões e sobe `cv`.
  Teto de permissões (`EquipeService.ator`/`exigirPodeAtribuir`, lido do banco): perfil criado, editado, duplicado ou
  atribuído cabe nas permissões de quem age; Administrador só administrador atribui; não administrador não mexe em
  administrador, no próprio perfil nem no perfil que usa (403 `PERMISSAO_NEGADA`).
  Convite de equipe tem hash, 7 dias e aceite único, com a transação dentro de `TenantContext.executarComo`.
  Convite vencido não trava a exclusão do perfil (a exclusão apaga os convites do perfil); `DELETE /usuarios/convites/{id}` cancela convite não aceito, com o mesmo teto de quem convida (404 se de outra consultoria ou já aceito; auditoria `CONVITE_EQUIPE_CANCELADO`).
  `/responsaveis` só lista id/nome dos membros ativos com `ALUNO_LER`; gestão completa exige `EQUIPE_LER`.
- Auditoria: `auditoria/Auditoria.registrar` usa resumos fixos, sem valores clínicos ou códigos.
  `@Auditar` roda dentro da transação (advisor 1, transação 0); `AuditoriaGravacao` usa JDBC com
  consultoria explícita porque o login começa global. A ação e seu evento sofrem o mesmo rollback.
  Retenção de um ano, limpeza diária; leitura paginada exige `AUDITORIA_LER`. No app a lista é `Tabela` (colunas a partir de 760 px, cartões abaixo) e os filtros Pessoa/Ação são `EscolhaEmFolha`.
  `/auditoria/pessoas` traz só id/nome para o filtro, com a mesma permissão, sem exigir gestão da equipe.
- `web/` erros (`ApiError` com `codigo`), `RequestIdFilter`, corpo até 1 MiB (`LimiteCorpoFilter`, 413 `CORPO_EXCEDIDO`).
- `security/` JWT de 15 min com `cv`; refresh opaco com rotação (reuso derruba todas as sessões); web = cookie
  `TREINOS_REFRESH` + CSRF `TREINOS-XSRF-TOKEN`, nativo = refresh no corpo (`X-Treinos-Cliente: nativo`).
- `tenant/` `TenantContext` preenchido só pelo `JwtAuthenticationFilter` (ou `TenantContext.executarComo` em rota
  pública/seed, com a transação aberta **dentro** do bloco). Sem contexto = UUID zero (leitura vazia, escrita falha).
- `auth/LimiteTentativas`: `login_tentativa` igual à V016 da Central (uma linha por chave). Login bloqueado grava `LOGIN_BLOQUEADO` só na tentativa que cruza o limite (uma linha por chave e janela), não em cada 429.
  No profile `test` os limites por IP são altos (a suíte toda sai de 127.0.0.1).
- Qualidade: Error Prone na compilação, `ArquiteturaTest` (`@TenantId`, `@PreAuthorize`, SQL nativo, Jackson 3) e
  JaCoCo ≥ 70% de linhas no `mvn verify`. Exceção nova entra na lista do teste com o porquê.
- Migration nova: subir o total em `FlywayMigrationIntegrationTest`. Coluna `char(n)` pede `@JdbcTypeCode(SqlTypes.CHAR)`.
- Rota pública que grava em tabela com `@TenantId` (cadastro de treinador, aceitar convite, seed) não abre transação no
  topo: cria o global numa transação e roda o resto em `TenantContext.executarComo(...)`, com a transação **dentro**.
  O convite descobre a consultoria pelo hash (`ConviteBusca`, SQL nativo mínimo) antes de entrar nela.
- Catálogo público (exercícios e alimentos) vem de `dados/fontes/` pelos scripts de `scripts/catalogo/`; o SQL gerado
  (`V007`, `V008`) não se edita à mão, e fonte nova ou corrigida = migration nova. Valor ausente nunca vira zero
  (`Tr`/`NA` → 0 com marca em `tracos`). A busca usa `nome_busca` (sem acento), calculada igual no Python e em
  `Buscas.semAcento`; teste: `python -m unittest scripts/catalogo/test_catalogo.py`.
- Suplementos e ergogênicos ficam na biblioteca (`/suplementos`, `/ergogenicos`) e são copiados para a dieta; link passa por `LinksExternos` (https). `ConteudoDieta.ergogenicos` sai nulo sem `ERGOGENICO_LER`, é preservado sem `ERGOGENICO_ALTERAR` e quando o corpo vem sem a lista (apagar = lista vazia), linha toda em branco não trava a publicação, não entra em modelo nem em cópia para outro aluno e nunca vai a log/auditoria (ganchos `paraLeitura`/`paraGravarRascunho`/`paraCopiaDeOutroAluno` do `PlanoServiceBase`).
- Aplicar modelo (`POST /receitas/{id}/aplicar`) exige `MODELO_APLICAR` + `ALUNO_LER` e, no serviço e antes de qualquer efeito, `TREINO_ALTERAR` (treino, sessão, mobilidade), `DIETA_ALTERAR` (dieta, refeição) ou as do que o pacote traz; salvar pasta como modelo exige também `TREINO_LER` e `DIETA_LER`. Sem `pastaId` o serviço cria pasta nova e exige também `PASTA_ALTERAR` (no app, `AplicarAoAluno` só oferece pastas existentes a quem não tem essa permissão).
- Planejamento no app: grupos (Treino, Dieta, Pacotes, Mobilidade = `GRUPOS_DE_MODELOS`) são `Abas`; os tipos do grupo, chips numa `FaixaDeChips`. Biblioteca: a aba do catálogo chama-se "Importar do catálogo".
- Questionários no app (`treinador/questionarios/`): aba **Atualização** do Planejamento (`?aba=atualizacao`; `?novo=1` abre o "novo" da aba ativa e sai do endereço na hora: é consumido ao abrir, para o voltar não ter passo sobrando). O Planejamento abre com `MODELO_LER` **ou** `QUESTIONARIO_LER` e cada aba só aparece a quem tem a permissão dela (sem `MODELO_LER` não busca modelos). O editor é `planejamento/questionario/[id]` (`QUESTIONARIO_LER`; sem `QUESTIONARIO_ALTERAR` ou arquivado, só a Prévia). `useQuestionarioEditor` tem a semântica do `usePlanoEditor` (nada salva sozinho, 409 `CONFLITO_EDICAO` → recarregar, publicar salva antes, 422 `QUESTIONARIO_INVALIDO` lista os problemas por pergunta). Regras puras em `dominio/editorQuestionario.ts` (fábricas, `paraApi` tira campo de outro tipo, limites e `podeAdicionar`/`podeDestacar` com `motivo`); o tipo de uma pergunta nunca muda no editor (remove e adiciona). FOTOS não se adiciona. Excluir pede confirmação e é recusado com envios (o app oferece arquivar); o padrão não se arquiva nem se exclui. Escolha do questionário: `treinador/questionarios/SeletorDeQuestionario` (opções de `GET /questionarios/opcoes`, só publicados e ativos; regras de texto em `dominio/seletorQuestionario.ts`) na ficha do aluno (`ALUNO_ALTERAR`, nulo = "Padrão da consultoria") e na folha da pasta aberta (`PASTA_ALTERAR`, nulo = "O do aluno", recarrega pastas e atualizações). Sem permissão é `CampoLeitura`; 403 nas opções esconde a linha; 409 `QUESTIONARIO_INDISPONIVEL` recarrega as opções. `AtualizacaoDaPasta` mostra "Questionário: {nome}" (o `Detalhe` traz o nome também da ABERTA, resolvido na hora). O nome é de trabalho do treinador: as rotas do aluno (`/aluno/atualizacao*` e o painel) mandam `questionarioNome` nulo (`Detalhe.paraAluno`).
- Modelos do Planejamento (`receitas/`): tipo `MOBILIDADE` (alongamento/mobilidade: seções com itens nome, prescrição em texto e
  vídeo) é modelo reutilizável e também "Aplicar ao aluno" (cria o plano de mobilidade na pasta). Pasta de plano pode ser finalizada
  (`POST /pastas/{id}/finalizar`, `concluida_em`); peso e observação opcionais vão para o registro de peso na mesma
  transação. Aluno tem `dias_atualizacao` (1 a 365): "Nova pasta" sugere início hoje e fim = início + dias - 1.
- Plano do aluno × modelo do Planejamento: o modelo é só o molde e aplicar cria uma cópia sem ligação. Os editores avisam isso (`plano/FaixaDoPlano`, textos em `dominio/planoDoAluno.ts`): título "Treino de <nome>" no aluno, "Modelo: <tipo>" no molde.
- Planos: treino e dieta compartilham `planos/PlanoServiceBase` (rascunho com lock otimista, validar, publicar versão
  imutável, replicar com uids novos). Erro de validação = 422 `PLANO_INVALIDO`/`CONFIRMAR_AVISOS` com a lista em
  `fieldErrors` (`field` = caminho no conteúdo).
- Mobilidade (`mobilidade/`): plano de mobilidade da pasta no padrão da dieta (`PlanoServiceBase`, rascunho + versão imutável, um ativo por aluno), em `/planos-mobilidade`, com as permissões do **treino** (`TREINO_LER/ALTERAR/PUBLICAR`; a Nutricionista também lê, pois tem `TREINO_LER`). Conteúdo = `receitas/ConteudoMobilidade` (mesmo do modelo `MOBILIDADE`); regras de publicação no `ValidadorMobilidade`. Auditoria: `MOBILIDADE_PUBLICADA`. Aluno: `GET /aluno/mobilidade` (404 sem plano publicado). Sem registro de execução e sem PDF.
- Pastas (`pastas/`): agrupam treinos, dietas e mobilidades do aluno e dão o período a todos. Plano criado/replicado com `pastaId`
  usa o período da pasta (o do corpo é ignorado, também ao salvar o rascunho); mudar a pasta altera o **rascunho** dos planos (publicado segue imutável);
  replicar a pasta copia todos. Pasta de outro aluno/consultoria = 404. A V011 moveu os planos anteriores à V009 para pastas (por aluno e período); a ficha não mostra mais “sem pasta”.
- Troca de plano do aluno: `GET /aluno/pastas` (pastas com plano **publicado**; status Ativa/Concluída vem de `concluida_em`; `atual` = pasta do plano vigente) e `GET /aluno/pastas/{id}` (treino e dieta publicados da pasta, 404 se de outro aluno ou só rascunho). Trocar só muda o que o aluno consulta, nunca o `ativo`; plano de outra pasta é só leitura no app (`AlunoProvider.escolhida`, `aluno/SeletorPlano`).
- Minha conta (`conta/`): permissão `CONTA_LER` (só o Administrador nos perfis padrão); `GET /minha-conta` (`MinhaContaDto` do contrato da Central, seção 6.3, mais `previa`; 404 `CONTA_NAO_ENCONTRADA`) e `GET /minha-conta/consumo` (uso real de alunos ativos e membros da equipe contra `direitos_locais.limites`; limite ausente = `SEM_LIMITE_CONFIGURADO`, nunca zero). Os dados vêm de `FonteDaConta` (hoje `FonteDaContaLocal`, tabelas V021 globais lidas por `ContaLocalRepositorio` com `consultoria_id` explícito, populadas por `SeedContaDemo`); a integração com a Central troca só essa fonte (o que falta e como trocar: `docs/integracao-central.md`). Só leitura, não bloqueia nada.
- Integração com a Central (`integracao/`, V026; guia e checklist: `docs/integracao-central.md`): desligada por padrão (`TREINOS_INTEGRACAO_ATIVA`); ligada, a API só sobe com chaves e URL completas (`ChavesDeIntegracao`). `/integracao/**` tem cadeia própria autenticada só por HMAC (`IntegracaoFiltro`, autoridade `PERM_INTEGRACAO` que nenhum usuário tem); todo controller novo ali segue a regra do `@PreAuthorize`. Provisionamento adota a consultoria pelo e-mail do administrador ou cria uma nova com convite (`usuario_convite.criado_por` nulo = convite do sistema; o link só vai na primeira resposta e nunca é gravado). Direitos: só versão maior altera, igual/menor só confirma. Bloqueio por direitos (`AcessoPorDireitos`) só com `TREINOS_INTEGRACAO_BLOQUEIO_ATIVO=true`, no login e a cada requisição. SQL nativo só em `IntegracaoRepositorio`, sempre com `consultoria_id` explícito (roda fora do `TenantContext`). Segredos de integração nunca em log nem no git. Teste: `IntegracaoCentralIntegrationTest` usa uma Central de mentira que confere a assinatura.
- Lesões (`lesoes/`): histórico estruturado do aluno, dado sensível (LGPD), só treinador; o sistema não interpreta.
- Atualização (`atualizacoes/`): uma por pasta, data no `fim` (a linha já gravada acompanha o `fim` da pasta enquanto ABERTA; enviada/revisada não muda), sem agendador; o questionário é da consultoria
  (`questionarios/`, V024: `questionario` com rascunho + `questionario_versao` imutável; o padrão nasce por trigger em `consultoria`,
  como os perfis da V018; `atualizacao_modelo` virou só a fábrica). Versão fixada no envio (`questionario_versao_id`); ABERTA, mesmo depois
  do "vou atrasar", resolve na hora pasta > aluno > padrão (`QuestionarioResolver`; arquivado ou sem versão publicada é ignorado). O envio leva
  `questionarioVersaoId`; respostas validadas pela versão. O peso só é gravado
  se o questionário tem pergunta `PESO` respondida. Estados ABERTA/ENVIADA/REVISADA; atraso calculado e "vou atrasar" só avisa. Envio grava peso
  na mesma transação; feedback editável.
  `RegrasAtualizacao` (igual a `dominio/atualizacao.ts`): abre pela data original, "atrasada" só após
  max(data, atrasoAte); nova data entre a data e +15 dias. Enviar/atraso levam `pastaId` (fora da vigente = 409
  `ATUALIZACAO_NAO_ATUAL`); reenvio do já enviado = 200 sem alterar (checado antes da pasta). Envio mantém a observação
  do peso; corrida no peso do dia = 409. "Visto" do feedback é UPDATE sem `versioned`. Dado sensível, sem log, 404 fora do dono e da consultoria. Fotos ainda não implementadas.
  Esquema do questionário (formato 2: `ConteudoQuestionario`, 11 tipos, `LimitesQuestionario`): regras de publicação em `ValidadorQuestionario` e de resposta em `ValidadorAtualizacao`, espelhadas em `dominio/questionario.ts` e `dominio/respostasAtualizacao.ts`; os dois lados leem as mesmas fixtures de `api/src/test/resources/paridade-questionario/`, geradas por `scripts/questionario/gerar-fixtures.mjs` (não editar à mão). Resposta de tipo desconhecido é erro. Respostas até 256 KiB. NUMERO (mínimo, máximo e resposta) fica em ±`NUMERO_ABSOLUTO` (1 bilhão); notas por dia `{}` contam como não respondidas.
  Atualização no app: o formulário (`QuestionarioAtualizacao`) renderiza os 11 tipos e o tipo desconhecido vira "Atualize o app para responder esta pergunta."; o texto de qualquer resposta (`false` e `0` contam) sai de `dominio/atualizacaoQuestionario.textoDaResposta`. O envio manda só `questionarioVersaoId` (obrigatório; id que não é o da versão vigente = 409 `MODELO_ATUALIZACAO_ALTERADO`). O rascunho do aparelho guarda o id da versão e `rascunhoVigente` o reconcilia com `respostasCompativeis`; o aviso "Seu treinador atualizou o questionário" só aparece com versões diferentes conhecidas ou resposta descartada. Todo 409 do envio salva o que está na tela (apaga o rascunho se já enviada) e recarrega com aviso neutro, exceto `PESO_JA_REGISTRADO`, que só mostra a mensagem. O Resumo do treinador (`treinador/ResumoDaAtualizacao`, `resumoDoTreinador`) usa a pergunta PESO e as de `destaque` do questionário, nunca ids fixos; "Média de N dias" e "Peso anterior" vêm do sistema (último peso antes do fim, de qualquer origem).
  Painel e listas (`GET /atualizacoes?situacao=&meus=`) saem de `AtualizacaoService.listar/contar` (uma consulta JPQL, `linhasDoPainel`; a fase vem de `RegrasAtualizacao`, não de SQL), com o mesmo filtro "Meus alunos" (`AlunoRepository.ativosDoEscopo`); o item da lista não leva modelo, respostas nem resumo (só o detalhe).
- Gestão dos questionários (`questionarios/QuestionarioService`, rotas `/questionarios`): permissões `QUESTIONARIO_LER` e `QUESTIONARIO_ALTERAR` (V025; publicar, duplicar, arquivar, excluir e definir o padrão ficam em ALTERAR; Treinador e Nutricionista têm as duas, o Assistente só LER). `GET /questionarios/opcoes` também abre com `ALUNO_ALTERAR`/`PASTA_ALTERAR`, para os seletores. Rascunho com `versao` (409 `CONFLITO_EDICAO`), não é auditado e aceita conteúdo incompleto (`obrigatoria` nulo vira false; acima de 256 KiB = 422 `QUESTIONARIO_GRANDE_DEMAIS`); publicar valida com o `ValidadorQuestionario` (422 `QUESTIONARIO_INVALIDO` com `fieldErrors`, `CONFIRMAR_AVISOS`) e recusa mudar o tipo de um id já publicado (caminho `...tipo`). Nome único entre os ativos (409 `QUESTIONARIO_NOME_EM_USO`); só um padrão (publicado e ativo; trocar desmarca o atual e dá `flush` antes). O padrão não se arquiva nem se exclui (409 `QUESTIONARIO_PADRAO`); excluir com envio apontando para alguma versão = 409 `QUESTIONARIO_EM_USO` (o app oferece arquivar); aluno e pasta que o escolheram voltam a nulo pela FK. Escolha em `PUT /alunos/{id}/questionario` e `PUT /pastas/{id}/questionario` (`{questionarioId|null}`; só publicado e não arquivado, senão 409 `QUESTIONARIO_INDISPONIVEL`); replicar a pasta não copia a escolha. Outra consultoria responde 404 em tudo. Definir padrão, arquivar e desarquivar são idempotentes (200) e só auditam quando mudam o estado (`Auditoria.registrarEvento`). Auditoria com resumos fixos (`QUESTIONARIO_*`, `ALUNO_QUESTIONARIO_ALTERADO`, `PASTA_QUESTIONARIO_ALTERADO`). Os espelhos manuais no app são `dominio/perfilEquipe.ts` e `treinador/equipe/acoesAuditoria.ts`.
- Histórico do aluno no app (`aluno/historico.tsx`): "Registros e cargas" usa o período da pasta em uso (a escolhida em `AlunoProvider.escolhida` ou a vigente; sem pasta com período ou sem conexão, últimos 30 dias) e traz o mesmo `CartaoProgresso` da ficha, sem `alunoId`, pela rota `GET /aluno/progresso?exercicioId=` (só ALUNO, sempre o da sessão).
- Histórico do aluno para o treinador (`GET /alunos/{id}/execucoes`): a `observacao` da série é dado sensível e sai nula sem `ALUNO_SENSIVEL_LER`; o aluno vê a própria.
- Execuções: `execucao_serie.serie_trabalho` e `exercicio_id` vêm da versão publicada, nunca
  do cliente. Gravação só pelo upsert do `ExecucaoUpsert`; registro ruim vira `RECUSADO` com motivo, sem derrubar o lote.

## App: convenções
- Minha conta (app): `app/treinador/minha-conta.tsx` com abas Cadastro / Meu plano / Financeiro e o cartão de consumo (peças em `treinador/conta/PartesDaConta`, regras de texto e selo em `dominio/minhaConta.ts`). Só consulta; `previa:true` mostra o aviso "Prévia"; 404 vira "Conta ainda não disponível". Item no menu do usuário e na busca só com `CONTA_LER` (`podeAcessarTela`).
- Barra de topo do treinador (`ui/BarraTopo`, só com o menu lateral, web ≥ 768 px; sem a linha da consultoria, que já está no menu): nome da tela, busca "O que você deseja fazer?" (`ui/BuscaGlobal`, Ctrl/Cmd+K), "Todas as telas" com favoritos (`treinos:<usuarioId>:favoritos`, apagados ao sair) e cartão do usuário (Meus dados, Ajustes, Sair; Minha conta com `CONTA_LER`). Teclado da barra (`ui/usoWeb.useTeclado`) escuta na captura, porque `TextInput`/`Pressable` do react-native-web param a propagação. Só na web (no tablet nativo o Perfil fica no menu lateral). Telas e ações da busca estão em `dominio/telas.ts` e seguem `podeAcessarTela`: **tela nova entra lá**. A busca não procura alunos pelo nome. `/treinador/perfil` fica só para o celular (barra inferior).
- Menu do treinador (`ui/Navegacao`): lateral a partir de `LARGURA_MENU_LATERAL` (768), só ícones (trilho) até `LARGURA_MENU_EXPANDIDO` (1024), expandido depois. Barra inferior do celular: Início, Alunos, Biblioteca, Planejamento, Perfil; Marca, Equipe, Ajuda e Auditoria são `soLateral` e no celular ficam em Perfil › Atalhos (`ItemDeLista`). Início ganha `ponto` quando há atualização para revisar (`painelTreinador`, só com `PAINEL_VER` + `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`). Barra do aluno: inferior sempre, limitada a 720 px no PC.
- Equipe: `useSessao().pode(codigo)` usa `/eu` só para apresentação; menu, ações e cartões seguem
  as permissões. `GuardaDePermissao` não monta telas sem acesso. A API continua autorizando pelo banco.
  Responsável é salvo junto ao cadastro (mesma transação); `meus=true` em `/alunos` e `/painel`
  filtra pelo usuário autenticado. É preferência de listagem, sem restringir acesso a outros alunos da consultoria.
- Rotas em `app/src/app/` (Expo Router). Áreas em pastas reais `treinador/` e `aluno/` (URLs `/treinador` e `/aluno`):
  grupos `(treinador)`/`(aluno)` colidiriam os dois `index` em `/`.
- `api/cliente.ts` é o único lugar que fala HTTP; `api/rotas.ts` tem uma função por rota. Credencial só vai para a
  própria API (`caminhoDaApi`). Web: access em memória + cookie; nativo: SecureStore (`sessao/armazenamentoSeguro.ts`,
  com `.web.ts` vazio). Nunca `localStorage` para token.
- Na web, o cookie XSRF é de sessão do navegador: antes do refresh o cliente faz `GET /actuator/health` para ganhar
  um novo. Sem conexão na abertura, a sessão abre offline com o último perfil salvo.
- Design: tokens em `tema/tokens.ts`; status com `Selo` (nunca a cor da marca); confirmação com `PainelConfirmacao`;
  aviso com `useAviso()` (erro fica até ser fechado); link de texto com `LinkTexto`. Fontes importadas por subcaminho (só os pesos usados).
  Marca como texto ou ícone usa `marcaTexto` do `useTema()` (`marcaParaTexto` escurece/clareia até 4,5:1 sobre o fundo), nunca `marca` direto; `marca` só em fundo com `sobreMarca`.
  Tela pública (entrar, cadastro, convites) segue o tema do aparelho; logado, o padrão é o da marca. Foco de teclado é o anel único `anelFoco` (`:focus-visible` no `global.css`).
  Peças compartilhadas: `ui/Tabela` (colunas a partir de `LARGURA_TABELA` 520, ou `larguraMinima`; abaixo vira cartões empilhados), `ui/ItemDeLista` (cartão inteiro é o toque, com seta), `ui/LinhaDeAcoes` (botões que quebram linha), `ui/FaixaDeChips` (chips numa linha que rola com esmaecimento; com `quebrar`, no PC viram linhas, porque rolagem horizontal com mouse parece corte), `ui/EscolhaEmFolha` (mais de `OPCOES_PARA_BUSCAR` = 8 opções: botão "Rótulo: valor" abre folha com busca), `ui/CampoLeitura` (rótulo + valor só leitura, "—" sem valor), `ui/CampoSenha` (`Campo` com o olho "Mostrar senha"/"Ocultar senha", alvo de 44 px; **todo campo de senha novo usa ele**, nunca `secureTextEntry` direto), `Estados` (`SemPermissao`, `Bloqueado`, `Incompleto`). Folha no PC tem `LARGURA_FOLHA` 600 (pasta usa `LARGURA_EDITOR`), semântica de diálogo e `KeyboardAvoidingView`. `Tela centrado` centraliza formulário curto (Entrar com altura ≥ 700).
  Acessibilidade: título da tela é `Texto nivel={1}` (um h1 por tela); `Abas` aceita `contagem`; alvo de toque mínimo `ALVO_TOQUE` 44 em chip, aba, link, ícone e trilha; fonte mínima 12.
- **Níveis:** fundo → `Cartao` (`superficie` + borda) → faixa `CabecalhoDeGrupo` e cabeçalho da `Tabela` (`superficie3`, para o título destacar) → item (`superficie2` + borda); campo
  = `campo` + `bordaCampo`; pressionado ou hover = `superficie3` (`ui/sobre`). 24 px entre blocos. `Tela` respeita `largura`
  (`LARGURA_EDITOR` 1040, `LARGURA_LISTA` 1800 = `LARGURA_MAXIMA`, aluno 720). Listas de itens usam `ui/Grade` (1 coluna abaixo de 760 px, 2 a partir de 760, 3 a partir de 1240, pela largura da própria grade; regra em `dominio/grade.ts`).
- **Tipografia** (`ui/tipografia.ts`, escala 12/13/14/15/16/24/28): `titulo` 24/30, `bloco` (título de cartão e folha), `rotulo`
  (campo); `secao` só subtítulo dentro de bloco. `Texto numerico` e campos numéricos usam números tabulares.
- **Botões:** um `primario` por área (Planejamento: "Novo modelo"; Folha da pasta: Finalizar/Reabrir; "Aplicar ao aluno" e "Editar" são secundários); botão não estica sem `cheio`;
  rótulo quebra em até 2 linhas; destrutivo = `perigoTexto` + `PainelConfirmacao`. Botão desabilitado leva `motivo` (texto curto do porquê, lido pelo leitor de tela) em vez de ficar mudo.
- **Seleção** é invertida (`texto`/`fundo`: `Escolha`, chips, calendário; `BotaoMarcar` desmarcado usa `bordaCampo`); a marca só em ação principal, menu e aba ativos,
  cartão "Hoje" do aluno e título.
- **Preferências pessoais** em `dominio/preferencias.ts` (AsyncStorage `treinos:<usuarioId>:preferencias`, um JSON): tema (consultoria/escuro/claro/sistema), contraste, tamanho do texto (o `Texto` e os campos
  multiplicam a fonte), animações, vibração e gráficos (`graficos`: desligado, Progresso por exercício e Peso mostram só as listas; interruptor em Perfil › Preferências e no cartão Progresso) e `barrasEscuras` (só web, padrão ligado: `color-scheme: dark` na raiz com o tema escuro, aplicado em `app/_layout.tsx`; o bloco de impressão fixa `color-scheme: light`). `useTema()` expõe `preferencias`, `fatorTexto` e `escolherPreferencia`. A marca
  da consultoria usa as paletas de `dominio/paletas.ts` (`avaliarMarca` bloqueia cor que não segura texto branco com 4,5:1).
  Fontes do nome: PADRAO, METAL, ESPORTIVA, CONDENSADA (migration V016).
  Movimento usa Reanimated 4 com `sv.get()`/`sv.set()` (React Compiler) e `useMovimentoReduzido`; vibração só pelo `ui/vibrar` (sem chamadas na web).
- Lint do React 19 recusa `setState` síncrono dentro de `useEffect`: atualizar estado só em callback de promessa.
  Dados de tela com `ui/useCarregar` (chave → busca; `definir` depois de alterar). Painel lateral/folha: `ui/Folha`. A `Folha` é um `Modal`: diálogo aberto dentro dela renderiza no `PortalHost` da própria folha (`usePortalDaFolha`; `PainelConfirmacao` já faz isso), senão fica atrás e o toque não chega. Na web o `hostName` do primitivo é ignorado: o contexto também traz o `elemento` da folha, passado como `container`.
- Voltar (web e botão físico): aba **de tela** (Planejamento `?aba=treino|dieta|pacotes|mobilidade|atualizacao`, Biblioteca `?aba=`, Atualizações `?situacao=`, Minha conta `?aba=`) mora no endereço e trocar de aba é `router.push` com o parâmetro (nunca `setParams`, que não cria passo), então o voltar a desfaz; o parâmetro novo de uma tela entra na própria tela (`abaDoPlanejamento`, `abaInicial`). Visão dentro de cartão (Lista/Gráfico, Editar/Prévia, abas do aluno) continua estado local. `ui/Folha` entra no histórico do navegador (`ui/historicoDasFolhas`, só web; regras em `dominio/historicoDasFolhas`): cada Folha aberta ocupa uma entrada marcada com `folhaNivel`, o voltar fecha só a Folha, e fechar pelo X volta a entrada. Se uma Folha navega para outra tela sem fechar ("Criar e editar"), a entrada dela fica no histórico e o voltar que cai nela é pulado na hora (`sobrando` em `ui/historicoDasFolhas`, por `id` de tela; o expo-router reescreve o estado dessa entrada ao voltar, então a marca `folhaNivel` não serve para reconhecê-la). Pelo mesmo motivo `ui/historicoDasFolhas` embrulha `history.replaceState` para manter o `folhaNivel` quando o expo-router regrava a mesma tela (sem isso, fechar uma Folha aninhada derrubava a de baixo). Medido: editor → Planejamento → Alunos em 2 voltas ("Criar e editar", com `history.back` e com a seta Voltar); ficha após "Aplicar ao aluno" (Folha dentro de Folha) também em 2; com duas Folhas abertas o voltar do navegador fecha uma por vez. O botão avançar do navegador sobre uma entrada de Folha que já fechou só tira a marca dela (um avançar sem efeito, nunca preso). O "Sair sem salvar?" da `GuardaDeSaida` aparece dentro da Folha do topo (`portalDaFolhaDoTopo`). **Conhecido:** o voltar do *navegador* com alteração pendente num editor sai sem perguntar (só a seta e o botão físico passam por `beforeRemove`).
- Menu ⋯ da pasta: "Salvar como pacote" só com as permissões da rota (`dominio/modelos.podeSalvarPastaComoModelo`: MODELO_ALTERAR, ALUNO_LER, TREINO_LER, DIETA_LER); sem nenhuma ação o ⋯ some.
- Pastas: `src/app/` só rotas; peças das telas do treinador em `src/treinador/`; regras puras (com teste) em
  `src/dominio/` (formatos BR, agrupamento "3x3 - FS", operações do editor, contas da dieta). `novoUid()` em todo item novo.
- Metodologia (`ConfiguracaoConsultoria`, modelo `METODOLOGIA`, cópia em `ConteudoTreino.metodologia`): além de tipos, trabalho/preparação, regra de % e arredondamento, tem `repeticoes` (faixa mín./máx. por tipo, opcional; ausente = sem faixa). O editor preenche a faixa ao criar a série e ao trocar o tipo do grupo (`dominio/editorTreino.repeticoesDoTipo`); depois tudo é editável. Validação em `MarcaService.validar`.
- Editor de treino: uma sessão por vez (`SeletorDeSessoes`, chips que quebram linha no PC), "Abrir/Fechar todos" os exercícios e os modelos numa `Folha` "Modelos"; dieta: refeições em
  `CabecalhoDeGrupo`, recolhidas por padrão. Configuração do plano (título, período, metodologia) é um cartão recolhível.
- Editores de plano: `treinador/plano/usePlanoEditor` (**nada é salvo sozinho**: "Salvar rascunho" no `TopoPlano`, "Salvar modelo" no `TopoModelo`;
  Validar e Publicar salvam antes; 409 → recarregar, validar e publicar com erros/avisos da API). Mudança grande (receita, remoção) passa pelo `BarraDesfazer`.
  Sair com alteração pendente passa pela `ui/GuardaDeSaida` (provider no layout do treinador): a tela chama `useGuardaDeSaida(pendente)` (o hook do editor e o
  `EditorModelo` já chamam) e quem navega (`Navegacao`, `BuscaGlobal`, `TodasAsTelas`, `CartaoDoUsuario`, voltar e trilha do `Cabecalho`) embrulha em
  `confirmar` da `useSaidaGuardada`; `beforeRemove` cobre o botão físico e a seta, e a web avisa no `beforeunload`. Tela nova com estado não salvo entra nesse esquema.
- Verificar: `npm run typecheck && npm run lint && npm test`; bundle nativo com `npx expo export --platform android`.
- Atrás do Caddy o Tomcat recebe `X-Forwarded-Port` (porta do `Host`): sem isso a web em `:8088` parecia outra origem
  e o CORS recusava o login.

- Aluno offline: `offline/AlunoProvider` (pacote salvo, registros, gatilhos de envio) sobre a interface
  `RepositorioLocal` (uma operação por vez) e `Sincronizador`. `abrirRepositorio` escolhe: celular =
  `RepositorioSqlite` (expo-sqlite, um banco `treinos-<usuarioId>.db` por usuário, esquema versionado por
  `user_version` em `offline/banco.ts`: versão nova = bloco novo, nunca editar o v1);
  web = `RepositorioChaveValor` (prefixo `treinos:<usuarioId>:`). Mudou o contrato? A bateria do `offline.test.ts`
  roda nas duas (SQLite do Node em `bancoNode.apoioTeste.ts`, nunca importado pelo app). Série marcada grava no aparelho na hora;
  a carga sugerida vem de `dominio/cargas.ts` (seção 8) e o que o aluno digita é gravado como digitou.
- Mobilidade do aluno: aba "Mobilidade" (antes do Histórico) só com mobilidade publicada; o `AlunoProvider` guarda a última vista no `RepositorioLocal` (documento `kv` `mobilidade`, sem mudar `VERSAO_ESQUEMA`) e limpa no 404. Tela só de consulta; vídeo abre fora do app.
- Telas do aluno no estilo do protótipo: cartão "Hoje · <tipo da sessão>" na cor da marca (`CartaoHoje`; sem sessão ou sem exercício é cartão neutro, "Nada para registrar hoje."), divisões com chips de data do período
  (`datasDaSessao`; registro até 60 dias para trás ou para frente, `podeRegistrarEm`), dia em `sessao/[uid]?data=` e um
  exercício por tela em `sessao/[uid]/[exercicio]` (`aluno/useSessaoDoDia`). Nome da sessão com `nomeComDia`. Dieta sem total
  (valor nulo) mostra `Incompleto`; atualização antes da data mostra `Bloqueado` com "Disponível a partir de".
- Cargas por divisão (`dominio/relatorio.ts` + `treinador/CargasPorDivisao`) no histórico do aluno e na ficha do
  treinador; o mesmo dado sai no PDF de cargas (`pdf/pdfCargas.ts`).

- Ficha do aluno (treinador): `CartaoPastas` (lista com a situação da atualização de cada pasta; tocar abre a `Folha` larga
  — `largura={LARGURA_EDITOR}` — com o menu ⋯ no topo (`Folha.acaoNoTopo`, ao lado do X), as ações, o cartão `AtualizacaoDaPasta` logo abaixo delas,
  `CartaoPlanos` de treino, dieta e mobilidade (estado vazio sem botão "Novo…": só o do cabeçalho) e `CartaoRegistros` só com o período e os treinos
  da pasta), `CartaoLesoes`, `CartaoProgresso` e `CartaoPeso` (lista ou `GraficoLinha`, SVG sem biblioteca). Registros
  não ficam mais soltos na ficha. "Progresso por exercício" fica na ficha (fora da pasta), com o histórico de todas as
  pastas e seleção múltipla de exercícios numa `Folha` (a lista vem do último ano; no máximo `LIMITE_PROGRESSO` = 10 marcados, regra em `dominio/selecaoMultipla.ts`); filtra por grupo muscular (`ExercicioFeito.grupoMuscular`, da
  biblioteca; nulo fora dela = "Sem grupo") e exercício (`dominio/relatorio.opcoesDeProgresso`), com busca sem acento na folha. Cada exercício marcado é um bloco
  (`ProgressoDoExercicio`: resumo do primeiro e do último registro com carga, `GraficoLinha` com 2 pontos ou mais, 5 datas mais recentes e "Ver todos"); regras em `dominio/progresso.ts`, sem cálculo novo.
- PDFs: `pdf/pdfTreino.ts`/`pdfDieta.ts` montam HTML (todo texto com `esc()`); `pdf/imprimir.ts` no celular gera o
  arquivo e abre o compartilhar; `imprimir.web.ts` usa um bloco só de impressão na própria página + `window.print()`
  (a CSP tem `frame-src 'none'`, então nada de iframe). Logo entra como data URI (`pdf/logo.ts`).

- Ajuda: `app/src/ajuda/conteudo.ts` é o texto único (primeiros passos, tutorial guiado, seções, perguntas) das telas
  `/treinador/ajuda` e `/aluno/ajuda` e dos PDFs `app/public/guias/*.pdf` (web serve em `/guias/`). Mudou funcionalidade
  que o guia descreve? Edite o `conteudo.ts` e rode `node scripts/guias/gerar.mjs` (precisa de Edge/Chrome), versionando os PDFs.
- `ui/RolagemComTopo` (usado por `Tela` e `Folha`) mostra o botão "voltar ao início da página" depois de 400 px de rolagem. Lema da marca saiu da interface e do PDF
  (o campo saiu da tela; salvar a Marca mantém o lema que já estava gravado). Marca aparece a quem tem `MARCA_ALTERAR` (nos perfis
  padrão, só o Administrador); tema claro/escuro é preferência pessoal em Perfil, para qualquer um.

## Onde está cada coisa
- `api/` — backend novo. `app/` — app Expo novo.
- `docs/` — `integracao-central.md` (integração com a Central) e `catalogo.md` (catálogo público). Planilhas e CSVs
  de treino não ficam no git.

## Comandos
- API: `cd api && mvn verify` (precisa de Docker para o Testcontainers). Maven usa o JDK do `JAVA_HOME` (21).
- App: `cd app && npm run typecheck && npm run lint && npm test`; `npx expo install --check` e `npx expo-doctor`.
- Tudo local: `cp .env.example .env` (preencher), `docker compose up -d --build`, abrir `http://localhost:8088`.
- Base de estilo: Uniwind 1.12.2 + Tailwind 4, sem preset de Babel; Metro estende `getDefaultConfig` do Expo.
  RNR copiado em `app/src/components/ui/`, adaptadores compatíveis em `app/src/ui/`. `tokens.ts` é a fonte;
  `global.css` espelha os tokens (teste obrigatório). Marca/tema mudam via `Uniwind.updateCSSVariables` no TemaProvider.
- Movimento: respeitar `ui/useMovimentoReduzido`; Reanimated usa `.get()`/`.set()` para manter o React Compiler.
  Descanso pertence ao `AlunoProvider` e guarda instante de término, nunca contador decrementado; só inicia
  automaticamente ao marcar uma série cujo plano define descanso. `dominio/descanso.ts` contém as contas testáveis.
  `dominio/progressoSemana.ts` combina histórico e registros locais da versão ativa; cache de uma semana no
  repositório isolado por usuário, apagado no logout. Descanso não usa notificações com o app fechado.
  Atualização usa lembretes locais (3 dias antes, no dia e 1 dia depois, às 9h), sem respostas nem medidas,
  cancelados ao enviar e sair; web usa só cartão e ponto na aba. O rascunho por pasta fica no `RepositorioLocal`.
  No Expo Go do Android o `expo-notifications` lança ao importar: `aluno/atualizacao/lembretes.ts` o carrega sob demanda e lá os lembretes ficam desligados.
  `Folha` usa mola e arraste no cabeçalho; web mantém Esc e clique fora. Bases RNR incluem licença MIT local.

- Importação de conteúdo do Saraiva (vídeos, semanas de treino, mobilidade, suplementos e medicação/ergogênicos; o passo de ergogênicos pede login de Administrador): `node scripts/importacao/importar.mjs`
  (`--simular` só lê; `--substituir` troca modelos que já existem; `--trocar-videos` troca vídeo já gravado). Usa a API
  como treinador (`DEMO_SENHA` do ambiente, sem imprimir) e é idempotente. Dados em `scripts/importacao/dados/`, sem
  dado de aluno. No `docker compose up` o serviço `importacao` (one-shot, `node:24-alpine`, `API_URL=http://api:8080`) roda o script
  sozinho depois da API ficar saudável; o conteúdo volta sozinho após `docker compose down -v`. Rodar à mão só para as opções.
