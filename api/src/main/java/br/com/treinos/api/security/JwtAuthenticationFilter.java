package br.com.treinos.api.security;

import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoAutorizadoException;
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
import br.com.treinos.api.equipe.PermissoesDoUsuario;

/**
 * Valida o Bearer, carrega o usuário ativo com a mesma versão de credenciais e preenche o {@link TenantContext} com a
 * consultoria <b>do banco</b> (nunca do token nem do corpo). Token inválido não autentica: a rota protegida responde
 * 401. O contexto é limpo no {@code finally}, mesmo com exceção.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    private final PermissoesDoUsuario permissoes;

    public JwtAuthenticationFilter(JwtService jwtService, UsuarioRepository usuarioRepository, PermissoesDoUsuario permissoes) {
        this.permissoes=permissoes;
        this.jwtService = jwtService;
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
        JwtService.Acesso acesso;
        try {
            acesso = jwtService.validarAcesso(header.substring(7).trim());
        } catch (NaoAutorizadoException recusado) {
            return;
        }
        Usuario usuario = usuarioRepository.findById(acesso.usuarioId())
                .filter(Usuario::isAtivo)
                .filter(u -> u.getCredenciaisVersao() == acesso.credenciaisVersao())
                .orElse(null);
        if (usuario == null) {
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
