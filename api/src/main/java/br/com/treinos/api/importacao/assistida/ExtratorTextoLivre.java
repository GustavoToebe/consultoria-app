package br.com.treinos.api.importacao.assistida;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Extrator para blocos de texto livre colados pelo treinador (WhatsApp, Notas, E-mail).
 * Divide em blocos com base em dias da semana, títulos de treino/dieta ou parágrafos.
 */
public final class ExtratorTextoLivre {

    private static final Pattern CABECALHO_BLOCO = Pattern.compile(
            "(?im)^(?:===|---|###|treino\\s+[a-z0-9]|segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo|"
                    + "refei[çc][aã]o|caf[eé]|almo[çc]o|jantar|lanche|ceia|suplementa[çc][aã]o)");

    private ExtratorTextoLivre() {
    }

    public static ResultadoExtracao extrair(String titulo, String conteudo) {
        if (conteudo == null || conteudo.isBlank()) {
            return new ResultadoExtracao("TEXTO_LIVRE", "", List.of(), Map.of());
        }

        String tituloFinal = titulo != null && !titulo.isBlank() ? titulo.strip() : "Texto Livre";
        String[] linhas = conteudo.split("\\R");
        List<BlocoTexto> blocos = new ArrayList<>();
        StringBuilder blocoAtual = new StringBuilder();
        String tituloBlocoAtual = tituloFinal;
        int numBloco = 1;

        for (String lin : linhas) {
            String limpa = lin.strip();
            if (CABECALHO_BLOCO.matcher(limpa).find()) {
                if (blocoAtual.length() > 0) {
                    blocos.add(new BlocoTexto(tituloBlocoAtual, blocoAtual.toString().strip(), tituloFinal, numBloco++));
                    blocoAtual.setLength(0);
                }
                tituloBlocoAtual = limpa;
            }
            blocoAtual.append(lin).append('\n');
        }

        if (blocoAtual.length() > 0) {
            blocos.add(new BlocoTexto(tituloBlocoAtual, blocoAtual.toString().strip(), tituloFinal, numBloco));
        }

        return new ResultadoExtracao("TEXTO_LIVRE", conteudo, List.copyOf(blocos),
                Map.of("blocos", blocos.size()));
    }
}
