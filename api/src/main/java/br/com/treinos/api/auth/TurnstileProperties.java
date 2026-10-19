package br.com.treinos.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

/**
 * Verificação humana do Cloudflare Turnstile no cadastro de treinador, no login e no "esqueci a senha"
 * ({@code TREINOS_TURNSTILE_*}). Desligada por padrão: sem {@code habilitado=true} nada é exigido e nenhuma outra variável
 * é lida. Ligada, a API só sobe com chave pública e segredo preenchidos (sem chamada de rede na subida). O segredo só
 * existe em variável de ambiente, sem valor padrão.
 *
 * @param siteKey chave pública do widget (vai ao app pela rota pública de configuração)
 * @param segredo segredo do widget, só no servidor
 * @param verifyUrl endereço do siteverify (o da Cloudflare por padrão; os testes apontam para um servidor local)
 * @param hostname site em que o token precisa ter sido resolvido; vazio = o host do {@code APP_URL}
 */
@ConfigurationProperties("treinos.turnstile")
public record TurnstileProperties(boolean habilitado, String siteKey, String segredo, String verifyUrl, String hostname) {

    static final String VERIFY_URL_PADRAO = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    public TurnstileProperties {
        siteKey = limpar(siteKey);
        segredo = limpar(segredo);
        verifyUrl = limpar(verifyUrl).isEmpty() ? VERIFY_URL_PADRAO : limpar(verifyUrl);
        hostname = limpar(hostname);
    }

    /** Falha a subida, dizendo só o NOME da variável que falta (nunca o valor). */
    void exigirCompleta() {
        faltando(siteKey, "TREINOS_TURNSTILE_SITE_KEY");
        faltando(segredo, "TREINOS_TURNSTILE_SEGREDO");
        URI uri = URI.create(verifyUrl);
        if (uri.getHost() == null || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
            throw new IllegalStateException("treinos.turnstile.verify-url precisa ser uma URL http(s) completa.");
        }
    }

    private static void faltando(String valor, String nome) {
        if (valor.isEmpty()) {
            throw new IllegalStateException("Turnstile ligado (TREINOS_TURNSTILE_HABILITADO=true), mas falta " + nome + ".");
        }
    }

    private static String limpar(String valor) {
        return valor == null ? "" : valor.trim();
    }

    /** Sem segredo nenhum: este objeto pode ir parar num log. */
    @Override
    public String toString() {
        return "TurnstileProperties[habilitado=" + habilitado + "]";
    }
}
