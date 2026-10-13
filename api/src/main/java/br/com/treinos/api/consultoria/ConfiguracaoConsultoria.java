package br.com.treinos.api.consultoria;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Metodologia da consultoria ({@code consultoria.configuracao}). {@code regraPreparacao} é a
 * regra de FS do Saraiva (3 FS = 50/70/85; 2 FS = 70/85; 1 FS = 85): o editor usa para preencher os percentuais
 * quando muda a quantidade de séries de preparação; depois cada série pode ser editada. {@code repeticoes} é a faixa de
 * repetições de cada tipo de série (chave = nome do tipo): o editor preenche ao criar a série ou trocar o tipo. Tipo sem
 * faixa não preenche nada.
 */
public record ConfiguracaoConsultoria(
        List<String> tiposSerie,
        String tipoTrabalho,
        String tipoPreparacao,
        Map<String, List<Integer>> regraPreparacao,
        BigDecimal arredondamentoKg,
        String instrucoesTreino,
        String rodapePdf,
        Map<String, Repeticoes> repeticoes
) {

    /** Faixa de repetições de um tipo de série (mínima e máxima; iguais = número fixo, como "3x3"). */
    public record Repeticoes(Integer min, Integer max) { }

    public ConfiguracaoConsultoria {
        repeticoes = repeticoes == null ? Map.of() : repeticoes;
    }

    /** Ponto de partida de toda consultoria nova; o treinador muda na tela Marca. */
    public static ConfiguracaoConsultoria padrao() {
        Map<String, List<Integer>> regra = new LinkedHashMap<>();
        regra.put("1", List.of(85));
        regra.put("2", List.of(70, 85));
        regra.put("3", List.of(50, 70, 85));
        Map<String, Repeticoes> repeticoes = new LinkedHashMap<>();
        repeticoes.put("Aquecimento", new Repeticoes(10, 15));
        repeticoes.put("FS", new Repeticoes(3, 3));
        repeticoes.put("WS", new Repeticoes(3, 6));
        repeticoes.put("Back off", new Repeticoes(6, 8));
        return new ConfiguracaoConsultoria(
                List.of("Aquecimento", "FS", "WS", "Back off", "Top set", "Rest pause", "Cluster"),
                "WS",
                "FS",
                regra,
                new BigDecimal("0.5"),
                "",
                "",
                repeticoes);
    }
}
