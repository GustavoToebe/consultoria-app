package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.util.Locale;

/**
 * Kiwify automática ({@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO}). Desligada por padrão: as rotas dela respondem 503
 * {@code KIWIFY_INDISPONIVEL} e {@code GET /eu} traz {@code kiwifyHabilitada=false}. Ligada, a API só sobe com as chaves de
 * cifra ({@link PagamentosProperties}) e com a URL pública https ({@code TREINOS_PAGAMENTOS_URL_PUBLICA}, a mesma base do
 * webhook da InfinitePay), sem chamada de rede na subida. Segredos só em variável de ambiente, sem valor padrão.
 *
 * @param urlApi           base da API pública da Kiwify (https; só localhost e 127.0.0.1 aceitam http, para os testes)
 * @param conciliacaoAtiva liga o conciliador agendado (desligado só nos testes, que o chamam à mão)
 */
@ConfigurationProperties("treinos.pagamentos.kiwify")
public record KiwifyProperties(boolean habilitado, String urlApi, Boolean conciliacaoAtiva) {

    static final String API_PADRAO = "https://public-api.kiwify.com";

    public KiwifyProperties {
        urlApi = limpar(urlApi).isEmpty() ? API_PADRAO : semBarraFinal(limpar(urlApi));
        conciliacaoAtiva = conciliacaoAtiva == null || conciliacaoAtiva;
    }

    /** Falha a subida, dizendo só o NOME da variável que falta ou está errada (nunca o valor). */
    void exigirCompleta(PagamentosProperties pagamentos, InfinitePayProperties infinitePay) {
        if (!habilitado) {
            return;
        }
        faltando(pagamentos.chaves(), "TREINOS_PAGAMENTOS_CHAVES");
        faltando(pagamentos.chaveAtiva(), "TREINOS_PAGAMENTOS_CHAVE_ATIVA");
        faltando(infinitePay.urlPublica(), "TREINOS_PAGAMENTOS_URL_PUBLICA");
        exigirHttps(infinitePay.urlPublica(), "TREINOS_PAGAMENTOS_URL_PUBLICA", false);
        exigirHttps(urlApi, "TREINOS_PAGAMENTOS_KIWIFY_URL_API", true);
    }

    private static void exigirHttps(String url, String nome, boolean aceitaLocal) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(nome + " precisa ser uma URL https completa.");
        }
        String host = uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
        boolean local = aceitaLocal && ("localhost".equals(host) || "127.0.0.1".equals(host));
        if (host == null || !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))) {
            throw new IllegalStateException(nome + " precisa ser uma URL https completa.");
        }
    }

    private static void faltando(String valor, String nome) {
        if (valor.isEmpty()) {
            throw new IllegalStateException(
                    "Kiwify ligada (TREINOS_PAGAMENTOS_KIWIFY_HABILITADO=true), mas falta " + nome + ".");
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

    @Override
    public String toString() {
        return "KiwifyProperties[habilitado=" + habilitado + "]";
    }
}
