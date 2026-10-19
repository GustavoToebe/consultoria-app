package br.com.treinos.api.atualizacoes;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Valida as respostas de um questionário (atualização ou anamnese) contra a versão respondida e devolve só as respostas
 * conhecidas e visíveis. Pergunta escondida por condição ({@code mostrarSe}) não é obrigatória e a resposta dela é
 * descartada (nunca vira "não"). Mensagens nunca repetem o valor sensível enviado. Mesmas regras de
 * {@code errosRespostasAtualizacao} em {@code app/src/dominio/respostasAtualizacao.ts} (o teste de paridade confere os
 * campos).
 */
@Component
public class ValidadorAtualizacao {

    private static final Pattern UUID_TEXTO = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern DATA = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final Pattern TELEFONE = Pattern.compile("[0-9()+\\-. ]+");
    private static final Pattern EMAIL = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");

    private final JsonMapper json;

    public ValidadorAtualizacao(JsonMapper json) {
        this.json = json;
    }

    /** Com as fotos desligadas (padrão): a pergunta FOTOS é ignorada, como sempre foi. */
    public JsonNode validar(JsonNode modelo, JsonNode respostas) {
        return validar(modelo, respostas, false);
    }

    /**
     * Com as fotos ligadas, a resposta de FOTOS é a lista de ids das fotos já enviadas (sem repetir, no máximo
     * {@link LimitesQuestionario#FOTOS_POR_PERGUNTA}); quem as liga é o {@code FotoService}, no envio.
     */
    public JsonNode validar(JsonNode modelo, JsonNode respostas, boolean fotosLigadas) {
        return validar(modelo, respostas, fotosLigadas, "ATUALIZACAO_INVALIDA", LocalDate.now(Fuso.BRASILIA));
    }

    /** {@code codigo} vai no 422 ({@code ATUALIZACAO_INVALIDA} ou {@code ANAMNESE_INVALIDA}); {@code hoje} limita DATA "só no passado". */
    public JsonNode validar(JsonNode modelo, JsonNode respostas, boolean fotosLigadas, String codigo, LocalDate hoje) {
        var erros = new ArrayList<ApiError.FieldError>();
        var limpas = json.createObjectNode();
        if (respostas == null || !respostas.isObject()
                || json.writeValueAsString(respostas).getBytes(StandardCharsets.UTF_8).length > LimitesQuestionario.RESPOSTAS_BYTES) {
            throw new ValidacaoException("Confira as respostas.", codigo,
                    List.of(new ApiError.FieldError("respostas", "Respostas inválidas ou acima do limite.")));
        }
        // Respostas já aceitas e visíveis, por id: é o que as condições das perguntas seguintes consultam.
        Map<String, JsonNode> visiveis = new HashMap<>();
        for (var secao : modelo.path("secoes")) {
            boolean secaoVisivel = visivel(secao.path("mostrarSe"), visiveis);
            for (var p : secao.path("perguntas")) {
                String id = p.path("id").asString();
                String tipo = p.path("tipo").asString();
                if ("DATA_AUTOMATICA".equals(tipo) || "INFORMATIVO".equals(tipo) || ("FOTOS".equals(tipo) && !fotosLigadas)) {
                    continue;
                }
                if (!secaoVisivel || !visivel(p.path("mostrarSe"), visiveis)) {
                    continue;
                }
                var v = respostas.path(id);
                if (vazio(v)) {
                    if (p.path("obrigatoria").asBoolean(false)) {
                        erros.add(new ApiError.FieldError(id, "Preencha este campo."));
                    }
                    continue;
                }
                if ("GRADE".equals(tipo) && p.path("obrigatoria").asBoolean(false) && gradeValida(p, v)
                        && v.size() < p.path("linhas").size()) {
                    erros.add(new ApiError.FieldError(id, "Responda todas as linhas."));
                    continue;
                }
                if (!valida(tipo, p, v, hoje)) {
                    erros.add(new ApiError.FieldError(id, "Confira o formato e os limites deste campo."));
                    continue;
                }
                JsonNode limpa = "FOTOS".equals(tipo) ? fotosEmMinusculas(v) : v;
                limpas.set(id, limpa);
                visiveis.put(id, limpa);
            }
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira as respostas.", codigo, erros);
        }
        return limpas;
    }

