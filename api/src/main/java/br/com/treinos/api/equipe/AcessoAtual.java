package br.com.treinos.api.equipe;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import java.util.function.Supplier;

/** Só autoridades montadas pelo filtro a partir do banco. Sem usuário autenticado nada é permitido (nega por padrão). */
public final class AcessoAtual {
    private AcessoAtual() { }
    public static boolean pode(String codigo) {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        return auth!=null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PERM_"+codigo));
    }
    public static void exigir(String codigo) {
        if(!pode(codigo)) throw new AccessDeniedException("Seu perfil não permite esta ação.");
    }
    /**
     * Só para o seed de demonstração (sem HTTP): só {@code SeedDemo} e {@code SeedHistoricoDemo} podem chamar (o
     * {@code ArquiteturaTest} falha para qualquer outra classe). Concede os dados sensíveis dentro do bloco e restaura o contexto anterior
     * no fim. O principal não é um {@code UsuarioAutenticado}, então auditoria e responsável não o tratam como pessoa.
     */
    public static <T> T comoSistema(Supplier<T> acao) {
        var anterior=SecurityContextHolder.getContext();
        var contexto=SecurityContextHolder.createEmptyContext();
        contexto.setAuthentication(new UsernamePasswordAuthenticationToken("sistema",null,
                List.of(new SimpleGrantedAuthority("PERM_ALUNO_SENSIVEL_LER"),new SimpleGrantedAuthority("PERM_ALUNO_SENSIVEL_ALTERAR"))));
        SecurityContextHolder.setContext(contexto);
        try { return acao.get(); }
        finally { SecurityContextHolder.setContext(anterior); }
    }
}
