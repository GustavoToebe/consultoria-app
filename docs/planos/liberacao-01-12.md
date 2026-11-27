# Liberação para o cliente de 01/12

Situação: Em execução (27/11) · Onde: main e branch `lote-27-11` (a criar) · Atualizado: 27/11/2026

## Objetivo
Um cliente real usa o app completo a partir de 01/12. Tudo o que foi feito nesta sessão vai para produção com as
funcionalidades habilitadas. Meta: em produção até 29/11, com folga para o Gustavo testar em 30/11.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Liberar tudo, com as chaves ligadas por padrão | ligar | Gustavo (pedido 28) |
| D2 | Exceção: `CENTRAL_ASAAS_HABILITADO` (cobra dinheiro de verdade) só liga quando tudo estiver pronto | desligado até o checklist fechar | Gustavo (pedido 28) |
| D3 | LGPD só o mínimo agora: apagar os fatos das regras de atenção ao anonimizar ou excluir aluno; o resto (exportação etc.) até 15/12 | mínimo agora, resto até 15/12 | Gustavo (pedido 28) |
| D4 | Revisão de advogado e de LGPD não bloqueia a entrega | não bloqueia | Gustavo (pedido 12) |
| D5 | Se alguma chave só puder ser mudada na VPS, a entrega registra arquivo, linha e comando de recarga | registrar | Gustavo (pedido 28) |

## Inventário

### (a) Migrations V102 em diante
Produção: V102 a V110 (deploy verde `fb57efa9` em 27/11 15:48 UTC, informado no pedido; não conferido aqui).
Próximo número livre: V112.

| Versão | Estado | O que faz |
| --- | --- | --- |
| V102 | produção | `inscricao.instagram` (varchar 30, nula), usuário normalizado, copiado ao aluno no aceite |
| V103 | produção | Redes sociais novas: `aluno` (youtube, facebook, linkedin, telegram) e `consultoria` (facebook, linkedin, telegram), link https |
| V104 | produção | `inscricao.aceita_sem_cobranca` (cortesia da ficha rápida) e CHECK `ck_aluno_acesso_desativado` com os motivos MANUAL e ATRASO |
| V105 | produção | Contrato digital: `contrato_modelo`, `contrato_aluno`, `contrato_arquivo` e `consultoria.contrato_prazo_dias`; sem uso enquanto `TREINOS_CONTRATOS_HABILITADO` estiver desligado |
| V106 | produção | Liberação agendada do plano: `versao_liberada` e `liberar_em` (aluno vê a versão liberada) |
| V107 | produção | Documentos PDF: `tema_pdf` com os seis modelos e `opcoes_pdf` (só as sobrescritas) |
| V108 | produção | WhatsApp: uma linha por fato (`ocorrencia`) |
| V109 | produção | Contrato: responsável por link e guarda (`grupo_id`, `assinante_declarou_responsavel`, `apagado_em`) |
| V110 | produção | Overtraining Pay (Asaas): `subconta_asaas`, `cliente_asaas_aluno`, `forma_de_recebimento.overtraining_pay`, colunas de split e de cobrança Asaas |
| V111 | na main, ainda não em produção (número provisório) | Plano na inscrição: `questionario.mostrar_preco_dos_planos` e `inscricao.plano_comercial_id` (FK composta, `ON DELETE SET NULL`); renumerar no merge se necessário |
| V190 | só na worktree `consultoria-app-regras-atencao` (não está na main) | Regras de atenção: alvo da FK composta em `atualizacao` (UNIQUE `consultoria_id, id`) e demais tabelas da frente (conferir o SQL inteiro); número provisório, renumerar para V112 |
| V199 | citada no pedido como cardio provisória; não encontrei o arquivo na main nem na worktree conferida | Cardio/HIIT (a conferir antes de renumerar para V113) |

### (b) Chaves `TREINOS_*` (`api/src/main/resources/application.yml`, `docker-compose.yml`, `.env.example`)
Padrão = valor do yml quando a variável não vem. Pré-requisito = o que a API exige para subir ligada.

