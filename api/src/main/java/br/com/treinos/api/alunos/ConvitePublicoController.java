package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AceitarConviteRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConsultarConviteRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConvitePublico;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.auth.SessaoHttp;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.security.DestinoCliente;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Convite público: mostra a marca do treinador e cria a conta do aluno. Limite de tentativas por IP. O código só vem no
 * corpo (o link do app o leva no fragmento `#codigo=`): no caminho ele ficaria em log de acesso, no histórico e na
 * prévia de link de quem recebeu a mensagem.
 */
@RestController
@RequestMapping("/publico/convites")
public class ConvitePublicoController {

    private final ConvitePublicoService convites;
    private final LimiteTentativas limite;
    private final SessaoHttp sessaoHttp;

    public ConvitePublicoController(ConvitePublicoService convites, LimiteTentativas limite, SessaoHttp sessaoHttp) {
        this.convites = convites;
        this.limite = limite;
        this.sessaoHttp = sessaoHttp;
    }

    @PostMapping("/consultar")
    public ConvitePublico consultar(@RequestBody @Valid ConsultarConviteRequest request, HttpServletRequest http) {
        limite.convite(http.getRemoteAddr());
        return convites.consultar(request.codigo());
    }

    @PostMapping("/aceitar")
    public LoginResponse aceitar(@RequestBody @Valid AceitarConviteRequest request,
                                 HttpServletRequest http, HttpServletResponse resposta) {
        limite.convite(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        return sessaoHttp.responder(convites.aceitar(request.codigo(), request.email(), request.senha()), cliente,
                resposta);
    }
}
