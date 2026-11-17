---
name: backend-consultoria
description: Lista de conferência do back do consultoria-app (api/, Java 25, Spring Boot 4, Hibernate 7). Use ao criar, alterar ou revisar rota, service, consulta, DTO, permissão, auditoria ou chave de funcionalidade da API.
---
# Back do consultoria-app: lista de conferência

O `AGENTS.md` do repositório é a fonte e vence esta lista. Aqui fica só o que mais se erra; o detalhe de cada módulo
está no item dele em "API: convenções".

## Antes de escrever
- Leia o item do módulo no `AGENTS.md` e um controller e um service vizinhos; siga o padrão deles.
- Padrão de segurança que veio da Central ou do Servirea: leia o arquivo de lá antes de reimplementar.

## Isolamento e autorização
- Toda rota tem `@PreAuthorize` (o `ArquiteturaTest` cobra). Equipe: `hasAuthority('PERM_...')`. Aluno:
  `hasRole('ALUNO')` e sempre o aluno da sessão.
- Permissão vem do banco a cada requisição, nunca do JWT. Checagem que depende do conteúdo (tipo presente, pasta nova)
  fica no service, **antes de qualquer efeito**.
- Nunca confie em id de consultoria ou de aluno vindo do cliente. `@TenantId` é preenchido do banco.
- Recurso de outra consultoria ou de outro aluno responde 404, nunca 403.
- SQL nativo: evite. Se precisar, classe pequena, `consultoria_id` (e `aluno_id`) explícitos e entrada na lista do
  `ArquiteturaTest` com o porquê. `@TenantId` não protege SQL nativo.
- Rota pública (`/publico/**`): `@PreAuthorize("permitAll()")`, controller em `CONTROLLERS_PUBLICOS`, limite no
  `LimiteTentativas`, o mesmo 404 para inexistente, fora do formato e desligado. Se grava em tabela com `@TenantId`,
  não abre transação no topo: descobre a consultoria e roda em `TenantContext.executarComo(...)` com a transação
  **dentro**.

## Forma
- DTO `record`, `@Transactional` no service, erro com `codigo` pelas exceções que já existem (`web/` e a biblioteca
  `plataforma`). `ErroJsonIntegrationTest` trava o formato do JSON de erro.
- Validação: 422 com o campo em `fieldErrors`; a mensagem nunca repete o valor.
- Edição concorrente: `versao` e 409 `CONFLITO_EDICAO`. Escrita que conta (vaga, limite, horário) trava a consultoria
  antes de contar (`ConsultoriaRepository.travar`).
- Plano publicado é imutável. Registro do aluno é idempotente (id do aparelho e chave natural; o último
  `alteradoNoAparelhoEm` vence; registro ruim vira `RECUSADO`, sem derrubar o lote).
- Escrita nova em aluno anonimizado: 409 `ALUNO_ANONIMIZADO`.
- Sem compatibilidade com formato antigo até o primeiro cliente: nada de código de transição.

## Dado sensível (LGPD)
- Peso, dieta, suplementação, observações, CPF, endereço, data de nascimento e fotos: nunca em log, auditoria,
  mensagem de erro nem `toString` de record. Leitura só com a permissão sensível; sem ela sai nulo ou omitido.
- Dado novo do aluno entra na exportação (`privacidade/`) e na anonimização e em "Excluir minha conta".
- Auditoria com resumo fixo, só quando muda. Ação nova tem espelho em `app/src/treinador/equipe/acoesAuditoria.ts`.
- Segredo só em variável de ambiente, sem valor padrão; `.env.example` só com o nome.

## Chave de funcionalidade
Recurso que nasce desligado: propriedade `TREINOS_..._HABILITADO` (padrão `false`), anotação `@Exige...` no controller
(503 com código próprio), campo no `GET /eu`, `application-test.yml` liga e um teste `...DesligadoIntegrationTest`.
No app o 503 nunca vira erro na tela.

## Espelhos (mudou um, mude o outro)
- Permissão nova: catálogo da API, gatilho dos perfis padrão (migration) e `app/src/dominio/perfilEquipe.ts`.
- Contrato: `app/src/api/tipos.ts` e `app/src/api/rotas.ts`.
- Regra pareada entre a API e `app/src/dominio/` (validações, faixas de data, metodologia padrão, questionário com
  as fixtures de paridade).
- Mudança que invalida algo do `AGENTS.md` atualiza o `AGENTS.md` junto.

## Antes de entregar
- Teste de integração da rota: caminho feliz, outra consultoria (404), sem permissão (403) e, se houver, a chave
  desligada (503). Dado único por teste: skill `verificacoes-consultoria`.
- `mvn verify` em `api/`. Com migration: skill `migrations-consultoria`.
