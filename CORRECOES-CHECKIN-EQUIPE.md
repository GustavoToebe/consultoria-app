# Correções do check-in e da equipe (revisão de 09/10/2026, `d300af9`)

Revisão do código que o Codex fez (`PLANO-CHECKIN.md` C1–C11 e `PLANO-EQUIPE.md` E1–E7). Os testes passam (API: 121;
app: 193 em 34 suítes), mas a revisão achou os problemas abaixo.

**Como trabalhar:**
- Uma sessão por parte (A, depois B, depois C).
- Cada correção vem **com teste que falha antes e passa depois**.
- Antes de cada commit: `cd api && mvn verify` e `cd app && npm run typecheck && npm run lint && npm test`.
- Push na `main` com autorização do Gustavo.
- Relatório com ✅/❌.
- Migration nova começa na **V019**.

## Parte A: antes de domingo (obrigatório)

### A1. Escalada de privilégio na equipe (grave)

Arquivo `equipe/EquipeService.java`.

**Problema:**
- Quem tem `USUARIO_ALTERAR` consegue se colocar no perfil Administrador (`alterarUsuario`, sem nenhuma checagem do perfil
  escolhido). Também consegue convidar um e-mail seu como Administrador (`convidar`) e rebaixar ou desativar os outros
  administradores.
- Quem tem `PERFIL_ALTERAR` consegue editar o **próprio** perfil e se dar todas as permissões (`alterarPerfil`;
  `CatalogoPermissoes.validar` não tem teto).
- `duplicarPerfil` do Administrador gera um perfil comum com **todas** as permissões, que depois pode ser atribuído.

**Regra a implementar (num método só, chamado por todos esses caminhos):**
1. Perfil com `acessoTotal` (Administrador): só um usuário com `acessoTotal` pode atribuí-lo (alterar membro ou convidar).
2. Criar, editar ou duplicar perfil: as permissões do perfil resultante têm de estar **contidas** nas permissões de
   quem está fazendo. Administrador pode tudo.
3. Atribuir perfil (alterar membro ou convidar): o perfil tem de estar contido nas permissões de quem atribui.
4. Quem não é administrador **não pode**:
   - alterar, desativar nem trocar o perfil de um administrador;
   - trocar o próprio perfil;
   - editar o perfil que ele mesmo usa.
5. Resposta: 403 `PERMISSAO_NEGADA`, com mensagem clara ("Você não pode dar permissões que não tem.").

**Testes (`EquipeIntegrationTest`):** um membro com perfil `{EQUIPE_LER, USUARIO_ALTERAR}` tenta:
- se promover;
- convidar alguém como Administrador;
- desativar o administrador.

E um membro com `PERFIL_ALTERAR` tenta acrescentar `ALUNO_SENSIVEL_LER` ao próprio perfil e duplicar o Administrador.
Tudo tem que dar 403. O administrador continua fazendo tudo.

### A2. "Vou atrasar" esconde o cartão ou mostra o estado errado

Arquivos: `atualizacoes/RegrasAtualizacao.java:12-15`, `atualizacoes/AtualizacaoService.java:93`,
`app/src/dominio/atualizacao.ts:7-9` e `CartaoAtualizacao.tsx`.

**Problema:**
- A nova data pode ser **anterior** à data original.
- A fase é calculada a partir de `atrasoAte ?? data`. Por isso:
  - quem avisa que vai atrasar some do cartão da tela inicial;
  - quem escolhe uma data antes da original vê "Responder", e o envio dá 422;
  - no dia seguinte aparece "atrasada", quando ainda faltam dias para a data.

**Regra:**
- A nova data tem de ficar entre `data` e `data + 15` (a API recusa fora disso, com mensagem no campo).
- O formulário abre por `data - 1`, como antes.
- "Atrasada" só depois de `max(data, atrasoAte)`.
- Com o aviso dado, o cartão continua visível com "Você avisou: nova data DD/MM" e o botão Responder.
- A mesma regra vale na API e no app, com teste nos dois lados.
- O app tem que mostrar a mensagem do campo `data` que vem da API, não só "Confira os campos indicados".

### A3. O envio da atualização apaga a observação do peso daquele dia

Arquivo `AtualizacaoService.java:80-82`.

**Problema:** o código chama `p.alterar(peso, null, …)`, o que apaga a observação que já existia no registro de peso da
data.

**Correção:**
- Manter `p.getObservacao()`.
- Se dois registros de peso chegarem juntos para a mesma data, o `unique(aluno_id, data)` estoura em 500: devolva 409.
- Teste para os dois casos.

### A4. Falso "Outra pessoa alterou" no feedback

**Problema:** quando o aluno abre o feedback, `marcarVisto` muda a entidade com `@Version` e sobe a `versao`. Se o
treinador estava editando o feedback, recebe 409 sem ninguém ter mexido no texto.

**Correção:**
- Gravar `feedback_visto_em` com um UPDATE que não mexe na `versao`.
- Teste: aluno marca visto → treinador salva o feedback com a versão que tinha → 200.

### A5. Atualização antiga aberta pelo histórico grava na pasta atual

Arquivos: `app/src/app/aluno/atualizacao.tsx` (com `?id=`) e `FormularioAtualizacao`.

**Problema:** enviar ou avisar atraso numa atualização antiga sempre usa a pasta **atual**. Isso pode gravar respostas e
peso de A em B.

