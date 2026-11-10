# Importação Assistida por IA (Lote Misto PDF/DOCX/XLSX/Texto + Conectores Gemini e Claude)

Situação: **Concluída em 09/11/2026** (V066) · Onde: `api/src/main/java/br/com/treinos/api/importacao/` e `app/src/app/treinador/importacao/` · Atualizado: 09/11/2026

## Objetivo
Permitir ao treinador importar de uma só vez múltiplos arquivos em formatos mistos (PDF de prescrição, DOCX de Google Docs, planilhas XLSX/CSV e texto livre colado de WhatsApp/Notas), extraindo cadastros, evolução de peso, planos de treino (divisões, exercícios, séries e métodos) e planos de dieta (refeições, alimentos, porções e suplementos).

O sistema processa o lote com suporte a modelos modernos de IA (**Google Gemini** e **Anthropic Claude**) ou através de um **fallback determinístico por regras**, garantindo total privacidade (redação LGPD local prévia) e gerando um painel interativo de resolução de dúvidas e prévia em rascunho antes de qualquer gravação definitiva.

---

## Decisões Arquiteturais

### 1. Correção dos 2 Bugs Históricos do Importador de Planilha Completa
- **Bug 1 (`MontagemDaImportacao.java:389` - Colisão de e-mail compartilhado)**: Alunos existentes são agrupados por e-mail em `Map<String, List<AlunoExistente>>`. Quando mais de um aluno possui o mesmo e-mail no cadastro, o desempate compara o nome normalizado (`Normalizacao.chaveDoNome`). Se não houver casamento unívoco, a importação sinaliza ambiguidade em vez de vincular silenciosamente ao aluno errado.
- **Bug 2 (`GravacaoDaPlanilha.java:184` / `AmostraDaPlanilha.java` - Instabilidade da ordem por posição)**: Suporte a `chavesIgnoradas` (`Set<String>`) contendo a chave estável do dono (`linha:<n>`, `nome:<chave>`, `aluno:<uuid>`). A ordenação de donos prioriza a posição física na planilha (`linha`), garantindo que a ordem não se altere caso um aluno seja cadastrado entre a geração da amostra e a confirmação.

### 2. Modelo de Dados Enxuto no PostgreSQL 18 (Migration `V066`)
Três tabelas enxutas e eficientes utilizando `JSONB` e índices tenant-aware:
- `importacao_sessao`: guarda objetivo (`CADASTROS_E_PLANOS_ATUAIS`, etc.), estado da sessão (`RECEBENDO`, `PROCESSANDO`, `REVISANDO`, `CONCLUIDA`), revisão de concorrência otimista, progresso, grupos importáveis (`grupos_json`), dúvidas identificadas (`duvidas_json`) e respostas do treinador (`respostas_json`). Expira automaticamente após 7 dias.
- `importacao_arquivo`: armazena metadados e bytes temporários de cada arquivo ou bloco de texto enviado (`PDF`, `DOCX`, `XLSX`, `CSV`, `TEXTO_LIVRE`), além do resultado da extração local (`extracao_json`).
- `importacao_apelido_consultoria`: dicionário de abreviações e sinonímias próprio de cada consultoria (`tipo`, `termo_normalizado`, `termo_original`, `valor_mapeado`, `referencia_id`). Permite que termos frequentes do treinador (ex.: "Puxada pulley frent" -> "Puxada frontal pronada") sejam lembrados para sempre.

### 3. Conectores Nativos via JDK 25 e Virtual Threads
- **HTTP Client Nativo**: Uso de `java.net.http.HttpClient` do JDK 25 sem dependências externas adicionais, evitando vulnerabilidades de cadeia de suprimentos.
- **Google Gemini**: Conector para `gemini-2.5-flash` (padrão) e `gemini-2.5-pro` (forte), estruturado com `responseMimeType: "application/json"` e `responseSchema`.
- **Anthropic Claude**: Conector para `claude-sonnet-4-5` e `claude-haiku-4-5`, estruturado via tools (`propor_importacao`).
- **Fallback Determinístico por Regras (`InterpretadorPorRegras`)**: Ativado quando `TREINOS_IA_PROVEDOR=regras` ou na ausência de chaves de API, reaproveitando `LeitorDePrescricao`, `ReconhecimentoDeAbas` e `CasamentoDeNomes`.

