package br.com.treinos.api.consultoria;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Metodologia da consultoria ({@code consultoria.configuracao}, seção 7.3 do plano). {@code regraPreparacao} é a
 * regra de FS do Saraiva (3 FS = 50/70/85; 2 FS = 70/85; 1 FS = 85): o editor usa para preencher os percentuais
 * quando muda a quantidade de séries de preparação; depois cada série pode ser editada.
 */
public record ConfiguracaoConsultoria(
        List<String> tiposSerie,
        String tipoTrabalho,
        String tipoPreparacao,
        Map<String, List<Integer>> regraPreparacao,
        BigDecimal arredondamentoKg,
        String instrucoesTreino,
        String rodapePdf
) {

    /** Ponto de partida de toda consultoria nova; o treinador muda na tela Marca. */
    public static ConfiguracaoConsultoria padrao() {
        Map<String, List<Integer>> regra = new LinkedHashMap<>();
        regra.put("1", List.of(85));
        regra.put("2", List.of(70, 85));
        regra.put("3", List.of(50, 70, 85));
        return new ConfiguracaoConsultoria(
                List.of("Aquecimento", "FS", "WS", "Back off", "Top set", "Rest pause", "Cluster"),
                "WS",
                "FS",
                regra,
                new BigDecimal("0.5"),
                "",
                "");
    }
}
