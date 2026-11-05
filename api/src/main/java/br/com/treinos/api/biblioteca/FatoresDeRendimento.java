package br.com.treinos.api.biblioteca;

import br.com.treinos.api.web.Buscas;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.regex.Pattern;

/**
 * Perfis nativos de rendimento do alimento, do mercado até o prato. FC = peso bruto ÷ peso líquido (sempre ≥ 1).
 * FCc = peso pronto ÷ peso líquido cru (hidrata &gt; 1, retração &lt; 1, constante = 1). A lista de compras faz o
 * caminho inverso: o treinador prescreve o peso pronto (PC), o líquido cru é PC ÷ FCc e a compra é esse líquido × FC.
 * Espelho em {@code dominio/fatoresDoAlimento.ts}. Não usa tabela externa.
 */
public final class FatoresDeRendimento {

    /** Limpeza antes do preparo. */
    public enum PerfilFc {
        SEM_PERDA("1.00"),
        LIMPEZA_LEVE("1.12"),
        DESCASCADO_MEDIO("1.25"),
        DESCASCADO_ALTO("1.45");

        private final BigDecimal valor;

        PerfilFc(String valor) {
            this.valor = new BigDecimal(valor);
        }

        public BigDecimal valor() {
            return valor;
        }
    }

    /** Cocção ou estado em que o alimento é pesado na dieta. */
    public enum PerfilFcc {
        CRU_OU_PRONTO("1.00"),
        GRAO_COZIDO("2.60"),
        MASSA_COZIDA("2.50"),
        LEGUMINOSA_COZIDA("1.85"),
        CARNE_GRELHADA_ASSADA("0.78"),
        CARNE_COZIDA_ENSOPADA("0.88"),
        LEGUME_TUBERCULO_COZIDO("0.95"),
        LEGUME_TUBERCULO_ASSADO_REFOGADO("0.82"),
        OVO_PREPARADO("0.90");

        private final BigDecimal valor;

        PerfilFcc(String valor) {
            this.valor = new BigDecimal(valor);
        }

        public BigDecimal valor() {
            return valor;
        }
    }

    public record Estimativa(PerfilFc perfilFc, PerfilFcc perfilFcc, BigDecimal fatorCorrecao, BigDecimal fatorCoccao) {
    }

