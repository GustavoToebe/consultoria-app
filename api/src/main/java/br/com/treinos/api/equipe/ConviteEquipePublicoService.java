package br.com.treinos.api.equipe;
import br.com.treinos.api.auth.AuthService;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;
@Service
public class ConviteEquipePublicoService {
    private final ConviteEquipeBusca busca;
    private final EquipeService equipe;
    private final AuthService auth;
    public ConviteEquipePublicoService(ConviteEquipeBusca busca,EquipeService equipe,AuthService auth) { this.busca=busca;this.equipe=equipe;this.auth=auth; }
    public AuthService.Sessao aceitar(String codigo,String senha,DestinoCliente cliente) {
        if(codigo==null || !codigo.matches("[A-Za-z0-9_-]{43}")) throw EquipeService.conviteInvalido();
        String hash=OpaqueTokenGenerator.hash(codigo);var cid=busca.consultoria(hash).orElseThrow(EquipeService::conviteInvalido);
        var usuario=TenantContext.executarComo(cid,() -> equipe.aceitar(hash,senha));
        return auth.sessaoNova(usuario,cliente);
    }
}
