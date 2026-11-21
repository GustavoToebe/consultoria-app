package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.web.CorpoExcedidoException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;

/**
 * Rotas públicas que a Meta chama (webhook). A autoridade não é um login: o {@code GET} confere o verify token e o {@code POST}
 * a assinatura do corpo cru, ambos no serviço. O corpo é lido à mão, cru e com teto de 64 KiB ({@code @RequestBody} o
 * reinterpretaria antes da assinatura e leria até 1 MiB). Sem a chave do WhatsApp ligada, 503 (e nunca se aceita assinatura com
 * app secret vazio).
 */
@RestController
@ExigeWhatsApp
public class WhatsAppWebhookController {

    private final WhatsAppWebhookService webhook;

    public WhatsAppWebhookController(WhatsAppWebhookService webhook) {
        this.webhook = webhook;
    }

    @PreAuthorize("permitAll()")
    @GetMapping("/publico/whatsapp/meta")
    public ResponseEntity<String> verificar(@RequestParam(name = "hub.mode", required = false) String modo,
                                            @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
                                            @RequestParam(name = "hub.challenge", required = false) String desafio) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.TEXT_PLAIN)
                .body(webhook.verificar(modo, verifyToken, desafio));
    }

    @PreAuthorize("permitAll()")
    @PostMapping("/publico/whatsapp/meta")
    public ResponseEntity<Void> receber(@RequestHeader(name = "X-Hub-Signature-256", required = false) String assinatura,
                                        HttpServletRequest http) throws IOException {
        int maximo = WhatsAppWebhookService.MAXIMO_DO_CORPO;
        if (http.getContentLengthLong() > maximo) {
            throw new CorpoExcedidoException();
        }
        byte[] corpo;
        try (InputStream entrada = http.getInputStream()) {
            // Um byte a mais que o teto basta para saber que passou; o resto não é lido.
            corpo = entrada.readNBytes(maximo + 1);
        }
        webhook.receber(corpo, assinatura);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }
}
