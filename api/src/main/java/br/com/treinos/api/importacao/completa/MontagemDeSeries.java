package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Faixa;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.ErroDaFaixa;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TecnicaDaMetodologia;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.TecnicaEscrita;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Séries do formato com colunas de contagem por tipo (a planilha do primeiro treinador: WS, FS, TS, BO, "Back Off %" e
 * "Rep Range"), porte exato do {@code montarSeries} do {@code planos-lib.mjs}. Ordem FS, WS, Top set, Back off. A faixa
 * de repetições vale só para a WS; FS e Back off levam as repetições do tipo na metodologia. FS tem a carga
 * {@code PERCENTUAL_WS} pela regra de preparação da metodologia para o total de FS; WS = {@code CARGA_TRABALHO}; Top set
 * sem número = {@code ACIMA_DA_ANTERIOR} sem percentual (nunca inventado); Back off = {@code PERCENTUAL_WS} com o % da
 * coluna (fração 0,85 = 85) ou sem carga. Esforço, descanso e técnica ficam nulos: a planilha não os traz.
 *
 * <p>O tipo vem da metodologia da consultoria pelo código ({@code FEEDER}, {@code WORKING}, {@code TOP_SET},
 * {@code BACK_OFF}) e, sem ele, pelo papel. Tipo que a metodologia não tem não vira série (aviso
 * {@code TIPO_FORA_DA_METODOLOGIA}). Os avisos são códigos fixos, sem valor da planilha.
 *
 * <p>O formato livre (uma coluna de prescrição, ou séries e repetições separadas) é o {@link #porPrescricao}: o que o
 * {@link LeitorDePrescricao} entendeu vira séries do tipo de trabalho da metodologia.
 */
public final class MontagemDeSeries {

    /** Teto de séries por tipo numa linha ({@code MAX_SERIES_POR_TIPO} do script). */
    static final int MAX_SERIES_POR_TIPO = 10;
    private static final Set<String> SIM = Set.of("sim", "s", "true", "verdadeiro", "x");
    private static final Set<String> NAO = Set.of("nao", "n", "false", "falso");

    /** Número de uma célula: {@code presente} falso = vazia; presente com {@code valor} nulo = não é número. */
    public record Numero(boolean presente, BigDecimal valor) {
        public static final Numero AUSENTE = new Numero(false, null);

        public static Numero de(BigDecimal valor) {
            return new Numero(true, valor);
        }

        boolean invalido() {
            return presente && valor == null;
        }
    }

    /** Lógico de uma célula, como o {@code logico} do script. */
    public enum Logico { SIM, NAO, AUSENTE, INVALIDO }

    public record Entrada(Numero ws, Numero fs, Logico ts, Logico bo, Numero backoff, LeitorDePrescricao.Faixa faixa) {
    }

    /** {@code faixaRecuperada} = a faixa da WS veio de uma data do Excel (só contada, não é aviso). */
    public record Resultado(List<Serie> series, List<String> avisos, boolean faixaRecuperada) {
    }

    private MontagemDeSeries() {
    }

    /** Número da célula, como o {@code numero} do script: vazia = ausente; texto "2,5" vale; outro texto = não é número. */
    public static Numero numero(Celula c) {
        if (ReconhecimentoDeAbas.vazia(c)) {
            return Numero.AUSENTE;
        }
        if (c.erro()) {
            return Numero.de(null);
        }
        String t = c.texto().strip().replace(',', '.');
        if (!c.numero() && !t.matches("-?\\d+(\\.\\d+)?")) {
            return Numero.de(null);
        }
        try {
            return Numero.de(new BigDecimal(t));
        } catch (NumberFormatException e) {
            return Numero.de(null);
        }
    }

    /**
     * Lógico da célula: vazia = ausente; "sim", "s", "true", "verdadeiro", "x" e 1 = sim; "não", "n", "false", "falso" e 0
     * = não; o resto = inválido. (O leitor já trata o "x" sozinho como célula vazia, então ele chega como ausente.)
     */
    public static Logico logico(Celula c) {
        if (ReconhecimentoDeAbas.vazia(c)) {
            return Logico.AUSENTE;
        }
        if (c.erro()) {
            return Logico.INVALIDO;
        }
        if (c.numero()) {
            BigDecimal n = new BigDecimal(c.texto());
            return n.compareTo(BigDecimal.ONE) == 0 ? Logico.SIM : n.signum() == 0 ? Logico.NAO : Logico.INVALIDO;
        }
        String t = Normalizacao.chaveDoNome(c.texto()).toLowerCase(Locale.ROOT);
        return SIM.contains(t) ? Logico.SIM : NAO.contains(t) ? Logico.NAO : Logico.INVALIDO;
    }

    public static Resultado montar(Entrada e, ConfiguracaoConsultoria metodologia) {
        List<String> avisos = new ArrayList<>();
        List<Serie> series = new ArrayList<>();
        TipoDeSerie tipoFs = tipo(metodologia, "FEEDER", Papel.PREPARACAO, null);
        TipoDeSerie tipoWs = tipo(metodologia, "WORKING", Papel.TRABALHO, ConteudoTreino.CARGA_TRABALHO);
        TipoDeSerie tipoTs = tipo(metodologia, "TOP_SET", Papel.TRABALHO, ConteudoTreino.ACIMA_DA_ANTERIOR);
        TipoDeSerie tipoBo = tipo(metodologia, "BACK_OFF", Papel.POS_TRABALHO, null);

        int nFs = quantidade(e.fs(), "FS", avisos);
        if (nFs > 0 && tipoFs == null) {
            avisos.add("TIPO_FORA_DA_METODOLOGIA");
        } else if (nFs > 0) {
            List<Faixa> regra = tipoFs.regraPercentuais() == null ? null : tipoFs.regraPercentuais().get(String.valueOf(nFs));
            if (regra == null || regra.size() < nFs) {
                regra = null;
                avisos.add("FS_SEM_REGRA_DE_PERCENTUAL");
            }
            for (int i = 0; i < nFs; i++) {
                Carga carga = regra == null ? Carga.de(ConteudoTreino.NENHUMA)
                        : Carga.percentual(ConteudoTreino.PERCENTUAL_WS, regra.get(i).min(), regra.get(i).max());
                series.add(serie(tipoFs, repsMin(tipoFs), repsMax(tipoFs), carga));
            }
        }

        int nWs = quantidade(e.ws(), "WS", avisos);
        Integer min = null;
        Integer max = null;
        boolean recuperada = false;
        if (nWs > 0) {
            LeitorDePrescricao.Faixa f = e.faixa();
            if (f == null || !f.ok()) {
                ErroDaFaixa erro = f == null ? ErroDaFaixa.VAZIA : f.erro();
                avisos.add(erro == ErroDaFaixa.DATA ? "FAIXA_VIROU_DATA" : erro == ErroDaFaixa.VAZIA ? "FAIXA_VAZIA" : "FAIXA_INVALIDA");
            } else {
                min = f.min();
                max = f.max();
                recuperada = f.deData();
            }
            if (tipoWs == null) {
                avisos.add("TIPO_FORA_DA_METODOLOGIA");
            }
        }
        for (int i = 0; i < nWs && tipoWs != null; i++) {
            series.add(serie(tipoWs, min, max, Carga.de(ConteudoTreino.CARGA_TRABALHO)));
        }

        if (e.ts() == Logico.INVALIDO) {
            avisos.add("TS_INVALIDO");
        }
        if (e.ts() == Logico.SIM) {
            if (tipoTs == null) {
                avisos.add("TIPO_FORA_DA_METODOLOGIA");
            } else {
                series.add(serie(tipoTs, null, null, Carga.de(ConteudoTreino.ACIMA_DA_ANTERIOR)));
                avisos.add("TOP_SET_SEM_PERCENTUAL");
            }
        }

        if (e.bo() == Logico.INVALIDO) {
            avisos.add("BO_INVALIDO");
        }
        if (e.bo() == Logico.SIM) {
            // A planilha diz só se há back off, não quantas séries: uma. Fração da planilha (0,85) vira 85.
            BigDecimal b = e.backoff() == null ? null : e.backoff().valor();
            Integer p = b != null && b.signum() > 0 && b.compareTo(BigDecimal.valueOf(2)) <= 0
                    ? b.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).intValueExact() : null;
            if (p == null) {
                avisos.add("BACK_OFF_SEM_PERCENTUAL");
            }
            if (tipoBo == null) {
                avisos.add("TIPO_FORA_DA_METODOLOGIA");
            } else {
                series.add(serie(tipoBo, repsMin(tipoBo), repsMax(tipoBo),
                        p == null ? Carga.de(ConteudoTreino.NENHUMA) : Carga.percentual(ConteudoTreino.PERCENTUAL_WS, p, null)));
            }
        }
        return new Resultado(List.copyOf(series), List.copyOf(avisos), recuperada && nWs > 0);
    }

    /**
     * O que foi entendido da prescrição escrita (de uma ou mais colunas da linha, já juntado): {@code series} = a
     * quantidade escrita; {@code piramide} = as repetições de cada série; {@code duracaoSegundos} = série por tempo;
     * {@code tecnica} = a técnica estruturada escrita, com os números que vieram junto.
     */
    public record Prescrita(Integer series, Integer repsMin, Integer repsMax, List<Integer> piramide, boolean amrap,
                            boolean falha, Integer duracaoSegundos, Integer descansoSegundos, Integer rir, BigDecimal rpe,
                            TecnicaEscrita tecnica) {
    }

    /**
     * {@code manterTexto} = o texto da planilha precisa ir para a observação (técnica posta com padrões da metodologia,
     * técnica ou pirâmide que não deu para usar); {@code observacoes} = linhas a acrescentar na observação do exercício
     * (a duração da série por tempo).
     */
    public record PorPrescricao(List<Serie> series, List<String> avisos, boolean manterTexto, List<String> observacoes) {
    }

    /**
     * Séries do formato livre: só nascem quando a quantidade está escrita ("3x10", a coluna "Séries") ou é a pirâmide
     * (uma série por número). Todas do tipo de trabalho da metodologia, com carga de trabalho (nunca um número), as
     * repetições entendidas (ou sem elas), AMRAP só quando escrito, "até a falha" como RIR 0, o RIR ou o RPE de um valor
     * só e o descanso escrito. Série por tempo nasce sem repetições e a duração vai para a observação (como no resto do
     * projeto). A técnica (rest pause, cluster ou drop-set) só entra se a metodologia da consultoria a tem e se fica
     * completa com o que foi escrito mais o padrão da metodologia (o mesmo que o editor preenche ao escolher a técnica);
     * senão a série fica sem técnica e o texto fica na observação. Avisos com códigos fixos, sem valor da planilha.
     */
    public static PorPrescricao porPrescricao(Prescrita p, ConfiguracaoConsultoria metodologia) {
        List<String> avisos = new ArrayList<>();
        List<String> observacoes = new ArrayList<>();
        boolean manter = false;
        Integer quantidade = p.series();
        List<Integer> piramide = p.piramide();
        if (piramide != null && quantidade != null && quantidade != piramide.size()) {
            avisos.add("PIRAMIDE_DIFERENTE_DAS_SERIES");
            return new PorPrescricao(List.of(), List.copyOf(avisos), true, List.of());
        }
        if (piramide != null) {
            quantidade = piramide.size();
        }
        if (quantidade == null) {
            return new PorPrescricao(List.of(), List.of(), false, List.of());
        }
        TipoDeSerie trabalho = tipo(metodologia, "WORKING", Papel.TRABALHO, ConteudoTreino.CARGA_TRABALHO);
        if (trabalho == null) {
            avisos.add("TIPO_FORA_DA_METODOLOGIA");
            return new PorPrescricao(List.of(), List.copyOf(avisos), true, List.of());
        }

        Esforco esforco = null;
        Integer rir = p.falha() ? Integer.valueOf(0) : p.rir();
        if ((p.falha() && p.rir() != null && p.rir() != 0) || (rir != null && p.rpe() != null)) {
            avisos.add("ESFORCO_CONFLITANTE");
            manter = true;
        } else if (rir != null) {
            esforco = Esforco.deRir(rir);
        } else if (p.rpe() != null) {
            esforco = new Esforco(null, p.rpe());
        }

        Integer min = p.amrap() ? null : p.repsMin();
        Integer max = p.amrap() ? null : p.repsMax();
        if (p.duracaoSegundos() != null) {
            min = null;
            max = null;
            observacoes.add("Duração de cada série: " + duracao(p.duracaoSegundos()));
        }

        Tecnica tecnica = null;
        if (p.tecnica() != null) {
            manter = true; // a técnica entra com padrões da metodologia: o texto da planilha fica para conferir
            tecnica = tecnica(p.tecnica(), metodologia, avisos);
            if (tecnica != null && ConteudoTreino.CLUSTER.equals(tecnica.tipo())) {
                int soma = tecnica.blocos().stream().mapToInt(Integer::intValue).sum();
                boolean bate = piramide == null && !p.amrap() && p.duracaoSegundos() == null
                        && (min == null || (min == soma && max != null && max == soma));
                if (bate) {
                    min = soma;
                    max = soma;
                } else {
                    avisos.add("CLUSTER_DIFERENTE_DAS_REPETICOES");
                    tecnica = null;
                }
            }
        }

        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            Integer rMin = piramide != null ? piramide.get(i) : min;
            Integer rMax = piramide != null ? piramide.get(i) : max;
            boolean comTecnica = tecnica != null && (!p.tecnica().soNaUltima() || i == quantidade - 1);
            series.add(new Serie(UUID.randomUUID(), trabalho.codigo().trim(), rMin, rMax, p.amrap() ? Boolean.TRUE : null,
                    Carga.de(ConteudoTreino.CARGA_TRABALHO), esforco, p.descansoSegundos(), comTecnica ? tecnica : null,
                    null, null));
        }
        return new PorPrescricao(List.copyOf(series), List.copyOf(avisos), manter, List.copyOf(observacoes));
    }

    /**
     * A técnica completa: o que foi escrito e, no que faltou, o padrão da metodologia. Técnica fora da metodologia ou
     * que continua incompleta (cluster sem blocos, por exemplo) = null com aviso.
     */
    static Tecnica tecnica(TecnicaEscrita e, ConfiguracaoConsultoria metodologia, List<String> avisos) {
        String tipo = switch (e.tipo()) {
            case REST_PAUSE -> ConteudoTreino.REST_PAUSE;
            case CLUSTER -> ConteudoTreino.CLUSTER;
            case DROP_SET -> ConteudoTreino.DROP_SET;
            case SUPERSET -> null;
        };
        TecnicaDaMetodologia daMetodologia = tipo == null || metodologia == null || metodologia.tecnicas() == null
                ? null : metodologia.tecnica(tipo);
        if (daMetodologia == null) {
            avisos.add("TECNICA_FORA_DA_METODOLOGIA");
            return null;
        }
        Tecnica padrao = daMetodologia.padrao() == null ? Tecnica.vazia(tipo) : daMetodologia.padrao();
        Integer seg = e.pausaSegundos();
        Integer resp = e.pausaRespiracoes();
        if (seg == null && resp == null) {
            seg = padrao.pausaSegundos();
            resp = padrao.pausaRespiracoes();
        }
        Tecnica t = switch (tipo) {
            case ConteudoTreino.REST_PAUSE -> Tecnica.restPause(seg, resp, e.pausas() != null ? e.pausas()
                    : padrao.pausas() != null ? padrao.pausas() : Integer.valueOf(1));
            case ConteudoTreino.CLUSTER -> Tecnica.cluster(e.blocos(), seg, resp);
            default -> Tecnica.dropSet(e.quedas() != null ? e.quedas() : padrao.quedas(),
                    e.reducaoPercentual() != null ? e.reducaoPercentual() : padrao.reducaoPercentual(),
                    padrao.repsPorQueda(), e.pausaSegundos() != null ? e.pausaSegundos() : padrao.pausaSegundos());
        };
        if (!t.problemas().isEmpty()) {
            avisos.add("TECNICA_INCOMPLETA");
            return null;
        }
        return t;
    }

    /** "30 s", "1 min", "1 min 30 s". */
    static String duracao(int segundos) {
        int min = segundos / 60;
        int seg = segundos % 60;
        if (min == 0) {
            return seg + " s";
        }
        return seg == 0 ? min + " min" : min + " min " + seg + " s";
    }

    /** Quantidade de séries de um tipo: ausente = 0; não inteiro ou negativo = inválida; acima de 10 = ignorada. */
    private static int quantidade(Numero n, String rotulo, List<String> avisos) {
        if (n == null || !n.presente()) {
            return 0;
        }
        BigDecimal v = n.valor();
        boolean inteiro = v != null && (v.signum() == 0 || v.stripTrailingZeros().scale() <= 0);
        if (!inteiro || v.signum() < 0) {
            avisos.add("QUANTIDADE_DE_" + rotulo + "_INVALIDA");
            return 0;
        }
        if (v.compareTo(BigDecimal.valueOf(MAX_SERIES_POR_TIPO)) > 0) {
            avisos.add("QUANTIDADE_DE_" + rotulo + "_ACIMA_DE_10");
            return 0;
        }
        return v.intValueExact();
    }

    /** O tipo pelo código e, sem ele, o primeiro com o papel (e a carga padrão, quando dada). */
    static TipoDeSerie tipo(ConfiguracaoConsultoria m, String codigo, Papel papel, String modoDaCarga) {
        if (m == null || m.tipos() == null) {
            return null;
        }
        TipoDeSerie porCodigo = m.tipoPorCodigo(codigo);
        if (porCodigo != null) {
            return porCodigo;
        }
        return m.tipos().stream().filter(t -> t != null && t.papel() == papel && t.codigo() != null)
                .filter(t -> modoDaCarga == null || (t.cargaPadrao() != null && modoDaCarga.equals(t.cargaPadrao().modo())))
                .findFirst().orElse(null);
    }

    private static Integer repsMin(TipoDeSerie t) {
        return t.repeticoes() == null ? null : t.repeticoes().min();
    }

    private static Integer repsMax(TipoDeSerie t) {
        return t.repeticoes() == null ? null : t.repeticoes().max();
    }

    private static Serie serie(TipoDeSerie tipo, Integer min, Integer max, Carga carga) {
        return Serie.de(UUID.randomUUID(), tipo.codigo().trim(), min, max, carga);
    }
}
