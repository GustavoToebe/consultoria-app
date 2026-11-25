package br.com.treinos.api.security;

import br.com.plataforma.comum.web.ForbiddenException;
import br.com.treinos.api.alunos.AlunoRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.regex.Pattern;

/**
 * Restringe o aluno cujo acesso foi pausado manualmente por atraso (Fase 2): ele continua entrando e mantendo sessão,
 * mas só acessa a lista fechada de rotas necessárias para consultar sua situação, aceitar termos, gerenciar conta/push
 * e regularizar o pagamento. Qualquer outra rota devolve 403 {@code ACESSO_PAUSADO_POR_ATRASO}.
 */
@Component
public class AcessoPausadoInterceptor implements HandlerInterceptor {

    public static final String CODIGO = "ACESSO_PAUSADO_POR_ATRASO";
    private static final String MENSAGEM = "Seu acesso está pausado por atraso. Regularize o pagamento para continuar.";
    private static final Pattern LINK_OU_PIX = Pattern.compile("^/aluno/financeiro/cobrancas/[^/]+/(link|pix)$");

    private final AlunoRepository alunos;

    public AcessoPausadoInterceptor(AlunoRepository alunos) {
        this.alunos = alunos;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UsuarioAutenticado eu)) {
            return true;
        }
        if (!"ALUNO".equals(eu.papel()) || eu.alunoId() == null) {
            return true;
        }
        String metodo = request.getMethod();
        String caminho = caminho(request);
        if (permitido(metodo, caminho)) {
            return true;
        }
        if (alunos.existsByIdAndAcessoPausadoEmIsNotNull(eu.alunoId())) {
            throw new ForbiddenException(MENSAGEM, CODIGO);
        }
        return true;
    }

    private static String caminho(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contexto = request.getContextPath();
        if (contexto != null && !contexto.isEmpty() && uri.startsWith(contexto)) {
            return uri.substring(contexto.length());
        }
        return uri;
    }

    static boolean permitido(String metodo, String caminho) {
        if ("GET".equals(metodo)) {
            return "/eu".equals(caminho)
                    || "/termos".equals(caminho)
                    || "/aluno/financeiro".equals(caminho)
                    || "/eu/contratacao".equals(caminho)
                    || "/aluno/contratacao".equals(caminho)
                    || "/aluno/meus-dados".equals(caminho);
        }
        if ("PUT".equals(metodo)) {
            return "/eu/senha".equals(caminho);
        }
        if ("DELETE".equals(metodo)) {
            return "/aluno/push-token".equals(caminho);
        }
        if ("POST".equals(metodo)) {
            return "/termos/aceite".equals(caminho)
                    || "/aluno/conta/excluir".equals(caminho)
                    || "/aluno/financeiro/retorno-pagamento".equals(caminho)
                    || LINK_OU_PIX.matcher(caminho).matches();
        }
        return false;
    }
}
