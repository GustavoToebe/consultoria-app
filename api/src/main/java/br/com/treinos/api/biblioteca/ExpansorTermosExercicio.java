package br.com.treinos.api.biblioteca;

import br.com.treinos.api.web.Buscas;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Expansor de termos de busca PT↔EN para exercícios da biblioteca (N24).
 * Converte termos usuais em inglês para os equivalentes em português do catálogo.
 */
public final class ExpansorTermosExercicio {

    private static final Map<String, String> TERMOS_EN_PT = new LinkedHashMap<>();

    static {
        // Frases compostas primeiro (ordem decrescente de especificidade)
        TERMOS_EN_PT.put("bulgarian split squat", "agachamento bulgaro");
        TERMOS_EN_PT.put("romanian deadlift", "stiff");
        TERMOS_EN_PT.put("incline bench press", "supino inclinado");
        TERMOS_EN_PT.put("decline bench press", "supino declinado");
        TERMOS_EN_PT.put("incline bench", "supino inclinado");
        TERMOS_EN_PT.put("decline bench", "supino declinado");
        TERMOS_EN_PT.put("bench press", "supino");
        TERMOS_EN_PT.put("chest fly", "crucifixo");
        TERMOS_EN_PT.put("pec deck", "voador");
        TERMOS_EN_PT.put("push up", "flexao");
        TERMOS_EN_PT.put("overhead press", "desenvolvimento");
        TERMOS_EN_PT.put("shoulder press", "desenvolvimento");
        TERMOS_EN_PT.put("lateral raise", "elevacao lateral");
        TERMOS_EN_PT.put("front raise", "elevacao frontal");
        TERMOS_EN_PT.put("rear delt fly", "crucifixo inverso");
        TERMOS_EN_PT.put("rear delt", "crucifixo inverso");
        TERMOS_EN_PT.put("upright row", "remada alta");
        TERMOS_EN_PT.put("lat pulldown", "puxada");
        TERMOS_EN_PT.put("pull up", "barra fixa");
        TERMOS_EN_PT.put("chin up", "barra fixa");
        TERMOS_EN_PT.put("seated row", "remada baixa");
        TERMOS_EN_PT.put("bent over row", "remada curvada");
        TERMOS_EN_PT.put("t-bar row", "remada cavalinho");
        TERMOS_EN_PT.put("face pull", "face pull");
        TERMOS_EN_PT.put("deadlift", "levantamento terra");
        TERMOS_EN_PT.put("front squat", "agachamento frontal");
        TERMOS_EN_PT.put("hack squat", "agachamento hack");
        TERMOS_EN_PT.put("leg press", "leg press");
        TERMOS_EN_PT.put("leg extension", "cadeira extensora");
        TERMOS_EN_PT.put("seated leg curl", "cadeira flexora");
        TERMOS_EN_PT.put("lying leg curl", "mesa flexora");
        TERMOS_EN_PT.put("leg curl", "flexora");
        TERMOS_EN_PT.put("hip thrust", "elevacao pelvica");
        TERMOS_EN_PT.put("glute bridge", "elevacao pelvica");
        TERMOS_EN_PT.put("calf raise", "panturrilha");
        TERMOS_EN_PT.put("bicep curl", "rosca direta");
        TERMOS_EN_PT.put("hammer curl", "rosca martelo");
        TERMOS_EN_PT.put("preacher curl", "rosca scott");
        TERMOS_EN_PT.put("concentration curl", "rosca concentrada");
        TERMOS_EN_PT.put("tricep pushdown", "triceps polia");
        TERMOS_EN_PT.put("tricep extension", "triceps");
        TERMOS_EN_PT.put("skull crusher", "triceps testa");
        TERMOS_EN_PT.put("leg raise", "elevacao de pernas");

        // Termos simples
        TERMOS_EN_PT.put("barbell", "barra");
        TERMOS_EN_PT.put("dumbbell", "halter");
        TERMOS_EN_PT.put("cable", "polia");
        TERMOS_EN_PT.put("machine", "maquina");
        TERMOS_EN_PT.put("smith", "smith");
        TERMOS_EN_PT.put("dip", "paralela");
        TERMOS_EN_PT.put("shrug", "encolhimento");
        TERMOS_EN_PT.put("rdl", "stiff");
        TERMOS_EN_PT.put("stiff", "stiff");
        TERMOS_EN_PT.put("squat", "agachamento");
        TERMOS_EN_PT.put("lunge", "afundo");
        TERMOS_EN_PT.put("abduction", "abdutora");
        TERMOS_EN_PT.put("adduction", "adutora");
        TERMOS_EN_PT.put("kickback", "coice");
        TERMOS_EN_PT.put("crunch", "abdominal");
        TERMOS_EN_PT.put("plank", "prancha");
        TERMOS_EN_PT.put("pullover", "pullover");
    }

    private ExpansorTermosExercicio() {
    }

    /**
     * Traduz uma expressão de busca em inglês para o equivalente em português.
     */
    public static String traduzir(String busca) {
        if (busca == null || busca.isBlank()) {
            return "";
        }
        String resultado = Buscas.semAcento(busca).toLowerCase(Locale.ROOT).trim();
        for (Map.Entry<String, String> entry : TERMOS_EN_PT.entrySet()) {
            String en = entry.getKey();
            String pt = entry.getValue();
            resultado = resultado.replaceAll("\\b" + en + "\\b", pt);
        }
        return resultado.trim();
    }

    /**
     * Verifica se o exercício corresponde ao termo de busca (direto ou via tradução EN->PT).
     */
    public static boolean casou(Exercicio e, String buscaOriginal) {
        if (buscaOriginal == null || buscaOriginal.isBlank()) {
            return true;
        }
        String texto = Buscas.semAcento(e.getNome() + " " + Objects.toString(e.getGrupoMuscular(), "")).toLowerCase(Locale.ROOT);
        String procurado = Buscas.semAcento(buscaOriginal).toLowerCase(Locale.ROOT).trim();
        if (texto.contains(procurado)) {
            return true;
        }
        String traduzido = traduzir(procurado);
        if (traduzido.isEmpty() || traduzido.equals(procurado)) {
            return false;
        }
        if (texto.contains(traduzido)) {
            return true;
        }
        String[] tokens = traduzido.split("\\s+");
        return Arrays.stream(tokens).filter(t -> !t.isBlank()).allMatch(texto::contains);
    }
}
