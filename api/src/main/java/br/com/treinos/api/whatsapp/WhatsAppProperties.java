package br.com.treinos.api.whatsapp;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

/**
 * Avisos pelo WhatsApp oficial da Meta ({@code TREINOS_WHATSAPP_HABILITADO}). Desligado por padrão: as rotas
 * {@link ExigeWhatsApp} respondem 503 {@code WHATSAPP_INDISPONIVEL}, nada entra na fila, o job não faz nada e a API sobe sem
 * nenhuma variável do WhatsApp. Ligado, a subida exige as chaves de cifra, o app secret e o verify token (sem valor padrão).
 *
 * @param chaves          chaves AES-256 que cifram o token de acesso de cada consultoria ({@code id:base64 de 32 bytes})
 * @param chaveAtiva      id da chave de {@code chaves} que cifra o que é gravado agora
 * @param metaAppSecret   segredo do aplicativo da Meta: assina o webhook ({@code X-Hub-Signature-256}); nunca em log
 * @param metaVerifyToken senha que a Meta devolve no {@code GET} de cadastro do webhook; nunca em log
 * @param metaUrl         base da Graph API ({@code TREINOS_WHATSAPP_META_URL}); ligado, precisa ser https (o token de acesso vai
 *                        nesse endereço), menos localhost e 127.0.0.1, que são o servidor de mentira dos testes
 * @param envioAgendado   liga o job de envio; os testes o desligam e chamam {@link WhatsAppDaFila#rodar()} à mão
 * @param timeoutSegundos tempo máximo da chamada à Meta
 */
@ConfigurationProperties("treinos.whatsapp")
public record WhatsAppProperties(boolean habilitado, String chaves, String chaveAtiva, String metaAppSecret,
                                 String metaVerifyToken, String metaUrl, Boolean envioAgendado, Integer timeoutSegundos) {

    public static final String URL_PADRAO = "https://graph.facebook.com";

    public WhatsAppProperties {
        chaves = chaves == null ? "" : chaves.strip();
        chaveAtiva = chaveAtiva == null ? "" : chaveAtiva.strip();
        metaAppSecret = metaAppSecret == null ? "" : metaAppSecret.strip();
        metaVerifyToken = metaVerifyToken == null ? "" : metaVerifyToken.strip();
        metaUrl = metaUrl == null || metaUrl.isBlank() ? URL_PADRAO : metaUrl.strip().replaceAll("/+$", "");
        envioAgendado = envioAgendado == null || envioAgendado;
        timeoutSegundos = timeoutSegundos == null || timeoutSegundos < 1 ? 5 : timeoutSegundos;
        if (habilitado) {
            exigirCompleta(chaves, chaveAtiva, metaAppSecret, metaVerifyToken);
            exigirHttps(metaUrl);
        }
    }

    /** Ligado sem alguma das variáveis secretas a API não sobe (a mensagem só diz o nome, nunca um valor). */
    private static void exigirCompleta(String chaves, String chaveAtiva, String appSecret, String verifyToken) {
        if (chaves.isBlank() || chaveAtiva.isBlank()) {
            throw new IllegalStateException("O WhatsApp está ligado, mas faltam TREINOS_WHATSAPP_CHAVES e TREINOS_WHATSAPP_CHAVE_ATIVA.");
        }
        if (appSecret.isBlank()) {
            throw new IllegalStateException("O WhatsApp está ligado, mas falta TREINOS_WHATSAPP_META_APP_SECRET.");
        }
        if (verifyToken.isBlank()) {
            throw new IllegalStateException("O WhatsApp está ligado, mas falta TREINOS_WHATSAPP_META_VERIFY_TOKEN.");
        }
    }

    /** O token de acesso vai nesse endereço: só https (servidor de mentira local dos testes é a exceção). */
    private static void exigirHttps(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("treinos.whatsapp.meta-url não é um endereço válido.");
        }
        String host = uri.getHost();
        boolean local = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
        if (host == null || !(local || "https".equalsIgnoreCase(uri.getScheme()))) {
            throw new IllegalStateException("treinos.whatsapp.meta-url precisa ser https.");
        }
    }

    @Override
    public String toString() {
        return "WhatsAppProperties[habilitado=" + habilitado + "]";
    }
}
