# Formulários unificados da consultoria ("Google Forms interno", C62)

Situação: Concluída em 09/11/2026 (V064) · Onde: `main` · Atualizado: 09/11/2026

## Objetivo
Unificar os três motores de formulários do sistema (`inscricao`, `anamnese` e `atualizacao`) em um único construtor de formulários flexível por seções e perguntas ("Google Forms interno"), permitindo à consultoria criar múltiplos formulários públicos com links independentes (`1:N`), encadeamento pós-envio (ex.: inscrição seguida de anamnese completa), identificação de origem no CRM e aplicação direta de respostas na ficha do aluno por mapeamento de destino no perfil (`DestinoNoPerfil`).

---

## O problema atual (três silos separados)
Hoje o sistema trata formulários em três silos com lógicas divergentes:
1. **Inscrição (`inscricao`)**:
   - Campos fixos rígidos no banco (`nome`, `telefone`, `email`, `sexo`, `objetivo`, `modalidade`, `previsao`, `como_conheceu`).
   - Remendo de `campos_ocultos` em `inscricao_configuracao` para esconder parte dos fixos.
   - Respostas extras em tabela própria chave/valor (`inscricao_resposta`).
   - Trava de um único link público por consultoria (`1:1` em `inscricao_configuracao`).
2. **Anamnese (`anamnese`)**:
   - Perguntas dinâmicas por seções em `jsonb` (`Questionario` + `QuestionarioVersao`).
   - Sem link público próprio (só pode ser respondida dentro do app pelo aluno autenticado ou aplicada no aceite da inscrição).
   - Não se conecta diretamente a campanhas ou triagens públicas.
3. **Atualização (`atualizacao`)**:
   - Motor próprio com perguntas de acompanhamento periódico (peso, fotos, notas).
   - Fluxo de resposta e revisão isolado do restante da plataforma.

---

## Decisões de Arquitetura e Produto

| # | Decisão | Valor | Quem decidiu |
|---|---|---|---|
| D1 | **Motor unificado** | Todo formulário é 100% composto por Seções + Perguntas sobre o modelo existente de `Questionario` e `QuestionarioVersao`. As finalidades passam a indicar o caso de uso (`PUBLICO` / `INSCRICAO`, `ANAMNESE`, `ATUALIZACAO`, `AVULSO`), compartilhando o mesmo editor, validador, prévia e lógica de versionamento. | Gustavo / Claude, 09/11 |
| D2 | **Fim dos campos fixos e de `campos_ocultos`** | A tela pública não possui campos engessados. Nome, telefone, e-mail, sexo, etc. tornam-se perguntas normais do formulário. Qualquer pergunta pode declarar um `destinoNoPerfil` opcional (`DestinoNoPerfil`: `NOME`, `TELEFONE`, `EMAIL`, `CPF`, `DATA_NASCIMENTO`, `SEXO`, `PESO`, `ALTURA`, `OBJETIVO`, `OBSERVACOES`, `ENDERECO`, `FOTOS`). Validações essenciais (ex.: WhatsApp válido para contato) continuam aplicadas no tipo da pergunta. | Gustavo / Claude, 09/11 |
| D3 | **Múltiplos links públicos (`1:N`)** | Cada questionário público possui seu próprio `codigo_publico` (`/inscricao/<codigo>`), situação independente (`aberto = true/false`), responsável padrão da equipe (`responsavel_id`) e texto de apresentação. A consultoria pode ter links distintos para Bio do Instagram, campanhas pagas, parcerias ou triagens específicas. | Gustavo, 30/10 e 09/11 |
| D4 | **Encadeamento de formulários** | Configuração opcional `proximoQuestionarioId` no formulário público: ao concluir o envio com sucesso, a página pública pode redirecionar automaticamente para um segundo questionário (ex.: formulário rápido de `Inscrição Saraiva Team` → `Anamnese Saraiva Team` completa de 57 perguntas) sem exigir login imediato, vinculando as respostas à mesma inscrição. | Gustavo / Claude, 09/11 |
| D5 | **Origem no CRM (Interessados)** | O Kanban de Interessados exibe um selo com o nome do formulário respondido e ganha filtro por formulário/link de origem, permitindo filtrar leads por canal ou campanha sem depender apenas de parâmetros de URL soltos. | Gustavo / Claude, 09/11 |
| D6 | **Aplicação na ficha do aluno** | O histórico da ficha do aluno passa a exibir todos os questionários respondidos (inscrições, anamneses, atualizações e avulsos). Na visualização de qualquer resposta com `destinoNoPerfil`, o treinador pode acionar a ação "Aplicar na ficha" para atualizar os dados cadastrais do aluno automaticamente. | Gustavo / Claude, 09/11 |
| D7 | **Migração retrocompatível (preservação do Saraiva)** | A migration unificadora migra os dados de produção sem perda: o formulário de 14 perguntas da `Inscrição Saraiva Team` e o de 57 perguntas da `Anamnese Saraiva Team` são preservados como questionários independentes; o `codigo_publico` atual do Saraiva permanece idêntico apontando para sua Inscrição padrão. | Claude, 09/11 |
| D8 | **Perguntas condicionais no fluxo público (Exemplo N37)** | O motor de exibição condicional já existente em `QuestionarioVersao` passa a valer também no formulário público unificado. Exemplo real `N37` da reunião de 08/11: pergunta *"Quem indicou?"* exibida condicionalmente apenas se a opção selecionada na pergunta anterior (*"Como conheceu a consultoria?"*) for *"Aluno do time"* ou *"Influenciador"*. | Gustavo, 08/11 e 09/11 |

