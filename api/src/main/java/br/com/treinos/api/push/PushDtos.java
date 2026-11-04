package br.com.treinos.api.push;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class PushDtos {

    private PushDtos() {
    }

    static final String FORMATO = "^(Exponent|Expo)PushToken\\[[A-Za-z0-9_\\-]{8,170}\\]$";

    /** O {@code toString} do record não repete o token (dado do aparelho); as mensagens de validação também não. */
    public record RegistrarRequest(
            @NotBlank(message = "Informe o token.") @Size(max = 200, message = "Token inválido.")
            @Pattern(regexp = FORMATO, message = "Token inválido.") String token,
            @NotBlank(message = "Informe a plataforma.")
            @Pattern(regexp = "ANDROID|IOS", message = "Plataforma inválida.") String plataforma) {

        @Override
        public String toString() {
            return "RegistrarRequest[" + plataforma + "]";
        }
    }

    public record RemoverRequest(
            @NotBlank(message = "Informe o token.") @Size(max = 200, message = "Token inválido.") String token) {

        @Override
        public String toString() {
            return "RemoverRequest[]";
        }
    }

    /** Exportação do aluno (LGPD): só que existe, de que aparelho e desde quando; nunca o valor. */
    public record PushExportado(String plataforma, Instant registradoEm) { }
}
