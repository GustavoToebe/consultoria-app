package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lê o texto de prescrição de uma célula ("4x10", "3x8-12", "3 séries de 10", "10-12", "até a falha", "AMRAP", "30 kg",
 * "rest pause"...) por regras fixas. Devolve o que entendeu e o texto que sobrou, que vai para a observação. O que não
 * entende não preenche: nunca inventa série, repetição nem carga.
 *
 * <p>A faixa de repetições que o Excel transformou em data ("8-12" virou 08/12) é recuperada como o
 * {@code faixaDeRepeticoes} do {@code planos-lib.mjs}: o dia e o mês, do menor para o maior, só se os dois estão entre 1 e
 * 50 e o ano (quando há) entre {@value #ANO_MINIMO_DA_DATA} e {@value #ANO_MAXIMO_DA_DATA}.
 */
public final class LeitorDePrescricao {

    public static final int ANO_MINIMO_DA_DATA = 2015;
    public static final int ANO_MAXIMO_DA_DATA = 2040;
    private static final int PARTE_MAXIMA_DA_DATA = 50;
    private static final int REPETICOES_MAXIMAS = 500;
    /** Teto de séries de um exercício na API ({@code LIMITE_SERIES} do editor). */
    static final int SERIES_MAXIMAS = 30;
    private static final BigDecimal CARGA_MAXIMA = new BigDecimal("1000");
    private static final LocalDate BASE_1900 = LocalDate.of(1899, 12, 30);
    private static final LocalDate BASE_1904 = LocalDate.of(1904, 1, 1);

    public enum Tecnica { REST_PAUSE, DROP_SET, CLUSTER, SUPERSET }

    public enum ErroDaFaixa { VAZIA, INVALIDA, DATA }

    /** Faixa de repetições: {@code min}/{@code max} ou {@code erro}; {@code deData} = recuperada de uma data do Excel. */
    public record Faixa(Integer min, Integer max, boolean deData, ErroDaFaixa erro) {
        static Faixa de(int min, int max) {
            return new Faixa(min, max, false, null);
        }

        static Faixa daData(int min, int max) {
            return new Faixa(min, max, true, null);
        }

        static Faixa comErro(ErroDaFaixa erro) {
            return new Faixa(null, null, false, erro);
        }

        public boolean ok() {
            return erro == null;
        }
    }

    /**
     * O que foi entendido (nulo = não estava escrito ou não foi entendido) e a {@code sobra}: o texto original sem os
     * trechos entendidos, sem pontuação solta nas pontas ("" quando nada sobrou).
     */
    public record Prescricao(Integer series, Integer repsMin, Integer repsMax, boolean amrap, boolean ateAFalha,
                             BigDecimal cargaKg, Set<Tecnica> tecnicas, boolean faixaDeData, String sobra) {

        static final Prescricao VAZIA = new Prescricao(null, null, null, false, false, null, Set.of(), false, "");

        public boolean entendeuAlgo() {
            return series != null || repsMin != null || amrap || ateAFalha || cargaKg != null || !tecnicas.isEmpty();
        }

        /** Tinha texto e nada foi entendido. */
        public boolean naoEntendida() {
            return !entendeuAlgo() && !sobra.isEmpty();
        }

        /** Entendeu parte e sobrou texto (que vai para a observação). */
        public boolean comSobra() {
            return entendeuAlgo() && !sobra.isEmpty();
        }

        public boolean vazia() {
            return !entendeuAlgo() && sobra.isEmpty();
        }
    }

    /** Número que não é pedaço de outro (nem de decimal: "4x10,5" não é "4x10"); vírgula de lista vale. */
    private static final String ANTES = "(?<!\\d)(?<!\\d[.,])";
    private static final String DEPOIS = "(?!\\d)(?![.,]\\d)";
    private static final String REPS = "(?:\\s*(?:repeticoes|repeticao|reps|rep))?";
    private static final String ATE = "\\s*(?:-|–|a|ate|/)\\s*";
    private static final Pattern SERIES_X_REPS = Pattern.compile(
            ANTES + "(\\d{1,2})\\s*[x×]\\s*(\\d{1,3})(?:" + ATE + "(\\d{1,3}))?" + DEPOIS + REPS + "(?![a-z])");
    private static final Pattern SERIES_X_FALHA = Pattern.compile(
            ANTES + "(\\d{1,2})\\s*[x×]\\s*(?:ate\\s+a\\s+|ate\\s+)?(falha|amrap)(?![a-z])");
    private static final Pattern SERIES_DE = Pattern.compile(
            ANTES + "(\\d{1,2})\\s*(?:series|serie)(?![a-z])(?:\\s*de\\s*(\\d{1,3})(?:\\s*(?:-|–|a|ate)\\s*(\\d{1,3}))?"
                    + DEPOIS + REPS + "(?![a-z]))?");
    private static final Pattern CARGA = Pattern.compile(ANTES + "(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*kgs?(?![a-z])");
    private static final Pattern REPS_FAIXA = Pattern.compile(
            ANTES + "(?<![\\-–])(\\d{1,3})\\s*(?:-|–|a|ate)\\s*(\\d{1,3})" + DEPOIS + "(?![\\-–])" + REPS + "(?![a-z])");
    private static final Pattern REPS_N = Pattern.compile(ANTES + "(\\d{1,3})\\s*(?:repeticoes|repeticao|reps|rep)(?![a-z])");
    private static final Pattern AMRAP = Pattern.compile("(?<![a-z])amrap(?![a-z])");
    private static final Pattern FALHA = Pattern.compile("(?<![a-z])(?:ate\\s+a\\s+|ate\\s+)?falha(?![a-z])");
    private static final Pattern REST_PAUSE = Pattern.compile("(?<![a-z])rest[\\s-]?pause(?![a-z])");
    private static final Pattern DROP = Pattern.compile("(?<![a-z])(?:drop[\\s-]?sets?|drop)(?![a-z])");
    private static final Pattern CLUSTER = Pattern.compile("(?<![a-z])cluster(?![a-z])");
    private static final Pattern SUPERSET = Pattern.compile(
            "(?<![a-z])(?:bi[\\s-]?sets?|super[\\s-]?sets?|super[\\s-]?series?|bi[\\s-]?series?|bisseries?)(?![a-z])");
    private static final Pattern FAIXA_ESCRITA = Pattern.compile("^(\\d{1,3})\\s*(?:a|à|-|–)\\s*(\\d{1,3})$");
    private static final Pattern NUMERO_SOLTO = Pattern.compile("^(\\d{1,3})$");
    private static final Pattern DATA_ISO = Pattern.compile(
            "^(\\d{4})-(\\d{1,2})-(\\d{1,2})(?:[t ]\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?z?)?$");
    private static final Pattern DATA_BR = Pattern.compile("^(\\d{1,2})\\s*([/-])\\s*(\\d{1,2})(?:\\s*\\2\\s*(\\d{4}|\\d{2}))?$");
    private static final Pattern PONTAS = Pattern.compile("^[\\s,;:+\\-–/|.()]+|[\\s,;:+\\-–/|.()]+$");
    private static final Pattern CONECTIVO_NAS_PONTAS = Pattern.compile("^(?:de|e)\\s+|\\s+(?:de|e)$", Pattern.CASE_INSENSITIVE);

    private LeitorDePrescricao() {
    }

    /**
     * Faixa de repetições de uma célula, como o {@code faixaDeRepeticoes} do script: número inteiro de 0 a 500 é fixo
     * (mínimo = máximo); outro número é uma data do Excel (recuperada ou {@code DATA}); texto "6a8", "6-8", "6 à 8" é faixa
     * (mínimo até máximo, nunca invertida), número solto é fixo, e texto de data é recuperado como a data.
     */
    public static Faixa faixaDeRepeticoes(Celula c, boolean data1904) {
        if (c == null || (!c.erro() && c.texto().isBlank())) {
            return Faixa.comErro(ErroDaFaixa.VAZIA);
        }
        if (c.erro()) {
            return Faixa.comErro(ErroDaFaixa.INVALIDA);
        }
        if (c.numero()) {
            BigDecimal n;
            try {
                n = new BigDecimal(c.texto());
            } catch (NumberFormatException e) {
                return Faixa.comErro(ErroDaFaixa.INVALIDA);
            }
            if (inteiro(n) && n.signum() >= 0 && n.compareTo(BigDecimal.valueOf(REPETICOES_MAXIMAS)) <= 0) {
                return Faixa.de(n.intValueExact(), n.intValueExact());
            }
            LocalDate d = dataDoExcel(n, data1904);
            return d == null ? Faixa.comErro(ErroDaFaixa.INVALIDA) : faixaDaData(d.getDayOfMonth(), d.getMonthValue(), d.getYear());
        }
        return faixaDeTexto(c.texto());
    }

    /** A faixa de um texto que é só a faixa (ou só o número, ou só a data); senão {@code INVALIDA}. */
    static Faixa faixaDeTexto(String texto) {
        String t = texto.strip().toLowerCase(Locale.ROOT);
        if (t.isEmpty()) {
            return Faixa.comErro(ErroDaFaixa.VAZIA);
        }
        Matcher m = NUMERO_SOLTO.matcher(t);
        if (m.matches()) {
            int n = Integer.parseInt(m.group(1));
            return Faixa.de(n, n);
        }
        m = FAIXA_ESCRITA.matcher(t);
        if (m.matches()) {
            int a = Integer.parseInt(m.group(1));
            int b = Integer.parseInt(m.group(2));
            if (a <= b && b <= REPETICOES_MAXIMAS) {
                return Faixa.de(a, b);
            }
        }
        m = DATA_ISO.matcher(t);
        if (m.matches()) {
            return faixaDaData(Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)), Integer.parseInt(m.group(1)));
        }
        m = DATA_BR.matcher(t);
        if (m.matches() && !("-".equals(m.group(2)) && m.group(4) == null)) {
            Integer ano = m.group(4) == null ? null
                    : m.group(4).length() == 2 ? 2000 + Integer.parseInt(m.group(4)) : Integer.parseInt(m.group(4));
            return faixaDaData(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(3)), ano);
        }
        return Faixa.comErro(ErroDaFaixa.INVALIDA);
    }

    private static Faixa faixaDaData(int a, int b, Integer ano) {
        if (ano != null && (ano < ANO_MINIMO_DA_DATA || ano > ANO_MAXIMO_DA_DATA)) {
            return Faixa.comErro(ErroDaFaixa.DATA);
        }
        if (a < 1 || a > PARTE_MAXIMA_DA_DATA || b < 1 || b > PARTE_MAXIMA_DA_DATA) {
            return Faixa.comErro(ErroDaFaixa.DATA);
        }
        return Faixa.daData(Math.min(a, b), Math.max(a, b));
    }

    /**
     * Série do Excel para data, como o {@code dataDoExcel} do script: dias desde 30/12/1899 (ou 01/01/1904), hora
     * descartada; abaixo de 61 (o 29/02/1900 que não existiu) ou a partir de 2958466 (ano 10000) não é data.
     */
    static LocalDate dataDoExcel(BigDecimal serial, boolean data1904) {
        if (serial.compareTo(BigDecimal.valueOf(data1904 ? 0 : 61)) < 0 || serial.compareTo(BigDecimal.valueOf(2958466)) >= 0) {
            return null;
        }
        long dias = serial.setScale(0, java.math.RoundingMode.FLOOR).longValueExact();
        return (data1904 ? BASE_1904 : BASE_1900).plusDays(dias);
    }

    /** Prescrição de uma célula: número vira faixa (ou data recuperada); texto passa por {@link #ler(String)}. */
    public static Prescricao ler(Celula c, boolean data1904) {
        if (c == null || c.erro()) {
            return Prescricao.VAZIA;
        }
        if (c.numero()) {
            Faixa f = faixaDeRepeticoes(c, data1904);
            return f.ok()
                    ? new Prescricao(null, f.min(), f.max(), false, false, null, Set.of(), f.deData(), "")
                    : new Prescricao(null, null, null, false, false, null, Set.of(), false, c.texto());
        }
        return ler(c.texto());
    }

    /** Prescrição de um texto. */
    public static Prescricao ler(String texto) {
        String original = texto == null ? "" : texto.strip();
        if (original.isEmpty()) {
            return Prescricao.VAZIA;
        }
        Faixa inteira = faixaDeTexto(original);
        if (inteira.ok()) {
            return new Prescricao(null, inteira.min(), inteira.max(), false, false, null, Set.of(), inteira.deData(), "");
        }
        Leitura l = new Leitura(original);
        l.seriesERepeticoes();
        l.seriesAteAFalha();
        l.seriesDe();
        l.carga();
        l.faixa();
        l.repeticoes();
        l.marcas();
        return new Prescricao(l.series, l.repsMin, l.repsMax, l.amrap, l.falha, l.carga, Set.copyOf(l.tecnicas), false, l.sobra());
    }

    private static boolean inteiro(BigDecimal n) {
        return n.signum() == 0 || n.stripTrailingZeros().scale() <= 0;
    }

    /** Uma leitura: casa os padrões no texto dobrado (sem acento, minúsculo, mesmo tamanho) e marca o que foi usado. */
    private static final class Leitura {
        private final String original;
        private final String dobrado;
        private final boolean[] usado;
        private Integer series;
        private Integer repsMin;
        private Integer repsMax;
        private boolean amrap;
        private boolean falha;
        private BigDecimal carga;
        private final Set<Tecnica> tecnicas = EnumSet.noneOf(Tecnica.class);

        Leitura(String original) {
            this.original = original;
            this.dobrado = Normalizacao.dobrar(original);
            this.usado = new boolean[original.length()];
        }

        void seriesERepeticoes() {
            Matcher m = SERIES_X_REPS.matcher(dobrado);
            while (m.find()) {
                Integer s = series(m.group(1));
                int[] reps = faixa(m.group(2), m.group(3));
                if (series == null && s != null && reps != null && livre(m)) {
                    series = s;
                    repsMin = reps[0];
                    repsMax = reps[1];
                    usar(m);
                }
            }
        }

        void seriesAteAFalha() {
            Matcher m = SERIES_X_FALHA.matcher(dobrado);
            while (m.find()) {
                Integer s = series(m.group(1));
                if (series == null && s != null && livre(m)) {
                    series = s;
                    if ("amrap".equals(m.group(2))) {
                        amrap = true;
                    } else {
                        falha = true;
                    }
                    usar(m);
                }
            }
        }

        void seriesDe() {
            Matcher m = SERIES_DE.matcher(dobrado);
            while (m.find()) {
                Integer s = series(m.group(1));
                if (series != null || s == null || !livre(m)) {
                    continue;
                }
                int[] reps = m.group(2) == null ? null : faixa(m.group(2), m.group(3));
                series = s;
                if (reps != null && repsMin == null) {
                    repsMin = reps[0];
                    repsMax = reps[1];
                    usar(m);
                } else {
                    // Sem repetições entendidas ("3 séries de 99999"): só o "3 séries" foi usado.
                    usarTrecho(m.start(), fimDaPalavraSeries(m));
                }
            }
        }

        void carga() {
            Matcher m = CARGA.matcher(dobrado);
            while (m.find()) {
                if (carga != null || !livre(m)) {
                    continue;
                }
                BigDecimal kg = new BigDecimal(m.group(1).replace(',', '.'));
                if (kg.signum() > 0 && kg.compareTo(CARGA_MAXIMA) <= 0) {
                    carga = kg.stripTrailingZeros();
                    if (carga.scale() < 0) {
                        carga = carga.setScale(0);
                    }
                    usar(m);
                }
            }
        }

        void faixa() {
            Matcher m = REPS_FAIXA.matcher(dobrado);
            while (m.find()) {
                if (repsMin != null || !livre(m)) {
                    continue;
                }
                int[] reps = LeitorDePrescricao.faixa(m.group(1), m.group(2));
                if (reps != null) {
                    repsMin = reps[0];
                    repsMax = reps[1];
                    usar(m);
                }
            }
        }

        void repeticoes() {
            Matcher m = REPS_N.matcher(dobrado);
            while (m.find()) {
                if (repsMin != null || !livre(m)) {
                    continue;
                }
                int n = Integer.parseInt(m.group(1));
                if (n <= REPETICOES_MAXIMAS) {
                    repsMin = n;
                    repsMax = n;
                    usar(m);
                }
            }
        }

        void marcas() {
            Matcher m = AMRAP.matcher(dobrado);
            while (m.find()) {
                if (livre(m)) {
                    amrap = true;
                    usar(m);
                }
            }
            m = FALHA.matcher(dobrado);
            while (m.find()) {
                if (livre(m)) {
                    falha = true;
                    usar(m);
                }
            }
            tecnica(REST_PAUSE, Tecnica.REST_PAUSE);
            tecnica(DROP, Tecnica.DROP_SET);
            tecnica(CLUSTER, Tecnica.CLUSTER);
            tecnica(SUPERSET, Tecnica.SUPERSET);
        }

        private void tecnica(Pattern p, Tecnica t) {
            Matcher m = p.matcher(dobrado);
            while (m.find()) {
                if (livre(m)) {
                    tecnicas.add(t);
                    usar(m);
                }
            }
        }

        private Integer series(String s) {
            int n = Integer.parseInt(s);
            return n >= 1 && n <= SERIES_MAXIMAS ? n : null;
        }

        private int[] faixa(String a, String b) {
            return LeitorDePrescricao.faixa(a, b);
        }

        private int fimDaPalavraSeries(Matcher m) {
            int i = m.end(1);
            while (i < dobrado.length() && Character.isWhitespace(dobrado.charAt(i))) {
                i++;
            }
            while (i < dobrado.length() && Character.isLetter(dobrado.charAt(i))) {
                i++;
            }
            return i;
        }

        private boolean livre(Matcher m) {
            for (int i = m.start(); i < m.end(); i++) {
                if (usado[i]) {
                    return false;
                }
            }
            return true;
        }

        private void usar(Matcher m) {
            usarTrecho(m.start(), m.end());
        }

        private void usarTrecho(int inicio, int fim) {
            for (int i = inicio; i < fim; i++) {
                usado[i] = true;
            }
        }

        String sobra() {
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < original.length(); i++) {
                s.append(usado[i] ? ' ' : original.charAt(i));
            }
            String t = s.toString().replaceAll("\\s+", " ").strip();
            String antes;
            do {
                antes = t;
                t = PONTAS.matcher(t).replaceAll("");
                t = CONECTIVO_NAS_PONTAS.matcher(t).replaceAll("").strip();
            } while (!t.equals(antes));
            return t.codePoints().anyMatch(Character::isLetterOrDigit) ? t : "";
        }
    }

    /** Faixa {mínimo, máximo} de dois números escritos (o segundo pode faltar: fixo); invertida ou acima de 500 = null. */
    private static int[] faixa(String a, String b) {
        int min = Integer.parseInt(a);
        int max = b == null ? min : Integer.parseInt(b);
        if (min > max || max > REPETICOES_MAXIMAS) {
            return null;
        }
        return new int[] {min, max};
    }
}
