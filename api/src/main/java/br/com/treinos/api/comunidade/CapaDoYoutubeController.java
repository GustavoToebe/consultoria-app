package br.com.treinos.api.comunidade;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.CapaCriada;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Capa do vídeo a partir do link do YouTube (C25): o corpo traz só o link; o servidor extrai o id e baixa a miniatura do host
 * fixo do YouTube. Responde como {@code POST /comunidade/capas}: o id da capa pendente, que o app liga ao aulão ou ao post.
 */
@RestController
@RequestMapping("/comunidade/capas")
public class CapaDoYoutubeController {

    /** Link ausente, vazio ou fora do padrão: 422 {@code CAPA_INVALIDA} no campo {@code videoUrl}, decidido no service. */
    public record CapaDoYoutubeRequest(String videoUrl) { }

    private final CapaDoYoutubeService capa;
    private final LimiteTentativas limite;

    public CapaDoYoutubeController(CapaDoYoutubeService capa, LimiteTentativas limite) {
        this.capa = capa;
        this.limite = limite;
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/youtube")
    public CapaCriada daCapaDoYoutube(@RequestBody CapaDoYoutubeRequest pedido, @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
        return new CapaCriada(capa.criar(pedido.videoUrl()));
    }
}
