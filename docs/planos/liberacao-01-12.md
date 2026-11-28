# Liberação para o cliente de 01/12

Situação: leva 1 publicada em `origin/main` (c9d16c8e, 27/11, CI verde). Leva 2 local na branch `leva-2` (HEAD 55355998, 6 commits à frente de `origin/main`), não publicada · Onde: `main` (leva 1) e `leva-2` (leva 2) · Atualizado: 27/11/2026

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
| D6 | Chave `TREINOS_CARDIO_INTERVALADO_HABILITADO` (timer do cardio/HIIT) fica desligada até o APK com o timer estar nas lojas; ligar só depois da confirmação do Gustavo | desligada | Gustavo (instrução desta rodada; yml: ligar só depois do APK) |

## Inventário

### (a) Migrations V102 em diante
Produção: V102 a V110 (deploy verde `fb57efa9` em 27/11 15:48 UTC, informado no pedido; não conferido aqui).
`origin/main` (leva 1, c9d16c8e): V111 a V114 (renumeradas no merge, 27/11).
Branch `leva-2` (local, não publicada): V115 (Java, sem arquivo SQL: origem da receita, `receita.origem`) e V116 (SQL, texto de "Outro" na inscrição). Próximo número livre: V117.

| Versão | Estado | O que faz |
| --- | --- | --- |
| V102 | produção | `inscricao.instagram` (varchar 30, nula), usuário normalizado, copiado ao aluno no aceite |
| V103 | produção | Redes sociais novas: `aluno` (youtube, facebook, linkedin, telegram) e `consultoria` (facebook, linkedin, telegram), link https |
| V104 | produção | `inscricao.aceita_sem_cobranca` (cortesia da ficha rápida) e CHECK `ck_aluno_acesso_desativado` com os motivos MANUAL e ATRASO |
| V105 | produção | Contrato digital: `contrato_modelo`, `contrato_aluno`, `contrato_arquivo` e `consultoria.contrato_prazo_dias` |
| V106 | produção | Liberação agendada do plano: `versao_liberada` e `liberar_em` |
| V107 | produção | Documentos PDF: `tema_pdf` e `opcoes_pdf` |
| V108 | produção | WhatsApp: uma linha por fato (`ocorrencia`) |
| V109 | produção | Contrato: responsável por link e guarda (`grupo_id`, `assinante_declarou_responsavel`, `apagado_em`) |
| V110 | produção | Overtraining Pay (Asaas): `subconta_asaas`, `cliente_asaas_aluno`, `forma_de_recebimento.overtraining_pay`, colunas de split e de cobrança Asaas |
| V111 | leva 1, em `origin/main` | Plano na inscrição: `questionario.mostrar_preco_dos_planos` e `inscricao.plano_comercial_id` (FK composta, `ON DELETE SET NULL`) |
| V112 | leva 1 (antes V190) | Regras de atenção: `regra_de_atencao`, `atualizacao_atencao`, `usuario.push_atencao` e o tipo `ATUALIZACAO_ATENCAO` em `push_envio` |
| V113 | leva 1 (antes V199) | Cardio na biblioteca: `exercicio.tipo_de_cardio`, `cardio_mede_distancia` e `cardio_mede_ritmo` |
| V114 | leva 1 (antes V191) | Exceção por aluno das regras de atenção: `regra_de_atencao_aluno` |
| V115 | leva 2 (Java) | `receita.origem` (`PADRAO` ou `CONSULTORIA`), backfill pelas listas padrão; testada em `OrigemDaReceitaIntegrationTest` |
| V116 | leva 2 | `inscricao.plano_outro_texto` (varchar 120, nula): texto próprio do "Outro" do plano; testada em `PlanoOutroNaInscricaoIntegrationTest` |

Contagens de migrations (`FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`): conferir o total da leva 2 no teste antes do push (o AGENTS cita 115 com a V116).

### (b) Chaves `TREINOS_*` (`api/src/main/resources/application.yml`, `docker-compose.yml`, `.env.example`)
Padrão = valor do yml quando a variável não vem. Pré-requisito = o que a API exige para subir ligada.
**Em produção as variáveis vêm de `/opt/ecossistema/consultoria.env`: o padrão do yml só vale com a variável ausente.** Se o arquivo da VPS tiver a chave como `false`, ela continua desligada até o Gustavo mudar o arquivo e recarregar a API (procedimento em P5).

Ligadas por padrão no yml (11, leva 1): CICLO, RETORNO, PUSH, CONTRATOS, VITRINE, LOJA, MARKETPLACE, UNIDADE_CARGA, MIGRACAO_ASSISTIDA, PAGAMENTOS e REGRAS_ATENCAO. Seguem desligadas as que pedem segredo ou decisão.

Nota: `docker-compose.yml` traz `TREINOS_CADASTRO_ABERTO` com padrão `true` (`:-true`), enquanto o yml traz `false`. Em produção vale o `consultoria.env`; a divergência do compose só afeta o ambiente local. Ajustar ou aceitar antes do deploy.

