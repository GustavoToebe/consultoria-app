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
 * Rota pública de webhook do Asaas (Overtraining Pay). A consultoria é resolvida pelo {@code tokenCaminho} e autenticada
 * pelo cabeçalho {@code asaas-access-token} em tempo constante no serviço. O corpo é lido manualmente com teto de 16 KiB
 * (413 se exceder) e nunca é gravado nem logado.
 */
@RestController
@ExigePagamentos
@ExigeAsaas
public class AvisoAsaasController {

    static final String HEADER_TOKEN = "asaas-access-token";

    private final AvisoAsaasService avisos;

    public AvisoAsaasController(AvisoAsaasService avisos) {
        this.avisos = avisos;
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/publico/pagamentos/asaas/{tokenCaminho}")
    public ResponseEntity<Void> receber(@PathVariable String tokenCaminho, HttpServletRequest http) throws IOException {
        int maximo = AvisoAsaasService.MAXIMO_DO_CORPO;
        if (http.getContentLengthLong() > maximo) {
            throw new CorpoExcedidoException();
        }
        byte[] corpo;
        try (InputStream entrada = http.getInputStream()) {
            corpo = entrada.readNBytes(maximo + 1);
        }
        avisos.receber(tokenCaminho, corpo, http.getHeader(HEADER_TOKEN));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }
}
