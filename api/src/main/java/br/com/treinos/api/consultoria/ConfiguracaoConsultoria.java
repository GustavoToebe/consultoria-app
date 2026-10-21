package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Buscas;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Metodologia: as regras de série de um plano de treino (modelo {@code METODOLOGIA}, copiada em
 * {@code ConteudoTreino.metodologia}). {@code regraPreparacao} é a
 * regra de FS do Saraiva (3 FS = 50/70/85; 2 FS = 70/85; 1 FS = 85): o editor usa para preencher os percentuais
 * quando muda a quantidade de séries de preparação; depois cada série pode ser editada. {@code repeticoes} é a faixa de
 * repetições de cada tipo de série (chave = nome do tipo): o editor preenche ao criar a série ou trocar o tipo. Tipo sem
 * faixa não preenche nada. O tipo diz para que a série serve (aquecimento, preparação, trabalho…); a técnica (cluster,
 * rest pause, drop-set) diz como executar e fica na própria série ({@code ConteudoTreino.Tecnica}), por isso nome de
 * técnica não entra na lista de tipos.
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

    private static final Set<BigDecimal> ARREDONDAMENTOS = Set.of(new BigDecimal("0.25"), new BigDecimal("0.5"),
            BigDecimal.ONE, new BigDecimal("2.5"));

    /** Nomes que são técnica, não tipo de série, na forma de {@link #chaveDeTipo}. Espelho em {@code dominio/tiposDeSerie.ts}. */
    public static final Set<String> NOMES_DE_TECNICA = Set.of("cluster", "rest pause", "restpause", "drop set", "dropset");

    /** Chave de comparação de um nome de tipo: sem acento, minúsculas, hífen/travessão/NBSP viram espaço, espaços colapsados. */
    public static String chaveDeTipo(String tipo) {
        return Buscas.semAcento(tipo == null ? "" : tipo.replaceAll("[\\-–— ]", " "));
    }

    /**
     * Regra da lista de tipos da consultoria (receita METODOLOGIA): além de {@link #validar}, nome de técnica não entra.
     * A cópia dentro do plano passa só por {@link #validar}: o tipo da série é texto livre, e a lista fica onde o
     * treinador a edita.
     */
    public static void validarComoMetodologia(ConfiguracaoConsultoria c) {
        validar(c);
        for (String t : c.tiposSerie()) {
            if (nomeDeTecnica(t)) {
                throw new BadRequestException("\"" + t.trim()
                        + "\" é uma técnica, não um tipo de série: escolha a técnica na própria série.");
            }
        }
    }

    /** "Cluster", "Rest-pause", "DROP SET"… são técnicas da série, não tipos. */
    public static boolean nomeDeTecnica(String tipo) {
        return NOMES_DE_TECNICA.contains(chaveDeTipo(tipo));
    }

    /** Valores de um plano sem metodologia vinculada e da metodologia criada com a consultoria. */
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
                List.of("Aquecimento", "FS", "WS", "Back off", "Top set", "Cardio"),
                "WS",
                "FS",
                regra,
                new BigDecimal("0.5"),
                "",
                "",
                repeticoes);
    }

    public static void validar(ConfiguracaoConsultoria c) {
        if (c == null || c.tiposSerie() == null || c.tiposSerie().isEmpty() || c.tiposSerie().size() > 20) {
            throw new BadRequestException("Informe de 1 a 20 tipos de série.");
        }
        Set<String> tipos = new HashSet<>();
        for (String t : c.tiposSerie()) {
            if (t == null || t.isBlank() || t.length() > 30 || !tipos.add(t.trim())) {
                throw new BadRequestException("Tipos de série: sem nomes vazios, repetidos ou com mais de 30 letras.");
            }
        }
        if (!tipos.contains(c.tipoTrabalho()) || !tipos.contains(c.tipoPreparacao())) {
            throw new BadRequestException("O tipo de trabalho e o de preparação precisam estar na lista de tipos.");
        }
        if (c.arredondamentoKg() == null || ARREDONDAMENTOS.stream().noneMatch(a -> a.compareTo(c.arredondamentoKg()) == 0)) {
            throw new BadRequestException("Arredondamento precisa ser 0,25, 0,5, 1 ou 2,5 kg.");
        }
        Map<String, List<Integer>> regra = c.regraPreparacao() == null ? Map.of() : c.regraPreparacao();
        for (Map.Entry<String, List<Integer>> e : regra.entrySet()) {
            int quantidade;
            try {
                quantidade = Integer.parseInt(e.getKey());
            } catch (NumberFormatException ex) {
                throw new BadRequestException("Regra de preparação: a chave é a quantidade de séries (1 a 10).");
            }
            List<Integer> percentuais = e.getValue();
            if (quantidade < 1 || quantidade > 10 || percentuais == null || percentuais.size() != quantidade
                    || percentuais.stream().anyMatch(p -> p == null || p < 1 || p > 200)) {
                throw new BadRequestException("Regra de preparação: " + e.getKey()
                        + " série(s) precisam de " + e.getKey() + " percentual(is) de 1 a 200.");
            }
        }
        for (Map.Entry<String, ConfiguracaoConsultoria.Repeticoes> e : c.repeticoes().entrySet()) {
            if (!tipos.contains(e.getKey())) {
                throw new BadRequestException("Repetições: o tipo \"" + e.getKey() + "\" não está na lista de tipos.");
            }
            ConfiguracaoConsultoria.Repeticoes r = e.getValue();
            if (r == null || r.min() == null || r.max() == null || r.min() < 0 || r.max() > 500 || r.max() < r.min()) {
                throw new BadRequestException("Repetições de " + e.getKey()
                        + ": informe mínima e máxima de 0 a 500, com a máxima maior ou igual à mínima.");
            }
        }
        if (c.instrucoesTreino() != null && c.instrucoesTreino().length() > 20000) {
            throw new BadRequestException("Instruções do treino com no máximo 20.000 caracteres.");
        }
        if (c.rodapePdf() != null && c.rodapePdf().length() > 500) {
            throw new BadRequestException("Rodapé do PDF com no máximo 500 caracteres.");
        }
    }
}
