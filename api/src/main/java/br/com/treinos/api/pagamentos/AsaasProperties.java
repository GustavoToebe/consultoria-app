package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.util.Locale;

/**
 * Overtraining Pay via Asaas ({@code TREINOS_PAGAMENTOS_ASAAS_HABILITADO}). Desligado por padrão: as rotas respondem 503
 * {@code OVERTRAINING_PAY_INDISPONIVEL} e {@code GET /eu} traz {@code overtrainingPayHabilitado=false}. Ligado, a API só sobe
 * com as chaves de cifra ({@link PagamentosProperties}), {@code TREINOS_PAGAMENTOS_ASAAS_API_KEY_MATRIZ}, as carteiras da matriz
 * e do sócio e URL pública https.
 * Segredos só em variável de ambiente, sem valor padrão. {@code toString()} nunca expõe a API Key da matriz.
 */
@ConfigurationProperties("treinos.pagamentos.asaas")
public record AsaasProperties(boolean habilitado, String urlBase, String apiKeyMatriz, String urlPublica,
                              String walletMatriz, String walletSocio, Integer percentualSocioBps,
                              Boolean conciliacaoAtiva) {

    static final String URL_PADRAO = "https://api-sandbox.asaas.com/v3";
    static final int PERCENTUAL_SOCIO_PADRAO_BPS = 3500;

    public AsaasProperties {
        urlBase = limpar(urlBase).isEmpty() ? URL_PADRAO : semBarraFinal(limpar(urlBase));
        apiKeyMatriz = limpar(apiKeyMatriz);
        urlPublica = semBarraFinal(limpar(urlPublica));
        walletMatriz = limpar(walletMatriz);
        walletSocio = limpar(walletSocio);
        percentualSocioBps = percentualSocioBps == null ? PERCENTUAL_SOCIO_PADRAO_BPS : percentualSocioBps;
        conciliacaoAtiva = conciliacaoAtiva == null || conciliacaoAtiva;
    }

    /** URL pública efetiva para montar o webhook: usa a própria ou cai na URL pública geral dos pagamentos. */
    public String urlPublicaEfetiva(InfinitePayProperties infinitePay) {
        if (!urlPublica.isEmpty()) {
            return urlPublica;
        }
        return infinitePay == null ? "" : infinitePay.urlPublica();
    }

    /** Falha a subida dizendo apenas o NOME da variável ausente ou inválida (nunca o valor). */
    void exigirCompleta(PagamentosProperties pagamentos, InfinitePayProperties infinitePay) {
        if (!habilitado) {
            return;
        }
        faltando(pagamentos.chaves(), "TREINOS_PAGAMENTOS_CHAVES");
        faltando(pagamentos.chaveAtiva(), "TREINOS_PAGAMENTOS_CHAVE_ATIVA");
        faltando(apiKeyMatriz, "TREINOS_PAGAMENTOS_ASAAS_API_KEY_MATRIZ");
        String publica = urlPublicaEfetiva(infinitePay);
        faltando(publica, "TREINOS_PAGAMENTOS_ASAAS_URL_PUBLICA");
        exigirHttps(publica, "TREINOS_PAGAMENTOS_ASAAS_URL_PUBLICA", false);
        exigirHttps(urlBase, "TREINOS_PAGAMENTOS_ASAAS_URL_BASE", true);
        // Sem carteira o split some em silêncio (CalculadorDeSplitAsaas): ligado, a subida exige as duas (I7).
        faltando(walletMatriz, "TREINOS_PAGAMENTOS_ASAAS_WALLET_MATRIZ");
        faltando(walletSocio, "TREINOS_PAGAMENTOS_ASAAS_WALLET_SOCIO");
        if (percentualSocioBps < 0 || percentualSocioBps > 10000) {
            throw new IllegalStateException("TREINOS_PAGAMENTOS_ASAAS_PERCENTUAL_SOCIO_BPS precisa estar entre 0 e 10000.");
        }
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
        if (valor == null || valor.isEmpty()) {
            throw new IllegalStateException(
                    "Overtraining Pay ligado (TREINOS_PAGAMENTOS_ASAAS_HABILITADO=true), mas falta " + nome + ".");
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
        return "AsaasProperties[habilitado=" + habilitado + "]";
    }
}
