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
    /** Marca da consultoria para a tela de aceite. O código vem no corpo (nunca no caminho); 404 igual para qualquer código inválido. */
    @PostMapping("/publico/convites-equipe/consultar")
    public EquipeDtos.ConviteEquipePublico consultar(@RequestBody @Valid EquipeDtos.ConsultarConviteRequest r,HttpServletRequest http) {
        limite.conviteEquipeConsulta(http.getRemoteAddr());
        return convites.consultar(r.codigo());
    }
    /** Aceite com o código e a senha no corpo; a mesma regra e o mesmo 404 da consulta para código inválido, vencido ou já aceito. */
    @PostMapping("/publico/convites-equipe/aceitar")
    public LoginResponse aceitar(@RequestBody @Valid EquipeDtos.AceitarRequest r,HttpServletRequest http,HttpServletResponse resposta) {
        limite.convite(http.getRemoteAddr());var cliente=DestinoCliente.de(http);
        return sessao.responder(convites.aceitar(r.codigo(),r.senha()),cliente,resposta);
    }
}
