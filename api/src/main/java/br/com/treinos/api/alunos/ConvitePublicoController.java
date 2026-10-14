package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AceitarConviteRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConvitePublico;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.auth.SessaoHttp;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.security.DestinoCliente;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Convite público: mostra a marca do treinador e cria a conta do aluno. Limite de tentativas por IP. */
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

    @GetMapping("/{codigo}")
    public ConvitePublico consultar(@PathVariable String codigo, HttpServletRequest http) {
        limite.convite(http.getRemoteAddr());
        return convites.consultar(codigo);
    }

    @PostMapping("/{codigo}/aceitar")
    public LoginResponse aceitar(@PathVariable String codigo, @RequestBody @Valid AceitarConviteRequest request,
                                 HttpServletRequest http, HttpServletResponse resposta) {
        limite.convite(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        return sessaoHttp.responder(convites.aceitar(codigo, request.email(), request.senha()), cliente,
                resposta);
    }
}
