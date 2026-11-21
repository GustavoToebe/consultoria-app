package br.com.treinos.api.whatsapp;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Chamada à Cloud API da Meta (Graph API), SEMPRE fora de transação: envia a mensagem por modelo (template) e lê os modelos da
 * conta. Conexão e resposta com tempo máximo curto, sem redirecionamento (o token de acesso iria junto) e leitura da resposta
 * limitada. O token só vai no cabeçalho {@code Authorization}; nada da resposta (que pode repetir o telefone) nem o token vai a
 * log ou à exceção: o erro vira só um código curto ({@code META_<código>}, {@code HTTP_<status>} ou a classe do erro de rede).
 */
@Component
class MetaCliente {

    /** Versão da Graph API na URL. shortcut: fixa no código, trocar quando a Meta aposentar a versão (não vale uma variável). */
    static final String VERSAO_DA_API = "v23.0";
    static final int LIMITE_DA_RESPOSTA = 64 * 1024;
    static final int MODELOS_POR_CHAMADA = 250;

    /**
     * Códigos de erro da Meta que passam sozinhos (limite de taxa, instabilidade): tentam de novo. Qualquer outro erro 4xx da
     * Meta (token inválido, modelo inexistente ou não aprovado, parâmetros, número que não tem WhatsApp...) é definitivo.
     * Lista escrita de memória da documentação da Cloud API, sem consulta ao Context7 (indisponível na sessão).
     */
    private static final Set<Integer> CODIGOS_PASSAGEIROS = Set.of(1, 2, 4, 17, 32, 341, 368, 613, 80007, 130429, 131000, 131016,
            131048, 131056);

    /** Falha da chamada. {@code codigo} é curto e sem dado; {@code definitiva}: não adianta tentar de novo. */
    static class FalhaNaMeta extends RuntimeException {
        private static final long serialVersionUID = 1L;

        private final boolean definitiva;

        FalhaNaMeta(String codigo, boolean definitiva) {
            super(codigo, null, false, false);
            this.definitiva = definitiva;
        }

        String codigo() {
            return getMessage();
        }

        boolean definitiva() {
            return definitiva;
        }
    }

    /** Um modelo da conta da Meta: nome, idioma e a situação ({@code APPROVED}, {@code PENDING}, {@code REJECTED}...). */
    record ModeloDaMeta(String nome, String idioma, String situacao) {
    }

    private final WhatsAppProperties propriedades;
    private final HttpClient http;
    private final JsonMapper json = new JsonMapper();

    MetaCliente(WhatsAppProperties propriedades) {
        this.propriedades = propriedades;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(propriedades.timeoutSegundos()))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    /**
     * Envia o modelo ao número ({@code para}: só dígitos, com DDI) com as variáveis do corpo, na ordem. Devolve o id da mensagem na
     * Meta ({@code wamid...}), pelo qual o webhook acha a linha da fila. Lança {@link FalhaNaMeta} se não der.
     */
    String enviarModelo(String token, String phoneNumberId, String para, String modelo, String idioma, List<String> variaveis) {
        ObjectNode corpo = json.createObjectNode();
        corpo.put("messaging_product", "whatsapp");
        corpo.put("recipient_type", "individual");
        corpo.put("to", para);
        corpo.put("type", "template");
        ObjectNode template = corpo.putObject("template");
        template.put("name", modelo);
        template.putObject("language").put("code", idioma);
        if (!variaveis.isEmpty()) {
            ObjectNode componente = template.putArray("components").addObject();
            componente.put("type", "body");
            ArrayNode parametros = componente.putArray("parameters");
            for (String variavel : variaveis) {
                ObjectNode p = parametros.addObject();
                p.put("type", "text");
                p.put("text", variavel);
            }
        }
        HttpRequest pedido = base(token, "/" + VERSAO_DA_API + "/" + phoneNumberId + "/messages")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(corpo))).build();
        JsonNode resposta = chamar(pedido);
        String id = resposta.path("messages").path(0).path("id").asString("");
        // Um 200 sem o id não diz o que aconteceu com a mensagem: tenta de novo (a Meta sempre devolve o id).
        if (id.isBlank() || id.length() > 120) {
            throw new FalhaNaMeta("RESPOSTA_INVALIDA", false);
        }
        return id;
    }

    /**
     * Os modelos da conta (WABA) com a situação de cada um. shortcut: uma página de {@value #MODELOS_POR_CHAMADA}, sem seguir a
     * paginação; conta com mais modelos que isso mostra "não encontrado" para o que ficou de fora, trocar se aparecer o caso.
     */
    List<ModeloDaMeta> listarModelos(String token, String wabaId) {
        HttpRequest pedido = base(token, "/" + VERSAO_DA_API + "/" + wabaId + "/message_templates?fields=name,language,status&limit="
                + MODELOS_POR_CHAMADA).GET().build();
        JsonNode dados = chamar(pedido).path("data");
        if (!dados.isArray()) {
            throw new FalhaNaMeta("RESPOSTA_INVALIDA", false);
        }
        List<ModeloDaMeta> modelos = new ArrayList<>();
        for (JsonNode m : dados) {
            modelos.add(new ModeloDaMeta(m.path("name").asString(""), m.path("language").asString(""), m.path("status").asString("")));
        }
        return modelos;
    }

    private HttpRequest.Builder base(String token, String caminho) {
        return HttpRequest.newBuilder(URI.create(propriedades.metaUrl() + caminho))
                .timeout(Duration.ofSeconds(propriedades.timeoutSegundos())).header("Accept", "application/json")
                .header("Authorization", "Bearer " + token);
    }

    /** Faz a chamada e devolve o JSON de uma resposta 2xx; o resto vira {@link FalhaNaMeta} com só o código. */
    private JsonNode chamar(HttpRequest pedido) {
        HttpResponse<InputStream> resposta;
        byte[] corpo;
        try {
            resposta = http.send(pedido, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream entrada = resposta.body()) {
                corpo = entrada.readNBytes(LIMITE_DA_RESPOSTA);
            }
        } catch (IOException e) {
            throw new FalhaNaMeta(e.getClass().getSimpleName(), false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FalhaNaMeta("InterruptedException", false);
        }
        int status = resposta.statusCode();
        if (status / 100 == 2) {
            try {
                return json.readTree(corpo);
            } catch (RuntimeException e) {
                throw new FalhaNaMeta("RESPOSTA_INVALIDA", false);
            }
        }
        throw falha(status, corpo);
    }

    /** Erro da Meta: o código dela ({@code META_190}) quando há; senão o status. Definitivo só em 4xx que não é passageiro. */
    private FalhaNaMeta falha(int status, byte[] corpo) {
        int codigo = -1;
        try {
            codigo = json.readTree(corpo).path("error").path("code").asInt(-1);
        } catch (RuntimeException semJson) {
            // Resposta que não é JSON (proxy, gateway): vale o status.
        }
        String rotulo = codigo > 0 ? "META_" + codigo : "HTTP_" + status;
        boolean cliente = status / 100 == 4 && status != 429 && status != 408;
        return new FalhaNaMeta(rotulo, cliente && !CODIGOS_PASSAGEIROS.contains(codigo));
    }
}
