package br.com.treinos.api.importacao;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.Year;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Um conversor só de número, data e sim/não das células da planilha, usado pela importação de uma aba
 * ({@code GravadorDaImportacao}) e pela planilha completa ({@code AnaliseDaPlanilha}, {@code MontagemDeSeries}), para as
 * duas trilhas aceitarem e recusarem as mesmas coisas. Nunca devolve nem repete o conteúdo da célula em mensagem.
 */
public final class ValoresDeCelula {

    /**
     * Teto de algarismos e de casas (para cima ou para baixo) de um número. {@code 1E+999999999} tem um algarismo, mas
     * {@code toPlainString} tentaria alocar 1 GB e {@code setScale} de {@code 1E-30000000} leva segundos de CPU: acima
     * disso a célula é "com erro", antes de qualquer conta.
     */
    static final int LIMITE_DO_NUMERO = 30;
    /** Diferença abaixo da qual um número nativo do Excel é só resíduo de ponto flutuante (81.900000000000006). */
    private static final BigDecimal RESIDUO_DE_CONTA = new BigDecimal("0.000001");

    public enum Situacao { VAZIO, VALIDO, INVALIDO, AMBIGUO, COM_ERRO }

    /** {@code valor} só com {@link Situacao#VALIDO}. */
    public record Numero(Situacao situacao, BigDecimal valor) {
        public boolean valido() {
            return situacao == Situacao.VALIDO;
        }
    }

    public enum SimNao { SIM, NAO, VAZIO, INVALIDO }

    /** Unidade escrita depois do número ("80,5 kg", "120 kcal"): só letras, até 5. */
    private static final Pattern COM_UNIDADE = Pattern.compile("^(.*\\d)\\s*\\p{L}{1,5}\\.?$");
    /** "1.500", "12.345": um ponto e três dígitos, sem vírgula, pode ser 1,5 ou 1500. "0.500" é decimal (milhar não começa em zero). */
    private static final Pattern PONTO_E_TRES_DIGITOS = Pattern.compile("[+-]?[1-9]\\d*\\.\\d{3}");
    private static final Pattern DECIMAL_COM_VIRGULA = Pattern.compile("[+-]?\\d+(,\\d+)?");
    private static final Pattern DECIMAL_COM_PONTO = Pattern.compile("[+-]?\\d+\\.\\d+");
    /** "1.234,56" e "1.234.567": ponto de milhar e vírgula decimal. */
    private static final Pattern MILHAR_COM_PONTO = Pattern.compile("[+-]?\\d{1,3}(\\.\\d{3})+(,\\d+)?");
    /** "1,234.56": vírgula de milhar e ponto decimal (os dois separadores juntos não deixam dúvida). */
    private static final Pattern MILHAR_COM_VIRGULA = Pattern.compile("[+-]?\\d{1,3}(,\\d{3})+\\.\\d+");
    /** "1,23457E+11": o Excel exporta assim no CSV. */
    private static final Pattern COM_EXPOENTE = Pattern.compile("[+-]?\\d+([.,]\\d+)?[eE][+-]?\\d+");

    /** Dia/mês/ano com 1 ou 2 dígitos, separador / - ou . (o mesmo nos dois), ano com 2 ou 4 dígitos e hora opcional no fim. */
    private static final Pattern DATA_DMA = Pattern.compile(
            "^(\\d{1,2})([/.-])(\\d{1,2})\\2(\\d{4}|\\d{2})(?:[ T]+\\d{1,2}:\\d{2}(?::\\d{2}(?:[.,]\\d{1,9})?)?)?$");
    private static final Pattern DATA_ISO = Pattern.compile(
            "^(\\d{4})-(\\d{1,2})-(\\d{1,2})(?:[ T]+\\d{1,2}:\\d{2}(?::\\d{2}(?:[.,]\\d{1,9})?)?)?$");

    private static final Set<String> SIM = Set.of("sim", "s", "ativo", "ativa", "verdadeiro", "true", "1");
    private static final Set<String> NAO = Set.of("nao", "n", "inativo", "inativa", "falso", "false", "0");

    private ValoresDeCelula() {
    }

    /** Número que passa do {@link #LIMITE_DO_NUMERO}: a célula é tratada como "com erro". */
    public static boolean foraDoLimite(BigDecimal n) {
        return n.precision() > LIMITE_DO_NUMERO || n.scale() > LIMITE_DO_NUMERO || n.scale() < -LIMITE_DO_NUMERO;
    }

    /**
     * Número da célula. Nativa do xlsx: o valor gravado. Texto: aceita "80,5", "80.5", "1.234,56", "1,234.56",
     * "1.234.567", "1,2E+3" e uma unidade no fim ("80,5 kg"); "1.500" é {@link Situacao#AMBIGUO}. Fora do
     * {@link #LIMITE_DO_NUMERO}, {@link Situacao#COM_ERRO}.
     */
    public static Numero numero(Celula c) {
        if (c == null) {
            return new Numero(Situacao.VAZIO, null);
        }
        if (c.erro()) {
            return new Numero(Situacao.COM_ERRO, null);
        }
        String t = c.texto() == null ? "" : c.texto().strip();
        if (t.isEmpty()) {
            return new Numero(Situacao.VAZIO, null);
        }
        return c.numero() ? decimal(t) : deTexto(t);
    }

