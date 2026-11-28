# Liberação para o cliente de 01/12

Situação (29/11): chaves da leva 2 ligadas por padrão (D7 a D9, seção (b)) e V117 de preenchimento, sem commit. Antes: leva 1 publicada em `origin/main` (c9d16c8e, 27/11, CI verde). Leva 2 local na branch `leva-2` (HEAD d57b1ca5 + mudanças sem commit), não publicada · Onde: `main` (leva 1) e `leva-2` (leva 2) · Atualizado: 29/11/2026

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
| D7 | Regra fixa: **tudo liberado em produção**. Toda chave de funcionalidade nasce `true` (inclusive plano aplicado, IA enviar dados e Pagar no iOS/Android; o cadastro aberto ficou com a D8); nada espera revisão jurídica ou LGPD. A chave que depende de segredo fica `false` no padrão só se, ligada sem ele, a API recusasse a subida (ou fingisse funcionar); o que falta está na seção (b). Substitui o que divergir da D1; a D2 (`CENTRAL_ASAAS_HABILITADO`) conflita com esta regra e é do repositório da Central: decisão do Gustavo | ligar tudo; exceção só a D6 | Gustavo (28/11) |
| D8 | Cadastro aberto **com o Turnstile ligado**: o padrão de `TREINOS_CADASTRO_ABERTO` volta a `false` (yml, compose e `.env.example`), para uma variável esquecida não abrir o cadastro sem proteção; `TREINOS_CADASTRO_ABERTO=true` só vai ao `consultoria.env` depois de o Turnstile estar ligado e testado (P5, passo 7) | aberto, só depois do Turnstile; padrão `false` | Gustavo (29/11) |
| D9 | "Pagar" no celular e IA da importação ficam ligados, cientes dos riscos (revisão das lojas; texto do arquivo com dados pessoais ao provedor). Ao submeter o app à App Store, o "Pagar" fica **desligado no iOS** (`TREINOS_PAGAMENTOS_PAGAR_NO_IOS=false` no ambiente que a revisão da Apple acessa) e só volta a `true` com a resposta da Apple | ligados; iOS desligado na revisão | Gustavo (29/11) |
| D10 | Ninguém perde função ao ligar o plano aplicado: a V117 dá MOBILIDADE, PDF e EQUIPE a toda linha existente de `direitos_locais` (só acrescenta; consultoria sem linha continua sem linha) | migration de preenchimento | Gustavo (29/11) |

## Inventário

### (a) Migrations V102 em diante
Produção: V102 a V110 (deploy verde `fb57efa9` em 27/11 15:48 UTC, informado no pedido; não conferido aqui).
`origin/main` (leva 1, c9d16c8e): V111 a V114 (renumeradas no merge, 27/11).
Branch `leva-2` (local, não publicada): V115 (Java, sem arquivo SQL: origem da receita, `receita.origem`), V116 (SQL, texto de "Outro" na inscrição) e V117 (SQL, funcionalidades das consultorias existentes). Próximo número livre: V118. A leva 4 tem uma V117 provisória: no merge dela, renumerar para V118 e subir os totais dos testes.

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
| V117 | leva 2 | Preenchimento (D10): toda linha de `direitos_locais` ganha MOBILIDADE, PDF e EQUIPE que faltarem (caixa ignorada, como o `PlanoDaConsultoria`); não remove nada, não cria linha, não muda limites, versão nem `confirmado_em`; idempotente; testada em `ConsultoriasExistentesGanhamFuncionalidadesIntegrationTest` |

Contagens de migrations (`FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`): conferir o total da leva 2 no teste antes do push (116 com a V117).

