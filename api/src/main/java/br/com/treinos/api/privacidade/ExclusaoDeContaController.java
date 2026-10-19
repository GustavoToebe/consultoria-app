package br.com.treinos.api.privacidade;

import br.com.plataforma.comum.seguranca.login.LimiteLoginException;
import br.com.treinos.api.auth.SessaoHttp;
import br.com.treinos.api.privacidade.PrivacidadeDtos.ExcluirContaRequest;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Excluir minha conta", lado do aluno: sempre a conta da sessão, nunca um id vindo do cliente. Depois do 204 a sessão
 * já não vale (usuário inativo, sessões encerradas); na web o cookie de renovação também sai.
 */
@RestController
public class ExclusaoDeContaController {

    private final ExclusaoDeContaService exclusao;
    private final SessaoHttp sessaoHttp;

    public ExclusaoDeContaController(ExclusaoDeContaService exclusao, SessaoHttp sessaoHttp) {
        this.exclusao = exclusao;
        this.sessaoHttp = sessaoHttp;
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/conta/excluir")
    public ResponseEntity<Void> excluir(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid ExcluirContaRequest request,
                                        HttpServletRequest http, HttpServletResponse resposta) {
        resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        try {
            exclusao.excluir(eu, request, http.getRemoteAddr());
        } catch (LimiteLoginException bloqueado) {
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(bloqueado.segundos()));
            throw bloqueado;
        }
        sessaoHttp.limpar(DestinoCliente.de(http), resposta);
        return ResponseEntity.noContent().build();
    }
}
