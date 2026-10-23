package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Conteúdo do plano de treino, guardado em {@code jsonb} no rascunho e em cada versão. Todo {@code uid} nasce
 * no cliente e é preservado ao editar: é ele que liga o registro do aluno à série. As anotações limitam o tamanho do
 * que chega; as regras de negócio ficam no {@link ValidadorTreino} (rascunho pode estar incompleto).
 *
 * <p>Quatro conceitos separados: o <b>tipo</b> da série (o papel dela, um código da metodologia), a <b>técnica</b> (a
 * forma de executar), a <b>prescrição</b> (repetições, carga, esforço, descanso) e a <b>execução</b> do exercício
 * (cadência, isometria). A carga e o esforço não se misturam: RIR/RPE é esforço, nunca uma forma de carga.</p>
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

    /** Modalidade do exercício que usa a prescrição de cardio (sem tipo, carga, esforço, repetições nem técnica). */
    public static final String CARDIO = "CARDIO";

    /** Formas de carga. Percentual é sempre da carga da série de trabalho (WS); 1RM não existe em lugar nenhum. */
    public static final String CARGA_TRABALHO = "CARGA_TRABALHO";
    public static final String PERCENTUAL_WS = "PERCENTUAL_WS";
    /** A mesma carga da última série de trabalho do exercício. */
    public static final String MESMA_CARGA = "MESMA_CARGA";
    /** Carga acima da série imediatamente anterior do exercício, em % (top set). */
    public static final String ACIMA_DA_ANTERIOR = "ACIMA_DA_ANTERIOR";
    /** Carga abaixo da carga registrada hoje numa série anterior do exercício ({@code referenciaUid}), em % (back off). */
    public static final String ABAIXO_DA_REFERENCIA = "ABAIXO_DA_REFERENCIA";
    public static final String NENHUMA = "NENHUMA";
    public static final List<String> MODOS = List.of(CARGA_TRABALHO, PERCENTUAL_WS, MESMA_CARGA, ACIMA_DA_ANTERIOR,
            ABAIXO_DA_REFERENCIA, NENHUMA);

    /**
     * Técnicas da série. As seis estruturadas têm campos próprios. As onze descritivas só levam o tipo: o aluno lê a
     * explicação da metodologia. O tipo da série vem da metodologia, a técnica não.
     */
    public static final String REST_PAUSE = "REST_PAUSE";
    public static final String CLUSTER = "CLUSTER";
    public static final String DROP_SET = "DROP_SET";
    public static final String MYO_REPS = "MYO_REPS";
    public static final String PARTIAL_REPS = "PARTIAL_REPS";
    public static final String FORCED_REPS = "FORCED_REPS";
    public static final String NEGATIVA = "NEGATIVA";
    public static final String SUPER_SLOW = "SUPER_SLOW";
    public static final String VINTE_E_UM = "VINTE_E_UM";
    public static final String EMOM = "EMOM";
    public static final String PIRAMIDE_CRESCENTE = "PIRAMIDE_CRESCENTE";
    public static final String PIRAMIDE_DECRESCENTE = "PIRAMIDE_DECRESCENTE";
    public static final String PIRAMIDE_TRUNCADA = "PIRAMIDE_TRUNCADA";
    public static final String DUPLA_PROGRESSAO = "DUPLA_PROGRESSAO";
    public static final String GVT = "GVT";
    public static final String FST7 = "FST7";
    public static final String ESPECIALIZACAO = "ESPECIALIZACAO";
    /** As seis com campos próprios. Só nelas a metodologia pode gravar {@code padrao}. */
    public static final List<String> ESTRUTURADAS = List.of(REST_PAUSE, CLUSTER, DROP_SET, MYO_REPS, PARTIAL_REPS,
            FORCED_REPS);
    /** Sem campo próprio: a explicação da metodologia é o que o aluno lê. */
    public static final List<String> DESCRITIVAS = List.of(NEGATIVA, SUPER_SLOW, VINTE_E_UM, EMOM, PIRAMIDE_CRESCENTE,
            PIRAMIDE_DECRESCENTE, PIRAMIDE_TRUNCADA, DUPLA_PROGRESSAO, GVT, FST7, ESPECIALIZACAO);
    public static final List<String> TECNICAS = List.of(REST_PAUSE, CLUSTER, DROP_SET, MYO_REPS, PARTIAL_REPS,
            FORCED_REPS, NEGATIVA, SUPER_SLOW, VINTE_E_UM, EMOM, PIRAMIDE_CRESCENTE, PIRAMIDE_DECRESCENTE,
            PIRAMIDE_TRUNCADA, DUPLA_PROGRESSAO, GVT, FST7, ESPECIALIZACAO);

    /** Região do alongamento/encurtamento das repetições parciais. */
    public static final String ALONGADA = "ALONGADA";
    public static final String ENCURTADA = "ENCURTADA";
    public static final String LIVRE = "LIVRE";
    public static final List<String> REGIOES = List.of(ALONGADA, ENCURTADA, LIVRE);

    /** Técnicas de grupo de exercícios da sessão. */
    public static final String SUPERSET = "SUPERSET";
    public static final String AGONISTA_ANTAGONISTA = "AGONISTA_ANTAGONISTA";
    public static final String TRI_SET = "TRI_SET";
    public static final String GIANT_SET = "GIANT_SET";
    public static final String CIRCUITO = "CIRCUITO";
    public static final String PRE_EXAUSTAO = "PRE_EXAUSTAO";
    public static final String POS_EXAUSTAO = "POS_EXAUSTAO";
    public static final List<String> TECNICAS_DE_GRUPO = List.of(SUPERSET, AGONISTA_ANTAGONISTA, TRI_SET, GIANT_SET,
            CIRCUITO, PRE_EXAUSTAO, POS_EXAUSTAO);

    /**
     * Sessão. {@code grupos} liga exercícios feitos em sequência (superset, circuito, pré-exaustão...): cada exercício do
     * grupo aponta o {@code uid} dele em {@code grupoUid}, e a ordem é a da sessão.
     */
    public record Sessao(
            UUID uid,
            @Size(max = 80) String nome,
            Integer diaSemana,
            @Size(max = 20) String tipo,
            Integer frequenciaSemanal,
            @Size(max = 1000) String observacao,
            @Size(max = 500) String cardio,
            @Size(max = 40) List<@Valid @NotNull ExercicioPlano> exercicios,
            @Size(max = 20) List<@Valid @NotNull Grupo> grupos) {

        /**
         * Sem grupos = lista vazia, nunca nulo: o JSON sai sempre com {@code "grupos": []} e o app (pacote offline e editor)
         * lê a lista sem conferir nulo. Um corpo sem o campo também vira lista vazia.
         */
        public Sessao {
            grupos = grupos == null ? List.of() : grupos;
        }

        /** Sessão sem grupos de exercícios (a maior parte). */
        public Sessao(UUID uid, String nome, Integer diaSemana, String tipo, Integer frequenciaSemanal, String observacao,
                      String cardio, List<ExercicioPlano> exercicios) {
            this(uid, nome, diaSemana, tipo, frequenciaSemanal, observacao, cardio, exercicios, null);
        }

        public List<ExercicioPlano> exerciciosOuVazio() {
            return exercicios == null ? List.of() : exercicios;
        }

        public List<Grupo> gruposOuVazio() {
            return grupos == null ? List.of() : grupos;
        }
    }

    /**
     * Grupo de exercícios da sessão. {@code descansoAposSegundos} é o descanso depois de cada volta do grupo (não vale em
     * pré/pós-exaustão, onde cada série mantém o próprio descanso); {@code voltas} só conta no circuito.
     */
    public record Grupo(
            UUID uid,
            @Size(max = 30) String tecnica,
            Integer descansoAposSegundos,
            Integer voltas) {
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
            UUID grupoUid) {

        /** Sem cadência, isometria nem grupo (a maior parte dos exercícios). */
        public ExercicioPlano(UUID uid, UUID exercicioId, String nome, String modalidade, String videoUrl,
                              String observacao, Boolean progressao, String unidade, List<Serie> series) {
            this(uid, exercicioId, nome, modalidade, videoUrl, observacao, progressao, unidade, series, null, null, null);
        }

        public List<Serie> seriesOuVazio() {
            return series == null ? List.of() : series;
        }

        /** Exercício de cardio: as séries levam {@code cardio} e não têm tipo, carga, esforço, repetições nem técnica. */
        public boolean deCardio() {
            return CARDIO.equals(modalidade);
        }

        /** Mesmo exercício com outras séries (o resto, inclusive execução e grupo, acompanha). */
        public ExercicioPlano comSeries(UUID novoUid, List<Serie> novas) {
            return new ExercicioPlano(novoUid, exercicioId, nome, modalidade, videoUrl, observacao, progressao, unidade,
                    novas, cadencia, isometriaSegundos, grupoUid);
        }

        public ExercicioPlano comGrupoUid(UUID novo) {
            return new ExercicioPlano(uid, exercicioId, nome, modalidade, videoUrl, observacao, progressao, unidade,
                    series, cadencia, isometriaSegundos, novo);
        }
    }

    /**
     * Uma série. {@code tipo} é o código do tipo na metodologia do plano ({@code WORKING}, {@code BACK_OFF}...) e é
     * obrigatório, menos em exercício de cardio: a técnica nunca o substitui (rest pause, cluster etc. entram na própria
     * série de trabalho). {@code repsMin}/{@code repsMax} juntos ou nenhum; {@code amrap} (o máximo de repetições, só quando
     * pedido) exclui as repetições; no cluster elas são a soma dos blocos. {@code alvoExtra} é um texto curto do
     * treinador (até 120). Não há outro texto livre: o resto vai na observação do exercício.
     */
    public record Serie(
            UUID uid,
            @Size(max = 30) String tipo,
            Integer repsMin,
            Integer repsMax,
            Boolean amrap,
            @Valid Carga carga,
            @Valid Esforco esforco,
            Integer descansoSegundos,
            @Valid Tecnica tecnica,
            @Valid Cardio cardio,
            @Size(max = 120) String alvoExtra) {

        /** Série só com tipo, repetições e carga (o resto a preencher com os {@code com...}). */
        public static Serie de(UUID uid, String tipo, Integer repsMin, Integer repsMax, Carga carga) {
            return new Serie(uid, tipo, repsMin, repsMax, null, carga, null, null, null, null, null);
        }

        public String modo() {
            return carga == null || carga.modo() == null ? NENHUMA : carga.modo();
        }

        /** Série de trabalho: a referência da carga do dia (histórico, % da WS e mesma carga). */
        public boolean deTrabalho() {
            return CARGA_TRABALHO.equals(modo());
        }

        public boolean semTipo() {
            return tipo == null || tipo.isBlank();
        }

        public boolean amrapExplicito() {
            return Boolean.TRUE.equals(amrap);
        }

        public Serie comUid(UUID novo) {
            return new Serie(novo, tipo, repsMin, repsMax, amrap, carga, esforco, descansoSegundos, tecnica, cardio,
                    alvoExtra);
        }

        public Serie comTipo(String novo) {
            return new Serie(uid, novo, repsMin, repsMax, amrap, carga, esforco, descansoSegundos, tecnica, cardio,
                    alvoExtra);
        }

        public Serie comReps(Integer min, Integer max) {
            return new Serie(uid, tipo, min, max, amrap, carga, esforco, descansoSegundos, tecnica, cardio, alvoExtra);
        }

        public Serie comAmrap(Boolean novo) {
            return new Serie(uid, tipo, repsMin, repsMax, novo, carga, esforco, descansoSegundos, tecnica, cardio,
                    alvoExtra);
        }

        public Serie comCarga(Carga nova) {
            return new Serie(uid, tipo, repsMin, repsMax, amrap, nova, esforco, descansoSegundos, tecnica, cardio,
                    alvoExtra);
        }

        public Serie comEsforco(Esforco novo) {
            return new Serie(uid, tipo, repsMin, repsMax, amrap, carga, novo, descansoSegundos, tecnica, cardio,
                    alvoExtra);
        }

        public Serie comDescanso(Integer segundos) {
            return new Serie(uid, tipo, repsMin, repsMax, amrap, carga, esforco, segundos, tecnica, cardio, alvoExtra);
        }

        public Serie comTecnica(Tecnica nova) {
            return new Serie(uid, tipo, repsMin, repsMax, amrap, carga, esforco, descansoSegundos, nova, cardio,
                    alvoExtra);
        }

        public Serie comCardio(Cardio novo) {
            return new Serie(uid, tipo, repsMin, repsMax, amrap, carga, esforco, descansoSegundos, tecnica, novo,
                    alvoExtra);
        }

        public Serie comAlvoExtra(String novo) {
            return new Serie(uid, tipo, repsMin, repsMax, amrap, carga, esforco, descansoSegundos, tecnica, cardio, novo);
        }

        /** Mesma série apontando a referência da carga para outro uid (cópia com uids novos). */
        Serie comReferencia(UUID novaReferencia) {
            return comCarga(new Carga(carga.modo(), carga.percentualMin(), carga.percentualMax(), novaReferencia));
        }
    }

    /**
     * Carga da série. {@code percentualMin}/{@code percentualMax} formam a faixa de {@code PERCENTUAL_WS} ("85 a 90% da
     * WS"), de {@code ACIMA_DA_ANTERIOR} ("+1 a 5% sobre a anterior") e de {@code ABAIXO_DA_REFERENCIA} ("reduzir 10 a
     * 15% da série de referência"); máximo nulo = valor único. {@code referenciaUid} só vale em
     * {@code ABAIXO_DA_REFERENCIA}: uma série anterior do mesmo exercício. Nula = {@code NENHUMA}.
     */
    public record Carga(
            @Size(max = 30) String modo,
            BigDecimal percentualMin,
            BigDecimal percentualMax,
            UUID referenciaUid) {

        public static Carga de(String modo) {
            return new Carga(modo, null, null, null);
        }

        public static Carga percentual(String modo, int min, Integer max) {
            return new Carga(modo, BigDecimal.valueOf(min), max == null ? null : BigDecimal.valueOf(max), null);
        }

        public static Carga abaixoDa(UUID referencia, int min, Integer max) {
            return new Carga(ABAIXO_DA_REFERENCIA, BigDecimal.valueOf(min), max == null ? null : BigDecimal.valueOf(max),
                    referencia);
        }

        /** Problemas por campo de uma carga de série, com a referência obrigatória no back off (vazio = válida). */
        public Map<String, String> problemas() {
            return problemas(true);
        }

        /**
         * Problemas por campo. {@code exigeReferencia} falso é o padrão de um tipo na metodologia, que não conhece as
         * séries do exercício: a referência só nasce na série.
         */
        public Map<String, String> problemas(boolean exigeReferencia) {
            Map<String, String> p = new LinkedHashMap<>();
            String m = modo == null ? NENHUMA : modo;
            if (!MODOS.contains(m)) {
                p.put("modo", "Forma de carga inválida.");
                return p;
            }
            switch (m) {
                case PERCENTUAL_WS -> faixa(p, 200, "Percentual da WS entre 1 e 200.");
                case ACIMA_DA_ANTERIOR -> faixa(p, 100, "Acima da anterior: percentual entre 1 e 100.");
                case ABAIXO_DA_REFERENCIA -> {
                    faixa(p, 50, "Abaixo da referência: redução entre 1 e 50.");
                    if (exigeReferencia && referenciaUid == null) {
                        p.put("referenciaUid", "Escolha a série de referência.");
                    }
                }
                default -> {
                    // CARGA_TRABALHO, MESMA_CARGA e NENHUMA não têm parâmetro.
                }
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
     * Esforço da série: {@code rir} (repetições na reserva, 0 a 5; 0 é "até a falha técnica") ou {@code rpe} (1 a 10, de
     * meio em meio), nunca os dois. Sem nenhum dos dois, a série não tem esforço prescrito.
     */
    public record Esforco(Integer rir, BigDecimal rpe) {

        private static final BigDecimal MEIO = new BigDecimal("0.5");

        public static Esforco deRir(int valor) {
            return new Esforco(valor, null);
        }

        public static Esforco deRpe(String valor) {
            return new Esforco(null, new BigDecimal(valor));
        }

        /** Sem RIR nem RPE: o mesmo que não ter esforço. */
        public boolean vazio() {
            return rir == null && rpe == null;
        }

        public Map<String, String> problemas() {
            Map<String, String> p = new LinkedHashMap<>();
            if (rir != null && (rir < 0 || rir > 5)) {
                p.put("rir", "RIR entre 0 (até a falha técnica) e 5.");
            }
            if (rpe != null && (rpe.compareTo(BigDecimal.ONE) < 0 || rpe.compareTo(BigDecimal.TEN) > 0
                    || rpe.remainder(MEIO).signum() != 0)) {
                p.put("rpe", "RPE precisa ficar entre 1 e 10, de meio em meio.");
            }
            if (rir != null && rpe != null) {
                p.put("rpe", "Use RIR ou RPE, não os dois.");
            }
            return p;
        }
    }

    /**
     * Prescrição de uma série de cardio (só em exercício com modalidade {@code CARDIO}): ao menos duração, distância ou
     * intervalos. O aluno só marca "feito".
     */
    public record Cardio(
            Integer duracaoMin,
            BigDecimal distanciaKm,
            @Size(max = 40) String ritmo,
            Integer zona,
            @Valid Intervalos intervalos) {

        /** Intervalado: {@code voltas} de {@code trabalhoSeg} de esforço e {@code descansoSeg} de descanso. */
        public record Intervalos(Integer trabalhoSeg, Integer descansoSeg, Integer voltas) {
        }

        public Map<String, String> problemas() {
            Map<String, String> p = new LinkedHashMap<>();
            if (duracaoMin == null && distanciaKm == null && intervalos == null) {
                p.put("duracaoMin", "Informe a duração, a distância ou os intervalos.");
            }
            if (duracaoMin != null && (duracaoMin < 1 || duracaoMin > 600)) {
                p.put("duracaoMin", "Duração de 1 a 600 minutos.");
            }
            if (distanciaKm != null && (distanciaKm.signum() <= 0 || distanciaKm.compareTo(new BigDecimal("1000")) > 0)) {
                p.put("distanciaKm", "Distância maior que zero e até 1000 km.");
            }
            if (ritmo != null && ritmo.length() > 40) {
                p.put("ritmo", "Ritmo com no máximo 40 caracteres.");
            }
            if (zona != null && (zona < 1 || zona > 5)) {
                p.put("zona", "Zona de 1 a 5.");
            }
            if (intervalos != null) {
                if (intervalos.trabalhoSeg() == null || intervalos.trabalhoSeg() < 1 || intervalos.trabalhoSeg() > 3600) {
                    p.put("intervalos.trabalhoSeg", "Tempo de esforço de 1 a 3600 segundos.");
                }
                if (intervalos.descansoSeg() != null && (intervalos.descansoSeg() < 0 || intervalos.descansoSeg() > 3600)) {
                    p.put("intervalos.descansoSeg", "Descanso de 0 a 3600 segundos.");
                }
                if (intervalos.voltas() == null || intervalos.voltas() < 1 || intervalos.voltas() > 100) {
                    p.put("intervalos.voltas", "Voltas de 1 a 100.");
                }
            }
            return p;
        }
    }

    /**
     * Técnica da série. Rest pause: a série, uma pausa curta e a retomada com a mesma carga, {@code pausas} vezes
     * (padrão 1; as repetições das retomadas não se prescrevem). Cluster: {@code blocos} de repetições ("4+2") com a
     * pausa entre eles. Drop-set: ao terminar, reduz a carga ({@code reducaoPercentual}, nulo = sem fixar) e continua
     * ({@code repsPorQueda}, nulo = até a falha), {@code quedas} vezes, com {@code pausaSegundos} entre as quedas (0 =
     * sem pausa). Myo-reps: a série de ativação (as repetições da série) e {@code miniSeries} de
     * {@code repsPorMiniSerie}, com a pausa entre elas. Partial reps: {@code repsParciais} no fim da série, na
     * {@code regiao} (alongada, encurtada ou livre). Forced reps: {@code repsAssistidas} com ajuda de um parceiro. A
     * pausa é em segundos, em respirações ou nos dois ("5 respirações ou 10 s"). O aluno registra a série inteira, como
     * nas outras.
     */
    public record Tecnica(
            @Size(max = 30) String tipo,
            Integer pausaSegundos,
            Integer pausaRespiracoes,
            Integer pausas,
            @Size(max = 10) List<Integer> blocos,
            Integer quedas,
            Integer reducaoPercentual,
            Integer repsPorQueda,
            Integer miniSeries,
            Integer repsPorMiniSerie,
            Integer repsParciais,
            @Size(max = 20) String regiao,
            Integer repsAssistidas) {

        public static Tecnica restPause(Integer segundos, Integer respiracoes, Integer pausas) {
            return new Tecnica(REST_PAUSE, segundos, respiracoes, pausas, null, null, null, null, null, null, null, null,
                    null);
        }

        public static Tecnica cluster(List<Integer> blocos, Integer segundos, Integer respiracoes) {
            return new Tecnica(CLUSTER, segundos, respiracoes, null, blocos, null, null, null, null, null, null, null,
                    null);
        }

        public static Tecnica dropSet(Integer quedas, Integer reducaoPercentual, Integer repsPorQueda,
                                      Integer pausaSegundos) {
            return new Tecnica(DROP_SET, pausaSegundos, null, null, null, quedas, reducaoPercentual, repsPorQueda, null,
                    null, null, null, null);
        }

        public static Tecnica myoReps(Integer miniSeries, Integer repsPorMiniSerie, Integer segundos,
                                      Integer respiracoes) {
            return new Tecnica(MYO_REPS, segundos, respiracoes, null, null, null, null, null, miniSeries,
                    repsPorMiniSerie, null, null, null);
        }

        public static Tecnica partialReps(Integer repsParciais, String regiao) {
            return new Tecnica(PARTIAL_REPS, null, null, null, null, null, null, null, null, null, repsParciais, regiao,
                    null);
        }

        public static Tecnica forcedReps(Integer repsAssistidas) {
            return new Tecnica(FORCED_REPS, null, null, null, null, null, null, null, null, null, null, null,
                    repsAssistidas);
        }

        /** Só o tipo, sem valor nenhum (o padrão vazio de uma técnica na metodologia). */
        public static Tecnica vazia(String tipo) {
            return new Tecnica(tipo, null, null, null, null, null, null, null, null, null, null, null, null);
        }

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
                p.put("tipo", "Técnica desconhecida.");
                return p;
            }
            if (DESCRITIVAS.contains(tipo)) {
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
                    faixa(p, pausaSegundos, 0, 600, "pausaSegundos",
                            "Descanso entre as quedas de 0 a 600 segundos (0 = sem descanso).", false);
                }
                case MYO_REPS -> {
                    faixa(p, miniSeries, 2, 10, "miniSeries", "Myo-reps: de 2 a 10 mini-séries.", completa);
                    faixa(p, repsPorMiniSerie, 1, 50, "repsPorMiniSerie",
                            "Myo-reps: de 1 a 50 repetições por mini-série.", completa);
                    pausa(p, completa);
                }
                case PARTIAL_REPS -> {
                    faixa(p, repsParciais, 1, 30, "repsParciais", "Repetições parciais entre 1 e 30.", completa);
                    if (completa ? regiao == null || !REGIOES.contains(regiao) : regiao != null && !REGIOES.contains(regiao)) {
                        p.put("regiao", "Região das parciais: alongada, encurtada ou livre.");
                    }
                }
                case FORCED_REPS -> faixa(p, repsAssistidas, 1, 5, "repsAssistidas",
                        "Repetições assistidas entre 1 e 5.", completa);
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

    /**
     * Cópia com todos os uids novos: receita aplicada, plano copiado ou replicado. As referências entre uids
     * ({@code referenciaUid} da carga, {@code grupos[].uid} e {@code grupoUid} dos exercícios) são remapeadas para os uids
     * novos; uma referência que não aponta para nada do conteúdo fica como está, para o validador apontá-la.
     */
    public ConteudoTreino comUidsNovos() {
        return comUids(UUID::randomUUID);
    }

    /** Mesmo treino com outra metodologia (a cópia das regras que acompanha o plano). */
    public ConteudoTreino comMetodologia(Metodologia nova) {
        return new ConteudoTreino(objetivo, orientacoes, sessoes, nova);
    }

    private ConteudoTreino comUids(Supplier<UUID> novo) {
        List<Sessao> novas = sessoesOuVazio().stream().map(s -> {
            Map<UUID, UUID> gruposNovos = new HashMap<>();
            List<Grupo> grupos = s.grupos() == null ? null : s.grupos().stream().map(g -> {
                UUID uid = novo.get();
                if (g.uid() != null) {
                    gruposNovos.putIfAbsent(g.uid(), uid);
                }
                return new Grupo(uid, g.tecnica(), g.descansoAposSegundos(), g.voltas());
            }).toList();
            List<ExercicioPlano> exercicios = s.exerciciosOuVazio().stream().map(e -> {
                ExercicioPlano copia = e.comSeries(novo.get(), seriesComUidsNovos(e.seriesOuVazio(), novo));
                return e.grupoUid() == null ? copia : copia.comGrupoUid(gruposNovos.getOrDefault(e.grupoUid(), e.grupoUid()));
            }).toList();
            return new Sessao(novo.get(), s.nome(), s.diaSemana(), s.tipo(), s.frequenciaSemanal(), s.observacao(),
                    s.cardio(), exercicios, grupos);
        }).toList();
        return new ConteudoTreino(objetivo, orientacoes, novas, metodologia);
    }

    /** Séries com uid novo; a referência de cada back off passa a apontar o uid novo da série que ela referenciava. */
    private static List<Serie> seriesComUidsNovos(List<Serie> series, Supplier<UUID> novo) {
        Map<UUID, UUID> novos = new HashMap<>();
        List<Serie> copias = series.stream().map(x -> {
            UUID uid = novo.get();
            if (x.uid() != null) {
                novos.putIfAbsent(x.uid(), uid);
            }
            return x.comUid(uid);
        }).toList();
        return copias.stream().map(x -> x.carga() != null && x.carga().referenciaUid() != null
                ? x.comReferencia(novos.getOrDefault(x.carga().referenciaUid(), x.carga().referenciaUid())) : x).toList();
    }
}