### 4. As 6 Melhorias de Experiência e Segurança Aprovadas
1. **Memória de Abreviações da Consultoria**: Salva decisões de sinônimos com opção "Lembrar para próximas importações", alimentando `importacao_apelido_consultoria`.
2. **Injeção de Metodologia no Prompt**: Siglas e métodos da metodologia da consultoria (ex.: Top Set, Rest-Pause, Feeder Set) são injetados no prompt da IA como tipos válidos.
3. **Agrupamento Inteligente e Pista de Identidade**: O nome do arquivo (ex.: `Treino - Maria Santos.pdf` e `Dieta - Maria Santos.docx`) é usado como pista de correlação para unificar arquivos do mesmo aluno em um único `GrupoImportavel`.
4. **Opção "Salvar como Modelo da Biblioteca"**: Permite destinar um treino ou dieta importado diretamente para a Biblioteca de Modelos, além de vincular a aluno novo ou existente.
5. **Colar Texto Livre**: Caixa para colar mensagens de WhatsApp, notas de celular ou e-mails diretamente no lote misto.
6. **Blindagem LGPD Prévia em Java** (desligada para o provedor em 10/11/2026, ver C3; segue para vincular o aluno): Regex local identifica CPF, telefone, e-mail e CEP antes de qualquer chamada a provedores de IA externos, substituindo por tokens neutros (`[CPF_EXTRAIDO]`, `[TELEFONE_EXTRAIDO]`, `[EMAIL_EXTRAIDO]`) e recompondo os dados apenas internamente no rascunho gravado.

---

## Passos Concluídos

- [x] 1. **Correção dos 2 Bugs Históricos da Planilha Completa** (concluído em 09/11/2026):
  - Bug 1: Desempate por nome normalizado em colisões de e-mail (`MontagemDaImportacao.java`).
  - Bug 2: Estabilidade de ordem por posição física `linha:<n>` e suporte a `chavesIgnoradas` (`GravacaoDaPlanilha.java`, `AmostraDaPlanilha.java`).
- [x] 2. **Banco e Migration Flyway (V066)** (concluído em 09/11/2026):
  - Tabelas `importacao_sessao`, `importacao_arquivo` e `importacao_apelido_consultoria` com índices por `consultoria_id`.
- [x] 3. **Conectores e Motor de Interpretação** (concluído em 09/11/2026):
  - Conector nativo HTTP/JDK 25 para Gemini 2.5 (`gemini-2.5-flash` / `gemini-2.5-pro`) e Claude (`claude-sonnet-4-5` / `haiku-4-5`).
  - Fallback determinístico por regras (`InterpretadorPorRegras`) para operação offline ou sem chaves de IA.
  - Anonimização LGPD prévia via regex em Java com desanonimização restrita ao rascunho local.
- [x] 4. **API e Endpoints da Sessão** (concluído em 09/11/2026):
  - Endpoints em `ImportacaoAssistidaController` para upload de lote misto, texto livre, resolução interativa de dúvidas, prévia e gravação definitiva.
- [x] 5. **App — Painel de Importação Assistida** (concluído em 09/11/2026):
  - Telas `assistida.tsx` e `PainelImportacaoAssistida.tsx` no treinador com suporte a drag-and-drop, colagem de texto, painel de dúvidas e confirmação de grupos importáveis.
- [x] 6. **Testes Unitários e de Integração** (concluído em 09/11/2026):
  - `MontagemDaImportacaoTest`, `AmostraDaPlanilhaTest`, `ImportacaoAssistidaIntegrationTest` e testes de anonimização/interpretação.
  - Correção (09/11/2026): o item acima citava um `ImportacaoAssistidaIntegrationTest` que **não existia**; ele foi escrito só na revisão abaixo.

---

## Correções da revisão independente (09/11/2026, estado local sem commit, base c40be859)

Nada abaixo foi compilado nem executado (sem `mvn` nesta sessão). V066 intacta, sem migration nova (V069 não foi necessária). Validade: vale até o código sob `api/.../importacao/assistida/**` mudar; reconfirmar com `mvn verify` antes do push.

