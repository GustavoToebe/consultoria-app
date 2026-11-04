package br.com.treinos.api.push;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Push do Expo para compromisso marcado, remarcado ou cancelado ({@code TREINOS_PUSH_HABILITADO}). Desligado por padrão: as
 * rotas {@link ExigePush} respondem 503 {@code PUSH_INDISPONIVEL}, nada entra na fila nem é enviado e o app não pede
 * permissão ({@code pushHabilitado} no {@code GET /eu}).
 *
 * @param expoUrl         endereço da API do Expo ({@code TREINOS_PUSH_EXPO_URL})
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
    }

    @Override
    public String toString() {
        return "PushProperties[habilitado=" + habilitado + "]";
    }
}
