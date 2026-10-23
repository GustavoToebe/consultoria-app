package br.com.treinos.api.biblioteca;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Suplementos Heavy Suppz que toda consultoria recebe (decisão de 23/10). O JSON no classpath não tem preço,
 * estoque, descrição nem tabela nutricional. Porção nula fica nula. Outra marca entra como outro JSON e outra
 * migration, com a mesma regra: só cria o nome que ainda não existe.
 */
public final class SuplementosPadrao {

    private SuplementosPadrao() {
    }

    public record Item(String nome, String marca, String categoria, String porcao, String porcoesPorEmbalagem,
                       List<String> sabores, String link) {
    }

    public static List<Item> itens(JsonMapper json) {
        try (InputStream in = SuplementosPadrao.class.getResourceAsStream("/suplementos/heavysuppz.json")) {
            if (in == null) {
                throw new IllegalStateException("Lista Heavy Suppz ausente.");
            }
            JsonNode raiz = json.readTree(in);
            List<Item> itens = new ArrayList<>();
            for (JsonNode n : raiz.get("itens")) {
                List<String> sabores = new ArrayList<>();
                JsonNode lista = n.get("sabores");
                if (lista != null) {
                    for (JsonNode s : lista) sabores.add(s.asString());
                }
                itens.add(new Item(texto(n, "nome"), texto(n, "marca"), texto(n, "categoria"), texto(n, "porcao"),
                        texto(n, "porcoesPorEmbalagem"), sabores, texto(n, "link")));
            }
            return itens;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível ler a lista Heavy Suppz.", e);
        }
    }

    private static String texto(JsonNode n, String campo) {
        JsonNode v = n.get(campo);
        if (v == null || v.isNull()) return null;
        String s = v.asString();
        return s.isBlank() ? null : s;
    }
}
