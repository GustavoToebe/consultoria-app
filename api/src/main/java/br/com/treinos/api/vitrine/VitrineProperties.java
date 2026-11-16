package br.com.treinos.api.vitrine;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Vitrine da consultoria ({@code TREINOS_VITRINE_HABILITADA}). Desligada por padrão: as rotas {@link ExigeVitrine} respondem
 * 503 {@code VITRINE_INDISPONIVEL} e o app esconde tudo ({@code vitrineHabilitada} no {@code GET /eu}).
 *
 * <p>{@code lojaHabilitada} ({@code TREINOS_LOJA_HABILITADA}, também desligada por padrão) liga a página pública da loja; as rotas
 * {@link ExigeLoja} respondem 503 {@code LOJA_INDISPONIVEL}. A loja só vale com a vitrine ligada ({@link #lojaEfetiva()}).
 * shortcut: a condição "pagamentos + InfinitePay" da D1 do plano é da venda (F2b) e ainda não entra; incluir quando houver pedido.
 * O marketplace (F3) terá chave própria.
 */
@ConfigurationProperties("treinos.vitrine")
public record VitrineProperties(boolean habilitada, boolean lojaHabilitada) {

    /** Vitrine ligada e loja ligada: o valor que o app e o interceptor usam. */
    public boolean lojaEfetiva() {
        return habilitada && lojaHabilitada;
    }
}