### (b) Chaves `TREINOS_*` (`api/src/main/resources/application.yml`, `docker-compose.yml`, `.env.example`)
Atualizado em 28/11 (D7), sobre a `leva-2` (HEAD d57b1ca5 + mudanças locais sem commit). Fonte: leitura do `application.yml`, dos
`*Properties` que validam a subida (`TurnstileProperties`, `FotosProperties`, `WhatsAppProperties`, `InfinitePayProperties`,
`KiwifyProperties`, `AsaasProperties`, `ChavesDeIntegracao`) e do compose de produção (`central-api-back/deploy/apps/consultoria/docker-compose.yml`,
só leitura: usa `env_file: consultoria.env` e não fixa nenhuma `TREINOS_*` em `environment:`, então o padrão do yml chega à produção).
Teste que trava os padrões e prova a subida sem nenhum segredo: `ChavesPadraoDaProducaoIntegrationTest`.

**Em produção vale o `/opt/ecossistema/consultoria.env`.** O padrão do yml só vale com a variável **ausente**: uma linha
`TREINOS_X=false` desliga, e uma linha **vazia** (`TREINOS_X=`, como no `.env.example` da Central) também não pega o padrão.
Por isso o P5 grava `=true` explícito em cada chave ligada.

| Chave | Estado em produção (padrão do yml) | O que falta (se faltar) |
| --- | --- | --- |
| `TREINOS_PAGAMENTOS_HABILITADO` | ligada | — |
| `TREINOS_CONTRATOS_HABILITADO` | ligada | — |
| `TREINOS_RETORNO_HABILITADO` | ligada | — |
| `TREINOS_PUSH_HABILITADO` | ligada | opcional: `TREINOS_PUSH_EXPO_TOKEN` (só se o projeto do Expo exigir "enhanced security"; vazio envia sem Authorization) |
| `TREINOS_CICLO_HABILITADO` | ligada | — |
| `TREINOS_UNIDADE_CARGA_HABILITADA` | ligada | — |
| `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA` | ligada | — |
| `TREINOS_VITRINE_HABILITADA`, `TREINOS_LOJA_HABILITADA`, `TREINOS_MARKETPLACE_HABILITADO` | ligadas | — |
| `TREINOS_REGRAS_ATENCAO_HABILITADO` | ligada | — |
| `TREINOS_CEP_HABILITADO` | ligada | — |
| `TREINOS_CADASTRO_ABERTO` | **desligada no padrão (D8)**: liga pelo `consultoria.env` (`TREINOS_CADASTRO_ABERTO=true`) só depois do Turnstile ligado e testado | `TREINOS_TURNSTILE_SITE_KEY`, `TREINOS_TURNSTILE_SEGREDO`, CSP liberando `challenges.cloudflare.com`, `TREINOS_TURNSTILE_HABILITADO=true`; só então `TREINOS_CADASTRO_ABERTO=true`. Atenção: aberto, qualquer pessoa cria consultoria, descobre se um e-mail já tem conta e pode ocupar o e-mail de quem vai contratar pela Central |
| `TREINOS_PLANO_APLICAR` | **ligada (nova)** | a V117 dá MOBILIDADE, PDF e EQUIPE a toda linha existente (D10); os limites (`alunos_ativos`, `membros_equipe`) passam a barrar o que é novo. Atenção: uma sincronização da Central com versão maior regrava a lista; o produto na Central precisa trazer as três |
| `TREINOS_PAGAMENTOS_PAGAR_NO_IOS` / `_ANDROID` | **ligadas, cientes (D9)** | o "Pagar" aparece no app do celular (cobrança do aluno e Assinatura do treinador). Ao submeter à App Store: `TREINOS_PAGAMENTOS_PAGAR_NO_IOS=false` no ambiente que a revisão acessa, e `true` de novo só com a resposta da Apple |
| `TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR` | **ligada, ciente (D9)** | sem efeito enquanto `TREINOS_IA_PROVEDOR=regras` (padrão). Para a IA funcionar: `TREINOS_IA_PROVEDOR=gemini` + `TREINOS_IA_GEMINI_API_KEY`, ou `=claude` + `TREINOS_IA_CLAUDE_API_KEY`. Atenção: ligada, o texto extraído do arquivo (nome, peso, dieta, CPF, e-mail, telefone e CEP) vai ao provedor |
| `TREINOS_IA_ENVIAR_ARQUIVO_AO_PROVEDOR` | leva 4 (outra branch) | não existe na `leva-2` |
| `TREINOS_EMAIL_HABILITADO` | desligada | `TREINOS_EMAIL_PROVEDOR=resend`, `TREINOS_EMAIL_REMETENTE` (`Nome <endereço>` de domínio verificado no Resend), `TREINOS_EMAIL_RESEND_API_KEY` (chave "Sending access" do domínio); depois `=true`. Não liga por padrão: com o provedor `log` a API sobe, mas "esqueci a senha" e convites não chegam e a tela diria que enviou |
| `TREINOS_TURNSTILE_HABILITADO` | desligada (ligada sem segredo, a API não sobe) | `TREINOS_TURNSTILE_SITE_KEY`, `TREINOS_TURNSTILE_SEGREDO` (opcional `TREINOS_TURNSTILE_HOSTNAME`) e a CSP do site liberando `challenges.cloudflare.com`; depois `=true` |
| `TREINOS_WHATSAPP_HABILITADO` | desligada (não sobe sem segredo) | `TREINOS_WHATSAPP_CHAVES`, `TREINOS_WHATSAPP_CHAVE_ATIVA`, `TREINOS_WHATSAPP_META_APP_SECRET`, `TREINOS_WHATSAPP_META_VERIFY_TOKEN` (e o app da Meta com o webhook); depois `=true` |
| `TREINOS_FOTOS_HABILITADO` | desligada (não sobe sem segredo) | `TREINOS_FOTOS_ENDPOINT`, `TREINOS_FOTOS_BUCKET`, `TREINOS_FOTOS_CHAVE`, `TREINOS_FOTOS_SEGREDO` (bucket R2 privado); depois `=true` |
| `TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO` | desligada (não sobe sem segredo) | `TREINOS_PAGAMENTOS_CHAVES`, `TREINOS_PAGAMENTOS_CHAVE_ATIVA`, `TREINOS_PAGAMENTOS_URL_PUBLICA` (https); depois `=true` |
| `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO` | desligada (não sobe sem segredo) | as mesmas três da InfinitePay; depois `=true` (a credencial de cada treinador é cadastrada na tela) |
| `TREINOS_PAGAMENTOS_ASAAS_HABILITADO` | desligada (não sobe sem segredo) | as três acima + `TREINOS_PAGAMENTOS_ASAAS_API_KEY_MATRIZ`; para cobrar de verdade também `TREINOS_PAGAMENTOS_ASAAS_URL_BASE` de produção, `_WALLET_MATRIZ` e `_WALLET_SOCIO` (checklist (d)); depois `=true` |
| `TREINOS_INTEGRACAO_ATIVA` | desligada (não sobe sem segredo) | `TREINOS_INTEGRACAO_CHAVES_ENTRADA`, `_CHAVE_SAIDA_ID`, `_CHAVE_SAIDA_SEGREDO`, `_CENTRAL_URL` (gerados pelo `ligar-integracao.sh` da Central); depois `=true` |
| `TREINOS_INTEGRACAO_BLOQUEIO_ATIVO` | desligada (não é funcionalidade) | ligar só com `TREINOS_INTEGRACAO_ATIVA=true` sincronizando: sem ela, consultoria com linha em `direitos_locais` confirmada há mais de 72 h perde o login |
| `TREINOS_CARDIO_INTERVALADO_HABILITADO` | desligada (D6, única exceção) | o APK novo com o timer nos aparelhos de teste |
| Jobs (`*_AGENDADA`, `*_AGENDADOS`, `*_CONCILIACAO_ATIVA`, `TREINOS_PUSH_ENVIO_AGENDADO`, `TREINOS_WHATSAPP_ENVIO_AGENDADO`) | ligados | — (só os testes desligam) |