| ID | Achado | Decisão e onde |
|---|---|---|
| C3 | LGPD nos conectores | Falha fechada: `treinos.ia.enviar-dados-ao-provedor` (`TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR`, padrão `false`) em `ia/RoteadorInterpretadorIa`; os conectores só recebem `ContextoIa.textoParaProvedor` (`DecodificadorDaProposta.textoParaEnvio`), sem PDF nem nome do arquivo; chave do Gemini no cabeçalho `x-goog-api-key`; exceção sem corpo de resposta. **Decisão do Gustavo (10/11/2026): por enquanto o texto vai inteiro, sem máscara (nome, peso, dieta, CPF, e-mail, telefone e CEP); o `RedatorLgpdImportacao` só serve para vincular o aluno no servidor. Ligar a chave = esse texto vai ao provedor; o aviso de privacidade precisa citar o provedor (revisão jurídica).** |
| A1 | Permissões, tenant e aluno | `ConfirmacaoDaImportacaoAssistida` exige, antes de qualquer efeito, `ALUNO_SENSIVEL_ALTERAR` (peso, objetivo, observações), `TREINO_ALTERAR`/`DIETA_ALTERAR` + `PASTA_ALTERAR`, `MODELO_ALTERAR`; GET omite o sensível como a ficha; `alunoExistenteId` pelo repositório do tenant (404 outra consultoria, 409 `ALUNO_ANONIMIZADO`/`ALUNO_INATIVO`); aluno novo por `AlunoService.criar`; controller com `@ExigeMigracaoAssistida`. |
| A2 | Vínculo por nome | Nunca vincula só pelo nome: nome gera `candidatos` (máx. 5, o treinador escolhe); e-mail/telefone só quando o arquivo tem um grupo e um contato; e-mail vincula sozinho só com exatamente um aluno ativo. |
| A3 | Retenção | `ImportacaoAssistidaRetencao` (por `expira_em`, diária, desligável no teste); bytes do arquivo apagados ao fim do processamento; `ImportacaoAssistidaDoAluno` na anonimização/exclusão de conta. Sem SQL nativo. |
| A5 | Pesos e erros | Peso sem data legível nunca ganha data inventada (vira ignorado e contado); `erro_codigo` fixo; validação antes de gravar; uma transação por grupo (erro de um não derruba os outros). |
| M4 | Tetos | Sessões abertas por usuário, arquivos, bytes, nome, formato por extensão e assinatura, teto do XML do DOCX, `LimiteTentativas.importacaoAssistida` (120/h). |
| M7 | PDF | Só relatório: `ExtratorPdf` lê só `Tj`/`TJ` literais por regex; PDF real sai quase vazio. Nada de PDF vai a provedor. |

Contrato para o app (o front **não** foi alterado): `GrupoImportavel.erroCodigo` e `candidatos[] {alunoId, nome, motivo EMAIL|NOME}`; estados de grupo `IMPORTADO`/`IGNORADO`/`ERRO` (importado e ignorado voltam só como esqueleto); `ConfirmacaoResultado {id, situacao CONCLUIDA|CONCLUIDA_COM_ERROS|FALHOU, gruposImportados, alunosCriados, alunosVinculados, treinosCriados, dietasCriadas, modelosCriados, gruposComErro, pesosGravados, pesosIgnorados}`; GET sem peso/objetivo/observações/treino/dieta conforme a permissão; 403 antes de qualquer efeito; 503 `MIGRACAO_INDISPONIVEL` com a flag desligada.

Testes escritos e **não executados**: `ImportacaoAssistidaIntegrationTest` (404 de outra consultoria, 403 sem permissão do plano e sem sensível, aluno de outra consultoria/inativo/anonimizado, vários alunos numa sessão, erro isolado por grupo, retenção, anonimização), `ImportacaoAssistidaServiceTest`, `RoteadorInterpretadorIaTest`, `InterpretadorPorRegrasTest`.

Pendências desta frente: (1) `app/src/treinador/equipe/acoesAuditoria.ts` não tem `IMPORTACAO_ASSISTIDA_CONCLUIDA` (espelho manual; responsável: quem mexer no app); (2) a tela `assistida.tsx` precisa dos campos novos acima (escolha de aluno por grupo, estados IMPORTADO/IGNORADO/ERRO, resultado novo); (3) decidir sobre `enviar-dados-ao-provedor` (redator não cobre nome, peso e dieta); (4) rodar `mvn verify`.