    private static Numero deTexto(String escrito) {
        String t = escrito;
        Matcher unidade = COM_UNIDADE.matcher(t);
        if (unidade.matches()) {
            t = unidade.group(1).strip();
        }
        if (PONTO_E_TRES_DIGITOS.matcher(t).matches()) {
            return new Numero(Situacao.AMBIGUO, null);
        }
        if (DECIMAL_COM_VIRGULA.matcher(t).matches() || COM_EXPOENTE.matcher(t).matches()) {
            return decimal(t.replace(',', '.'));
        }
        if (DECIMAL_COM_PONTO.matcher(t).matches()) {
            return decimal(t);
        }
        if (MILHAR_COM_PONTO.matcher(t).matches()) {
            return decimal(t.replace(".", "").replace(',', '.'));
        }
        if (MILHAR_COM_VIRGULA.matcher(t).matches()) {
            return decimal(t.replace(",", ""));
        }
        return new Numero(Situacao.INVALIDO, null);
    }

    private static Numero decimal(String t) {
        try {
            BigDecimal n = new BigDecimal(t);
            return foraDoLimite(n) ? new Numero(Situacao.COM_ERRO, null) : new Numero(Situacao.VALIDO, n);
        } catch (NumberFormatException e) {
            return new Numero(Situacao.INVALIDO, null);
        }
    }

    /**
     * O valor com no máximo {@code escala} casas, ou null. Número nativo do Excel com resíduo de conta (81.900000000000006)
     * volta à escala; casa a mais de verdade (ou digitada) não é arredondada. Só para valor de {@link #numero} (já dentro
     * do limite: o {@code setScale} é barato).
     */
    public static BigDecimal naEscala(BigDecimal valor, boolean nativo, int escala) {
        if (valor.scale() <= escala) {
            return valor;
        }
        BigDecimal arredondado = valor.setScale(escala, RoundingMode.HALF_UP);
        if (valor.compareTo(arredondado) == 0
                || (nativo && valor.subtract(arredondado).abs().compareTo(RESIDUO_DE_CONTA) < 0)) {
            return arredondado;
        }
        return null;
    }

    /**
     * Sim ou não: "sim", "s", "ativo", "ativa", "verdadeiro", "true" e 1 são sim; "não", "n", "inativo", "inativa",
     * "falso", "false" e 0 são não (sem acento nem caixa). O marcador de vazio ("x", "-") é vazio aqui: quem dá outro
     * sentido a ele (a planilha completa, "x" = sim) confere {@link Celula#marcador()} antes.
     */
    public static SimNao simNao(Celula c) {
        if (c == null) {
            return SimNao.VAZIO;
        }
        if (c.erro()) {
            return SimNao.INVALIDO;
        }
        String t = c.texto() == null ? "" : Buscas.semAcento(c.texto());
        if (t.isEmpty()) {
            return SimNao.VAZIO;
        }
        if (c.numero()) {
            Numero n = numero(c);
            if (!n.valido()) {
                return SimNao.INVALIDO;
            }
            return n.valor().compareTo(BigDecimal.ONE) == 0 ? SimNao.SIM : n.valor().signum() == 0 ? SimNao.NAO : SimNao.INVALIDO;
        }
        return SIM.contains(t) ? SimNao.SIM : NAO.contains(t) ? SimNao.NAO : SimNao.INVALIDO;
    }

    /**
     * Data da célula, ou null. Número só com formato de data no xlsx ({@link Celula#data()}): sem ele, "2025" seria
     * 17/07/1905. Texto: dia/mês/ano ({@link #DATA_DMA}; ano de 2 dígitos é deste século até o ano corrente, senão do
     * anterior) ou aaaa-mm-dd, com ou sem a hora no fim (descartada). Dia que não existe (31/04) = null. A faixa de datas
     * aceitas é de quem chama.
     */
    public static LocalDate data(Celula c, boolean data1904) {
        if (c == null || c.erro()) {
            return null;
        }
        String t = c.texto() == null ? "" : c.texto().strip();
        if (t.isEmpty()) {
            return null;
        }
        if (c.numero()) {
            Numero n = c.data() ? numero(c) : null;
            return n != null && n.valido() ? LeitorDePlanilha.dataSerial(n.valor(), data1904) : null;
        }
        try {
            Matcher m = DATA_DMA.matcher(t);
            if (m.matches()) {
                return LocalDate.of(ano(m.group(4)), Integer.parseInt(m.group(3)), Integer.parseInt(m.group(1)));
            }
            m = DATA_ISO.matcher(t);
            if (m.matches()) {
                return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
            }
        } catch (DateTimeException e) {
            return null;
        }
        return null;
    }

    /** Texto que parece mês/dia/ano (03/25/2025: o segundo número não pode ser mês e o primeiro pode): para avisar na prévia. */
    public static boolean pareceMesDiaAno(Celula c) {
        if (c == null || c.erro() || c.numero() || c.texto() == null) {
            return false;
        }
        Matcher m = DATA_DMA.matcher(c.texto().strip());
        if (!m.matches()) {
            return false;
        }
        int primeiro = Integer.parseInt(m.group(1));
        int segundo = Integer.parseInt(m.group(3));
        return primeiro >= 1 && primeiro <= 12 && segundo > 12 && segundo <= 31;
    }

    /**
     * CPF e CEP digitados como número perdem os zeros da frente (01234567890 vira 1234567890): a célula numérica só com
     * dígitos e mais curta que {@code tamanho} volta com os zeros. O resto sai como veio (o texto da célula, sem espaços nas pontas).
     */
    public static String comZerosAEsquerda(Celula c, int tamanho) {
        String t = c.texto() == null ? "" : c.texto().strip();
        if (c.numero() && !t.isEmpty() && t.length() < tamanho && t.chars().allMatch(ch -> ch >= '0' && ch <= '9')) {
            return "0".repeat(tamanho - t.length()) + t;
        }
        return t;
    }

    private static int ano(String escrito) {
        int ano = Integer.parseInt(escrito);
        if (escrito.length() == 4) {
            return ano;
        }
        int seculo = 2000 + ano;
        return seculo > Year.now(Fuso.BRASILIA).getValue() ? 1900 + ano : seculo;
    }
}
