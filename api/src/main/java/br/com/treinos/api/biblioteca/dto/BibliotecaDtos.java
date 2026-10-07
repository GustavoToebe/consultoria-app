package br.com.treinos.api.biblioteca.dto;

import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.CatalogoAlimento;
import br.com.treinos.api.biblioteca.CatalogoExercicio;
import br.com.treinos.api.biblioteca.Exercicio;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Contratos HTTP da biblioteca (seção 9.3). Agrupados aqui por serem curtos e só usados pelos controllers dela. */
public final class BibliotecaDtos {

    private BibliotecaDtos() { }

    public record ExercicioRequest(
            @NotBlank @Size(max = 120) String nome,
            @Size(max = 60) String grupoMuscular,
            @Size(max = 60) String equipamento,
            @NotNull Exercicio.Modalidade modalidade,
            @Size(max = 500) String videoUrl,
            @Size(max = 4000) String observacoes) {
    }

    public record ExercicioResponse(UUID id, String nome, String grupoMuscular, String equipamento,
                                    String modalidade, String videoUrl, String observacoes, String origem) {
        public static ExercicioResponse de(Exercicio e) {
            return new ExercicioResponse(e.getId(), e.getNome(), e.getGrupoMuscular(), e.getEquipamento(),
                    e.getModalidade().name(), e.getVideoUrl(), e.getObservacoes(), e.getOrigem().name());
        }
    }

    public record AlimentoRequest(
            @NotBlank @Size(max = 160) String nome,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 2) BigDecimal baseQuantidade,
            @NotNull @Pattern(regexp = "g|ml|un", message = "use g, ml ou un") String baseUnidade,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal kcal,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal proteina,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal carboidrato,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal gordura,
            @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 2) BigDecimal gramasPorUnidade,
            @Size(max = 200) String fonte) {
    }

    public record AlimentoResponse(UUID id, String nome, BigDecimal baseQuantidade, String baseUnidade,
                                   BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                                   BigDecimal gramasPorUnidade, String fonte, String origem) {
        public static AlimentoResponse de(Alimento a) {
            return new AlimentoResponse(a.getId(), a.getNome(), a.getBaseQuantidade(), a.getBaseUnidade(),
                    a.getKcal(), a.getProteina(), a.getCarboidrato(), a.getGordura(), a.getGramasPorUnidade(),
                    a.getFonte(), a.getOrigem().name());
        }
    }

    public record CatalogoExercicioResponse(UUID id, String nome, String grupoMuscular, String equipamento,
                                            String modalidade) {
        public static CatalogoExercicioResponse de(CatalogoExercicio c) {
            return new CatalogoExercicioResponse(c.getId(), c.getNome(), c.getGrupoMuscular(), c.getEquipamento(),
                    c.getModalidade());
        }
    }

    public record CatalogoAlimentoResponse(UUID id, String nome, BigDecimal baseQuantidade, String baseUnidade,
                                           BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato,
                                           BigDecimal gordura, String fonte) {
        public static CatalogoAlimentoResponse de(CatalogoAlimento c) {
            return new CatalogoAlimentoResponse(c.getId(), c.getNome(), c.getBaseQuantidade(), c.getBaseUnidade(),
                    c.getKcal(), c.getProteina(), c.getCarboidrato(), c.getGordura(), c.getFonte());
        }
    }

    public record ImportarCatalogoRequest(@NotNull @Size(min = 1, max = 200) List<@NotNull UUID> ids) {
    }

    public record ImportacaoResultado(int importados, int ignorados) {
    }

    public record ErroLinha(int linha, String motivo) {
    }

    /** Prévia da importação CSV: o que entra, o que não entra e o hash que a confirmação precisa repetir. */
    public record PreviaCsv<T>(List<T> validas, List<ErroLinha> erros, String hash) {
    }
}
