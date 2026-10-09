package br.com.treinos.api.equipe;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.Papel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Sem cache: editar permissões do perfil vale na próxima requisição, mesmo com o mesmo JWT. */
@Service
public class PermissoesDoUsuario {
    private final PerfilRepository perfis;
    public PermissoesDoUsuario(PerfilRepository perfis) { this.perfis=perfis; }
    @Transactional(readOnly=true)
    public Set<String> codigos(Usuario u) {
        if(u.getPapel()!=Papel.TREINADOR || u.getPerfilId()==null) return Set.of();
        return perfis.buscar(u.getPerfilId(),u.getConsultoriaId()).filter(Perfil::isAtivo)
                .map(p -> p.isAcessoTotal()?CatalogoPermissoes.CODIGOS:p.getPermissoes()).orElse(Set.of());
    }
    @Transactional(readOnly=true)
    public List<GrantedAuthority> autoridades(Usuario u) {
        List<GrantedAuthority> resultado=new ArrayList<>();
        resultado.add(new SimpleGrantedAuthority(u.getPapel().autoridade()));
        codigos(u).stream().sorted().forEach(c -> resultado.add(new SimpleGrantedAuthority("PERM_"+c)));
        return List.copyOf(resultado);
    }
}
