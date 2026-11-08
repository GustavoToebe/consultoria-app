package br.com.treinos.api.receitas;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Lê JSON {@code modelos-planejamento/1} do classpath. A coleção do arquivo é ignorada: o padrão nasce sem pasta.
 */
public final class LeitorDeModelos {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private LeitorDeModelos() {
    }

    public static JsonMapper json() {
        return JSON;
    }

    public static List<JsonNode> modelos(String caminho) {
        try (InputStream in = LeitorDeModelos.class.getClassLoader().getResourceAsStream(caminho)) {
            if (in == null) {
                throw new IllegalStateException("Modelo padrão ausente: " + caminho);
            }
            JsonNode raiz = JSON.readTree(in);
            if (!"modelos-planejamento/1".equals(raiz.path("formato").asString())) {
                throw new IllegalStateException("Formato de modelo padrão desconhecido: " + caminho);
            }
            JsonNode lista = raiz.get("modelos");
            if (lista == null || !lista.isArray() || lista.isEmpty()) {
                throw new IllegalStateException("Modelo padrão sem modelos: " + caminho);
            }
            List<JsonNode> modelos = new ArrayList<>();
            lista.forEach(modelos::add);
            return List.copyOf(modelos);
        } catch (IOException e) {
            throw new IllegalStateException("Não foi possível ler " + caminho, e);
        }
    }

    public static String nome(JsonNode modelo, String arquivo) {
        String nome = modelo.path("nome").asString("").strip();
        if (nome.isEmpty() || nome.length() > 120) {
            throw new IllegalStateException("Nome de modelo padrão inválido: " + arquivo);
        }
        return nome;
    }

    public static String descricao(JsonNode modelo, String arquivo) {
        String descricao = modelo.path("descricao").asString(null);
        if (descricao != null && descricao.length() > 400) {
            throw new IllegalStateException("Descrição de modelo padrão longa demais: " + arquivo);
        }
        return descricao;
    }
}
