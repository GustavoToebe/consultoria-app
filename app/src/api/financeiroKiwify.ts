import { requisicao } from './cliente';

/**
 * Contrato da Kiwify automática (D16 a D20 de `docs/planos/financeiro-em-fases.md`, frente F7, 18/11/2026). A API segue este
 * arquivo; o que as decisões não fixaram foi escolhido aqui, no padrão do recebimento online da InfinitePay, e está marcado
 * "(escolha)". Os tipos que mudam contratos existentes ficam em `financeiroTipos.ts` e `tipos.ts` e estão listados no fim.
 *
 * Chave `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO` (padrão `false`). Desligada: TODAS as rotas abaixo respondem 503
 * `KIWIFY_INDISPONIVEL` e `GET /eu` traz `kiwifyHabilitada: false`; o app esconde tudo da Kiwify (cartão, campos do plano,
 * selos e textos). Ligada sem as variáveis da cifra ou da URL pública, a API não sobe (como `ExigeInfinitePay`). Tudo também
 * atrás de `@ExigePagamentos` (financeiro desligado = 503 `FINANCEIRO_INDISPONIVEL`, como sempre).
 *
 * ---- Credencial por consultoria (`GET/PUT/DELETE /financeiro/kiwify`) ----
 * Ler: `FINANCEIRO_LER`. Gravar e remover: `FINANCEIRO_ALTERAR`. Os quatro valores (`tokenDoWebhook`, `clientId`,
 * `clientSecret`, `accountId`) são cifrados com a mesma AES-GCM da InfinitePay e NUNCA voltam ao app, a log, auditoria,
 * mensagem de erro nem `toString`. A resposta traz só `configurada`, `webhookUrl`, `clientIdFinal` e `versao`.
 * - `GET` não cria nada. Sem credencial: `{configurada:false, webhookUrl:null, clientIdFinal:null, versao:null}`.
 * - `PUT` cria (`versao` nula, os quatro obrigatórios) ou altera (`versao` = a que a tela viu; campo AUSENTE mantém o gravado,
 *   como a API Key da InfinitePay e a chave Pix). Criar com `versao` preenchida, ou alterar sem `versao` ou com versão velha =
 *   409 `CONFLITO_EDICAO`. Resposta 200 `KiwifyConfiguracao`.
 * - O token do CAMINHO do webhook (aleatório, por consultoria, 32 bytes em base64url) é gerado no primeiro `PUT`, como o
 *   `token_aviso` da InfinitePay (escolha), e não muda nas alterações. `DELETE` apaga a credencial E esse token: a URL antiga
 *   passa a dar 404 (o treinador tem de apagar o webhook no painel da Kiwify); configurar de novo gera URL nova.
 * - `webhookUrl` = `<TREINOS_PAGAMENTOS_URL_PUBLICA>/publico/pagamentos/kiwify/<token do caminho>` (a mesma base https da
 *   InfinitePay). Só vem para quem tem `FINANCEIRO_ALTERAR` (nulo para quem só lê): ela carrega o token da consultoria
 *   (escolha). O app só mostra e copia; nunca a grava no aparelho nem a põe em aviso, rótulo ou log.
 * - `clientIdFinal`: os 4 últimos caracteres do `client_id` (escolha), para a tela dizer "termina em a1b2". Nulo sem credencial.
 * - Validação (422 `KIWIFY_INVALIDA` com `fieldErrors` por campo: `tokenDoWebhook`, `clientId`, `clientSecret`, `accountId`;
 *   a mensagem nunca repete o valor): depois do strip, `tokenDoWebhook` de 16 a 200 caracteres (escolha: sem token a chave do
 *   HMAC é vazia e a assinatura não prova nada, D17), `clientId`, `clientSecret` e `accountId` de 1 a 200, sem espaço nem
 *   caractere de controle. Campo presente e em branco = 422 no campo (não apaga).
 * - Trocar o `tokenDoWebhook`: a API aceita o anterior por 24 horas para os reenvios antigos (pesquisa de 18/11).
 * - `DELETE /financeiro/kiwify?versao=N` → 204; versão diferente = 409 `CONFLITO_EDICAO`; sem credencial = 204 (idempotente).
 *   As cobranças e baixas já gravadas não mudam; os planos continuam marcados (as mensalidades seguem geradas, D18), mas sem
 *   credencial `cobrancaAutomatica` vem nulo (seção "Cobranças e aluno").
 * - Auditoria `KIWIFY_CONFIGURADA` / `KIWIFY_REMOVIDA` com resumo fixo (escolha dos nomes).
 *
 * ---- Webhook público (`POST /publico/pagamentos/kiwify/{token}`) ----
 * `permitAll`, em `CONTROLLERS_PUBLICOS`, no padrão do `AvisoInfinitePayController`: token malformado ou desconhecido 404 sem
 * gravar; corpo acima de 16 KiB 413 `CORPO_EXCEDIDO`; `?signature=` (HMAC-SHA1 do corpo cru com o `tokenDoWebhook`, 40 hex
 * minúsculos) ausente ou errado 401 sem gravar, comparado em tempo constante; malformado 400 `AVISO_INVALIDO`. Grava em
 * `aviso_de_pagamento` (provedor `KIWIFY`, só identificadores e o sha256 do corpo, nunca o corpo) antes do 200. O aviso
 * sozinho nunca dá baixa: o conciliador consulta `GET /v1/sales/{order_id}` e confere `status=paid`, `product.id`,
 * `customer.email` e o valor (D17; pesquisa de 18/11). Idempotente por `order_id` + `webhook_event_type`.
 *
 * ---- Baixa e "Para conferir" (D19) ----
 * Baixa automática: forma `KIWIFY`, provedor `KIWIFY`, `idExterno` = id da venda (`order_id`), `valorPagoCentavos` guardado,
 * na mensalidade ABERTA mais antiga da contratação ATIVA no plano do produto, do aluno achado pelo e-mail da compra
 * (`aluno.email`, sem ele o de login). A baixa da Kiwify não se desfaz pelo app (como a da InfinitePay: só a `MANUAL`).
 * Tudo o que não se aplica direto vira aviso CONFERIR, nunca baixa, com os motivos `KIWIFY_*` de `MotivoDaConferencia` e
 * `VALOR_DIFERENTE` / `CONSULTA_FALHOU` reaproveitados. `GET /financeiro/conferencias` (mesma permissão de antes) passa a
 * responder com a InfinitePay OU a Kiwify ligada (503 `RECEBIMENTO_ONLINE_INDISPONIVEL` só com as duas desligadas) e traz os
 * avisos dos dois provedores, cada um com `provedor`; `POST /financeiro/conferencias/{id}/conferido` não muda.
 *
 * ---- Plano comercial (D17) ----
 * `PlanoRequest`/`PlanoResponse` ganham `kiwifyAssinatura` ("Assinatura cobrada pela Kiwify") e `kiwifyProdutoId` (o id do
 * produto na Kiwify). Só plano `MENSAL`: ligado em outra periodicidade = 422 `PLANO_INVALIDO` no campo `kiwifyAssinatura`.
 * Ligado sem produto (vazio depois do strip) = 422 no campo `kiwifyProdutoId`; de 1 a 100 caracteres, letras, dígitos, `-` e
 * `_`; o mesmo produto em outro plano NÃO arquivado da consultoria = 422 no campo `kiwifyProdutoId` (escolha: senão a
 * conciliação não saberia qual plano). Desligado, `kiwifyProdutoId` vai nulo e é gravado nulo. Com a chave desligada a API
 * ignora os dois campos do corpo e mantém o gravado (o app reenvia o que leu, porque o `PUT` substitui inteiro).
 *
 * ---- Cobranças e aluno (D18) ----
 * `CobrancaResponse` e `CobrancaDoAluno` ganham `cobrancaAutomatica: 'KIWIFY' | null`: `'KIWIFY'` na MENSALIDADE de
 * contratação cujo plano tem `kiwifyAssinatura` ligada, calculado na leitura e SÓ com a chave ligada E a credencial da
 * consultoria configurada (no molde do `pagamentoOnline`, "configurado e ligado"); nulo nas outras, com a chave desligada e
 * sem credencial (depois do `DELETE`, ou plano marcado antes de configurar): aí a mensalidade volta a ser comum, com as
 * formas de pagamento e os lembretes de sempre. Tudo o que esta seção barra segue a mesma condição. Para o aluno, essa
 * mensalidade não tem "Pagar", link, Pix nem forma: `GET /aluno/financeiro` não a conta para `formasDePagamento`,
 * `POST /aluno/financeiro/cobrancas/{id}/link` e `/pix` respondem 409 `COBRANCA_AUTOMATICA` (escolha), o
 * `POST /cobrancas/{id}/link` da equipe também e o `POST /cobrancas/link-em-lote` devolve o item com `ok:false`,
 * `codigo:'COBRANCA_AUTOMATICA'` (falha definitiva, sem nova tentativa). Lembrete por e-mail (aluno e responsável) NÃO sai para ela, nem antes nem
 * depois de vencida, na primeira versão (D18); o "Abrir WhatsApp com a mensagem" da equipe continua. A equipe dá baixa
 * manual, desfaz a manual e cancela como em qualquer cobrança.
 *
 * ---- Mudanças em contratos existentes ----
 * - `GET /eu`: `kiwifyHabilitada` (`tipos.ts`; o app faz AND com `pagamentosHabilitados`).
 * - `FormaDePagamento` ganha `KIWIFY` (rótulo "Kiwify"; nunca escolhida na baixa manual).
 * - `MotivoDaConferencia` ganha os `KIWIFY_*`; `ConferenciaDePagamento` ganha `provedor` ('INFINITEPAY' | 'KIWIFY') e
 *   `idExterno` (o `order_id` da Kiwify, o `transaction_nsu` da InfinitePay; nulo se não veio). Nunca o e-mail do comprador.
 * - `PlanoRequest`/`PlanoResponse`: `kiwifyAssinatura`, `kiwifyProdutoId`.
 * - `CobrancaResponse`/`CobrancaDoAluno`: `cobrancaAutomatica`.
 */

