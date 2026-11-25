package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Leva o {@code tipo} das séries do treino importado (sigla que a IA ou as regras leram: "WS", "FS", "Back off"...) ao
 * <b>código</b> do tipo na metodologia da consultoria ({@code WORKING}, {@code BACK_OFF}...). Só troca quando acha o tipo;
 * o que não casa fica como veio (o editor já avisa tipo fora da metodologia) e nada é inventado. Função pura.
 */
final class TiposDaMetodologia {

    private static final Set<String> SIGLAS_TRABALHO = Set.of("WS", "WORKING", "TRABALHO", "WORKINGSET");
    private static final Set<String> SIGLAS_PREPARACAO = Set.of("FS", "FEEDER", "FEEDERSET", "PREPARACAO", "PREPARATORIA");
    private static final Set<String> SIGLAS_AQUECIMENTO = Set.of("AQ", "AQUECIMENTO", "WARMUP");
    private static final Set<String> SIGLAS_POS_TRABALHO = Set.of("BO", "BACKOFF");
    private static final Set<String> SIGLAS_TOP_SET = Set.of("TS", "TOPSET");

    private TiposDaMetodologia() {
    }

    static ConteudoTreino normalizar(ConteudoTreino treino, ConfiguracaoConsultoria config) {
        if (treino == null || config == null || config.tipos().isEmpty()) {
            return treino;
        }
        List<Sessao> sessoes = treino.sessoesOuVazio().stream().map(s -> sessao(s, config)).toList();
        return new ConteudoTreino(treino.objetivo(), treino.orientacoes(), sessoes, treino.metodologia());
    }

    private static Sessao sessao(Sessao s, ConfiguracaoConsultoria config) {
        List<ExercicioPlano> exercicios = s.exercicios() == null ? null : s.exercicios().stream()
                .map(e -> e.deCardio() ? e : e.comSeries(e.uid(), e.seriesOuVazio().stream()
                        .map(serie -> comCodigo(serie, config)).toList()))
                .toList();
        return new Sessao(s.uid(), s.nome(), s.diaSemana(), s.tipo(), s.frequenciaSemanal(), s.observacao(), s.cardio(),
                exercicios, s.grupos());
    }

    private static Serie comCodigo(Serie serie, ConfiguracaoConsultoria config) {
        if (serie == null || serie.tipo() == null || serie.tipo().isBlank()) {
            return serie;
        }
        String codigo = codigoDe(serie.tipo(), config);
        return codigo == null || codigo.equals(serie.tipo()) ? serie : serie.comTipo(codigo);
    }

    private static String codigoDe(String texto, ConfiguracaoConsultoria config) {
        String chave = chave(texto);
        if (chave.isEmpty()) {
            return null;
        }
        for (TipoDeSerie t : config.tipos()) {
            if (t == null || t.codigo() == null) {
                continue;
            }
            if (t.codigo().strip().equalsIgnoreCase(texto.strip()) || chave(t.codigo()).equals(chave)
                    || (t.nome() != null && chave(t.nome()).equals(chave))) {
                return t.codigo().strip();
            }
        }
        if (SIGLAS_TRABALHO.contains(chave)) {
            return primeiroDoPapel(config, Papel.TRABALHO);
        }
        if (SIGLAS_PREPARACAO.contains(chave)) {
            return primeiroDoPapel(config, Papel.PREPARACAO);
        }
        if (SIGLAS_AQUECIMENTO.contains(chave)) {
            return primeiroDoPapel(config, Papel.AQUECIMENTO);
        }
        if (SIGLAS_POS_TRABALHO.contains(chave)) {
            return primeiroDoPapel(config, Papel.POS_TRABALHO);
        }
        if (SIGLAS_TOP_SET.contains(chave)) {
            return config.tipos().stream().filter(t -> t != null && t.codigo() != null
                            && (chave(t.codigo()).equals("TOPSET") || (t.nome() != null && chave(t.nome()).equals("TOPSET"))))
                    .map(t -> t.codigo().strip()).findFirst().orElse(null);
        }
        return null;
    }

    private static String primeiroDoPapel(ConfiguracaoConsultoria config, Papel papel) {
        return config.tipos().stream().filter(t -> t != null && t.papel() == papel && t.codigo() != null)
                .map(t -> t.codigo().strip()).findFirst().orElse(null);
    }

    /** Sem acento, caixa, espaço, hífen nem sublinhado: "Back off", "BACK_OFF" e "back-off" dão a mesma chave. */
    private static String chave(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }
}
