package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TecnicaDaMetodologia;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Também completa a técnica da série (rest pause, cluster, drop-set) com o padrão da metodologia, como a planilha
 * completa faz; a técnica que a consultoria não usa, ou que fica incompleta, sai da série e vai escrita (só o nome
 * fixo da técnica) para a observação do exercício.
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
        if (treino == null || config == null) {
            return treino;
        }
        List<Sessao> sessoes = treino.sessoesOuVazio().stream().map(s -> sessao(s, config)).toList();
        return new ConteudoTreino(treino.objetivo(), treino.orientacoes(), sessoes, treino.metodologia());
    }

    private static Sessao sessao(Sessao s, ConfiguracaoConsultoria config) {
        List<ExercicioPlano> exercicios = s.exercicios() == null ? null : s.exercicios().stream()
                .map(e -> e.deCardio() ? e : comTecnicas(e.comSeries(e.uid(), e.seriesOuVazio().stream()
                        .map(serie -> comCodigo(serie, config)).toList()), config))
                .toList();
        return new Sessao(s.uid(), s.nome(), s.diaSemana(), s.tipo(), s.frequenciaSemanal(), s.observacao(), s.cardio(),
                exercicios, s.grupos());
    }

    private static ExercicioPlano comTecnicas(ExercicioPlano e, ConfiguracaoConsultoria config) {
        Set<String> sairam = new LinkedHashSet<>();
        List<Serie> series = e.seriesOuVazio().stream().map(serie -> {
            if (serie == null || serie.tecnica() == null) {
                return serie;
            }
            Serie completa = completar(serie, config);
            if (completa == null) {
                sairam.add(rotuloDaTecnica(serie.tecnica().tipo()));
                return serie.comTecnica(null);
            }
            return completa;
        }).toList();
        if (sairam.isEmpty() && series.equals(e.seriesOuVazio())) {
            return e;
        }
        String observacao = e.observacao();
        if (!sairam.isEmpty()) {
            String nota = "Técnica: " + String.join(", ", sairam) + ".";
            observacao = observacao == null || observacao.isBlank() ? nota : observacao.strip() + " " + nota;
            observacao = observacao.length() > 1000 ? observacao.substring(0, 1000).strip() : observacao;
        }
        return new ExercicioPlano(e.uid(), e.exercicioId(), e.nome(), e.modalidade(), e.videoUrl(), observacao,
                e.progressao(), e.unidade(), series, e.cadencia(), e.isometriaSegundos(), e.grupoUid(), e.equipamento(),
                e.alternativas());
    }

    /** A série com a técnica completa e a carga de trabalho (a técnica mora na WS), ou {@code null} se não dá. */
    private static Serie completar(Serie serie, ConfiguracaoConsultoria config) {
        ConteudoTreino.Tecnica lida = serie.tecnica();
        TecnicaDaMetodologia daMetodologia = lida.tipo() == null ? null : config.tecnica(lida.tipo());
        if (daMetodologia == null) {
            return null;
        }
        ConteudoTreino.Tecnica padrao = daMetodologia.padrao() == null
                ? ConteudoTreino.Tecnica.vazia(lida.tipo()) : daMetodologia.padrao();
        Integer seg = lida.pausaSegundos();
        Integer resp = lida.pausaRespiracoes();
        if (seg == null && resp == null) {
            seg = padrao.pausaSegundos();
            resp = padrao.pausaRespiracoes();
        }
        ConteudoTreino.Tecnica t = switch (lida.tipo()) {
            case ConteudoTreino.REST_PAUSE -> ConteudoTreino.Tecnica.restPause(seg, resp, lida.pausas() != null
                    ? lida.pausas() : padrao.pausas() != null ? padrao.pausas() : Integer.valueOf(1));
            case ConteudoTreino.CLUSTER -> ConteudoTreino.Tecnica.cluster(lida.blocos(), seg, resp);
            case ConteudoTreino.DROP_SET -> ConteudoTreino.Tecnica.dropSet(
                    lida.quedas() != null ? lida.quedas() : padrao.quedas(),
                    lida.reducaoPercentual() != null ? lida.reducaoPercentual() : padrao.reducaoPercentual(),
                    padrao.repsPorQueda(), lida.pausaSegundos() != null ? lida.pausaSegundos() : padrao.pausaSegundos());
            default -> null;
        };
        if (t == null || !t.problemas().isEmpty()) {
            return null;
        }
        Serie comTecnica = serie.comTecnica(t);
        if (ConteudoTreino.CLUSTER.equals(t.tipo())) {
            // As repetições do cluster são a soma dos blocos: sem repetições escritas valem a soma; outras, recusam.
            int soma = t.somaDosBlocos();
            boolean sem = serie.repsMin() == null && serie.repsMax() == null && !serie.amrapExplicito();
            boolean bate = soma == (serie.repsMin() == null ? -1 : serie.repsMin())
                    && soma == (serie.repsMax() == null ? -1 : serie.repsMax());
            if (!sem && !bate) {
                return null;
            }
            comTecnica = comTecnica.comReps(soma, soma);
        }
        return serie.carga() == null ? comTecnica.comCarga(ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO))
                : comTecnica;
    }

    private static String rotuloDaTecnica(String tipo) {
        return switch (tipo == null ? "" : tipo) {
            case ConteudoTreino.REST_PAUSE -> "Rest pause";
            case ConteudoTreino.CLUSTER -> "Cluster";
            case ConteudoTreino.DROP_SET -> "Drop-set";
            default -> "outra";
        };
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