| Nome | yml | compose | .env.example | Pré-requisito para subir | Decisão |
| --- | --- | --- | --- | --- | --- |
| `TREINOS_PAGAMENTOS_HABILITADO` | true | true | true | nenhum | ligada (D1) |
| `TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO` | false | false | false | `TREINOS_PAGAMENTOS_CHAVES`, `_CHAVE_ATIVA`, `_URL_PUBLICA` (https) | ligar (D1), com as chaves prontas |
| `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO` | false | ausente | false | as mesmas da InfinitePay; `_URL_API` (padrão https) | ligar (D1), com a credencial cadastrada |
| `TREINOS_PAGAMENTOS_ASAAS_HABILITADO` | false | ausente | false | `_CHAVES`, `_CHAVE_ATIVA`, `_ASAAS_API_KEY_MATRIZ` e URL pública https | não ligar (D2) |
| `TREINOS_PAGAMENTOS_PAGAR_NO_IOS` / `_ANDROID` | false | false | false | nenhum | desligadas até resposta das lojas |
| `TREINOS_CONTRATOS_HABILITADO` | true | true | true | nenhum | ligada (D1) |
| `TREINOS_WHATSAPP_HABILITADO` | false | false | false | `TREINOS_WHATSAPP_CHAVES` e `_CHAVE_ATIVA` | desligada: falta chave (decisão pendente do Gustavo) |
| `TREINOS_PUSH_HABILITADO` | true | true | true | `TREINOS_PUSH_EXPO_TOKEN` se exigido pelo envio | ligada (D1) |
| `TREINOS_RETORNO_HABILITADO` | true | true | true | nenhum | ligada (D1) |
| `TREINOS_EMAIL_HABILITADO` | false | false | false | com `_PROVEDOR=resend`, `_RESEND_API_KEY` e `_REMETENTE` (compose e `.env.example` trazem `log`) | ligar após a chave Resend na VPS |
| `TREINOS_CADASTRO_ABERTO` | false | `:-true` | ausente | nenhum | manter false: consultoria nova entra pela Central |
| `TREINOS_PLANO_APLICAR` | false | false | false | configurar o produto na Central antes | decisão pendente do Gustavo |
| `TREINOS_TURNSTILE_HABILITADO` | false | false | false | `_SITE_KEY`, `_SEGREDO`, `_HOSTNAME` | decisão pendente do Gustavo |
| `TREINOS_FOTOS_HABILITADO` | false | false | false | endpoint, bucket, chave e segredo | decisão pendente do Gustavo |
| `TREINOS_INTEGRACAO_ATIVA` | false | false | false | chaves geradas pelo `ligar-integracao.sh` na VPS | pendente: só na VPS |
| `TREINOS_CICLO_HABILITADO` | true | true | true | nenhum | ligada (leva 1) |
| `TREINOS_UNIDADE_CARGA_HABILITADA` | true | true | true | nenhum | ligada (leva 1) |
| `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA` | true | true | true | nenhum | ligada (leva 1) |
| `TREINOS_VITRINE_HABILITADA` | true | true | true | nenhum | ligada (leva 1) |
| `TREINOS_LOJA_HABILITADA` | true | true | true | nenhum | ligada (leva 1) |
| `TREINOS_MARKETPLACE_HABILITADO` | true | true | true | vitrine e loja ligadas | ligada (leva 1) |
| `TREINOS_REGRAS_ATENCAO_HABILITADO` | true | true | true | nenhum | ligada (leva 1); R7, R8 e C4 decididos pelo Gustavo em 27/11 |
| `TREINOS_CARDIO_INTERVALADO_HABILITADO` | false | false | false | APK com o timer publicado nas lojas | desligada (D6) |

### (c) Chaves da Central (`CENTRAL_*`)
Não relidas nesta atualização. Lugar em produção: `/opt/ecossistema/central.env` (CENTRAL_*) e `/opt/ecossistema/consultoria.env` (TREINOS_*), conforme
`central-api-back/deploy/README.md` (repo `C:\Users\gusta\Documents\central-unificada`, leitura). Valores de segredo não constam aqui.

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
PRONTO: **não**. O roteiro e o checklist completo estão em `docs/planos/overtraining-pay-asaas/overtraining-pay-asaas.md` (e `ligacao-passo-a-passo.md`).
Falta, do lado da Central:
1. Chave de API de produção e URL base de produção (hoje o padrão é o sandbox).
2. `CENTRAL_ASAAS_SOCIO_WALLET_ID`.
3. Webhook token e URL pública, e a configuração do webhook no painel do Asaas.
4. Homologação com cobrança de R$ 5,00, com o resultado registrado.
5. Decidir o fluxo de cartão e a política de split (`ABATER_MENSALIDADE` responde 409 na Central).
6. Divergência do default de `CENTRAL_PAGAMENTO_PROVEDOR` (ASAAS no yml × MERCADOPAGO no `.env.example`/README) a resolver.

Falta, do lado da consultoria (Overtraining Pay): `TREINOS_PAGAMENTOS_ASAAS_API_KEY_MATRIZ`, `TREINOS_PAGAMENTOS_ASAAS_WALLET_MATRIZ`, `TREINOS_PAGAMENTOS_ASAAS_WALLET_SOCIO`, `TREINOS_PAGAMENTOS_ASAAS_URL_BASE` (sandbox primeiro) e a URL pública https. Sem valor de segredo no repositório.

