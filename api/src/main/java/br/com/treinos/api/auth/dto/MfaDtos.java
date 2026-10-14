package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** Corpos da verificação em duas etapas do treinador (rotas {@code /eu/mfa}). */
public final class MfaDtos {

    private MfaDtos() {
    }

    public record SenhaRequest(@NotBlank @Size(max = 200) String senha) {
        @Override
        public String toString() {
            return "SenhaRequest[***]";
        }
    }

    public record ConfirmacaoRequest(@NotBlank @Size(max = 200) String senha, @NotBlank @Size(max = 64) String codigo) {
        @Override
        public String toString() {
            return "ConfirmacaoRequest[***]";
        }
    }

    /** O segredo e o link aparecem uma vez, para o QR code e para quem configura no mesmo aparelho. */
    public record Preparacao(String segredo, Instant expiraEm, String otpauthUri) {
        @Override
        public String toString() {
            return "Preparacao[expiraEm=" + expiraEm + "]";
        }
    }

    /** Os códigos de recuperação são mostrados uma vez; a sessão é a nova (as demais caíram). */
    public record Ativacao(List<String> codigosDeRecuperacao, LoginResponse sessao) {
        @Override
        public String toString() {
            return "Ativacao[codigos=***]";
        }
    }
}
