package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Faixa;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.ErroDaFaixa;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Serie;

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
