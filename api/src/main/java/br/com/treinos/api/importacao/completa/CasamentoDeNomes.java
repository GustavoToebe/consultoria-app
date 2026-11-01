package br.com.treinos.api.importacao.completa;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Casa um nome de exercício ou alimento da planilha com uma lista de candidatos (biblioteca, catálogo ou a lista da
 * própria planilha), por regras fixas. A chave tolera acento, caixa, pontuação, artigos, abreviações comuns ("c/" =
 * "com", "unilat." = "unilateral", "hal." = "halteres", "máq." = "máquina"...) e plural simples ("halteres" = "halter").
 *
 * <ul>
 *   <li>{@code CERTO}: as mesmas palavras depois de normalizar, em qualquer ordem;</li>
 *   <li>{@code PROVAVEL}: o candidato mais parecido, com nota de semelhança a partir de {@value #LIMIAR}: a mesma do
 *   {@code correspondencias-lib.mjs} (média da semelhança de edição com o coeficiente de Dice das palavras);</li>
 *   <li>{@code NENHUM}: nada chega ao limiar.</li>
 * </ul>
 * O provável nunca vincula sozinho: é pergunta para o treinador.
 */
public final class CasamentoDeNomes {

    /** Nota mínima para sugerir um candidato ({@code LIMIAR_DE_SUGESTAO} do script). */
    public static final double LIMIAR = 0.5;

    /** Artigos e preposições que não mudam o exercício ({@code PARADA} do {@code importar.mjs}). */
    private static final Set<String> PARADA = Set.of("a", "o", "as", "os", "na", "no", "nas", "nos", "de", "da", "do",
            "com", "em", "para", "e", "ou");
    /** Abreviações comuns nas planilhas de treino e dieta (a palavra já sem ponto, acento nem caixa). */
    private static final Map<String, String> ABREVIACOES = Map.ofEntries(
            Map.entry("unilat", "unilateral"), Map.entry("unil", "unilateral"), Map.entry("bilat", "bilateral"),
            Map.entry("hal", "halteres"), Map.entry("halt", "halteres"), Map.entry("maq", "maquina"),
            Map.entry("incl", "inclinado"), Map.entry("inc", "inclinado"), Map.entry("decl", "declinado"),
            Map.entry("pol", "polia"), Map.entry("elev", "elevacao"), Map.entry("agach", "agachamento"),
            Map.entry("colh", "colher"), Map.entry("fat", "fatia"), Map.entry("unid", "unidade"));
    private static final Pattern BARRA_ABREVIADA = Pattern.compile("(?<![a-z])([csp])/");

    public enum Nivel { CERTO, PROVAVEL, NENHUM }

    /** {@code candidato} = o nome como está na lista (nulo em {@code NENHUM}); {@code nota} de 0 a 1 (0 em {@code NENHUM}). */
    public record Resultado(Nivel nivel, String candidato, double nota) {
        static final Resultado NENHUM = new Resultado(Nivel.NENHUM, null, 0);
    }

    /** Os candidatos já normalizados, para casar muitos nomes contra a mesma lista. */
    public static final class Indice {
        private final Map<String, String> porPalavras = new HashMap<>();
        private final List<String[]> chaves = new ArrayList<>();

        public Indice(Collection<String> candidatos) {
            for (String nome : candidatos) {
                if (nome == null || nome.isBlank()) {
                    continue;
                }
                String k = chave(nome);
                if (k.isEmpty()) {
                    continue;
                }
                porPalavras.putIfAbsent(semOrdem(k), nome);
                chaves.add(new String[] {k, nome});
            }
        }

        public Resultado casar(String nome) {
            String k = chave(nome == null ? "" : nome);
            if (k.isEmpty()) {
                return Resultado.NENHUM;
            }
            String igual = porPalavras.get(semOrdem(k));
            if (igual != null) {
                return new Resultado(Nivel.CERTO, igual, 1);
            }
            String melhorChave = null;
            String melhorNome = null;
            double melhorNota = -1;
            for (String[] c : chaves) {
                double nota = notaDeSemelhanca(k, c[0]);
                if (nota > melhorNota || (nota == melhorNota && c[0].compareTo(melhorChave) < 0)) {
                    melhorNota = nota;
                    melhorChave = c[0];
                    melhorNome = c[1];
                }
            }
            return melhorNome != null && melhorNota >= LIMIAR ? new Resultado(Nivel.PROVAVEL, melhorNome, melhorNota) : Resultado.NENHUM;
        }
    }

    private CasamentoDeNomes() {
    }

    public static Resultado casar(String nome, Collection<String> candidatos) {
        return new Indice(candidatos).casar(nome);
    }

    /**
     * Chave do nome, na ordem em que as palavras aparecem: sem acento, minúscula, "c/" = "com" (e "s/" = "sem"),
     * abreviações por extenso, sem pontuação, sem artigos e no singular.
     */
    public static String chave(String nome) {
        String t = Normalizacao.semAcento(nome).toLowerCase(Locale.ROOT);
        t = BARRA_ABREVIADA.matcher(t).replaceAll(r -> switch (r.group(1)) {
            case "c" -> " com ";
            case "s" -> " sem ";
            default -> " para ";
        });
        List<String> saida = new ArrayList<>();
        for (String p : Normalizacao.palavras(t)) {
            String palavra = ABREVIACOES.getOrDefault(p, p);
            if (PARADA.contains(palavra)) {
                continue;
            }
            saida.add(singular(palavra));
        }
        return String.join(" ", saida);
    }

    /** Plural simples: "ões"/"ães" = "ão", "ais" = "al", "eis" = "el", "res"/"zes"/"ses" sem o "es", e o "s" final. */
    static String singular(String p) {
        if (p.length() <= 3 || !p.endsWith("s") || p.chars().allMatch(Character::isDigit)) {
            return p;
        }
        if (p.endsWith("oes") || p.endsWith("aes")) {
            return p.substring(0, p.length() - 3) + "ao";
        }
        if (p.length() > 4 && p.endsWith("ais")) {
            return p.substring(0, p.length() - 3) + "al";
        }
        if (p.length() > 4 && p.endsWith("eis")) {
            return p.substring(0, p.length() - 3) + "el";
        }
        if (p.length() > 4 && (p.endsWith("res") || p.endsWith("zes") || p.endsWith("ses"))) {
            return p.substring(0, p.length() - 2);
        }
        return p.substring(0, p.length() - 1);
    }

    private static String semOrdem(String chave) {
        String[] palavras = chave.split(" ");
        java.util.Arrays.sort(palavras);
        return String.join(" ", palavras);
    }

    /**
     * Nota de semelhança (0 a 1, duas casas) entre duas chaves, igual ao {@code notaDeSemelhanca} do script: a média de
     * {@code 1 - distância de edição / tamanho da maior} com {@code 2 * palavras em comum / (palavras de uma + da outra)}.
     */
    public static double notaDeSemelhanca(String a, String b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        double edicao = 1 - (double) distanciaDeEdicao(a, b) / Math.max(a.length(), b.length());
        Set<String> pa = Set.copyOf(List.of(a.split(" ")));
        Set<String> pb = Set.copyOf(List.of(b.split(" ")));
        long emComum = pa.stream().filter(pb::contains).count();
        double dice = 2.0 * emComum / (pa.size() + pb.size());
        return Math.round((edicao + dice) / 2 * 100) / 100.0;
    }

    static int distanciaDeEdicao(String a, String b) {
        int[] anterior = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            anterior[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            int[] atual = new int[b.length() + 1];
            atual[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int troca = anterior[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1);
                atual[j] = Math.min(Math.min(anterior[j] + 1, atual[j - 1] + 1), troca);
            }
            anterior = atual;
        }
        return anterior[b.length()];
    }
}
