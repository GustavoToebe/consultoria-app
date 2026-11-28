package br.com.treinos.api.termos;

import java.util.ArrayList;
import java.util.List;

/**
 * Seção "Contato" do termo de uso, montada com Configurações › Contato da consultoria (nome, WhatsApp e "Responder para"),
 * no lugar do marcador {@link #MARCADOR}. Sem WhatsApp nem e-mail, o nome e "fale com o seu treinador pelo app"; sem
 * consultoria (página pública), só a frase. Nunca devolve o colchete do modelo. Texto em Markdown simples do app
 * ({@code - } item, {@code **} negrito): o {@code *} sai dos valores para o nome não ligar o negrito.
 */
public final class ContatoDosTermos {

    public static final String MARCADOR = "{{CONTATO_DA_CONSULTORIA}}";
    static final String PELO_APP = "Fale com o seu treinador pelo app.";

    private ContatoDosTermos() { }

    public static String montar(String nome, String whatsapp, String email) {
        String n = limpo(nome);
        String w = limpo(whatsapp);
        String e = limpo(email);
        if (n == null && w == null && e == null) {
            return PELO_APP;
        }
        List<String> linhas = new ArrayList<>();
        if (n != null) {
            linhas.add("- **Consultoria:** " + n);
        }
        if (w != null) {
            linhas.add("- **WhatsApp:** " + w);
        }
        if (e != null) {
            linhas.add("- **E-mail:** " + e);
        }
        if (w == null && e == null) {
            linhas.add("");
            linhas.add(PELO_APP);
        }
        return String.join("\n", linhas);
    }

    private static String limpo(String valor) {
        if (valor == null) {
            return null;
        }
        String s = valor.replace("*", "").replaceAll("\\s+", " ").strip();
        return s.isEmpty() ? null : s;
    }
}
