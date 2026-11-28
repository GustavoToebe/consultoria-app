package br.com.treinos.api.vitrine;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Vitrine da consultoria ({@code TREINOS_VITRINE_HABILITADA}). Ligada por padrão (leva 1, 27/11; em produção vale o `consultoria.env`). Com a chave desligada, as rotas {@link ExigeVitrine} respondem
 * 503 {@code VITRINE_INDISPONIVEL} e o app esconde tudo ({@code vitrineHabilitada} no {@code GET /eu}).
 *
 * <p>{@code lojaHabilitada} ({@code TREINOS_LOJA_HABILITADA}, também ligada por padrão desde a leva 1, 27/11) controla a página pública da loja; as rotas
 * {@link ExigeLoja} respondem 503 {@code LOJA_INDISPONIVEL}. A loja só vale com a vitrine ligada ({@link #lojaEfetiva()}).
 * shortcut: a condição "pagamentos + InfinitePay" da D1 do plano é da venda (F2b) e ainda não entra; incluir quando houver pedido.
 *
 * <p>{@code marketplaceHabilitado} ({@code TREINOS_MARKETPLACE_HABILITADO}, ligada por padrão desde a leva 1, 27/11) controla a lista pública de lojas (F3); as
 * rotas {@link ExigeMarketplace} respondem 503 {@code MARKETPLACE_INDISPONIVEL}. O marketplace leva o visitante à página da loja, então
 * só vale com a loja efetiva ({@link #marketplaceEfetivo()}).
 */
@ConfigurationProperties("treinos.vitrine")
public record VitrineProperties(boolean habilitada, boolean lojaHabilitada, boolean marketplaceHabilitado) {

    /** Vitrine ligada e loja ligada: o valor que o app e o interceptor usam. */
    public boolean lojaEfetiva() {
        return habilitada && lojaHabilitada;
    }

    /** Loja efetiva e marketplace ligado: o valor que o app e o interceptor usam. */
    public boolean marketplaceEfetivo() {
        return lojaEfetiva() && marketplaceHabilitado;
    }
}