---

## Estrutura de Dados e Contrato

### 1. Enum `DestinoNoPerfil`
```java
public enum DestinoNoPerfil {
    NOME,
    TELEFONE,
    EMAIL,
    CPF,
    DATA_NASCIMENTO,
    SEXO,
    PESO,
    ALTURA,
    OBJETIVO,
    OBSERVACOES,
    ENDERECO,
    FOTOS
}
```

### 2. Extensão de `Questionario`
```sql
ALTER TABLE questionario
    ADD COLUMN codigo_publico VARCHAR(60) UNIQUE,
    ADD COLUMN publico_aberto BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN responsavel_id UUID REFERENCES usuario(id),
    ADD COLUMN texto_apresentacao VARCHAR(1000),
    ADD COLUMN proximo_questionario_id UUID REFERENCES questionario(id);
```

### 3. Associação na Inscrição
```sql
ALTER TABLE inscricao
    ADD COLUMN questionario_id UUID REFERENCES questionario(id),
    ADD COLUMN questionario_versao_id UUID REFERENCES questionario_versao(id);
```

---

## Passos planejados

- [x] 1. **Banco e Migration (Flyway)** (concluído em 09/11/2026, V064):
  - Adicionar colunas de publicação em `questionario` (`codigo_publico`, `publico_aberto`, `responsavel_id`, `texto_apresentacao`, `proximo_questionario_id`).
  - Migrar `inscricao_configuracao` para os novos campos do `questionario` padrão de cada consultoria.
  - Adicionar suporte a `destinoNoPerfil` no schema JSON de perguntas do questionário.
  - Testes de migração garantindo integridade dos dados existentes.
- [x] 2. **API — Endpoints e Validações** (concluído em 09/11/2026):
  - `GET /publico/formularios/{codigo}`: devolve metadados, apresentação e perguntas publicadas da versão ativa.
  - `POST /publico/formularios/{codigo}/responder`: validação Turnstile, rate limit, integridade de perguntas obrigatórias, criação de `Inscricao` com vínculo ao questionário e retorno de `proximoQuestionarioCodigo` (quando houver encadeamento).
  - `POST /alunos/{id}/questionarios/{respostaId}/aplicar-perfil`: aplica as respostas mapeadas com `DestinoNoPerfil` diretamente no cadastro do aluno.
  - Testes de integração em `FormulariosPublicosIntegrationTest` e `QuestionarioIntegrationTest`.
