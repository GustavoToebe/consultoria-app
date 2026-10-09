package br.com.treinos.api.equipe;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;

/** Só autoridades montadas pelo filtro a partir do banco; seed interno não possui autenticação HTTP. */
public final class AcessoAtual {
    private AcessoAtual() { }
    public static boolean pode(String codigo) {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        return auth==null || auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PERM_"+codigo));
    }
    public static void exigir(String codigo) {
        if(!pode(codigo)) throw new AccessDeniedException("Seu perfil não permite esta ação.");
    }
}
