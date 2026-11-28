package br.com.treinos.api.biblioteca.dto;

import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.CatalogoAlimento;
import br.com.treinos.api.biblioteca.CatalogoExercicio;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.web.LinkExterno;
import br.com.treinos.api.web.LinksExternos;
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

    /**
     * {@code tipoDeCardio} e {@code medidasDeCardio} só contam em {@code CARDIO} (fora dele são ignorados). Medidas
     * ausentes: na criação, as duas; na edição, as gravadas. Com {@code CARDIO}, grupo e equipamento do corpo são
     * ignorados e gravados nulos (docs/planos/cardio-e-hiit.md, D12 e D13).
     */
    public record ExercicioRequest(
            @NotBlank @Size(max = 120) String nome,
            @Size(max = 60) String grupoMuscular,
            @Size(max = 60) String equipamento,
            @NotNull Exercicio.Modalidade modalidade,
            @Size(max = 500) String videoUrl,
            @Size(max = 4000) String observacoes,
            Exercicio.TipoDeCardio tipoDeCardio,
            @Size(max = 2) List<Exercicio.@NotNull MedidaDeCardio> medidasDeCardio) {

        /** Sem os campos do cardio (seed e exercício que não é cardio). */
        public ExercicioRequest(String nome, String grupoMuscular, String equipamento, Exercicio.Modalidade modalidade,
                                String videoUrl, String observacoes) {
            this(nome, grupoMuscular, equipamento, modalidade, videoUrl, observacoes, null, null);
        }
    }

    /**
     * {@code imagens}: caminhos relativos das fotos do exercício do catálogo de onde este veio (vazio = nenhuma); o app
     * as pede ao proxy da web, a API nunca as serve. {@code imagemPropriaEm}: quando o treinador enviou imagem ou GIF
     * próprio (nulo = não há; serve também para o app renovar a imagem trocada). {@code tipoDeCardio} nulo = não
     * informado; {@code medidasDeCardio} vazia fora do {@code CARDIO}.
     */
    public record ExercicioResponse(UUID id, String nome, String grupoMuscular, String equipamento,
                                    String modalidade, String videoUrl, String observacoes, String origem,
                                    List<String> imagens, Instant imagemPropriaEm, String tipoDeCardio,
                                    List<String> medidasDeCardio) {
        public static ExercicioResponse de(Exercicio e, List<String> imagens, Instant imagemPropriaEm) {
            return new ExercicioResponse(e.getId(), e.getNome(), e.getGrupoMuscular(), e.getEquipamento(),
                    e.getModalidade().name(), e.getVideoUrl(), e.getObservacoes(), e.getOrigem().name(),
                    imagens, imagemPropriaEm, e.getTipoDeCardio() == null ? null : e.getTipoDeCardio().name(),
                    e.getMedidasDeCardio().stream().map(Enum::name).toList());
        }
    }

    /**
     * {@code fatorCorrecao} e {@code fatorCoccao} podem vir nulos no alimento comum: o serviço preenche com
     * {@code FatoresDeRendimento.estimar}. No suplemento ({@code tipo = SUPLEMENTO}) nulo permanece nulo: nada é
     * estimado. Número fora da faixa ou com mais de duas casas dá 422 {@code ALIMENTO_INVALIDO} no campo.
     * {@code grupo} é texto livre opcional (até 60; no suplemento é a categoria). {@code tipo} ausente = {@code ALIMENTO}.
     * No alimento o {@code kcal} do corpo é ignorado (o servidor grava proteína×4 + carboidrato×4 + gordura×9) e os três
     * macros são obrigatórios; kcal e macros nulos só valem no suplemento. {@code fibra} é opcional (nula fica nula) e
     * não entra na kcal: fora de 0 a 99999 ou com mais de duas casas, o serviço dá 422 {@code ALIMENTO_INVALIDO} no campo (no suplemento o corpo a ignora). Base ausente no suplemento vira 100 g só para preencher a coluna.
     */
    public record AlimentoRequest(
            @NotBlank @Size(max = 160) String nome,
            @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 2) BigDecimal baseQuantidade,
            @Pattern(regexp = "g|ml|un", message = "use g, ml ou un") String baseUnidade,
            @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal kcal,
            @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal proteina,
            @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal carboidrato,
            @DecimalMin("0") @DecimalMax("99999") @Digits(integer = 6, fraction = 2) BigDecimal gordura,
            BigDecimal fibra,
            @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 2) BigDecimal gramasPorUnidade,
            @Size(max = 200) String fonte,
            BigDecimal fatorCorrecao,
            BigDecimal fatorCoccao,
            String grupo,
            String tipo,
            @Size(max = 80) String marca,
            @LinkExterno @Size(max = LinksExternos.TAMANHO_MAXIMO) String link,
            String cupom,
            @Size(max = 20) List<@NotNull @Size(max = 60) String> sabores,
            @Size(max = 40) String porcoesPorEmbalagem,
            @Size(max = 80) String porcao) {
    }

    public record AlimentoResponse(UUID id, String nome, BigDecimal baseQuantidade, String baseUnidade,
                                   BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                                   BigDecimal fibra, BigDecimal gramasPorUnidade, String fonte, String origem,
                                   BigDecimal fatorCorrecao, BigDecimal fatorCoccao, String grupo,
                                   String tipo, String marca, String link, String cupom, List<String> sabores,
                                   String porcoesPorEmbalagem, String porcao) {
        public static AlimentoResponse de(Alimento a, List<String> sabores) {
            return new AlimentoResponse(a.getId(), a.getNome(), a.getBaseQuantidade(), a.getBaseUnidade(),
                    a.getKcal(), a.getProteina(), a.getCarboidrato(), a.getGordura(), a.getFibra(), a.getGramasPorUnidade(),
                    a.getFonte(), a.getOrigem().name(), a.getFatorCorrecao(), a.getFatorCoccao(), a.getGrupo(),
                    a.getTipo().name(), a.getMarca(), a.getLink(), a.getCupom(), sabores,
                    a.getPorcoesPorEmbalagem(), a.getPorcao());
        }
    }

    /**
     * Fatores e grupo atuais de um alimento da biblioteca, para a prévia da lista de compras no editor da dieta (o
     * rascunho não os guarda: a publicação copia os do momento). Nulo = não informado / sem grupo.
     */
    public record FatoresDoAlimento(UUID alimentoId, BigDecimal fatorCorrecao, BigDecimal fatorCoccao, String grupo) {
        public static FatoresDoAlimento de(Alimento a) {
            return new FatoresDoAlimento(a.getId(), a.getFatorCorrecao(), a.getFatorCoccao(), a.getGrupo());
        }
    }

    public record CatalogoExercicioResponse(UUID id, String nome, String grupoMuscular, String equipamento,
                                            String modalidade, String instrucoes, String fonte,
                                            List<String> imagens, boolean naBiblioteca) {
        public static CatalogoExercicioResponse de(CatalogoExercicio c, boolean naBiblioteca) {
            return new CatalogoExercicioResponse(c.getId(), c.getNome(), c.getGrupoMuscular(), c.getEquipamento(),
                    c.getModalidade(), c.getInstrucoes(), c.getFonte(), c.getImagens(), naBiblioteca);
        }
    }

    /**
     * {@code tracos}: nutrientes que a fonte marca como traço ({@code Tr}); o valor vem 0 e a tela mostra "Tr".
     * {@code naBiblioteca}: a consultoria já tem um alimento ativo com este nome (a importação o ignoraria).
     */
    public record CatalogoAlimentoResponse(UUID id, String nome, BigDecimal baseQuantidade, String baseUnidade,
                                           BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato,
                                           BigDecimal gordura, BigDecimal fibra, String fonte, String grupo,
                                           String codigoFonte, List<String> tracos, BigDecimal fatorCorrecao, BigDecimal fatorCoccao,
                                           boolean naBiblioteca) {
        public static CatalogoAlimentoResponse de(CatalogoAlimento c, boolean naBiblioteca) {
            List<String> tracos = c.getTracos() == null || c.getTracos().isBlank()
                    ? List.of() : List.of(c.getTracos().split(","));
            return new CatalogoAlimentoResponse(c.getId(), c.getNome(), c.getBaseQuantidade(), c.getBaseUnidade(),
                    c.getKcal(), c.getProteina(), c.getCarboidrato(), c.getGordura(), c.getFibra(), c.getFonte(), c.getGrupo(),
                    c.getCodigoFonte(), tracos, c.getFatorCorrecao(), c.getFatorCoccao(), naBiblioteca);
        }
    }

    /** Uma página do catálogo: {@code total} é quantos itens casaram com a busca, não só os de {@code itens}. */
    public record CatalogoPagina<T>(List<T> itens, long total) {
    }

    /**
     * Página da Biblioteca › Exercícios; {@code grupos} e {@code modalidades} (nomes do enum, na ordem dele) são todos os
     * da consultoria, sem aplicar filtro nenhum, para os seletores não encolherem.
     */
    public record ExerciciosPagina(List<ExercicioResponse> itens, long total, List<String> grupos, List<String> modalidades) {
    }

    public record ImportarCatalogoRequest(@NotNull @Size(min = 1, max = 200) List<@NotNull UUID> ids) {
    }

    public record ImportacaoResultado(int importados, int ignorados) {
    }

    /** Sem anotações de propósito: o serviço confere e responde 422 {@code GRUPOS_INVALIDOS} por campo (anotação daria 400). */
    public record UnirGruposRequest(List<String> origem, String destino) {
    }

    public record UnirGruposResultado(int exerciciosAlterados) {
    }
}