| Nome | O que liga | Padrão hoje | Pré-requisito para subir | Decisão |
| --- | --- | --- | --- | --- |
| `TREINOS_PAGAMENTOS_HABILITADO` | planos, cobranças e painel financeiro | false | nenhum | ligar (D1) |
| `TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO` | recebimento online InfinitePay | false | `TREINOS_PAGAMENTOS_CHAVES`, `_CHAVE_ATIVA`, `_URL_PUBLICA` (https) | ligar (D1), com as chaves prontas |
| `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO` | conciliação Kiwify | false | as mesmas da InfinitePay, mais `_URL_API` (padrão https) | ligar (D1), com a credencial cadastrada |
| `TREINOS_PAGAMENTOS_ASAAS_HABILITADO` | Overtraining Pay (Asaas) | false | `_CHAVES`, `_CHAVE_ATIVA`, `_ASAAS_API_KEY_MATRIZ`, URL pública https; não consta em `docker-compose.yml` nem em `.env.example` | não ligar (D2) |
| `TREINOS_CONTRATOS_HABILITADO` | contrato digital | false | nenhum | ligar (D1) |
| `TREINOS_WHATSAPP_HABILITADO` | WhatsApp da Meta | false | `TREINOS_WHATSAPP_CHAVES` e `_CHAVE_ATIVA` | ligar (D1), com as chaves prontas |
| `TREINOS_PUSH_HABILITADO` | push (Expo) | false | `TREINOS_PUSH_EXPO_TOKEN` se exigido pelo envio | ligar (D1) |
| `TREINOS_RETORNO_HABILITADO` | retorno imediato do aluno | false | nenhum | ligar (D1) |
| `TREINOS_EMAIL_HABILITADO` | e-mail de acesso e convite | false | com `_PROVEDOR=resend`, `_RESEND_API_KEY` e `_REMETENTE` (o `.env.example` pede isso em produção) | ligar (D1), após a chave Resend na VPS |
| `TREINOS_CADASTRO_ABERTO` | cadastro público de treinador | false | nenhum | manter false: consultoria nova entra pela Central |
| `TREINOS_PLANO_APLICAR` | limites e funcionalidades do plano da Central | false | nenhum; o `.env.example` pede configurar o produto na Central antes | decisão pendente do Gustavo |
| `TREINOS_TURNSTILE_HABILITADO` | verificação humana | false | `_SITE_KEY`, `_SEGREDO`, `_HOSTNAME` | decisão pendente do Gustavo |
| `TREINOS_FOTOS_HABILITADO` | fotos (R2 ou MinIO) | false | endpoint, bucket, chave e segredo | decisão pendente do Gustavo |
| `TREINOS_INTEGRACAO_ATIVA` | integração com a Central | false | chaves geradas pelo `ligar-integracao.sh` na VPS | pendente: só na VPS |
| `TREINOS_CICLO_HABILITADO`, `TREINOS_UNIDADE_CARGA_HABILITADA`, `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA`, `TREINOS_VITRINE_HABILITADA`, `TREINOS_LOJA_HABILITADA`, `TREINOS_MARKETPLACE_HABILITADO` | módulos de outras frentes | false | não avaliado | decisão pendente do Gustavo (não são desta sessão) |
| `TREINOS_REGRAS_ATENCAO_HABILITADO` | regras de atenção | não está na main (vem da worktree, padrão false) | — | decidir após o merge da worktree |

### (c) Chaves da Central (`CENTRAL_*`)
Lugar em produção: `/opt/ecossistema/central.env` (CENTRAL_*) e `/opt/ecossistema/consultoria.env` (TREINOS_*), conforme
`central-api-back/deploy/README.md` (repo `C:\Users\gusta\Documents\central-unificada`, leitura). Recarga: `recriar.sh central api`
ou `recriar.sh consultoria api`, conforme o README. Valores de segredo não constam aqui.

| Nome | Padrão no yml | Observação |
| --- | --- | --- |
| `CENTRAL_PAGAMENTO_PROVEDOR` | ASAAS (yml) | o `.env.example` traz MERCADOPAGO: divergência a decidir |
| `CENTRAL_INFINITEPAY_HABILITADO`, `_HANDLE`, `_API_KEY`, `_WEBHOOK_TOKEN`, `_URL_PUBLICA` | false e vazios | no `.env.example`; o README pede gravar por `gravar-segredo.sh` |
| `CENTRAL_ASAAS_HABILITADO` | false | bloco Asaas, NÃO está em `.env.example` nem em `deploy/` |
| `CENTRAL_ASAAS_URL_BASE` | `https://api-sandbox.asaas.com/v3` | sandbox como padrão |
| `CENTRAL_ASAAS_API_KEY`, `CENTRAL_ASAAS_WEBHOOK_TOKEN`, `CENTRAL_ASAAS_URL_PUBLICA` | vazios | produção ainda não configurada |
| `CENTRAL_ASAAS_SOCIO_WALLET_ID` | vazio | falta |
| `CENTRAL_ASAAS_SOCIO_PERCENTUAL` | 35.00 | split |
| `CENTRAL_ASAAS_VARREDURA_ENABLED` | true | |
| `CENTRAL_ASAAS_CANCELAMENTO_ENABLED` | false | só liga após o sandbox confirmar que o DELETE recusa cobrança recebida |

### (d) Checklist do Asaas
PRONTO: **não**.
Falta:
1. Chave de API de produção e URL base de produção (hoje o padrão é o sandbox).
2. `CENTRAL_ASAAS_SOCIO_WALLET_ID`.
3. Webhook token e URL pública, e a configuração do webhook no painel do Asaas.
4. Homologação com cobrança de R$ 5,00, com o resultado registrado.
5. Decidir o fluxo de cartão e a política de split (`ABATER_MENSALIDADE` responde 409 na Central).
6. Divergência do default de `CENTRAL_PAGAMENTO_PROVEDOR` (ASAAS no yml × MERCADOPAGO no `.env.example`/README) a resolver.

## Passos
- [ ] P1. Frentes de tela fechadas (editor de treino e dieta, Início do aluno, Personalizar, Marca, Auditoria, Inscrição, App do aluno no PC, Água, cardio/HIIT quando chegar) — commit/run: —
- [ ] P2. Branch `lote-27-11`: merge da pasta principal, de `rodada-28-11` e de `regras-de-atencao`; renumerar V190 para V112 e a cardio para V113, se entrar — commit/run: —
- [ ] P3. Verificação em série: tsc, lint, jest, `mvn verify` e a suíte e2e completa — commit/run: —
- [ ] P4. PR, CI verde, push fast-forward na main e deploy verde — commit/run: —
- [ ] P5. Chaves na VPS (instruções ao Gustavo, sem valor de segredo no repo) — commit/run: —
- [ ] P6. LGPD mínima: apagar os fatos das regras de atenção ao anonimizar ou excluir aluno, com teste de integração; pendência da exportação e do resto com prazo 15/12 no README dos planos — commit/run: —

## Fora do escopo
- Ligar `CENTRAL_ASAAS_HABILITADO` antes do checklist (d) estar fechado.
- Exportação LGPD e demais itens de LGPD: prazo 15/12.

## O que ficou para trás
- (preencher na entrega)
