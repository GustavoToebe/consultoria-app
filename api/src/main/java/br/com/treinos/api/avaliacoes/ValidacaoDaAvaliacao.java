package br.com.treinos.api.avaliacoes;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoRequest;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.Medidas;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Regras da avaliação física, sem banco (testável sem Docker). Espelho em {@code app/src/dominio/avaliacaoFisica.ts}:
 * mudou uma, mude a outra. As mensagens nunca repetem o valor digitado (dado sensível).
 */
final class ValidacaoDaAvaliacao {

    static final BigDecimal MINIMO_CM = BigDecimal.valueOf(5);
    static final BigDecimal MAXIMO_CM = BigDecimal.valueOf(300);
    static final int OBSERVACAO_MAXIMA = 1000;
    static final LocalDate PRIMEIRA_DATA = LocalDate.of(1900, 1, 1);

    private ValidacaoDaAvaliacao() { }

    /** O que vai para a entidade: medidas com uma casa decimal e observação sem espaços nas pontas (vazia = nula). */
    record Valida(LocalDate data, Medidas medidas, String observacao) { }

    /** Problemas por campo; lista vazia = válida. */
    static List<ApiError.FieldError> problemas(AvaliacaoRequest r, LocalDate hoje) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        if (r.data() == null) {
            erros.add(new ApiError.FieldError("data", "Informe a data da avaliação."));
        } else if (r.data().isAfter(hoje)) {
            erros.add(new ApiError.FieldError("data", "A data não pode ser no futuro."));
        } else if (r.data().isBefore(PRIMEIRA_DATA)) {
            erros.add(new ApiError.FieldError("data", "Confira a data."));
        }
        Medidas medidas = r.medidas() == null ? Medidas.VAZIAS : r.medidas();
        boolean alguma = false;
        for (var e : medidas.porCampo().entrySet()) {
            BigDecimal v = e.getValue();
            if (v == null) continue;
            alguma = true;
            if (v.compareTo(MINIMO_CM) < 0 || v.compareTo(MAXIMO_CM) > 0) {
                erros.add(new ApiError.FieldError("medidas." + e.getKey(), "Use um valor entre 5 e 300 cm."));
            } else if (v.stripTrailingZeros().scale() > 1) {
                erros.add(new ApiError.FieldError("medidas." + e.getKey(), "Use no máximo uma casa decimal."));
            }
        }
        if (!alguma) {
            erros.add(new ApiError.FieldError("medidas", "Preencha ao menos uma medida."));
        }
        if (r.observacao() != null && r.observacao().strip().length() > OBSERVACAO_MAXIMA) {
            erros.add(new ApiError.FieldError("observacao", "Use no máximo " + OBSERVACAO_MAXIMA + " caracteres."));
        }
        return erros;
    }

    /** Só depois de {@link #problemas} vazio. */
    static Valida normalizar(AvaliacaoRequest r) {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        Medidas medidas = r.medidas() == null ? Medidas.VAZIAS : r.medidas();
        medidas.porCampo().forEach((campo, v) -> m.put(campo, v == null ? null : v.setScale(1, RoundingMode.UNNECESSARY)));
        String obs = r.observacao() == null || r.observacao().isBlank() ? null : r.observacao().strip();
        return new Valida(r.data(), Medidas.de(m), obs);
    }
}