## Passos
- [x] P1. Frentes de tela da leva 1 integradas (editor de treino e dieta, Início do aluno, Personalizar, Marca, Auditoria, Inscrição, App do aluno no PC, Água, cardio/HIIT P1, P3 e P4a); o que ficou para a leva 2 está no README, Pendências soltas — commit/run: c9d16c8e (publicado).
- [x] P2. Leva 1: merge da pasta principal, da rodada de 28/11 (só a onda 1) e das regras de atenção; V190, V199 e V191 renumeradas para V112, V113 e V114 — commit/run: c9d16c8e.
- [x] P3. Leva 1: verificação antes do push (tsc, lint, jest, `mvn verify`, e2e) — registrada como verde pelo pedido de publicação; conferência por execução não refeita nesta atualização — commit/run: c9d16c8e.
- [x] P4. Leva 1: PR, CI verde, push fast-forward na `main` — commit/run: c9d16c8e (CI verde informado no pedido; deploy não conferido aqui).
- [ ] P4b. Leva 2 (`leva-2`, 6 commits, não publicada): verificação em série (`npm run typecheck`, `lint`, `jest`, `mvn verify` e os e2e das áreas tocadas), PR, CI verde, push — commit/run: —
- [ ] P5. Chaves na VPS (procedimento abaixo, executado pelo Gustavo; sem valor de segredo no repo) — commit/run: —
- [x] P6. LGPD mínima: apagar os fatos das regras de atenção ao anonimizar ou excluir aluno (código da leva 1, publicado em c9d16c8e); a exportação e o resto ficam com prazo 15/12 no README dos planos — commit/run: c9d16c8e.

### P5: procedimento para o Gustavo na VPS (não executado pela sessão)
Objetivo: confirmar que as 11 chaves ligadas por padrão não estão `false` no `consultoria.env`.
1. Listar só os nomes das variáveis (sem imprimir valores, porque o arquivo tem segredos):
   `grep -oE '^TREINOS_[A-Z_]+' /opt/ecossistema/consultoria.env | sort -u`
   Procurar, entre elas, estas 11: `TREINOS_CICLO_HABILITADO`, `TREINOS_RETORNO_HABILITADO`, `TREINOS_PUSH_HABILITADO`, `TREINOS_CONTRATOS_HABILITADO`, `TREINOS_VITRINE_HABILITADA`, `TREINOS_LOJA_HABILITADA`, `TREINOS_MARKETPLACE_HABILITADO`, `TREINOS_UNIDADE_CARGA_HABILITADA`, `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA`, `TREINOS_PAGAMENTOS_HABILITADO`, `TREINOS_REGRAS_ATENCAO_HABILITADO`.
2. Para cada uma que aparecer com `=false`, trocar para `=true` ou apagar a linha (apagar vale porque o padrão do yml é `true` com a variável ausente). Ver só a linha da chave: `grep -n '^TREINOS_CICLO_HABILITADO=' /opt/ecossistema/consultoria.env` (repetir o nome).
3. Não mexer em `TREINOS_CARDIO_INTERVALADO_HABILITADO`, `TREINOS_WHATSAPP_HABILITADO`, `TREINOS_PAGAMENTOS_ASAAS_HABILITADO` nem `CENTRAL_ASAAS_HABILITADO` neste passo.
4. Recarregar só a API (contêiner novo lendo o arquivo):
   `bash /opt/ecossistema/central-api-back/deploy/recriar.sh consultoria api`
   Não recriar a Central nem a Evolution para isso.
5. Conferir no app logado que as telas das chaves aparecem (ou `GET /eu` com as flags `true`) e registrar em P5 a data e o que foi mudado (nome da chave, sem valor).

## Fora do escopo
- Ligar `CENTRAL_ASAAS_HABILITADO` antes do checklist (d) estar fechado.
- Ligar `TREINOS_CARDIO_INTERVALADO_HABILITADO` antes do APK com o timer nas lojas.
- Exportação LGPD e demais itens de LGPD: prazo 15/12.

## O que ficou para trás
- Leva 2: verificação final, push e PR (P4b). Nada aqui está como aprovado sem execução.
- Chaves na VPS (P5): o Gustavo confere `/opt/ecossistema/consultoria.env` e recarrega a API conforme acima.
- Asaas: `CENTRAL_ASAAS_HABILITADO` segue desligado e o checklist (d) **não está pronto**.
- Leva 2, itens abertos: onda 2 da rodada de 28/11 (branch `onda2-rodada`, não publicada), cardio P2, P4b e P5, ordem D16 do APK, `ui/EscolhaSuspensa` na série aberta. Texto de "Outro" na inscrição completa: campo próprio pronto (V116); decisão pendente do Gustavo sobre obrigatório (hoje, `app/src/app/inscricao/[codigo].tsx` ~431) × opcional (pedido).
- Pendência de implementação: `GET`/`PUT /eu/preferencias-de-push` sem 503 com a chave desligada (`regras-de-atencao.md`).
