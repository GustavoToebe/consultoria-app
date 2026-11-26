package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.questionarios.ValidadorQuestionario;
import br.com.treinos.api.web.Buscas;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Resposta de uma pergunta {@code ITENS_DO_PLANO}: o cliente envia {@code [{id, motivo?}]}; o servidor confere cada id contra
 * a lista da fonte ({@link ItensDoPlano}) e grava {@code [{id, nome, motivo?}]} na ordem enviada, com o {@code nome} da
 * lista. Dado sensível (dieta, dor): a mensagem de recusa é fixa e nunca repete id, nome nem motivo.
 *
 * <p>Recusas (uma mensagem por pergunta, a primeira que valer): item que não é objeto, chave além de {@code id} e
 * {@code motivo} (inclusive um {@code nome} do cliente), id que não é texto, fora da lista ou repetido (ou com o mesmo
 * nome de outro), mais itens que o {@code max} da pergunta (sem ele, {@link ValidadorQuestionario#ITENS_MAXIMO}), motivo
 * que não é texto, acima de {@link ValidadorQuestionario#MOTIVO_TAMANHO} depois do strip, motivo em branco quando é
 * {@code OBRIGATORIO} e motivo preenchido quando é {@code NENHUM} (ausente). Motivo em branco ou nulo = sem motivo.
 */
final class RespostaDeItens {

    /** Itens gravados, ou a mensagem fixa do erro. */
    record Resultado(JsonNode limpa, String erro) {
        static Resultado erro(String mensagem) {
            return new Resultado(null, mensagem);
        }
    }

    private RespostaDeItens() {
    }

    static Resultado conferir(JsonMapper json, JsonNode pergunta, JsonNode resposta, ItensDoPlano itens) {
        String fonte = pergunta.path("fonte").asString("");
        String modo = pergunta.path("motivo").isMissingNode() || pergunta.path("motivo").isNull() ? "NENHUM"
                : pergunta.path("motivo").asString("");
        if (!ValidadorQuestionario.FONTES_DE_ITENS.contains(fonte) || !ValidadorQuestionario.MOTIVOS_DE_ITENS.contains(modo)) {
            return Resultado.erro("Esta pergunta está mal configurada.");
        }
        if (!resposta.isArray()) {
            return Resultado.erro("Confira os itens escolhidos.");
        }
        if (resposta.size() > maximo(pergunta)) {
            return Resultado.erro("Mais itens do que o permitido.");
        }
        Map<String, ItensDoPlano.Item> permitidos = new LinkedHashMap<>();
        itens.da(fonte).forEach(i -> permitidos.putIfAbsent(i.id(), i));
        Set<String> ids = new HashSet<>();
        Set<String> nomes = new HashSet<>();
        var limpa = json.createArrayNode();
        for (JsonNode escolhido : resposta) {
            if (!escolhido.isObject() || escolhido.propertyNames().stream().anyMatch(k -> !"id".equals(k) && !"motivo".equals(k))
                    || !escolhido.path("id").isString()) {
                return Resultado.erro("Confira os itens escolhidos.");
            }
            ItensDoPlano.Item item = permitidos.get(escolhido.path("id").asString());
            if (item == null) {
                return Resultado.erro("Item que não está na lista.");
            }
            if (!ids.add(item.id()) || !nomes.add(Buscas.semAcento(item.nome()))) {
                return Resultado.erro("Item repetido.");
            }
            JsonNode m = escolhido.path("motivo");
            if (!m.isMissingNode() && !m.isNull() && !m.isString()) {
                return Resultado.erro("Confira o motivo.");
            }
            String motivo = m.isString() ? m.asString().strip() : "";
            if (motivo.length() > ValidadorQuestionario.MOTIVO_TAMANHO) {
                return Resultado.erro("Motivo longo demais.");
            }
            if ("OBRIGATORIO".equals(modo) && motivo.isEmpty()) {
                return Resultado.erro("Informe o motivo de cada item.");
            }
            if ("NENHUM".equals(modo) && !motivo.isEmpty()) {
                return Resultado.erro("Esta pergunta não pede motivo.");
            }
            var gravado = json.createObjectNode();
            gravado.put("id", item.id());
            gravado.put("nome", item.nome());
            if (!motivo.isEmpty()) {
                gravado.put("motivo", motivo);
            }
            limpa.add(gravado);
        }
        return new Resultado(limpa, null);
    }

    /** {@code max} da pergunta (inteiro de 1 a o teto) ou o teto; igual a {@code maximoDeItens} do app. */
    private static int maximo(JsonNode pergunta) {
        JsonNode n = pergunta.path("max");
        if (!n.isNumber() || (n.isFloatingPointNumber() && !Double.isFinite(n.doubleValue()))) {
            return ValidadorQuestionario.ITENS_MAXIMO;
        }
        BigDecimal v = n.decimalValue();
        boolean valido = v.stripTrailingZeros().scale() <= 0 && v.compareTo(BigDecimal.ONE) >= 0
                && v.compareTo(BigDecimal.valueOf(ValidadorQuestionario.ITENS_MAXIMO)) <= 0;
        return valido ? v.intValueExact() : ValidadorQuestionario.ITENS_MAXIMO;
    }
}
