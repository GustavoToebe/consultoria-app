package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.CorpoExcedidoException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * Rota pública que a Kiwify chama (webhook). A autoridade é o token do caminho (acha a consultoria) mais a assinatura
 * {@code ?signature=} (HMAC-SHA1 do corpo CRU com o token do webhook como chave), as duas conferidas no serviço. O corpo é lido
 * à mão, em bytes, com teto de 16 KiB, e nunca reserializado: a assinatura vale sobre o que chegou. A query é lida da string
 * crua (nunca {@code getParameter}, que consumiria um corpo de formulário antes da leitura). Resposta sem corpo.
 */
@RestController
@ExigePagamentos
@ExigeKiwify
public class AvisoKiwifyController {

    private final AvisoKiwifyService avisos;

    public AvisoKiwifyController(AvisoKiwifyService avisos) {
        this.avisos = avisos;
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/publico/pagamentos/kiwify/{token}")
    public ResponseEntity<Void> receber(@PathVariable String token, HttpServletRequest http) throws IOException {
        int maximo = AvisoKiwifyService.MAXIMO_DO_CORPO;
        if (http.getContentLengthLong() > maximo) {
            throw new CorpoExcedidoException();
        }
        byte[] corpo;
        try (InputStream entrada = http.getInputStream()) {
            // Um byte a mais que o teto basta para saber que passou; o resto não é lido.
            corpo = entrada.readNBytes(maximo + 1);
        }
        avisos.receber(token, corpo, assinatura(http.getQueryString()));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }

    /**
     * O valor do parâmetro {@code signature} da query crua, ou nulo se não há. Repetido é ambíguo e vale como ausente (a
     * Kiwify manda um só): nada de escolher qual conferir.
     */
    static String assinatura(String query) {
        if (query == null || query.isEmpty()) {
            return null;
        }
        String achada = null;
        for (String par : query.split("&")) {
            int igual = par.indexOf('=');
            // Par de outro nome com % torto não é a assinatura: ignora. Assinatura com % torto vale como ausente (401).
            String nome = decodificar(igual < 0 ? par : par.substring(0, igual));
            if (!"signature".equals(nome)) {
                continue;
            }
            if (achada != null) {
                return null;
            }
            achada = igual < 0 ? "" : decodificar(par.substring(igual + 1));
            if (achada == null) {
                return null;
            }
        }
        return achada;
    }

    /** {@code URLDecoder} lança com {@code %} solto ou {@code %zz}: aqui vira nulo, nunca erro 500. */
    private static String decodificar(String texto) {
        try {
            return URLDecoder.decode(texto, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
