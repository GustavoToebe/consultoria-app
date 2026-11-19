package br.com.treinos.api.pagamentos;

/**
 * Contrato HTTP da credencial da Kiwify ({@code GET/PUT/DELETE /financeiro/kiwify}; contrato do app em
 * {@code app/src/api/financeiroKiwify.ts}). Os quatro segredos só entram: nenhuma resposta, log, auditoria, mensagem de erro
 * nem {@code toString} os repete. O formato de cada campo é conferido no serviço (422 {@code KIWIFY_INVALIDA} por campo, sem
 * repetir o valor): o erro do Bean Validation o carregaria.
 */
public final class KiwifyDtos {

    private KiwifyDtos() { }

    /** Campo ausente (nulo) mantém o gravado; presente e em branco é 422 no campo. {@code versao} nula só ao criar. */
    public record KiwifyRequest(String tokenDoWebhook, String clientId, String clientSecret, String accountId, Long versao) {

        @Override
        public String toString() {
            return "KiwifyRequest[...]";
        }
    }

    /**
     * {@code webhookUrl} só vem com {@code FINANCEIRO_ALTERAR} (carrega o token do caminho da consultoria) e depois de
     * configurar; {@code clientIdFinal} são os 4 últimos caracteres do {@code client_id}.
     */
    public record KiwifyResponse(boolean configurada, String webhookUrl, String clientIdFinal, Long versao) {

        @Override
        public String toString() {
            return "KiwifyResponse[configurada=" + configurada + "]";
        }
    }
}