MFA não tem chave: sem `TREINOS_MFA_CHAVES` e `TREINOS_MFA_CHAVE_ATIVA` o login funciona e ativar o MFA responde 503.

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
Só instruções; nenhum valor de segredo aqui. O compose de produção só usa `env_file`: **assim que a `leva-2` for publicada, toda
chave ligada por padrão que não estiver no `consultoria.env` liga sozinha** (o cadastro aberto não: o padrão dele é `false`). Por isso os
passos 1 a 3 vêm ANTES do deploy.

**Antes do deploy da `leva-2`**
1. Cópia de segurança: `cp -p /opt/ecossistema/consultoria.env /opt/ecossistema/consultoria.env.antes-2911`.
2. Ver só as linhas das chaves de funcionalidade (valores `true`/`false`, sem segredo):
   `grep -nE '^TREINOS_[A-Z_]*(HABILITAD[OA]|ABERTO|APLICAR|INTEGRACAO_ATIVA|BLOQUEIO_ATIVO|PAGAR_NO_IOS|PAGAR_NO_ANDROID|ENVIAR_DADOS_AO_PROVEDOR)=' /opt/ecossistema/consultoria.env`
3. Gravar as chaves (troca a linha se existir, acrescenta se faltar; linha vazia não pega o padrão). A primeira linha garante a
   quebra de linha no fim do arquivo, para o `echo` não colar na última linha:
   ```
   F=/opt/ecossistema/consultoria.env
   [ -n "$(tail -c1 "$F")" ] && echo >> "$F"
   gravar_chave() { if grep -q "^$1=" "$F"; then sed -i "s/^$1=.*/$1=$2/" "$F"; else echo "$1=$2" >> "$F"; fi; }
   for k in TREINOS_PAGAMENTOS_HABILITADO TREINOS_CONTRATOS_HABILITADO TREINOS_RETORNO_HABILITADO TREINOS_PUSH_HABILITADO \
            TREINOS_CICLO_HABILITADO TREINOS_UNIDADE_CARGA_HABILITADA TREINOS_MIGRACAO_ASSISTIDA_HABILITADA \
            TREINOS_VITRINE_HABILITADA TREINOS_LOJA_HABILITADA TREINOS_MARKETPLACE_HABILITADO TREINOS_REGRAS_ATENCAO_HABILITADO \
            TREINOS_CEP_HABILITADO TREINOS_PLANO_APLICAR TREINOS_PAGAMENTOS_PAGAR_NO_IOS TREINOS_PAGAMENTOS_PAGAR_NO_ANDROID \
            TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR; do gravar_chave "$k" true; done
   gravar_chave TREINOS_CADASTRO_ABERTO false               # D8: o padrão já é false; a linha explícita evita um true antigo. true só no passo 7
   gravar_chave TREINOS_CARDIO_INTERVALADO_HABILITADO false # D6
   ```
   Se o app estiver em revisão na App Store, gravar também `gravar_chave TREINOS_PAGAMENTOS_PAGAR_NO_IOS false` (D9).
