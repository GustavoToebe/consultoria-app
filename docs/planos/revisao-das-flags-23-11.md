# Revisão das flags desligadas em produção (23/11/2026)

Situação: Concluída em 23/11/2026 (só leitura; nenhuma flag foi ligada e nenhum arquivo de código mudou por causa dela) · Onde: main · Atualizado: 23/11/2026

Fonte: pedido do Gustavo de 23/11/2026 (ligar todas, menos `TREINOS_PAGAMENTOS_PAGAR_NO_IOS`), leitura do código da `main` em `85631a6b` por sete agentes de leitura (explorador e revisor) e conferência das afirmações centrais pela sessão principal. Validade: vale até mudar o código de `auth/`, `integracao/`, `conta/`, `whatsapp/`, `vitrine/`, `pagamentos/Kiwify*`, `push/`, `ciclo/`, o `docker-compose.yml` ou os planos citados; refazer a leitura antes de ligar qualquer chave. Nenhum teste foi rodado para esta revisão, nenhum `.env` real foi lido, e o compose e o `consultoria.env` de produção (`central-api-back/deploy`) não foram conferidos.

## Objetivo
Dizer, flag por flag, o que a subida exige, se a tela existe, o que pode dar errado e se pode ligar.

## Resultado
| Flag | Segredos ou passos exigidos | Veredito |
| --- | --- | --- |
| `TREINOS_CADASTRO_ABERTO` | nenhum novo; o Turnstile precisa ficar ligado (nada trava a subida sem ele) | **NÃO LIGAR.** Quem cadastra o e-mail de um futuro cliente fica com a consultoria que a Central adotar depois (`ProvisionamentoService.java:80-95`); não há verificação de e-mail; o 409 revela e-mails de alunos; o link aparece no celular sem exclusão de conta do treinador (App Store 5.1.1(v)); o termo só existe para o aluno; consultoria criada assim não tem linha de direitos (sem limite). Precisa de: e-mail confirmado antes de a conta valer, adoção da Central que exija mais que o e-mail, termo do treinador, esconder o link no celular. |
| `TREINOS_INTEGRACAO_BLOQUEIO_ATIVO` | nenhum novo (a Central já está ligada) | **PRECISA DE** conferir `direitos_locais` por SELECT só de leitura (`consultoria_id, contratacao_id, situacao, acesso_liberado, confirmado_em`, sem dado pessoal): a linha do Saraiva tem de ser a da contratação real e `confirmado_em` com menos de ~9 h; testar a suspensão numa consultoria de teste (`docs/integracao-central.md:78`); ter o roteiro de destravar (desligar a chave e recriar a API é o mais rápido). Riscos: falha da Central por mais de 72 h derruba todos, sem alerta; barra também os alunos; a fila offline do aluno é apagada após 30 dias; o motivo vindo da Central aparece ao aluno. Nunca ligar com `TREINOS_INTEGRACAO_ATIVA=false`. |
| `TREINOS_PLANO_APLICAR` | nenhum | **PRECISA DE** conferir a mesma tabela: em toda consultoria real têm de estar `MOBILIDADE`, `PDF` e `EQUIPE` e os limites têm de estar acima do uso. Sem linha nada é barrado. Linha com `funcionalidades` vazia ou nula tira Mobilidade, Equipe e PDF; a marcação de mobilidade do aluno vira falha sem nova tentativa. Só uma versão maior dos direitos substitui a linha. |
| `TREINOS_CICLO_HABILITADO` | nenhum; sem job nem envio em lote | **NÃO LIGAR** até a revisão jurídica do consentimento e dos Termos (RASCUNHO) e o teste da tela ligada no aparelho. Dado sensível de saúde. |
| `TREINOS_PUSH_HABILITADO` | credencial FCM e APNs no EAS e APK novo; `TREINOS_PUSH_EXPO_TOKEN` é opcional | **NÃO LIGAR AINDA.** O `docker-compose.yml` não repassa a variável: no `.env` ela não chega à API. Confirmar o compose de produção. |
| `TREINOS_WHATSAPP_HABILITADO` | `TREINOS_WHATSAPP_CHAVES`, `_CHAVE_ATIVA`, `_META_APP_SECRET`, `_META_VERIFY_TOKEN`; webhook `https://overtraining.app/api/publico/whatsapp/meta` e modelos aprovados na Meta; conexão por consultoria na tela `/treinador/whatsapp` | **PRECISA DE** os quatro segredos e os passos na Meta; decidir o aplicativo único da Meta (C19) contra a conta própria de cada treinador (C24); corrigir o aviso de compromisso reaberto (não sai de novo); texto do aviso de privacidade; B12 e B13 de `contato-da-consultoria.md`. Ligar não envia nada em lote (opt-in nulo). |
| `TREINOS_VITRINE_HABILITADA` | nenhum | **PODE LIGAR** (rotas só da equipe e do aluno), com a ressalva do plano: nada liga em produção antes do teste de R$ 1 da InfinitePay. |
| `TREINOS_LOJA_HABILITADA` | nenhum | **PRECISA DE** F2a.3 (Ajuda em `0cd1279e`, fechamento verificado em 23/11), decisão sobre a regra do plano (vitrine + pagamentos + InfinitePay) que o código não aplica, e a decisão sobre a página que continua no ar para consultoria suspensa. Rotas públicas sem Turnstile, só com limite por IP; sem `noindex`. |
| `TREINOS_MARKETPLACE_HABILITADO` | nenhum | **NÃO LIGAR.** A tela `/consultorias` e o opt-in no app (F3.2) não existem; a rota pública responderia sem tela; jurídico em aberto. |
| `TREINOS_PAGAMENTOS_PAGAR_NO_ANDROID` | nenhum; só interface | **PRECISA DE** decisão do Gustavo sobre a política de pagamento do Google Play. Com a Kiwify no modo automático o aluno não vê "Pagar". |
| `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO` | `TREINOS_PAGAMENTOS_CHAVES`, `_CHAVE_ATIVA`, `_URL_PUBLICA` (as da InfinitePay); `TREINOS_PAGAMENTOS_HABILITADO` ligada; credencial de cada treinador no app | **PRECISA DE** o compose repassar a variável (hoje não repassa), um payload real da Kiwify, e a revisão do webhook (sem proteção contra repetição; sem varredura de vendas perdidas). |

