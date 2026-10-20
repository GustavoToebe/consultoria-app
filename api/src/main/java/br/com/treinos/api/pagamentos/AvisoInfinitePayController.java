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

/**
 * Rota pública que a InfinitePay chama (webhook). A autoridade é o token do caminho, conferido no serviço. O corpo é lido
 * à mão, com teto de 16 KiB: um {@code @RequestBody} leria até 1 MiB, e {@code consumes} daria 415 para um
 * {@code Content-Type} inesperado, o que faria a InfinitePay reenviar o aviso. Resposta sem corpo.
 */
@RestController
@ExigePagamentos
@ExigeInfinitePay
public class AvisoInfinitePayController {

    private final AvisoInfinitePayService avisos;

    public AvisoInfinitePayController(AvisoInfinitePayService avisos) {
        this.avisos = avisos;
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/publico/pagamentos/infinitepay/{token}")
    public ResponseEntity<Void> receber(@PathVariable String token, HttpServletRequest http) throws IOException {
        int maximo = AvisoInfinitePayService.MAXIMO_DO_CORPO;
        if (http.getContentLengthLong() > maximo) {
            throw new CorpoExcedidoException();
        }
        byte[] corpo;
        try (InputStream entrada = http.getInputStream()) {
            // Um byte a mais que o teto basta para saber que passou; o resto não é lido.
            corpo = entrada.readNBytes(maximo + 1);
        }
        avisos.receber(token, corpo);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }
}