4. Não ligar sem o segredo: `TREINOS_EMAIL_HABILITADO`, `TREINOS_TURNSTILE_HABILITADO`, `TREINOS_WHATSAPP_HABILITADO`,
   `TREINOS_FOTOS_HABILITADO`, `TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO`, `_KIWIFY_HABILITADO`, `_ASAAS_HABILITADO` e
   `TREINOS_INTEGRACAO_ATIVA` ficam `false` (ou ausentes: o padrão delas é `false`) até as variáveis da tabela (b) existirem; ligadas e
   incompletas, a API não sobe. `TREINOS_INTEGRACAO_BLOQUEIO_ATIVO` só junto com a integração.

**Depois do deploy** (a V117 roda na subida)
5. Conferir que toda linha de `direitos_locais` tem as três funcionalidades (banco `consultoria`, Postgres da VPS, projeto `banco`):
   `select consultoria_id, funcionalidades, limites from direitos_locais where not (funcionalidades @> array['MOBILIDADE','PDF','EQUIPE']);`
   Esperado: nenhuma linha (código em minúsculas aparece aqui e conta como liberado pelo app; só confira). Se aparecer linha sem um
   dos três, voltar `TREINOS_PLANO_APLICAR=false` (passo 3) e recriar a API. Os `limites` mostrados passam a barrar aluno e membro
   novos: conferir se cabem.
