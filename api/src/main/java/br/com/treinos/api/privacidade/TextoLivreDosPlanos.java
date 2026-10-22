package br.com.treinos.api.privacidade;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.Set;

/**
 * Tira o texto livre de dentro do JSON de um plano de treino ou de mobilidade (rascunho e versões publicadas), em qualquer
 * nível: objetivo, orientações, observações, cardio e prescrição escritos à mão podem citar a pessoa. Ids, séries,
 * repetições, cargas, descanso, nomes de sessão/exercício/seção e links de vídeo ficam. A {@code metodologia} é da
 * consultoria (copiada no plano, nunca da pessoa) e não é tocada.
 */
final class TextoLivreDosPlanos {

    /** Chaves que guardam texto digitado pelo treinador para aquele aluno. */
    static final Set<String> CAMPOS = Set.of("objetivo", "orientacoes", "observacao", "observacoes", "cardio", "prescricao",
            "texto", "descricao", "nota", "notas", "comentario", "comentarios");
    private static final String METODOLOGIA = "metodologia";

    private TextoLivreDosPlanos() {
    }

    /** Devolve uma cópia com cada campo de texto livre trocado por {@code null}; o original não muda. */
    static JsonNode limpar(JsonNode no) {
        if (no instanceof ObjectNode objeto) {
            ObjectNode copia = objeto.objectNode();
            objeto.properties().forEach(campo -> {
                String chave = campo.getKey();
                JsonNode valor = campo.getValue();
                if (METODOLOGIA.equals(chave)) {
                    copia.set(chave, valor);
                } else if (CAMPOS.contains(chave) && valor.isString()) {
                    copia.putNull(chave);
                } else {
                    copia.set(chave, limpar(valor));
                }
            });
            return copia;
        }
        if (no instanceof ArrayNode lista) {
            ArrayNode copia = lista.arrayNode();
            lista.forEach(item -> copia.add(limpar(item)));
            return copia;
        }
        return no;
    }
}
