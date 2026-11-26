package br.com.treinos.api.importacao.assistida.ia;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JSON Schema do formato pedido à IA (o mesmo de {@link DecodificadorDaProposta#FORMATO_DA_RESPOSTA}): é o
 * {@code input_schema} da ferramenta do Claude. Só tipos, enums e {@code required}: faixas e tetos continuam no
 * decodificador, que é quem decide o que entra. Campo opcional ausente = nulo.
 */
final class EsquemaDaProposta {

    private EsquemaDaProposta() {
    }

    static Map<String, Object> paraClaude() {
        Map<String, Object> peso = objeto(campos(
                "data", texto(), "kg", numero(), "observacao", anulavel("string")), "data", "kg");

        Map<String, Object> serie = objeto(campos(
                "quantidade", inteiro(), "tipo", anulavel("string"),
                "repsMin", anulavel("integer"), "repsMax", anulavel("integer"), "descansoSegundos", anulavel("integer"),
                "tecnica", enumAnulavel("REST_PAUSE", "CLUSTER", "DROP_SET"),
                "pausas", anulavel("integer"), "blocos", Map.of("type", List.of("array", "null"), "items", inteiro()),
                "quedas", anulavel("integer"), "reducaoPercentual", anulavel("integer"),
                "pausaSegundos", anulavel("integer")), "quantidade");
        Map<String, Object> exercicio = objeto(campos(
                "nome", texto(), "observacao", anulavel("string"), "cadencia", anulavel("string"),
                "isometriaSegundos", anulavel("integer"), "series", lista(serie)), "nome", "series");
        Map<String, Object> sessao = objeto(campos(
                "nome", texto(), "diaSemana", Map.of("enum", java.util.Arrays.asList(1, 2, 3, 4, 5, 6, 7, null)),
                "exercicios", lista(exercicio)), "nome", "exercicios");
        Map<String, Object> treino = Map.of("type", List.of("object", "null"),
                "properties", Map.of("sessoes", lista(sessao)), "required", List.of("sessoes"));

        Map<String, Object> item = objeto(campos(
                "nome", texto(), "quantidade", anulavel("number"), "unidade", anulavel("string")), "nome");
        Map<String, Object> opcao = objeto(campos("itens", lista(item)), "itens");
        Map<String, Object> refeicao = objeto(campos(
                "nome", texto(), "horario", anulavel("string"), "modoDePreparo", anulavel("string"),
                "opcoes", lista(opcao)), "nome", "opcoes");
        Map<String, Object> suplemento = objeto(campos(
                "nome", texto(), "dose", anulavel("string"), "horario", anulavel("string"),
                "observacao", anulavel("string")), "nome");
        Map<String, Object> medicacao = objeto(campos(
                "nome", texto(), "principioAtivo", anulavel("string"), "concentracao", anulavel("string"),
                "dose", anulavel("string"), "horario", anulavel("string"), "observacao", anulavel("string")), "nome");
        Map<String, Object> dieta = Map.of("type", List.of("object", "null"),
                "properties", campos("aguaLitros", anulavel("number"), "refeicoes", lista(refeicao),
                        "suplementos", lista(suplemento), "medicacoes", lista(medicacao)));

        Map<String, Object> grupo = objeto(campos(
                "nomeAluno", anulavel("string"), "objetivo", anulavel("string"), "observacoes", anulavel("string"),
                "pesos", lista(peso), "treino", treino, "dieta", dieta), "nomeAluno");
        return objeto(campos("grupos", lista(grupo)), "grupos");
    }

    private static Map<String, Object> objeto(Map<String, Object> propriedades, String... obrigatorias) {
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("type", "object");
        o.put("properties", propriedades);
        o.put("required", List.of(obrigatorias));
        o.put("additionalProperties", false);
        return o;
    }

    private static Map<String, Object> campos(Object... paresNomeEsquema) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < paresNomeEsquema.length; i += 2) {
            m.put((String) paresNomeEsquema[i], paresNomeEsquema[i + 1]);
        }
        return m;
    }

    private static Map<String, Object> lista(Map<String, Object> itens) {
        return Map.of("type", "array", "items", itens);
    }

    private static Map<String, Object> texto() {
        return Map.of("type", "string");
    }

    private static Map<String, Object> inteiro() {
        return Map.of("type", "integer");
    }

    private static Map<String, Object> numero() {
        return Map.of("type", "number");
    }

    private static Map<String, Object> anulavel(String tipo) {
        return Map.of("type", List.of(tipo, "null"));
    }

    private static Map<String, Object> enumAnulavel(String... valores) {
        List<String> v = new java.util.ArrayList<>(List.of(valores));
        v.add(null);
        return Map.of("enum", v);
    }
}
