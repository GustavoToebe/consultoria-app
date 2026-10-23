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
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos HTTP da biblioteca. Agrupados aqui por serem curtos e só usados pelos controllers dela. */
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

    /**
     * {@code imagens}: caminhos relativos das fotos do exercício do catálogo de onde este veio (vazio = nenhuma); o app
     * as pede ao proxy da web, a API nunca as serve. {@code imagemPropriaEm}: quando o treinador enviou imagem ou GIF
     * próprio (nulo = não há; serve também para o app renovar a imagem trocada).
     */
    public record ExercicioResponse(UUID id, String nome, String grupoMuscular, String equipamento,
                                    String modalidade, String videoUrl, String observacoes, String origem,
                                    List<String> imagens, Instant imagemPropriaEm) {
        public static ExercicioResponse de(Exercicio e, List<String> imagens, Instant imagemPropriaEm) {
            return new ExercicioResponse(e.getId(), e.getNome(), e.getGrupoMuscular(), e.getEquipamento(),
                    e.getModalidade().name(), e.getVideoUrl(), e.getObservacoes(), e.getOrigem().name(),
                    imagens, imagemPropriaEm);
        }
    }

    /**
     * {@code fatorCorrecao} e {@code fatorCoccao} são opcionais (nulo = não informado); faixa e casas decimais são
     * conferidas no {@code BibliotecaService}, que responde 422 {@code ALIMENTO_INVALIDO} com o campo.
     */
    public record AlimentoRequest(
            @NotBlank @Size(max = 160) String nome,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 2) BigDecimal baseQuantidade,
            @NotNull @Pattern(regexp = "g|ml|un", message = "use g, ml ou un") String baseUnidade,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal kcal,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal proteina,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal carboidrato,
            @NotNull @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal gordura,
            @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 2) BigDecimal gramasPorUnidade,
            @Size(max = 200) String fonte,
            BigDecimal fatorCorrecao,
            BigDecimal fatorCoccao) {
    }

    public record AlimentoResponse(UUID id, String nome, BigDecimal baseQuantidade, String baseUnidade,
                                   BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                                   BigDecimal gramasPorUnidade, String fonte, String origem,
                                   BigDecimal fatorCorrecao, BigDecimal fatorCoccao) {
        public static AlimentoResponse de(Alimento a) {
            return new AlimentoResponse(a.getId(), a.getNome(), a.getBaseQuantidade(), a.getBaseUnidade(),
                    a.getKcal(), a.getProteina(), a.getCarboidrato(), a.getGordura(), a.getGramasPorUnidade(),
                    a.getFonte(), a.getOrigem().name(), a.getFatorCorrecao(), a.getFatorCoccao());
        }
    }

    /**
     * Fatores atuais de um alimento da biblioteca, para a prévia da lista de compras no editor da dieta (o rascunho não
     * os guarda: a publicação copia os do momento). Nulo = não informado.
     */
    public record FatoresDoAlimento(UUID alimentoId, BigDecimal fatorCorrecao, BigDecimal fatorCoccao) {
        public static FatoresDoAlimento de(Alimento a) {
            return new FatoresDoAlimento(a.getId(), a.getFatorCorrecao(), a.getFatorCoccao());
        }
    }

    public record CatalogoExercicioResponse(UUID id, String nome, String grupoMuscular, String equipamento,
                                            String modalidade, String instrucoes, String fonte,
                                            List<String> imagens) {
        public static CatalogoExercicioResponse de(CatalogoExercicio c) {
            return new CatalogoExercicioResponse(c.getId(), c.getNome(), c.getGrupoMuscular(), c.getEquipamento(),
                    c.getModalidade(), c.getInstrucoes(), c.getFonte(), c.getImagens());
        }
    }

    /** {@code tracos}: nutrientes que a fonte marca como traço ({@code Tr}); o valor vem 0 e a tela mostra "Tr". */
    public record CatalogoAlimentoResponse(UUID id, String nome, BigDecimal baseQuantidade, String baseUnidade,
                                           BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato,
                                           BigDecimal gordura, String fonte, String grupo, String codigoFonte,
                                           List<String> tracos, BigDecimal fatorCorrecao, BigDecimal fatorCoccao,
                                           String fonteFatores) {
        public static CatalogoAlimentoResponse de(CatalogoAlimento c) {
            List<String> tracos = c.getTracos() == null || c.getTracos().isBlank()
                    ? List.of() : List.of(c.getTracos().split(","));
            return new CatalogoAlimentoResponse(c.getId(), c.getNome(), c.getBaseQuantidade(), c.getBaseUnidade(),
                    c.getKcal(), c.getProteina(), c.getCarboidrato(), c.getGordura(), c.getFonte(), c.getGrupo(),
                    c.getCodigoFonte(), tracos, c.getFatorCorrecao(), c.getFatorCoccao(), c.getFonteFatores());
        }
    }

    /** Uma página do catálogo: {@code total} é quantos itens casaram com a busca, não só os de {@code itens}. */
    public record CatalogoPagina<T>(List<T> itens, long total) {
    }

    public record ImportarCatalogoRequest(@NotNull @Size(min = 1, max = 200) List<@NotNull UUID> ids) {
    }

    public record ImportacaoResultado(int importados, int ignorados) {
    }
}
