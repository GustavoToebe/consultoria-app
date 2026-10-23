package br.com.treinos.api.auth;

import br.com.plataforma.comum.seguranca.login.LimiteLoginException;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.dto.CadastroTreinadorRequest;
import br.com.treinos.api.auth.dto.EsqueciSenhaRequest;
import br.com.treinos.api.auth.dto.LoginRequest;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.auth.dto.RedefinirSenhaRequest;
import br.com.treinos.api.auth.dto.RefreshRequest;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.web.NaoEncontradoException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rotas públicas de sessão. Web recebe o refresh em cookie HttpOnly; nativo (header
 * {@code X-Treinos-Cliente: nativo}) recebe no corpo. O limite de tentativas do login é do módulo de autenticação (roda
 * antes do BCrypt); cadastro e refresh têm o limite por IP do app ({@link LimiteTentativas}). Login, cadastro e
 * "esqueci a senha" começam pela verificação humana ({@link VerificacaoHumana}), antes de tudo o mais; o refresh não.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final CadastroTreinadorService cadastroTreinador;
    private final LimiteTentativas limite;
    private final SessaoHttp sessaoHttp;
    private final Auditoria auditoria;
    private final RedefinicaoSenhaService redefinicao;
    private final VerificacaoHumana verificacao;
    private final boolean cadastroAberto;

    public AuthController(AuthService authService, CadastroTreinadorService cadastroTreinador,
                          LimiteTentativas limite, SessaoHttp sessaoHttp, Auditoria auditoria,
                          RedefinicaoSenhaService redefinicao, VerificacaoHumana verificacao,
                          @Value("${treinos.cadastro.aberto:false}") boolean cadastroAberto) {
        this.cadastroAberto = cadastroAberto;
        this.verificacao = verificacao;
        this.redefinicao = redefinicao;
        this.auditoria = auditoria;
        this.authService = authService;
        this.cadastroTreinador = cadastroTreinador;
        this.limite = limite;
        this.sessaoHttp = sessaoHttp;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest request, HttpServletRequest http,
                               HttpServletResponse resposta) {
        verificacao.exigir(request.turnstileToken(), http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        AuthService.Sessao sessao;
        try {
            sessao = authService.entrar(request.email(), request.senha(), request.codigoMfa(), request.novaSenha(),
                    http.getRemoteAddr());
        } catch (LimiteLoginException bloqueado) {
            // Só a tentativa que cruza o limite vira auditoria; as demais da janela só recebem o 429.
            if (bloqueado.primeiroBloqueio()) {
                auditoria.bloqueioLogin(request.email());
            }
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(bloqueado.segundos()));
            throw bloqueado;
        }
        return sessaoHttp.responder(sessao, cliente, resposta);
    }

    @PostMapping("/cadastro-treinador")
    public LoginResponse cadastroTreinador(@RequestBody @Valid CadastroTreinadorRequest request,
                                           HttpServletRequest http, HttpServletResponse resposta) {
        // Fechado (o padrão): 404 antes de tudo, sem dizer se o e-mail existe nem gastar verificação humana.
        if (!cadastroAberto) {
            throw new NaoEncontradoException("Cadastro de treinador fechado.");
        }
        verificacao.exigir(request.turnstileToken(), http.getRemoteAddr());
        limite.cadastro(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        return sessaoHttp.responder(cadastroTreinador.cadastrar(request), cliente, resposta);
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@RequestBody(required = false) @Valid RefreshRequest corpo,
                                 HttpServletRequest http, HttpServletResponse resposta) {
        limite.refresh(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        String bruto = sessaoHttp.refreshDoCliente(cliente, corpo == null ? null : corpo.refreshToken(), http)
                .orElseThrow(() -> new UnauthorizedException("Sessão inválida ou expirada. Entre de novo.", "SESSAO_EXPIRADA"));
        return sessaoHttp.responder(authService.renovar(bruto, http.getRemoteAddr()), cliente, resposta);
    }

    /** Sempre 202, exista a conta ou não; o e-mail só sai se existir. Limite por IP e por e-mail é do módulo (429 + Retry-After). */
    @PostMapping("/esqueci-senha")
    public ResponseEntity<Void> esqueciSenha(@RequestBody @Valid EsqueciSenhaRequest request, HttpServletRequest http,
                                             HttpServletResponse resposta) {
        verificacao.exigir(request.turnstileToken(), http.getRemoteAddr());
        try {
            redefinicao.solicitar(request.email(), http.getRemoteAddr());
        } catch (LimiteLoginException limitado) {
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(limitado.segundos()));
            throw limitado;
        }
        return ResponseEntity.accepted().build();
    }

    /** Não abre sessão: a pessoa entra com a senha nova (todas as sessões antigas caem). Com MFA ativo pede {@code codigoMfa}. */
    @PostMapping("/redefinir-senha")
    public ResponseEntity<Void> redefinirSenha(@RequestBody @Valid RedefinirSenhaRequest request, HttpServletRequest http,
                                               HttpServletResponse resposta) {
        try {
            redefinicao.redefinir(request.token(), request.novaSenha(), request.codigoMfa(), http.getRemoteAddr());
        } catch (LimiteLoginException limitado) {
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(limitado.segundos()));
            throw limitado;
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) @Valid RefreshRequest corpo,
                                       HttpServletRequest http, HttpServletResponse resposta) {
        DestinoCliente cliente = DestinoCliente.de(http);
        authService.sair(sessaoHttp.refreshDoCliente(cliente, corpo == null ? null : corpo.refreshToken(), http).orElse(null));
        sessaoHttp.limpar(cliente, resposta);
        return ResponseEntity.noContent().build();
    }
}
