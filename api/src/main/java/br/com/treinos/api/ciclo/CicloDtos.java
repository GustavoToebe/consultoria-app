package br.com.treinos.api.ciclo;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Contratos do ciclo. Datas e observação nunca entram em log nem em mensagem de erro. */
public final class CicloDtos {

    private CicloDtos() { }

    public record RegistroCiclo(UUID id, LocalDate inicio, LocalDate fim, Instant criadoEm, Instant alteradoEm) { }

    public record DiaCiclo(UUID id, LocalDate data, String fluxo, String colica, List<String> sintomas,
                           String observacao, Instant criadoEm, Instant alteradoEm) { }

    public record TextosDasFases(
            @Size(max = 1000) String menstrual,
            @Size(max = 1000) String folicular,
            @Size(max = 1000) String ovulatoria,
            @Size(max = 1000) String lutea) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CicloDaAluna(boolean disponivel, Boolean ativo, Integer consentimentoVersaoAtual,
                               Integer duracaoHabitual, Boolean mostrarFases,
                               List<RegistroCiclo> registros, List<DiaCiclo> dias, TextosDasFases textosDasFases) {

        public static CicloDaAluna indisponivel() {
            return new CicloDaAluna(false, null, null, null, null, null, null, null);
        }
    }

    public record CicloDoTreinador(boolean ativo, Integer duracaoHabitual, Boolean mostrarFases,
                                   List<RegistroCiclo> registros, List<DiaCiclo> dias) {

        public static CicloDoTreinador oculto() {
            return new CicloDoTreinador(false, null, null, List.of(), List.of());
        }
    }

    public record AtivarCiclo(@NotNull Integer consentimentoVersao, @Min(21) @Max(45) Integer duracaoHabitual) { }

    public record ConfiguracaoCiclo(@Min(21) @Max(45) Integer duracaoHabitual, @NotNull Boolean mostrarFases) { }

    public record RegistroRequest(@NotNull UUID id, @NotNull LocalDate inicio, LocalDate fim) { }

    public record DiaRequest(@NotNull UUID id, String fluxo, String colica, List<String> sintomas,
                             @Size(max = 300) String observacao) { }

    /** Exportação LGPD. A observação entra porque quem exporta já tem dado sensível. */
    public record CicloExportado(boolean ativo, Integer consentimentoVersao, Instant ativadoEm,
                                 Integer duracaoHabitual, boolean mostrarFases,
                                 List<RegistroCiclo> registros, List<DiaCiclo> dias) { }
}