    /** Ausência, nulo, texto em branco, lista vazia e objeto vazio contam como "não respondida"; {@code false} e 0 contam. */
    private static boolean vazio(JsonNode v) {
        return v.isMissingNode() || v.isNull() || (v.isString() && v.asString().isBlank()) || (v.isArray() && v.isEmpty())
                || (v.isObject() && v.isEmpty());
    }

    /**
     * Sem condição, visível. Com ela, a resposta (já aceita e visível) da pergunta de controle precisa ser um dos valores:
     * id da opção (escolha única), algum id marcado (múltipla) ou "sim"/"nao" (sim ou não). Sem resposta = escondida.
     */
    static boolean visivel(JsonNode condicao, Map<String, JsonNode> respostas) {
        if (condicao == null || condicao.isMissingNode() || condicao.isNull()) {
            return true;
        }
        JsonNode r = respostas.get(condicao.path("perguntaId").asString());
        if (r == null) {
            return false;
        }
        Set<String> valores = new HashSet<>();
        condicao.path("valores").forEach(n -> valores.add(n.asString()));
        if (r.isBoolean()) {
            return valores.contains(r.asBoolean() ? "sim" : "nao");
        }
        if (r.isString()) {
            return valores.contains(r.asString());
        }
        if (r.isArray()) {
            for (var item : r) {
                if (valores.contains(item.asString())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean valida(String tipo, JsonNode p, JsonNode v, LocalDate hoje) {
        return switch (tipo) {
            case "NOTA" -> nota(v);
            case "PESO" -> v.isNumber() && v.asDouble() >= 20 && v.asDouble() <= 400 && v.decimalValue().stripTrailingZeros().scale() <= 1;
            case "TEXTO", "TEXTO_LONGO" -> v.isString() && v.asString().length() <= ("TEXTO".equals(tipo)
                    ? LimitesQuestionario.TEXTO_CURTO_CAPACIDADE : LimitesQuestionario.TEXTO_LONGO_CAPACIDADE);
            case "NOTAS_POR_DIA" -> v.isObject() && v.properties().stream().allMatch(e ->
                    p.path("dias").valueStream().anyMatch(d -> String.valueOf(d.asInt()).equals(e.getKey()))
                            && (e.getValue().isNull() || nota(e.getValue())));
            case "ESCOLHA_UNICA" -> v.isString() && ids(p.path("opcoes")).contains(v.asString());
            case "MULTIPLA_ESCOLHA" -> multiplaEscolha(p, v);
            case "NUMERO" -> numero(p, v);
            case "SIM_NAO" -> v.isBoolean();
            case "FOTOS" -> fotos(v);
            case "DATA" -> data(p, v, hoje);
            case "TELEFONE" -> telefone(v);
            case "EMAIL" -> v.isString() && v.asString().strip().length() <= LimitesQuestionario.EMAIL_TAMANHO
                    && EMAIL.matcher(v.asString().strip()).matches();
            case "GRADE" -> gradeValida(p, v);
            case "ACEITE" -> v.isBoolean() && v.asBoolean();
            default -> false;
        };
    }

    /** AAAA-MM-DD de verdade (sem 31/02), entre 1900 e 2100; com {@code somentePassado}, até hoje. */
    private static boolean data(JsonNode p, JsonNode v, LocalDate hoje) {
        if (!v.isString() || !DATA.matcher(v.asString()).matches()) {
            return false;
        }
        LocalDate d;
        try {
            d = LocalDate.parse(v.asString());
        } catch (DateTimeException invalida) {
            return false;
        }
        if (d.getYear() < LimitesQuestionario.DATA_ANO_MINIMO || d.getYear() > LimitesQuestionario.DATA_ANO_MAXIMO) {
            return false;
        }
        return !(p.path("somentePassado").asBoolean(false) && d.isAfter(hoje));
    }

    /** Só dígitos, espaço, parênteses, +, - e ponto; de 10 a 13 dígitos (DDD + número, com ou sem o 55). */
    private static boolean telefone(JsonNode v) {
        if (!v.isString()) {
            return false;
        }
        String t = v.asString().strip();
        if (t.length() > LimitesQuestionario.TELEFONE_TAMANHO || !TELEFONE.matcher(t).matches()) {
            return false;
        }
        long digitos = t.chars().filter(Character::isDigit).count();
        return digitos >= LimitesQuestionario.TELEFONE_DIGITOS_MINIMO && digitos <= LimitesQuestionario.TELEFONE_DIGITOS_MAXIMO;
    }

    /** Objeto linha → coluna, só com linhas e colunas da pergunta. Obrigatória (todas as linhas) é conferida antes. */
    private static boolean gradeValida(JsonNode p, JsonNode v) {
        if (!v.isObject()) {
            return false;
        }
        Set<String> linhas = ids(p.path("linhas"));
        Set<String> colunas = ids(p.path("colunas"));
        return v.properties().stream().allMatch(e -> linhas.contains(e.getKey())
                && e.getValue().isString() && colunas.contains(e.getValue().asString()));
    }

    /** Lista de ids (UUID) sem repetição, de 1 a {@code FOTOS_POR_PERGUNTA}. A lista vazia já foi tratada como "não respondida". */
    private static boolean fotos(JsonNode v) {
        if (!v.isArray() || v.size() > LimitesQuestionario.FOTOS_POR_PERGUNTA) {
            return false;
        }
        Set<String> vistos = new HashSet<>();
        for (var item : v) {
            if (!item.isString() || !UUID_TEXTO.matcher(item.asString()).matches()) {
                return false;
            }
            if (!vistos.add(item.asString().toLowerCase(Locale.ROOT))) {
                return false;
            }
        }
        return true;
    }

    private JsonNode fotosEmMinusculas(JsonNode v) {
        var lista = json.createArrayNode();
        for (var item : v) {
            lista.add(item.asString().toLowerCase(Locale.ROOT));
        }
        return lista;
    }

    private static boolean nota(JsonNode v) {
        return v.isIntegralNumber() && v.asLong() >= 0 && v.asLong() <= 10;
    }

    private static Set<String> ids(JsonNode lista) {
        Set<String> ids = new HashSet<>();
        for (var o : lista) {
            ids.add(o.path("id").asString());
        }
        return ids;
    }

    /** Lista sem repetição, cada item é o id de uma opção. A lista vazia já foi tratada como "não respondida". */
    private static boolean multiplaEscolha(JsonNode pergunta, JsonNode v) {
        if (!v.isArray()) {
            return false;
        }
        Set<String> ids = ids(pergunta.path("opcoes"));
        Set<String> vistos = new HashSet<>();
        for (var item : v) {
            if (!item.isString() || !ids.contains(item.asString()) || !vistos.add(item.asString())) {
                return false;
            }
        }
        return true;
    }

    /** Dentro de min/max (quando existem) e com no máximo {@code casas} decimais (padrão 0). */
    private static boolean numero(JsonNode pergunta, JsonNode v) {
        if (!v.isNumber() || (v.isFloatingPointNumber() && !Double.isFinite(v.doubleValue()))) {
            return false;
        }
        BigDecimal valor = v.decimalValue();
        if (valor.abs().compareTo(BigDecimal.valueOf(LimitesQuestionario.NUMERO_ABSOLUTO)) > 0) {
            return false;
        }
        int casas = pergunta.path("casas").isNumber() ? pergunta.path("casas").asInt() : 0;
        if (valor.stripTrailingZeros().scale() > casas) {
            return false;
        }
        if (pergunta.path("min").isNumber() && valor.compareTo(pergunta.path("min").decimalValue()) < 0) {
            return false;
        }
        return !(pergunta.path("max").isNumber() && valor.compareTo(pergunta.path("max").decimalValue()) > 0);
    }
}
