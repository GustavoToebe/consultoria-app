package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Conteúdo do plano de treino, guardado em {@code jsonb} no rascunho e em cada versão. Todo {@code uid} nasce
 * no cliente e é preservado ao editar: é ele que liga o registro do aluno à série. As anotações limitam o tamanho do
 * que chega; as regras de negócio ficam no {@link ValidadorTreino} (rascunho pode estar incompleto).
 */
public record ConteudoTreino(
        @Size(max = 200) String objetivo,
        @Size(max = 8000) String orientacoes,
        @NotNull @Size(max = 20) List<@Valid @NotNull Sessao> sessoes,
        @Valid Metodologia metodologia) {

    public record Metodologia(UUID id, @Size(max = 120) String nome,
                              @NotNull ConfiguracaoConsultoria configuracao) { }

    public ConteudoTreino(String objetivo, String orientacoes, List<Sessao> sessoes) {
        this(objetivo, orientacoes, sessoes, null);
    }

    public static final String TREINO = "TREINO";
    public static final String DESCANSO_ATIVO = "DESCANSO_ATIVO";
    public static final String DESCANSO = "DESCANSO";
    public static final String ACESSORIOS = "ACESSORIOS";
    public static final List<String> TIPOS_SESSAO = List.of(TREINO, DESCANSO_ATIVO, DESCANSO, ACESSORIOS);

    /** Formas de intensidade. Percentual é sempre da carga da série de trabalho (WS); 1RM não existe em lugar nenhum. */
    public static final String CARGA_TRABALHO = "CARGA_TRABALHO";
    public static final String PERCENTUAL_WS = "PERCENTUAL_WS";
    /** Carga acima da série imediatamente anterior do exercício, em % (top set). */
    public static final String ACIMA_DA_ANTERIOR = "ACIMA_DA_ANTERIOR";
    /** A mesma carga da última série de trabalho do exercício (rest pause ou cluster depois da WS). */
    public static final String MESMA_CARGA = "MESMA_CARGA";
    public static final String RPE = "RPE";
    public static final String NENHUMA = "NENHUMA";
    public static final List<String> MODOS = List.of(CARGA_TRABALHO, PERCENTUAL_WS, ACIMA_DA_ANTERIOR, MESMA_CARGA, RPE,
            NENHUMA);
    /** Técnicas da série: lista fixa com campos próprios. O tipo da série tem nome livre, a técnica não. */
    public static final String REST_PAUSE = "REST_PAUSE";
    public static final String CLUSTER = "CLUSTER";
    public static final String DROP_SET = "DROP_SET";
    public static final List<String> TECNICAS = List.of(REST_PAUSE, CLUSTER, DROP_SET);
    /** Nome escolhido pelo treinador para um grupo de 2 exercícios (sem ele, "Bi-set"). */
    public static final String SUPERSERIE = "SUPERSERIE";

    public record Sessao(
            UUID uid,
            @Size(max = 80) String nome,
            Integer diaSemana,
            @Size(max = 20) String tipo,
            Integer frequenciaSemanal,
            @Size(max = 1000) String observacao,
            @Size(max = 500) String cardio,
            @Size(max = 40) List<@Valid @NotNull ExercicioPlano> exercicios) {

        public List<ExercicioPlano> exerciciosOuVazio() {
            return exercicios == null ? List.of() : exercicios;
        }
    }

    public record ExercicioPlano(
            UUID uid,
            UUID exercicioId,
            @Size(max = 120) String nome,
            @Size(max = 20) String modalidade,
            @Size(max = 500) String videoUrl,
            @Size(max = 1000) String observacao,
            Boolean progressao,
            @Size(max = 10) String unidade,
            @Size(max = 30) List<@Valid @NotNull Serie> series,
            @Size(max = 15) String cadencia,
            Integer isometriaSegundos,
            Boolean juntoComAnterior,
            @Size(max = 20) String combinacao) {

        /** Sem cadência, isometria nem agrupamento (a maior parte dos exercícios). */
        public ExercicioPlano(UUID uid, UUID exercicioId, String nome, String modalidade, String videoUrl,
                              String observacao, Boolean progressao, String unidade, List<Serie> series) {
            this(uid, exercicioId, nome, modalidade, videoUrl, observacao, progressao, unidade, series, null, null,
                    null, null);
        }

        public List<Serie> seriesOuVazio() {
            return series == null ? List.of() : series;
        }

        /** Feito em sequência com o exercício anterior da sessão, sem descanso entre eles (bi-set, tri-set...). */
        public boolean junto() {
            return Boolean.TRUE.equals(juntoComAnterior);
        }

        /** Mesmo exercício com outras séries (o resto, inclusive execução e agrupamento, acompanha). */
        public ExercicioPlano comSeries(UUID novoUid, List<Serie> novas) {
            return new ExercicioPlano(novoUid, exercicioId, nome, modalidade, videoUrl, observacao, progressao, unidade,
                    novas, cadencia, isometriaSegundos, juntoComAnterior, combinacao);
        }
    }

    /**
     * Uma série. {@code tipo} nulo só com técnica (a série que é só "rest pause" depois da WS). {@code repsMin} e
     * {@code repsMax} nulos = série por tempo (cardio); no cluster são a soma dos blocos. Não há texto livre aqui: o que
     * não cabe nos campos vai na observação do exercício.
     */
    public record Serie(
            UUID uid,
            @Size(max = 30) String tipo,
            Integer repsMin,
            Integer repsMax,
            @Valid Intensidade intensidade,
            Integer descansoSegundos,
            @Valid Tecnica tecnica) {

        public String modo() {
            return intensidade == null || intensidade.modo() == null ? NENHUMA : intensidade.modo();
        }

        /** Série de trabalho: a referência da carga do dia (histórico, % da WS e mesma carga). */
        public boolean deTrabalho() {
            return CARGA_TRABALHO.equals(modo());
        }

        public boolean semTipo() {
            return tipo == null || tipo.isBlank();
        }
    }

    /**
     * Intensidade da série. {@code percentualMin}/{@code percentualMax} formam a faixa de {@code PERCENTUAL_WS} ("85 a
     * 90% da WS") e de {@code ACIMA_DA_ANTERIOR} ("+1 a 5% sobre a anterior"); máximo nulo = valor único. {@code rir}
     * (0 a 5) vale em qualquer modo e 0 é "até a falha". Nula = {@code NENHUMA}.
     */
    public record Intensidade(
            @Size(max = 20) String modo,
            BigDecimal percentualMin,
            BigDecimal percentualMax,
            BigDecimal rpe,
            Integer rir) {

        private static final BigDecimal MEIO = new BigDecimal("0.5");

        /** Problemas por campo (vazio = válida). A chave é o nome do campo, para o app apontar onde está o erro. */
        public Map<String, String> problemas() {
            Map<String, String> p = new LinkedHashMap<>();
            String m = modo == null ? NENHUMA : modo;
            if (!MODOS.contains(m)) {
                p.put("modo", "Forma de intensidade inválida.");
                return p;
            }
            switch (m) {
                case PERCENTUAL_WS -> faixa(p, 200, "Percentual da WS entre 1 e 200.");
                case ACIMA_DA_ANTERIOR -> faixa(p, 100, "Acima da anterior: percentual entre 1 e 100.");
                case RPE -> {
                    if (rpe == null || rpe.compareTo(BigDecimal.ONE) < 0 || rpe.compareTo(BigDecimal.TEN) > 0
                            || rpe.remainder(MEIO).signum() != 0) {
                        p.put("rpe", "RPE precisa ficar entre 1 e 10, de meio em meio.");
                    }
                }
                default -> {
                    // CARGA_TRABALHO, MESMA_CARGA e NENHUMA não têm parâmetro além do RIR.
                }
            }
            if (rir != null && (rir < 0 || rir > 5)) {
                p.put("rir", "RIR entre 0 (até a falha) e 5.");
            }
            return p;
        }

        private void faixa(Map<String, String> p, int maximo, String mensagem) {
            BigDecimal max = BigDecimal.valueOf(maximo);
            if (percentualMin == null || percentualMin.compareTo(BigDecimal.ONE) < 0 || percentualMin.compareTo(max) > 0) {
                p.put("percentualMin", mensagem);
            } else if (percentualMax != null
                    && (percentualMax.compareTo(percentualMin) < 0 || percentualMax.compareTo(max) > 0)) {
                p.put("percentualMax", "Percentual máximo entre o mínimo e " + maximo + ".");
            }
        }
    }

    /**
     * Técnica da série. Rest pause: a série, uma pausa curta e a retomada com a mesma carga, {@code pausas} vezes
     * (padrão 1; as repetições das retomadas não se prescrevem). Cluster: {@code blocos} de repetições ("4+2") com a
     * pausa entre eles. Drop-set: ao terminar, reduz a carga ({@code reducaoPercentual}, nulo = sem fixar) e continua
     * ({@code repsPorQueda}, nulo = até a falha), {@code quedas} vezes. A pausa é em segundos, em respirações ou nos
     * dois ("5 respirações ou 10 s"). O aluno registra a série inteira, como nas outras.
     */
    public record Tecnica(
            @Size(max = 20) String tipo,
            Integer pausaSegundos,
            Integer pausaRespiracoes,
            Integer pausas,
            @Size(max = 10) List<Integer> blocos,
            Integer quedas,
            Integer reducaoPercentual,
            Integer repsPorQueda) {

        /** Problemas por campo de uma técnica completa, a da série (vazio = válida). */
        public Map<String, String> problemas() {
            return problemas(true);
        }

        /** Problemas só dos valores presentes: os padrões da metodologia são parciais (cluster sem blocos, por exemplo). */
        public Map<String, String> problemasDosValores() {
            return problemas(false);
        }

        private Map<String, String> problemas(boolean completa) {
            Map<String, String> p = new LinkedHashMap<>();
            if (tipo == null || !TECNICAS.contains(tipo)) {
                p.put("tipo", "Técnica desconhecida: use rest pause, cluster ou drop-set.");
                return p;
            }
            switch (tipo) {
                case REST_PAUSE -> {
                    pausa(p, completa);
                    faixa(p, pausas, 1, 5, "pausas", "Pausas do rest pause entre 1 e 5.", false);
                }
                case CLUSTER -> {
                    pausa(p, completa);
                    if ((completa || blocos != null) && (blocos == null || blocos.size() < 2 || blocos.size() > 10
                            || blocos.stream().anyMatch(b -> b == null || b < 1 || b > 50))) {
                        p.put("blocos", "Cluster: de 2 a 10 blocos, cada um com 1 a 50 repetições.");
                    }
                }
                case DROP_SET -> {
                    faixa(p, quedas, 1, 5, "quedas", "Quedas do drop-set entre 1 e 5.", completa);
                    faixa(p, reducaoPercentual, 5, 50, "reducaoPercentual",
                            "Redução da carga entre 5% e 50% (ou vazio, sem fixar).", false);
                    faixa(p, repsPorQueda, 1, 50, "repsPorQueda",
                            "Repetições por queda entre 1 e 50 (ou vazio, até a falha).", false);
                }
                default -> {
                    // Coberto pela lista TECNICAS.
                }
            }
            return p;
        }

        private void pausa(Map<String, String> p, boolean obrigatoria) {
            if (obrigatoria && pausaSegundos == null && pausaRespiracoes == null) {
                p.put("pausaSegundos", "Informe a pausa em segundos ou em respirações.");
            }
            faixa(p, pausaSegundos, 5, 600, "pausaSegundos", "Pausa de 5 a 600 segundos.", false);
            faixa(p, pausaRespiracoes, 1, 30, "pausaRespiracoes", "Pausa de 1 a 30 respirações.", false);
        }

        private static void faixa(Map<String, String> p, Integer valor, int min, int max, String campo, String mensagem,
                                  boolean obrigatorio) {
            if (valor == null ? obrigatorio : valor < min || valor > max) {
                p.put(campo, mensagem);
            }
        }

        /** Repetições de um cluster: a soma dos blocos ({@code null} se não é cluster ou não tem blocos). */
        public Integer somaDosBlocos() {
            if (!CLUSTER.equals(tipo) || blocos == null || blocos.isEmpty() || blocos.stream().anyMatch(b -> b == null)) {
                return null;
            }
            return blocos.stream().mapToInt(Integer::intValue).sum();
        }
    }

    public static ConteudoTreino vazio() {
        return new ConteudoTreino(null, null, List.of());
    }

    public List<Sessao> sessoesOuVazio() {
        return sessoes == null ? List.of() : sessoes;
    }

    /** Cópia com todos os uids novos: receita aplicada, plano copiado ou replicado. */
    public ConteudoTreino comUidsNovos() {
        return comUids(UUID::randomUUID);
    }

    /** Mesmo treino com outra metodologia (a cópia das regras que acompanha o plano). */
    public ConteudoTreino comMetodologia(Metodologia nova) {
        return new ConteudoTreino(objetivo, orientacoes, sessoes, nova);
    }

    private ConteudoTreino comUids(Supplier<UUID> novo) {
        List<Sessao> novas = sessoesOuVazio().stream().map(s -> new Sessao(novo.get(), s.nome(), s.diaSemana(),
                s.tipo(), s.frequenciaSemanal(), s.observacao(), s.cardio(),
                s.exerciciosOuVazio().stream().map(e -> e.comSeries(novo.get(),
                        e.seriesOuVazio().stream().map(x -> new Serie(novo.get(), x.tipo(), x.repsMin(), x.repsMax(),
                                x.intensidade(), x.descansoSegundos(), x.tecnica())).toList())).toList()))
                .toList();
        return new ConteudoTreino(objetivo, orientacoes, novas, metodologia);
    }
}