- [x] 3. **App — Editor e Gestão de Formulários (Treinador)** (concluído em 09/11/2026):
  - Tela de Questionários no menu Conteúdo: gerenciar formulários, gerar novo link público, ativar/desativar, escolher encadeamento e definir responsável da equipe.
  - Editor de perguntas: campo seletor opcional "Vincular resposta ao perfil do aluno" (`DestinoNoPerfil`).
- [x] 4. **App — CRM de Interessados** (concluído em 09/11/2026):
  - Exibição de selo do formulário de origem nos cartões do Kanban.
  - Filtro por formulário de origem no painel de filtros de Interessados.
- [x] 5. **App — Página Pública (`/inscricao/<codigo>`)** (concluído em 09/11/2026):
  - Renderizador 100% dinâmico a partir das seções e perguntas do questionário.
  - Fluxo encadeado: ao enviar formulário 1, transiciona suavemente para o formulário 2 caso configurado.
- [x] 6. **Ficha do Aluno e E2E** (concluído em 09/11/2026):
  - Aba ou seção unificada de formulários respondidos na ficha com botão "Aplicar no cadastro".
  - Testes E2E (Playwright) cobrindo criação de formulário público, resposta externa encadeada e triagem no CRM.

---

## Fora do escopo
- Construtor visual de landing pages (estilos livres de CSS, tipografia arbitrária ou blocos de arrastar). O formulário segue o design system padronizado do app.
- Envio de anexos de vídeo ou documentos pesados no formulário público (fotos corporais continuam suportadas).
- Cobrança/checkout integrado diretamente no envio do formulário (o fluxo financeiro segue via propostas no CRM).

---

## Correções da revisão independente (09/11/2026, V067)
Situação: implementadas no código, testes escritos e **ainda não executados** (sem `mvn` neste lote) · Atualizado: 09/11/2026
- **Uma fonte do link:** o questionário de inscrição (`codigo_publico`, `publico_aberto`, `responsavel_padrao_id`, `texto_apresentacao`, `campos_ocultos`, `link_versao`). O código sai sempre de `CodigoDeInscricao.novo()` (144 bits), nunca do cliente; "gerar novo link" e fechar agem nessa coluna, então o código antigo dá 404. `inscricao_configuracao` deixou de ser lida e escrita (a tabela fica; sai numa migration depois de conferida em produção).
- **Rotas do link:** `GET/PUT /questionarios/{id}/link`, `PUT .../link/campos-ocultos`, `POST .../link/novo-link`, com `INSCRICAO_LER`/`INSCRICAO_ALTERAR` e auditoria (`INSCRICAO_CONFIGURACAO_ALTERADA`, `INSCRICAO_LINK_RENOVADO`, resumo fixo). `/inscricoes/configuracao*` continua e age no formulário de inscrição padrão. `PUT /questionarios/{id}` não aceita mais código, abertura nem responsável.
- **D4 x AGENTS.md:** o link público só existe para finalidade `INSCRICAO` (a anamnese se responde logada); o encadeamento vai de inscrição para inscrição, e a resposta só traz o próximo código se ele também está aberto. O "texto de apresentação" ficou em 2000 (o plano previa 1000), igual ao da configuração antiga.
- **Destinos que não gravam nada** (`NOME`, `EMAIL`, `DATA_NASCIMENTO`, `ALTURA`, `OBSERVACOES`) são recusados na publicação (422 no campo `destino`) e saem do CHECK de `anamnese_pendencia`; as constantes ficam no enum porque versão publicada é imutável.
- **Código fraco:** a V067 zera o código de inscrição fechado que não está em `inscricao_configuracao` (abrir sempre gera um novo no servidor); código fraco de link já aberto fica (trocar quebraria o link divulgado: "Gerar novo link" resolve). Arquivar fecha o link e desarquivar não o reabre.
- **Pendências:** o envio encadeado pede de novo nome e WhatsApp e cria outra inscrição (falta um vínculo entre as duas respostas); o app ainda chama `/questionarios/{id}/codigo-publico` e oferece os destinos recusados (lote do front).

## O que ficou para trás
- —
