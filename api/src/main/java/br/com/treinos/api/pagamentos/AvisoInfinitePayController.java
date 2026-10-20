package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.CorpoExcedidoException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

/**
 * Rota pública que a InfinitePay chama (webhook). A autoridade é o token do caminho, conferido no serviço. O corpo é lido
 * à mão, com teto de 16 KiB: um {@code @RequestBody} leria até 1 MiB, e {@code consumes} daria 415 para um
 * {@code Content-Type} inesperado, o que faria a InfinitePay reenviar o aviso. Resposta sem corpo.
 *
 * <p>Formulário ({@code application/x-www-form-urlencoded}): a InfinitePay documenta o aviso como JSON, mas um corpo de
 * formulário é lido pelo servidor como parâmetros antes de chegar aqui, e o fluxo de entrada vem vazio. Então os parâmetros
 * viram um objeto JSON (um valor = texto; repetido = lista, que a leitura recusa como identificador) e seguem o mesmo
 * caminho, com o mesmo teto. Um JSON mandado com o rótulo de formulário chega como um único parâmetro sem valor, cujo nome
 * é o próprio JSON: esse nome é usado como o corpo.
 */
@RestController
@ExigePagamentos
@ExigeInfinitePay
public class AvisoInfinitePayController {

    private static final String FORMULARIO = "application/x-www-form-urlencoded";

    private final AvisoInfinitePayService avisos;
    private final JsonMapper json;

    public AvisoInfinitePayController(AvisoInfinitePayService avisos, JsonMapper json) {
        this.avisos = avisos;
        this.json = json;
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/publico/pagamentos/infinitepay/{token}")
    public ResponseEntity<Void> receber(@PathVariable String token, HttpServletRequest http) throws IOException {
        int maximo = AvisoInfinitePayService.MAXIMO_DO_CORPO;
        if (http.getContentLengthLong() > maximo) {
            throw new CorpoExcedidoException();
        }
        byte[] corpo;
        if (ehFormulario(http.getContentType())) {
            corpo = corpoDoFormulario(http.getParameterMap());
        } else {
            try (InputStream entrada = http.getInputStream()) {
                // Um byte a mais que o teto basta para saber que passou; o resto não é lido.
                corpo = entrada.readNBytes(maximo + 1);
            }
        }
        avisos.receber(token, corpo);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }

    static boolean ehFormulario(String tipo) {
        return tipo != null && tipo.trim().toLowerCase(Locale.ROOT).startsWith(FORMULARIO);
    }

    /** Os parâmetros do formulário como o corpo JSON que o leitor do aviso espera. O tamanho é conferido depois, no serviço. */
    byte[] corpoDoFormulario(Map<String, String[]> parametros) {
        if (parametros.size() == 1) {
            Map.Entry<String, String[]> unico = parametros.entrySet().iterator().next();
            String[] valores = unico.getValue();
            boolean semValor = valores.length == 1 && valores[0].isEmpty();
            if (semValor && unico.getKey().trim().startsWith("{")) {
                return unico.getKey().getBytes(StandardCharsets.UTF_8);
            }
        }
        ObjectNode objeto = json.createObjectNode();
        parametros.forEach((nome, valores) -> {
            if (valores.length == 1) {
                objeto.put(nome, valores[0]);
            } else {
                ArrayNode lista = objeto.putArray(nome);
                for (String valor : valores) {
                    lista.add(valor);
                }
            }
        });
        return json.writeValueAsBytes(objeto);
    }
}
