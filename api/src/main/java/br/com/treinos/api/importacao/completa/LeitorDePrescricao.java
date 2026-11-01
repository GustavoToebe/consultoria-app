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
 * <p>Fase 2 (01/11): também a pirâmide ("10-8-6", "4x12/10/8/6": uma série por número), a série por tempo ("3x30s",
 * "3x1min", sem repetições; a duração vai para a observação), o descanso escrito ("desc 60s", "descanso: 1min30",
 * {@code 90"}), RIR e RPE de um valor só ("RIR 2", "2 RIR", "RPE 8,5"; faixa como "RIR 1-2" não é lida e fica na sobra)
 * e os detalhes da técnica quando há uma só técnica estruturada escrita (rest pause: segundos, respirações, pausas ou
 * micro-séries; cluster: os blocos "4+4+2" ou "3 blocos de 4" e a pausa; drop-set: quedas e redução em %), com "na
 * última" para pôr a técnica só na última série. Cadência ("cadência 3-1-2") nunca vira pirâmide. Trecho reconhecido mas
 * que não cabe num campo (faixa de RIR ou de descanso) é só reservado: não é lido por outra regra e continua na sobra.
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

    /**
     * A técnica estruturada escrita (só quando há uma só) e os números escritos junto dela; nulo = não estava escrito.
     * {@code soNaUltima} = "na última (série)".
     */
    public record TecnicaEscrita(Tecnica tipo, Integer pausaSegundos, Integer pausaRespiracoes, Integer pausas,
                                 java.util.List<Integer> blocos, Integer quedas, Integer reducaoPercentual,
                                 boolean soNaUltima) {
        static TecnicaEscrita so(Tecnica tipo) {
            return new TecnicaEscrita(tipo, null, null, null, null, null, null, false);
        }
    }

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
     * trechos entendidos, sem pontuação solta nas pontas ("" quando nada sobrou). {@code piramide} = as repetições de
     * cada série, na ordem (3 a 10 números); {@code duracaoSegundos} = série por tempo; {@code tecnica} = a técnica
     * estruturada com os detalhes, só quando há uma só ({@code tecnicas} traz todas as palavras de técnica achadas).
     */
    public record Prescricao(Integer series, Integer repsMin, Integer repsMax, boolean amrap, boolean ateAFalha,
                             BigDecimal cargaKg, Set<Tecnica> tecnicas, boolean faixaDeData, String sobra,
                             java.util.List<Integer> piramide, Integer duracaoSegundos, Integer descansoSegundos,
                             Integer rir, BigDecimal rpe, TecnicaEscrita tecnica) {

        static final Prescricao VAZIA = new Prescricao(null, null, null, false, false, null, Set.of(), false, "");

        /** Sem os campos da fase 2 (pirâmide, tempo, descanso, esforço e detalhes da técnica). */
        public Prescricao(Integer series, Integer repsMin, Integer repsMax, boolean amrap, boolean ateAFalha,
                          BigDecimal cargaKg, Set<Tecnica> tecnicas, boolean faixaDeData, String sobra) {
            this(series, repsMin, repsMax, amrap, ateAFalha, cargaKg, tecnicas, faixaDeData, sobra, null, null, null, null,
                    null, null);
        }

        public boolean entendeuAlgo() {
            return series != null || repsMin != null || amrap || ateAFalha || cargaKg != null || !tecnicas.isEmpty()
                    || piramide != null || duracaoSegundos != null || descansoSegundos != null || rir != null || rpe != null;
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
            ANTES + "(\\d{1,2})\\s*[x×]\\s*(\\d{1,3})(?:" + ATE + "(\\d{1,3}))?" + DEPOIS + REPS + "(?![a-z])"
                    + "(?!\\s*(?:-|–|/)\\s*\\d)");
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
    private static final Pattern DROP = Pattern.compile("(?<![a-z])(?:drop[\\s-]?sets?|drops?)(?![a-z])");
    private static final Pattern CLUSTER = Pattern.compile("(?<![a-z])cluster(?![a-z])");
    private static final Pattern SUPERSET = Pattern.compile(
            "(?<![a-z])(?:bi[\\s-]?sets?|super[\\s-]?sets?|super[\\s-]?series?|bi[\\s-]?series?|bisseries?)(?![a-z])");
    /** Segundos e minutos escritos: "30s", "30 seg", 30", 30'', "1min", "1,5 min", 1', "1min30", 1'30". */
    private static final String SEG = "(?:''|’’|\"|”|″|segundos|segundo|segs|seg|s)";
    private static final String MIN = "(?:minutos|minuto|mins|min|'|’|′)";
    private static final String TEMPO = "(?:(?<s>\\d{1,4})\\s*" + SEG + "|(?<m>\\d{1,2}(?:[.,]5)?)\\s*" + MIN
            + "(?:\\s*(?<ms>\\d{1,2})\\s*" + SEG + "?)?)(?![a-z\\d])";
    private static final Pattern SERIES_X_TEMPO = Pattern.compile(ANTES + "(?<series>\\d{1,2})\\s*[x×]\\s*" + TEMPO);
    private static final Pattern DESCANSO_ROTULADO = Pattern.compile(
            "(?<![a-z])(?:descanso|descansar|desc|intervalo|int)\\.?\\s*(?:de\\s+)?:?\\s*" + TEMPO);
    private static final Pattern DESCANSO_ASPAS = Pattern.compile(ANTES + "(\\d{1,4})\\s*(?:''|’’|\"|”|″)(?![a-z\\d])");
    private static final Pattern TEMPO_SOLTO = Pattern.compile(ANTES + TEMPO);
    private static final Pattern FAIXA_ANTES = Pattern.compile("\\d\\s*(?:-|–|/|a|ate)\\s*$");
    private static final Pattern FAIXA_DEPOIS = Pattern.compile("^\\s*(?:-|–|/|a|ate)\\s*\\d");
    private static final Pattern RIR = Pattern.compile("(?<![a-z])rir\\s*:?\\s*(\\d{1,2})(?![\\d]|[.,]\\d)");
    private static final Pattern RIR_DEPOIS = Pattern.compile("(?<![\\d.,])(\\d{1,2})\\s*(?:de\\s+)?rir(?![a-z])");
    private static final Pattern RPE = Pattern.compile("(?<![a-z])rpe\\s*:?\\s*(\\d{1,2}(?:[.,]\\d)?)(?![\\d]|[.,]\\d)");
    private static final Pattern CADENCIA = Pattern.compile(
            "(?<![a-z])(?:cadencia|tempo|ritmo)\\s*:?\\s*[\\dx](?:\\s*[-–/]\\s*[\\dx]){2,3}");
    private static final String LISTA = "(\\d{1,3}(?:\\s*[-–/,]\\s*\\d{1,3}){2,9})(?!\\d|[.,]\\d|\\s*[-–/,]\\s*\\d)";
    private static final Pattern PIRAMIDE_COM_SERIES = Pattern.compile(
            ANTES + "(\\d{1,2})\\s*[x×]\\s*" + LISTA + REPS + "(?![a-z])");
    private static final Pattern PIRAMIDE = Pattern.compile(ANTES + LISTA + REPS + "(?![a-z])");
    private static final Pattern NUMEROS = Pattern.compile("\\d+");
    private static final Pattern RESPIRACOES = Pattern.compile(ANTES + "(\\d{1,2})\\s*respira(?:coes|cao)(?![a-z])");
    private static final Pattern PAUSAS = Pattern.compile(ANTES + "(\\d)\\s*(?:pausas?|paradas?)(?![a-z])");
    private static final Pattern MICRO_SERIES = Pattern.compile(ANTES + "(\\d{1,2})\\s*micro[\\s-]?series?(?![a-z])");
    private static final Pattern BLOCOS_SOMA = Pattern.compile(
            ANTES + "(?:(\\d{1,2})\\s*[x×]\\s*)?\\(?\\s*(\\d{1,2}(?:\\s*\\+\\s*\\d{1,2}){1,9})\\s*\\)?" + DEPOIS);
    private static final Pattern BLOCOS_IGUAIS = Pattern.compile(ANTES + "(\\d{1,2})\\s*blocos?\\s*de\\s*(\\d{1,2})" + DEPOIS
            + REPS + "(?![a-z])");
    private static final Pattern QUEDAS = Pattern.compile(ANTES + "(\\d)\\s*(?:quedas?|drops?)(?![a-z])");
    private static final Pattern REDUCAO = Pattern.compile(ANTES + "(\\d{1,2})\\s*%");
    private static final Pattern SERIES_X_TECNICA = Pattern.compile(
            ANTES + "(\\d{1,2})\\s*[x×]\\s*(?=(?:cluster|rest[\\s-]?pause|drop))");
    private static final Pattern NA_ULTIMA = Pattern.compile(
            "(?<![a-z])(?:so\\s+|apenas\\s+|somente\\s+)?na\\s+ultima(?:\\s+serie)?(?![a-z])");
    /** Quantos caracteres depois da palavra da técnica o tempo da pausa pode aparecer ("rest pause de 15 s"). */
    private static final int PERTO_DA_TECNICA = 25;
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
        // A ordem importa: cada regra só usa o trecho que nenhuma outra usou (ou reservou) antes.
        l.seriesPorTempo();
        l.descansoRotulado();
        l.tecnicaEscrita();
        l.descansoComAspas();
        l.esforco();
        l.cadencia();
        l.piramide();
        l.seriesERepeticoes();
        l.seriesAteAFalha();
        l.seriesDe();
        l.carga();
        l.faixa();
        l.repeticoes();
        l.marcas();
        return new Prescricao(l.series, l.repsMin, l.repsMax, l.amrap, l.falha, l.carga, Set.copyOf(l.tecnicas), false,
                l.sobra(), l.piramide, l.duracao, l.descanso, l.rir, l.rpe, l.tecnicaFinal());
    }

    /** Segundos de um {@link #TEMPO} casado (minutos × 60 + segundos); fora de 0 a 3600 ou minuto quebrado = null. */
    private static Integer segundos(Matcher m) {
        if (m.group("s") != null) {
            int s = Integer.parseInt(m.group("s"));
            return s <= 3600 ? s : null;
        }
        BigDecimal minutos = new BigDecimal(m.group("m").replace(',', '.'));
        BigDecimal total = minutos.multiply(BigDecimal.valueOf(60));
        if (m.group("ms") != null) {
            int ms = Integer.parseInt(m.group("ms"));
            if (ms >= 60 || minutos.stripTrailingZeros().scale() > 0) {
                return null;
            }
            total = total.add(BigDecimal.valueOf(ms));
        }
        return total.stripTrailingZeros().scale() <= 0 && total.compareTo(BigDecimal.valueOf(3600)) <= 0
                ? total.intValueExact() : null;
    }

    /** O descanso de uma célula da coluna "Descanso": só o tempo com unidade ("60s", "1min", 90"); senão null. */
    public static Integer descanso(String texto) {
        String t = Normalizacao.dobrar(texto == null ? "" : texto.strip());
        Matcher m = Pattern.compile("^(?:(?:descanso|desc|intervalo)\\.?\\s*:?\\s*)?" + TEMPO + "$").matcher(t);
        return m.matches() ? segundos(m) : null;
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
        /** Trecho reconhecido que não coube em campo nenhum: nenhuma outra regra o usa, mas ele continua na sobra. */
        private final boolean[] reservado;
        private java.util.List<Integer> piramide;
        private Integer duracao;
        private Integer descanso;
        private Integer rir;
        private BigDecimal rpe;
        private Tecnica unica;
        private Integer pausaSegundos;
        private Integer pausaRespiracoes;
        private Integer pausas;
        private java.util.List<Integer> blocos;
        private Integer quedas;
        private Integer reducao;
        private boolean soNaUltima;

        Leitura(String original) {
            this.original = original;
            this.dobrado = Normalizacao.dobrar(original);
            this.usado = new boolean[original.length()];
            this.reservado = new boolean[original.length()];
        }

        /** "3x30s", "3 x 1 min": séries por tempo (sem repetições). */
        void seriesPorTempo() {
            Matcher m = SERIES_X_TEMPO.matcher(dobrado);
            while (m.find()) {
                Integer s = series(m.group("series"));
                Integer seg = segundos(m);
                if (series == null && s != null && seg != null && seg > 0 && livre(m) && !faixaDepois(m.end())) {
                    series = s;
                    duracao = seg;
                    usar(m);
                }
            }
        }

        /** "desc 60s", "descanso: 1min30", "intervalo de 90"". */
        void descansoRotulado() {
            Matcher m = DESCANSO_ROTULADO.matcher(dobrado);
            while (m.find()) {
                Integer seg = segundos(m);
                if (descanso == null && seg != null && livre(m) && !faixaDepois(m.end())) {
                    descanso = seg;
                    usar(m);
                }
            }
        }

        /** 90" sozinho é descanso; "60-90"" (faixa) só é reservado. */
        void descansoComAspas() {
            Matcher m = DESCANSO_ASPAS.matcher(dobrado);
            while (m.find()) {
                if (!livre(m)) {
                    continue;
                }
                int seg = Integer.parseInt(m.group(1));
                boolean faixa = FAIXA_ANTES.matcher(dobrado.substring(0, m.start())).find();
                if (faixa || descanso != null || seg > 3600) {
                    reservar(m.start(), m.end());
                } else {
                    descanso = seg;
                    usar(m);
                }
            }
        }

        /** RIR e RPE de um valor só; com os dois, ou com faixa, nada é lido (o trecho fica na sobra). */
        void esforco() {
            java.util.List<int[]> trechos = new java.util.ArrayList<>();
            Integer achadoRir = null;
            boolean rirRuim = false;
            for (Pattern p : new Pattern[] {RIR, RIR_DEPOIS}) {
                Matcher m = p.matcher(dobrado);
                while (m.find()) {
                    if (!livre(m)) {
                        continue;
                    }
                    int v = Integer.parseInt(m.group(1));
                    if (faixaDepois(m.end()) || v > 5 || achadoRir != null) {
                        rirRuim = true;
                        reservar(m.start(), m.end());
                    } else {
                        achadoRir = v;
                        usar(m);
                        trechos.add(new int[] {m.start(), m.end()});
                    }
                }
            }
            BigDecimal achadoRpe = null;
            boolean rpeRuim = false;
            Matcher m = RPE.matcher(dobrado);
            while (m.find()) {
                if (!livre(m)) {
                    continue;
                }
                BigDecimal v = new BigDecimal(m.group(1).replace(',', '.'));
                boolean valido = v.compareTo(BigDecimal.ONE) >= 0 && v.compareTo(BigDecimal.TEN) <= 0
                        && v.remainder(new BigDecimal("0.5")).signum() == 0;
                if (faixaDepois(m.end()) || !valido || achadoRpe != null) {
                    rpeRuim = true;
                    reservar(m.start(), m.end());
                } else {
                    achadoRpe = v.stripTrailingZeros().scale() < 0 ? v.setScale(0) : v.stripTrailingZeros();
                    usar(m);
                    trechos.add(new int[] {m.start(), m.end()});
                }
            }
            if (rirRuim || rpeRuim || (achadoRir != null && achadoRpe != null)) {
                // Esforço que não dá para ler com certeza: nada é lido e o texto volta para a sobra.
                for (int[] t : trechos) {
                    for (int i = t[0]; i < t[1]; i++) {
                        usado[i] = false;
                        reservado[i] = true;
                    }
                }
                return;
            }
            rir = achadoRir;
            rpe = achadoRpe;
        }

        /** "cadência 3-1-2": nunca vira pirâmide nem faixa (fica na sobra). */
        void cadencia() {
            Matcher m = CADENCIA.matcher(dobrado);
            while (m.find()) {
                if (livre(m)) {
                    reservar(m.start(), m.end());
                }
            }
        }

        /** "10-8-6" (uma série por número) ou "4x12/10/8/6" (só quando as séries são tantas quantos os números). */
        void piramide() {
            Matcher m = PIRAMIDE_COM_SERIES.matcher(dobrado);
            while (m.find()) {
                java.util.List<Integer> reps = numeros(m.group(2));
                Integer s = series(m.group(1));
                if (piramide != null || series != null || reps == null || s == null || !livre(m)) {
                    continue;
                }
                if (s != reps.size()) {
                    reservar(m.start(), m.end()); // "4x12/10/8": as séries não batem com os números
                    continue;
                }
                series = s;
                piramide = reps;
                usar(m);
            }
            m = PIRAMIDE.matcher(dobrado);
            while (m.find()) {
                java.util.List<Integer> reps = numeros(m.group(1));
                if (piramide != null || series != null || reps == null || !livre(m)) {
                    continue;
                }
                series = reps.size();
                piramide = reps;
                usar(m);
            }
        }

        /** Os números da pirâmide (1 a 500, ao menos dois diferentes); senão null. */
        private java.util.List<Integer> numeros(String trecho) {
            java.util.List<Integer> saida = new java.util.ArrayList<>();
            Matcher n = NUMEROS.matcher(trecho);
            while (n.find()) {
                int v = Integer.parseInt(n.group());
                if (v < 1 || v > REPETICOES_MAXIMAS) {
                    return null;
                }
                saida.add(v);
            }
            boolean distintos = saida.stream().distinct().count() > 1;
            return saida.size() >= 3 && saida.size() <= SERIES_MAXIMAS && distintos ? java.util.List.copyOf(saida) : null;
        }

        /**
         * Os detalhes da técnica, só quando há uma só técnica estruturada escrita (rest pause, cluster ou drop-set):
         * duas técnicas na mesma célula não são lidas (ficam como palavra e na sobra).
         */
        void tecnicaEscrita() {
            Set<Tecnica> achadas = EnumSet.noneOf(Tecnica.class);
            int fim = -1;
            for (Object[] par : new Object[][] {{REST_PAUSE, Tecnica.REST_PAUSE}, {DROP, Tecnica.DROP_SET},
                    {CLUSTER, Tecnica.CLUSTER}}) {
                Matcher m = ((Pattern) par[0]).matcher(dobrado);
                if (m.find()) {
                    achadas.add((Tecnica) par[1]);
                    fim = m.end();
                }
            }
            Matcher q = QUEDAS.matcher(dobrado);
            boolean quedasEscritas = q.find();
            if (quedasEscritas) {
                achadas.add(Tecnica.DROP_SET);
            }
            tecnicas.addAll(achadas);
            if (achadas.size() != 1) {
                return;
            }
            unica = achadas.iterator().next();
            Matcher sx = SERIES_X_TECNICA.matcher(dobrado);
            if (series == null && sx.find() && livre(sx) && series(sx.group(1)) != null) {
                series = series(sx.group(1)); // "3x rest pause", "3x cluster 4+4+2"
                usar(sx);
            }
            Matcher ultima = NA_ULTIMA.matcher(dobrado);
            if (ultima.find() && livre(ultima)) {
                soNaUltima = true;
                usar(ultima);
            }
            switch (unica) {
                case REST_PAUSE -> {
                    pausaPerto(fim);
                    respiracoes();
                    Matcher m = PAUSAS.matcher(dobrado);
                    if (m.find() && livre(m)) {
                        pausas = Integer.parseInt(m.group(1));
                        usar(m);
                    }
                    m = MICRO_SERIES.matcher(dobrado);
                    if (pausas == null && m.find() && livre(m) && Integer.parseInt(m.group(1)) >= 2) {
                        pausas = Integer.parseInt(m.group(1)) - 1;
                        usar(m);
                    }
                }
                case CLUSTER -> {
                    Matcher m = BLOCOS_SOMA.matcher(dobrado);
                    if (m.find() && livre(m)) {
                        java.util.List<Integer> b = new java.util.ArrayList<>();
                        Matcher n = NUMEROS.matcher(m.group(2));
                        while (n.find()) {
                            b.add(Integer.parseInt(n.group()));
                        }
                        blocos = java.util.List.copyOf(b);
                        if (m.group(1) != null && series(m.group(1)) != null) {
                            series = series(m.group(1));
                        }
                        usar(m);
                    }
                    m = BLOCOS_IGUAIS.matcher(dobrado);
                    if (blocos == null && m.find() && livre(m)) {
                        int quantos = Integer.parseInt(m.group(1));
                        int cada = Integer.parseInt(m.group(2));
                        if (quantos >= 2 && quantos <= 10) {
                            blocos = java.util.Collections.nCopies(quantos, cada);
                            usar(m);
                        }
                    }
                    pausaPerto(fim);
                    respiracoes();
                }
                case DROP_SET -> {
                    Matcher m = QUEDAS.matcher(dobrado);
                    if (m.find() && livre(m)) {
                        quedas = Integer.parseInt(m.group(1));
                        usar(m);
                    }
                    m = REDUCAO.matcher(dobrado);
                    if (m.find() && livre(m)) {
                        reducao = Integer.parseInt(m.group(1));
                        usar(m);
                    }
                    pausaPerto(fim);
                }
                default -> {
                    // Superset é um grupo de exercícios, não técnica da série.
                }
            }
        }

        /** O tempo logo depois da palavra da técnica é a pausa dela ("rest pause 15s", "cluster (20")"). */
        private void pausaPerto(int fimDaPalavra) {
            if (fimDaPalavra < 0) {
                return;
            }
            Matcher m = TEMPO_SOLTO.matcher(dobrado);
            while (m.find()) {
                if (m.start() >= fimDaPalavra && m.start() - fimDaPalavra <= PERTO_DA_TECNICA && livre(m)
                        && !faixaDepois(m.end())) {
                    pausaSegundos = segundos(m);
                    if (pausaSegundos != null) {
                        usar(m);
                    }
                    return;
                }
            }
        }

        private void respiracoes() {
            Matcher m = RESPIRACOES.matcher(dobrado);
            if (m.find() && livre(m)) {
                pausaRespiracoes = Integer.parseInt(m.group(1));
                usar(m);
            }
        }

        TecnicaEscrita tecnicaFinal() {
            return unica == null ? null
                    : new TecnicaEscrita(unica, pausaSegundos, pausaRespiracoes, pausas, blocos, quedas, reducao, soNaUltima);
        }

        /** O texto logo depois do trecho continua uma faixa ("60-90s", "RIR 1-2"). */
        private boolean faixaDepois(int fim) {
            return FAIXA_DEPOIS.matcher(dobrado.substring(fim)).find();
        }

        private void reservar(int inicio, int fim) {
            for (int i = inicio; i < fim; i++) {
                reservado[i] = true;
            }
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
                if (usado[i] || reservado[i]) {
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
