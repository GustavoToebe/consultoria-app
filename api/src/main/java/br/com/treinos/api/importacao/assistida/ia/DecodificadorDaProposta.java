package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Trecho comum aos conectores externos: texto que pode sair do servidor e decodificação da proposta devolvida.
 * Valor ausente continua ausente: peso sem data ou sem número é descartado, nunca preenchido (AGENTS.md: não
 * inventar valor). E-mail e telefone não vêm da IA: a identificação é local.
 */
final class DecodificadorDaProposta {

    private DecodificadorDaProposta() {
    }

    /** Único texto do aluno que um conector pode enviar: o extraído, sem nome de arquivo nem PDF. */
    static String textoParaEnvio(ContextoIa contexto) {
        String texto = contexto.textoParaProvedor();
        if (texto == null || texto.isBlank()) {
            throw new IllegalStateException("Sem texto para enviar.");
        }
        return texto;
    }

    static String formatarApelidos(Map<String, String> apelidos) {
        if (apelidos == null || apelidos.isEmpty()) {
            return "Nenhum";
        }
        StringBuilder sb = new StringBuilder();
        apelidos.forEach((k, v) -> sb.append("- '").append(k).append("' -> '").append(v).append("'\n"));
        return sb.toString();
    }

    static ResultadoInterpretacao decodificar(JsonMapper json, JsonNode root, ContextoIa contexto) {
        List<ResultadoInterpretacao.PropostaGrupo> grupos = new ArrayList<>();
        List<ResultadoInterpretacao.PropostaDuvida> duvidas = new ArrayList<>();

        JsonNode gruposNode = root.path("grupos");
        if (gruposNode.isArray()) {
            for (JsonNode g : gruposNode) {
                String nome = texto(g, "nomeAluno");
                if (nome == null) {
                    nome = "Aluno sem identificação";
                }
                grupos.add(new ResultadoInterpretacao.PropostaGrupo(
                        contexto.nomeArquivo(), nome, null, null, texto(g, "objetivo"), texto(g, "observacoes"),
                        pesos(g.path("pesos")), tipado(json, g.path("treino"), ConteudoTreino.class),
                        tipado(json, g.path("dieta"), ConteudoDieta.class)));
            }
        }

        JsonNode duvidasNode = root.path("duvidas");
        if (duvidasNode.isArray()) {
            for (JsonNode d : duvidasNode) {
                List<ResultadoInterpretacao.PropostaSugestao> sugestoes = new ArrayList<>();
                JsonNode sugsNode = d.path("sugestoes");
                if (sugsNode.isArray()) {
                    for (JsonNode s : sugsNode) {
                        sugestoes.add(new ResultadoInterpretacao.PropostaSugestao(
                                s.path("termo").asText(), s.path("nota").asDouble(0.8)));
                    }
                }
                duvidas.add(new ResultadoInterpretacao.PropostaDuvida(
                        d.path("tipo").asText("EXERCICIO_NAO_RECONHECIDO"), d.path("termoOriginal").asText(""),
                        d.path("trechoOriginal").asText(""), contexto.nomeArquivo(), List.copyOf(sugestoes)));
            }
        }
        return new ResultadoInterpretacao(List.copyOf(grupos), List.copyOf(duvidas));
    }

    private static String texto(JsonNode no, String campo) {
        JsonNode v = no.path(campo);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        String t = v.asText().strip();
        return t.isEmpty() ? null : t;
    }

    private static List<ResultadoInterpretacao.PropostaPeso> pesos(JsonNode pesosNode) {
        List<ResultadoInterpretacao.PropostaPeso> pesos = new ArrayList<>();
        if (!pesosNode.isArray()) {
            return pesos;
        }
        for (JsonNode p : pesosNode) {
            String data = texto(p, "data");
            String kg = texto(p, "kg");
            if (data == null || kg == null) {
                continue; // sem data ou sem número: não vira peso
            }
            try {
                BigDecimal valor = new BigDecimal(kg.replace(',', '.'));
                pesos.add(new ResultadoInterpretacao.PropostaPeso(LocalDate.parse(data), valor, null));
            } catch (RuntimeException e) {
                // peso mal formatado é descartado
            }
        }
        return pesos;
    }

    private static <T> T tipado(JsonMapper json, JsonNode no, Class<T> tipo) {
        if (no.isMissingNode() || no.isNull()) {
            return null;
        }
        try {
            return json.treeToValue(no, tipo);
        } catch (RuntimeException e) {
            return null; // estrutura que não decodifica fica de fora
        }
    }
}