    private static final Pattern CRU = padrao("cru(?:a|as|s)?|fresco|fresca|frescos|frescas|in natura|seca?s?|po|flocos|farinha");
    private static final Pattern COZIDO = padrao("cozid[a-z]*|vapor");
    private static final Pattern GRELHADO = padrao("grelhad[a-z]*|assad[a-z]*|frit[a-z]*|refogad[a-z]*|chapa|airfryer|air fryer|bife");
    private static final Pattern ENSOPADO = padrao("cozid[a-z]*|desfiad[a-z]*|ensopad[a-z]*|panela|moid[a-z]*");
    private static final Pattern OVO_FEITO = padrao("cozid[a-z]*|mexid[a-z]*|frit[a-z]*|poche|omelete");
    private static final Pattern ASSADO_LEGUME = padrao("assad[a-z]*|refogad[a-z]*|grelhad[a-z]*|frit[a-z]*|chips");
    private static final Pattern OVO = padrao("ovos?|claras?|gemas?");
    private static final Pattern ARROZ = padrao("arroz");
    private static final Pattern MASSA = padrao("macarrao|espaguete|penne|parafuso|talharim|lasanha|nhoque");
    private static final Pattern LEGUMINOSA = padrao("feijao|lentilha|grao de bico|soja");
    private static final Pattern GRAO_QUANDO_COZIDO = padrao("quinoa|milho|canjica|aveia");
    private static final Pattern PRONTO = padrao("leite|queijo|iogurte|requeijao|whey|oleo|azeite|manteiga|pao|suco");
    private static final Pattern PROCESSADO = padrao("bacon|calabresa|presunto|salsicha|linguica|apresuntado");
    private static final Pattern OSSO = padrao("coxa|sobrecoxa|costela|acem|asa|com osso");
    private static final Pattern CASCA_GROSSA = padrao("banana|manga|abacaxi|abacate|maracuja|melancia|coco");
    private static final Pattern FOLHA = padrao("alface|rucula|agriao|couve|espinafre|brocolis|repolho|acelga");
    private static final Pattern CASCA_MEDIA = padrao("batata|mandioca|aipim|inhame|mandioquinha|cenoura|beterraba|abobrinha|chuchu|berinjela|abobora|cebola|alho|pimentao|laranja|mexerica|tangerina|mamao|melao|kiwi|goiaba|legumes");
    private static final Pattern CASCA_FINA = padrao("maca|pera|morango|uva|ameixa|pessego|tomate|pepino");
    private static final Pattern SEM_DESCARTE = padrao("arroz|macarrao|espaguete|penne|parafuso|talharim|lasanha|nhoque|aveia|farinha|feijao|lentilha|grao de bico|soja|leite|queijo|iogurte|whey|oleo|azeite|manteiga|pao|castanha|nozes|noz|amendoa|amendoim|ovos?|claras?|gemas?|chia|linhaca|semente|quinoa");
    private static final Pattern CARNE = padrao("carne|bovin[a-z]*|suin[a-z]*|frango|peru|peixe|file|bife|moid[a-z]*|patinho|alcatra|picanha|tilapia|salmao|atum|camarao|lombo|figado|bacon|calabresa|presunto|salsicha|linguica");
    private static final Pattern TUBERCULO = padrao("batata|mandioca|aipim|inhame|mandioquinha|cenoura|beterraba|abobrinha|chuchu|berinjela|abobora|brocolis|couve flor|abobora|vagem|legumes");

    private FatoresDeRendimento() {
    }

    /** Estima os dois fatores. {@code kcal} é o da base ({@code baseQuantidade} + {@code baseUnidade}); nulo não usa caloria. */
    public static Estimativa estimar(String nome, String grupo, BigDecimal kcal, BigDecimal baseQuantidade, String baseUnidade) {
        String texto = normalizar(nome) + " " + normalizar(grupo);
        PerfilFc fc = perfilFc(texto);
        PerfilFcc fcc = perfilFcc(texto, kcalPor100g(kcal, baseQuantidade, baseUnidade));
        return new Estimativa(fc, fcc, fc.valor(), fcc.valor());
    }

    /** Preenche só o fator que veio nulo. O número informado pelo treinador fica. */
    public static Estimativa completar(BigDecimal fatorCorrecao, BigDecimal fatorCoccao, String nome, String grupo,
                                       BigDecimal kcal, BigDecimal baseQuantidade, String baseUnidade) {
        if (fatorCorrecao != null && fatorCoccao != null) {
            return new Estimativa(null, null, fatorCorrecao, fatorCoccao);
        }
        Estimativa e = estimar(nome, grupo, kcal, baseQuantidade, baseUnidade);
        return new Estimativa(e.perfilFc(), e.perfilFcc(),
                fatorCorrecao != null ? fatorCorrecao : e.fatorCorrecao(),
                fatorCoccao != null ? fatorCoccao : e.fatorCoccao());
    }

    private static PerfilFc perfilFc(String texto) {
        if (casa(PROCESSADO, texto)) return PerfilFc.SEM_PERDA;
        if (casa(OSSO, texto)) return PerfilFc.DESCASCADO_ALTO;
        if (casa(CASCA_GROSSA, texto)) return PerfilFc.DESCASCADO_ALTO;
        if (casa(FOLHA, texto)) return PerfilFc.DESCASCADO_ALTO;
        if (casa(CASCA_MEDIA, texto)) return PerfilFc.DESCASCADO_MEDIO;
        if (casa(CASCA_FINA, texto)) return PerfilFc.LIMPEZA_LEVE;
        if (casa(SEM_DESCARTE, texto) || casa(OVO, texto) || casa(PRONTO, texto)) return PerfilFc.SEM_PERDA;
        if (casa(CARNE, texto) || texto.contains(" carne") || texto.contains("pescado")) return PerfilFc.LIMPEZA_LEVE;
        if (texto.contains("fruta")) return PerfilFc.LIMPEZA_LEVE;
        if (texto.contains("verdura") || texto.contains("hortalica")) return PerfilFc.DESCASCADO_MEDIO;
        return PerfilFc.SEM_PERDA;
    }

