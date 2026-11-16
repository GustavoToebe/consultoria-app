package br.com.treinos.api.vitrine;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.vitrine.VitrineDtos.MarketplaceResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Lista pública de lojas entre consultorias (F3, sem login, só leitura). Só {@link ExigeMarketplace}: desligado, 503
 * {@code MARKETPLACE_INDISPONIVEL}. O limite por IP vem antes de qualquer consulta. A resposta pode ser guardada por um minuto
 * ({@code Cache-Control: public, max-age=60}): quem sai do marketplace ou é suspenso pode aparecer por até esse tempo.
 */
@ExigeMarketplace
@RestController
@RequestMapping("/publico/lojas")
public class MarketplaceController {

    private final VitrinePublicaService vitrine;
    private final LimiteTentativas limite;

    public MarketplaceController(VitrinePublicaService vitrine, LimiteTentativas limite) {
        this.vitrine = vitrine;
        this.limite = limite;
    }

    @PreAuthorize("permitAll()")
    @GetMapping
    public ResponseEntity<MarketplaceResponse> lojas(@RequestParam(required = false) Long pagina,
                                                     @RequestParam(required = false) Long tamanho, HttpServletRequest http) {
        limite.marketplace(http.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic())
                .body(vitrine.marketplace(pagina, tamanho));
    }
}
