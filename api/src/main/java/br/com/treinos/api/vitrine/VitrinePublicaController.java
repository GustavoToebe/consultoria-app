package br.com.treinos.api.vitrine;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.fotos.RespostaDeFoto;
import br.com.treinos.api.vitrine.VitrineDtos.LojaPublicaResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Página pública da loja (sem login, só leitura): o código fica no caminho (é o link que a consultoria divulga). Só
 * {@link ExigeLoja}: com a loja desligada, 503 {@code LOJA_INDISPONIVEL}; ligada, código inexistente ou página desligada dão o mesmo
 * 404. O limite por IP vem antes de qualquer consulta, em baldes separados para a página e para as fotos.
 */
@ExigeLoja
@RestController
@RequestMapping("/publico/loja/{codigo}")
public class VitrinePublicaController {

    private final VitrinePublicaService loja;
    private final LimiteTentativas limite;

    public VitrinePublicaController(VitrinePublicaService loja, LimiteTentativas limite) {
        this.loja = loja;
        this.limite = limite;
    }

    @PreAuthorize("permitAll()")
    @GetMapping
    public LojaPublicaResponse pagina(@PathVariable String codigo, HttpServletRequest http) {
        limite.loja(http.getRemoteAddr());
        return loja.pagina(codigo);
    }

    @PreAuthorize("permitAll()")
    @GetMapping("/itens/{itemId}/foto")
    public ResponseEntity<byte[]> foto(@PathVariable String codigo, @PathVariable UUID itemId, HttpServletRequest http) {
        limite.lojaFoto(http.getRemoteAddr());
        return RespostaDeFoto.de(loja.foto(codigo, itemId));
    }
}