    private static PerfilFcc perfilFcc(String texto, BigDecimal kcal100) {
        if (casa(CRU, texto)) return PerfilFcc.CRU_OU_PRONTO;
        if (casa(OVO, texto)) return casa(OVO_FEITO, texto) ? PerfilFcc.OVO_PREPARADO : PerfilFcc.CRU_OU_PRONTO;
        if (casa(TUBERCULO, texto)) {
            if (casa(ASSADO_LEGUME, texto)) return PerfilFcc.LEGUME_TUBERCULO_ASSADO_REFOGADO;
            if (casa(COZIDO, texto)) return PerfilFcc.LEGUME_TUBERCULO_COZIDO;
            return PerfilFcc.CRU_OU_PRONTO;
        }
        if (casa(CARNE, texto) || texto.contains(" carne") || texto.contains("pescado")) {
            if (casa(GRELHADO, texto)) return PerfilFcc.CARNE_GRELHADA_ASSADA;
            if (casa(ENSOPADO, texto)) return PerfilFcc.CARNE_COZIDA_ENSOPADA;
            return PerfilFcc.CRU_OU_PRONTO;
        }
        if (casa(PRONTO, texto)) return PerfilFcc.CRU_OU_PRONTO;
        if (casa(LEGUMINOSA, texto) || (texto.contains("leguminosa") && !texto.contains(" legumes "))) {
            if (!casa(COZIDO, texto) && kcal100 != null && kcal100.compareTo(new BigDecimal("250")) >= 0) {
                return PerfilFcc.CRU_OU_PRONTO;
            }
            return PerfilFcc.LEGUMINOSA_COZIDA;
        }
        if (casa(MASSA, texto)) {
            if (!casa(COZIDO, texto) && kcal100 != null && kcal100.compareTo(new BigDecimal("300")) >= 0) {
                return PerfilFcc.CRU_OU_PRONTO;
            }
            return PerfilFcc.MASSA_COZIDA;
        }
        if (casa(ARROZ, texto)) {
            if (casa(COZIDO, texto)) return PerfilFcc.GRAO_COZIDO;
            if (kcal100 != null && kcal100.compareTo(new BigDecimal("250")) >= 0) return PerfilFcc.CRU_OU_PRONTO;
            return PerfilFcc.GRAO_COZIDO;
        }
        if (casa(GRAO_QUANDO_COZIDO, texto) && casa(COZIDO, texto)) return PerfilFcc.GRAO_COZIDO;
        return PerfilFcc.CRU_OU_PRONTO;
    }

    /** kcal da base convertida para 100 g. Fora de gramas, ou sem número, devolve nulo. */
    static BigDecimal kcalPor100g(BigDecimal kcal, BigDecimal baseQuantidade, String baseUnidade) {
        if (kcal == null || baseQuantidade == null || baseQuantidade.signum() <= 0) return null;
        if (baseUnidade != null && !baseUnidade.equalsIgnoreCase("g")) return null;
        return kcal.multiply(new BigDecimal("100")).divide(baseQuantidade, 2, RoundingMode.HALF_UP);
    }

    private static String normalizar(String texto) {
        return Buscas.semAcento(texto).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private static Pattern padrao(String alternativas) {
        return Pattern.compile("(?<![a-z0-9])(?:" + alternativas + ")(?![a-z0-9])");
    }

    private static boolean casa(Pattern padrao, String texto) {
        return padrao.matcher(texto).find();
    }
}