/** O que a API devolve da credencial. Os segredos nunca vêm. `versao` nula = nada configurado. */
export interface KiwifyConfiguracao {
  configurada: boolean;
  /** URL pública do webhook, com o token da consultoria no caminho. Só com `FINANCEIRO_ALTERAR` e depois de configurar. */
  webhookUrl: string | null;
  /** Os 4 últimos caracteres do `client_id` (a tela mostra "termina em …"). */
  clientIdFinal: string | null;
  versao: number | null;
}

/**
 * Criar: os quatro e `versao` nula. Alterar: `versao` obrigatória e só os campos que a pessoa digitou de novo (ausente mantém
 * o gravado). Nenhum vai a log nem volta na resposta.
 */
export interface KiwifyRequest {
  tokenDoWebhook?: string;
  clientId?: string;
  clientSecret?: string;
  accountId?: string;
  versao: number | null;
}

/** Os campos do corpo, na ordem da tela (também os nomes dos `fieldErrors` do 422 `KIWIFY_INVALIDA`). */
export type CampoDaKiwify = 'tokenDoWebhook' | 'clientId' | 'clientSecret' | 'accountId';

/** Códigos novos de erro da Kiwify (os de sempre continuam: 403, 409 `CONFLITO_EDICAO`, 503 `FINANCEIRO_INDISPONIVEL`). */
export type CodigoDeErroDaKiwify = 'KIWIFY_INVALIDA' | 'KIWIFY_INDISPONIVEL' | 'COBRANCA_AUTOMATICA';

export const buscarKiwify = () => requisicao<KiwifyConfiguracao>('/financeiro/kiwify');

export const salvarKiwify = (corpo: KiwifyRequest) =>
  requisicao<KiwifyConfiguracao>('/financeiro/kiwify', { metodo: 'PUT', corpo });

/** A versão vai na query, como o `DELETE` do recebimento online. */
export const removerKiwify = (versao: number | null) =>
  requisicao<void>(`/financeiro/kiwify${versao == null ? '' : `?versao=${versao}`}`, { metodo: 'DELETE' });
