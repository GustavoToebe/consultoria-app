package br.com.treinos.api.security;

import br.com.plataforma.comum.auth.Autenticador;
import br.com.plataforma.comum.auth.JwtService;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.integracao.AcessoPorDireitos;
import br.com.treinos.api.tenant.TenantContext;
import br.com.plataforma.comum.web.UnauthorizedException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import br.com.treinos.api.equipe.PermissoesDoUsuario;

/**
 * Valida o Bearer, carrega o usuário ativo com a mesma versão de credenciais e preenche o {@link TenantContext} com a
 * consultoria <b>do banco</b> (nunca do token nem do corpo). Token inválido não autentica: a rota protegida responde
 * 401. O contexto é limpo no {@code finally}, mesmo com exceção.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final Autenticador autenticador;
    private final UsuarioRepository usuarioRepository;

    private final PermissoesDoUsuario permissoes;
    private final AcessoPorDireitos direitos;

    public JwtAuthenticationFilter(Autenticador autenticador, UsuarioRepository usuarioRepository, PermissoesDoUsuario permissoes,
                                   AcessoPorDireitos acesso) {
        this.permissoes=permissoes;
        this.direitos=acesso;
        this.autenticador = autenticador;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            autenticar(request.getHeader(HttpHeaders.AUTHORIZATION));
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private void autenticar(String header) {
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return;
        }
        // Assinatura, validade e a versão das credenciais (o claim cv) são conferidas pelo módulo de autenticação.
        JwtService.Token token;
        try {
            token = autenticador.autenticar(header.substring(7).trim());
        } catch (UnauthorizedException recusado) {
            return;
        }
        UUID usuarioId;
        try {
            usuarioId = UUID.fromString(token.sujeito());
        } catch (IllegalArgumentException semUuid) {
            return;
        }
        Usuario usuario = usuarioRepository.findById(usuarioId).filter(Usuario::isAtivo).orElse(null);
        if (usuario == null) {
            return;
        }
        // Consultoria suspensa pela Central (ou sem confirmação além da tolerância): a sessão deixa de valer na hora.
        if (!direitos.liberada(usuario.getConsultoriaId())) {
            return;
        }
        TenantContext.set(usuario.getConsultoriaId());
        var autenticado = new UsuarioAutenticado(usuario.getId(), usuario.getConsultoriaId(),
                usuario.getPapel().name(), usuario.getAlunoId());
        var autenticacao = new UsernamePasswordAuthenticationToken(
                autenticado, null, permissoes.autoridades(usuario));
        SecurityContextHolder.getContext().setAuthentication(autenticacao);
        TenantContext.set(usuario.getConsultoriaId());
    }
}