6. Quando um segredo existir, gravar um por vez, sem eco (`ssh -t`):
   `bash /opt/ecossistema/central-api-back/deploy/gravar-segredo.sh /opt/ecossistema/consultoria.env <NOME>`
   e só então trocar a chave da funcionalidade para `true` (`gravar_chave` do passo 3). Ordem sugerida, da menos à mais arriscada:
   e-mail (`TREINOS_EMAIL_PROVEDOR=resend`, `_REMETENTE`, `_RESEND_API_KEY`, depois `TREINOS_EMAIL_HABILITADO=true`); MFA
   (`TREINOS_MFA_CHAVES`, `_CHAVE_ATIVA`); Turnstile e cadastro (passo 7); fotos (R2); `TREINOS_PAGAMENTOS_CHAVES`, `_CHAVE_ATIVA`
   e `_URL_PUBLICA` (servem InfinitePay, Kiwify e Asaas); InfinitePay depois do teste de R$ 1; Kiwify; WhatsApp; integração com a
   Central (`ligar-integracao.sh`); Asaas só com o checklist (d) fechado.
   Chave AES (MFA, pagamentos, WhatsApp): `openssl rand -base64 32`, gravada como `k1:<valor>`, e a `_CHAVE_ATIVA` = `k1`.
7. Turnstile e cadastro aberto (D8), nesta ordem: (a) CSP do site liberando `challenges.cloudflare.com` (proxy em
   `central-api-back/deploy/proxy`); (b) `gravar-segredo.sh` para `TREINOS_TURNSTILE_SITE_KEY` e `TREINOS_TURNSTILE_SEGREDO`;
   (c) `gravar_chave TREINOS_TURNSTILE_HABILITADO true`, recriar a API e testar login e "esqueci a senha" com o desafio;
   (d) só então `gravar_chave TREINOS_CADASTRO_ABERTO true`, recriar a API e testar o "Criar conta de treinador" com o desafio.
8. Depois de mexer no arquivo com a API já publicada, recarregar só ela: `bash /opt/ecossistema/central-api-back/deploy/recriar.sh consultoria api`.
   Se não ficar saudável, o log diz o NOME da variável que falta; voltar a cópia do passo 1 e recriar de novo.
9. Conferir `GET /eu` logado (flags da tabela (b) no estado esperado) e `GET /publico/configuracao` (`cadastroAberto` só `true`
   depois do passo 7); registrar aqui a data e o que foi mudado (nomes, sem valor).

## Fora do escopo
- Ligar `CENTRAL_ASAAS_HABILITADO` antes do checklist (d) estar fechado.
- Ligar `TREINOS_CARDIO_INTERVALADO_HABILITADO` antes do APK com o timer nas lojas.
- Exportação LGPD e demais itens de LGPD: prazo 15/12.

## O que ficou para trás
- Leva 2: verificação final, push e PR (P4b). Nada aqui está como aprovado sem execução.
- Chaves na VPS (P5): o Gustavo grava `=true` nas chaves ligadas e os segredos que faltam (tabela (b)) e recarrega a API.
- O `.env.example` de `central-api-back/deploy/apps/consultoria/` traz as chaves vazias: atualizar lá (outro repositório) para os padrões novos.
- `CENTRAL_*` (repositório da Central) não foi alterado nesta rodada: D2 × D7 a decidir pelo Gustavo.
- Asaas: `CENTRAL_ASAAS_HABILITADO` segue desligado e o checklist (d) **não está pronto**.
- Leva 2, itens abertos: onda 2 da rodada de 28/11 (branch `onda2-rodada`, não publicada), cardio P2, P4b e P5, ordem D16 do APK, `ui/EscolhaSuspensa` na série aberta. Texto de "Outro" na inscrição completa: campo próprio pronto (V116); decisão pendente do Gustavo sobre obrigatório (hoje, `app/src/app/inscricao/[codigo].tsx` ~431) × opcional (pedido).
- Pendência de implementação: `GET`/`PUT /eu/preferencias-de-push` sem 503 com a chave desligada (`regras-de-atencao.md`).
