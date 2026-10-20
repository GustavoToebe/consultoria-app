package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

/**
 * Recebimento online pela InfinitePay ({@code TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO}). Desligado por padrão: as rotas
 * do recebimento online respondem 503 {@code RECEBIMENTO_ONLINE_INDISPONIVEL}. Ligado, a API só sobe com as chaves de cifra
 * ({@link PagamentosProperties}) e com a URL pública https (sem chamada de rede na subida). Segredos só em variável de
 * ambiente, sem valor padrão.
 *
 * @param apiUrl           base da API de checkout da InfinitePay
 * @param urlPublica       URL https pela qual a internet alcança esta API; é a base do webhook que a InfinitePay chama
 * @param conciliacaoAtiva liga o conciliador agendado (desligado só nos testes, que o chamam à mão)
 */
@ConfigurationProperties("treinos.pagamentos.infinitepay")
public record InfinitePayProperties(boolean habilitado, String apiUrl, String urlPublica, Boolean conciliacaoAtiva) {

    static final String API_PADRAO = "https://api.checkout.infinitepay.io";

    public InfinitePayProperties {
        apiUrl = limpar(apiUrl).isEmpty() ? API_PADRAO : semBarraFinal(limpar(apiUrl));
        urlPublica = semBarraFinal(limpar(urlPublica));
        conciliacaoAtiva = conciliacaoAtiva == null || conciliacaoAtiva;
    }

    /** Falha a subida, dizendo só o NOME da variável que falta (nunca o valor). */
    void exigirCompleta(PagamentosProperties pagamentos) {
        if (!habilitado) {
            return;
        }
        faltando(pagamentos.chaves(), "TREINOS_PAGAMENTOS_CHAVES");
        faltando(pagamentos.chaveAtiva(), "TREINOS_PAGAMENTOS_CHAVE_ATIVA");
        faltando(urlPublica, "TREINOS_PAGAMENTOS_URL_PUBLICA");
        URI uri;
        try {
            uri = URI.create(urlPublica);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("TREINOS_PAGAMENTOS_URL_PUBLICA precisa ser uma URL https completa.");
        }
        if (uri.getHost() == null || !"https".equals(uri.getScheme())) {
            throw new IllegalStateException("TREINOS_PAGAMENTOS_URL_PUBLICA precisa ser uma URL https completa.");
        }
    }

    private static void faltando(String valor, String nome) {
        if (valor.isEmpty()) {
            throw new IllegalStateException(
                    "InfinitePay ligada (TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO=true), mas falta " + nome + ".");
        }
    }

    private static String limpar(String valor) {
        return valor == null ? "" : valor.trim();
    }

    private static String semBarraFinal(String valor) {
        String url = valor;
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    /** A URL pública é o único dado aqui e não é segredo; ainda assim o objeto sai curto no log. */
    @Override
    public String toString() {
        return "InfinitePayProperties[habilitado=" + habilitado + "]";
    }
}
