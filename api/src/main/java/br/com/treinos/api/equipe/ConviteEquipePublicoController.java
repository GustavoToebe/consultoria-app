package br.com.treinos.api.equipe;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.auth.SessaoHttp;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.security.DestinoCliente;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
@RestController
public class ConviteEquipePublicoController {
    private final ConviteEquipePublicoService convites;
    private final LimiteTentativas limite;
    private final SessaoHttp sessao;
    public ConviteEquipePublicoController(ConviteEquipePublicoService convites,LimiteTentativas limite,SessaoHttp sessao) { this.convites=convites;this.limite=limite;this.sessao=sessao; }
    @PostMapping("/publico/convites-equipe/{codigo}")
    public LoginResponse aceitar(@PathVariable String codigo,@RequestBody @Valid EquipeDtos.AceitarRequest r,HttpServletRequest http,HttpServletResponse resposta) {
        limite.convite(http.getRemoteAddr());var cliente=DestinoCliente.de(http);
        return sessao.responder(convites.aceitar(codigo,r.senha(),cliente),cliente,resposta);
    }
}
