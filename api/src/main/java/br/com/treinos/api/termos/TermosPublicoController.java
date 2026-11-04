package br.com.treinos.api.termos;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Termo de uso e aviso de privacidade sem login, para as páginas públicas que as lojas pedem ({@code /privacidade} e
 * {@code /termos-de-uso} no app). Mesmos textos do {@code GET /termos}, sem nada do usuário (nem o aceite).
 */
@RestController
@RequestMapping("/publico/termos")
public class TermosPublicoController {

    public record TermosPublicos(String versao, boolean rascunho, List<Termos.Documento> documentos) { }

    @PreAuthorize("permitAll()")
    @GetMapping
    public ResponseEntity<TermosPublicos> consultar() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(new TermosPublicos(Termos.VERSAO, Termos.RASCUNHO, Termos.documentos()));
    }
}