`TREINOS_PAGAMENTOS_PAGAR_NO_IOS` fica desligada, como pedido.

## Dependências entre as chaves
- Marketplace depende da loja, e a loja da vitrine.
- Kiwify depende de `TREINOS_PAGAMENTOS_HABILITADO`.
- Bloqueio e plano aplicado são independentes, mas os dois tratam a consultoria sem linha de direitos como livre.
- Cadastro aberto cria consultoria sem linha e por isso contorna o bloqueio e o plano.

## Passos
- [x] 1. Mapear as 11 flags e o repasse ao container (explorador) — 23/11/2026, sem commit (só leitura)
- [x] 2. Revisar cadastro, bloqueio, plano e WhatsApp (revisor) — 23/11/2026, sem commit (só leitura)
- [ ] 3. O Gustavo decide quais ligar e em que ordem; antes de ligar cada uma, cumprir o "PRECISA DE" dela — responsável: Gustavo

## Fora do escopo
- Editar o compose ou o `.env`, ligar qualquer chave, mexer na VPS ou em produção.

## O que ficou para trás
- Editar o `docker-compose.yml` para repassar `TREINOS_PUSH_*` e `TREINOS_PAGAMENTOS_KIWIFY_*` (o compose de produção está em `central-api-back/deploy` e não foi conferido).
- SELECT em `direitos_locais` na produção (só o Gustavo roda; não traz dado pessoal).
- Decisões do Gustavo: ver "Pendências soltas" no `README.md` (suspensão na página pública, cupom sem opt-in próprio, `noindex`).