**Correção:**
- Quando o `id` não é a atualização atual, o formulário fica **só leitura**.
- Na API, `enviar` e `atraso` recebem o `pastaId` (ou o id da atualização) e recusam com 409 se não for a atual.
- Teste.

### A6. Reenvio da atualização dá erro em vez de ser idempotente

**Problema:** se a rede cai depois que o servidor gravou, o reenvio recebe 409 `ATUALIZACAO_JA_ENVIADA` em vermelho, e o
rascunho local nunca é apagado.

**Correção:**
- Se a atualização já está ENVIADA ou REVISADA **pelo mesmo aluno**, responda 200 com o estado atual, sem alterar nada
  (o plano C diz que o reenvio é idempotente).
- O app trata como sucesso e apaga o rascunho.
- Teste.

## Parte B: logo depois de domingo

1. **Contadores × lista.** O painel conta com o filtro "Meus alunos", mas `GET /atualizacoes` não tem esse filtro.
   "Para revisar (1)" abre uma lista com 5. Acrescente `meus` à lista e use o mesmo filtro nos dois.
2. **Inundação da auditoria.** Cada login bloqueado grava uma linha (`Auditoria.bloqueioLogin`). Grave no máximo uma
   por chave e por janela de bloqueio.
3. **Rotas de modelo sem a permissão do plano.**
   - `POST /receitas/{id}/aplicar` exige também `ALUNO_LER` e `TREINO_ALTERAR`/`DIETA_ALTERAR`, conforme o que o modelo
     cria.
   - `salvar-como-modelo` exige `TREINO_LER`/`DIETA_LER`.
4. **Observação da série** (`ExecucaoDtos.SerieFeita.observacao`, texto livre do aluno): omitir sem `ALUNO_SENSIVEL_LER`.
5. **Código de permissão `null`** (`{"permissoes":[null]}`) dá 500 em `CatalogoPermissoes.validar`. Deve dar 400.
6. **Convite vencido trava apagar perfil**, e não existe rota para cancelar convite.
   - Contar só convites não vencidos.
   - Criar `DELETE /usuarios/convites/{id}` (`USUARIO_ALTERAR`, auditado).
7. **`AcessoAtual.pode`** devolve `true` sem autenticação. Trocar para negar (fail-closed) e ajustar quem depende disso.
8. **Painel pesado.**
   - `PainelService.contarAtualizacoes` chama `listar` 4 vezes, com várias consultas por aluno, e a lista leva o JSON do
     modelo em cada item.
   - Contar com uma consulta agregada e deixar o modelo só no detalhe.
   - Índice em `atualizacao(aluno_id)`, numa migration nova.
9. **`data_atualizacao` congelada:** depois que a linha existe, mudar o `fim` da pasta não muda a data. Atualizar
   enquanto a atualização estiver ABERTA.

## Parte C: qualidade (quando mexer nos arquivos)

- **Código compactado demais**, com várias instruções por linha e `br.com...` por extenso no meio do código:
  - `EquipeService`, `AlunoService` e outros do E1–E7.
  - Formatar como o resto da API (uma instrução por linha, imports), **sem mudar comportamento**, num commit só de
    formatação.
- **Mensagem que revela e-mail cadastrado:** `convidar` devolve 409 `EMAIL_EM_USO` quando o e-mail tem conta em
  **qualquer** consultoria. Trocar por uma resposta neutra ou mostrar o erro só no aceite.
- **`respostas.path("peso")`** assume que todo modelo tem `peso` obrigatório. Conferir pelo modelo da versão.
- **Chaves estrangeiras da V017** sem `consultoria_id` (a V018 usa o padrão composto). Só em migration nova, se for
  mexer.
- **`definirResponsavel`** aceita membro sem `ALUNO_LER`. Não é falha de segurança (só define o filtro "Meus alunos"),
  mas a API deve aceitar só quem aparece em `/responsaveis`.

## Verificado e certo (não mexer)

- **Permissões:** lidas do banco a cada requisição. Trocar perfil ou desativar derruba as sessões (`cv` + refresh).
- **Rotas:** toda rota tem `@PreAuthorize` com `PERM_…`; o aluno não tem `PERM_*`.
- **Outra consultoria = 404.** O SQL nativo novo filtra `consultoria_id`.
- **Último administrador:** protegido com trava, inclusive em acesso simultâneo.
- **Convite de equipe:**
  - guardado só como hash;
  - vence em 7 dias e só serve uma vez;
  - limite por IP;
  - código no fragmento da URL;
  - não toma conta de quem já existe.
- **Dado sensível:**
  - omitido no detalhe do aluno sem `ALUNO_SENSIVEL_LER`;
  - lesões, pesos e atualizações exigem a permissão sensível;
  - a auditoria só tem textos fixos.
- **Check-in:**
  - o aluno vem da sessão;
  - só uma atualização por pasta;
  - modelo versionado;
  - notificações com texto fixo, canceladas no logout;
  - rascunho apagado no logout;
  - foto mostra "Envio de fotos ainda não implementado";
  - sem `alert`/`confirm`.
- **Migrations:** só V017 e V018 novas, nenhuma antiga editada.
- **Commits:** nada indevido (sem `.env`, captura de tela ou `dist`).
