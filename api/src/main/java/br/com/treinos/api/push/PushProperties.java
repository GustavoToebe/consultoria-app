package br.com.treinos.api.push;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

/**
 * Push do Expo para compromisso marcado, remarcado ou cancelado ({@code TREINOS_PUSH_HABILITADO}). Desligado por padrão: as
 * rotas {@link ExigePush} respondem 503 {@code PUSH_INDISPONIVEL}, nada entra na fila nem é enviado e o app não pede
 * permissão ({@code pushHabilitado} no {@code GET /eu}).
 *
 * @param expoUrl         endereço da API do Expo ({@code TREINOS_PUSH_EXPO_URL}); com a chave ligada precisa ser https (a
 *                        subida falha com http), menos localhost e 127.0.0.1, que são o servidor de mentira dos testes
 * @param expoToken       token de acesso do Expo (enhanced security, {@code TREINOS_PUSH_EXPO_TOKEN}); sem valor padrão: vazio =
 *                        envia sem {@code Authorization}, o que o Expo aceita sem enhanced security. Nunca em log (o
 *                        {@code toString} o esconde)
 * @param envioAgendado   liga o job de envio; os testes o desligam e chamam {@link PushDoExpo#rodar()} à mão
 * @param timeoutSegundos tempo máximo da chamada ao Expo
 */
@ConfigurationProperties("treinos.push")
public record PushProperties(boolean habilitado, String expoUrl, String expoToken, Boolean envioAgendado, Integer timeoutSegundos) {

    public static final String URL_PADRAO = "https://exp.host/--/api/v2/push/send";

    public PushProperties {
        expoUrl = expoUrl == null || expoUrl.isBlank() ? URL_PADRAO : expoUrl.strip();
        expoToken = expoToken == null ? "" : expoToken.strip();
        envioAgendado = envioAgendado == null || envioAgendado;
        timeoutSegundos = timeoutSegundos == null || timeoutSegundos < 1 ? 5 : timeoutSegundos;
        if (habilitado) {
            exigirHttps(expoUrl);
        }
    }

    /** O token de acesso do Expo vai nesse endereço: só https (servidor de mentira local dos testes é a exceção). */
    private static void exigirHttps(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("treinos.push.expo-url não é um endereço válido.");
        }
        String host = uri.getHost();
        boolean local = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
        if (host == null || !(local || "https".equalsIgnoreCase(uri.getScheme()))) {
            throw new IllegalArgumentException("treinos.push.expo-url precisa ser https.");
        }
    }

    @Override
    public String toString() {
        return "PushProperties[habilitado=" + habilitado + "]";
    }
}
