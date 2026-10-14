package br.com.treinos.api.equipe;
import br.com.treinos.api.auth.AuthService;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;
@Service
public class ConviteEquipePublicoService {
    private final ConviteEquipeBusca busca;
    private final EquipeService equipe;
    private final AuthService auth;
    private final ReceitaService receitas;
    public ConviteEquipePublicoService(ConviteEquipeBusca busca,EquipeService equipe,AuthService auth,ReceitaService receitas) { this.busca=busca;this.equipe=equipe;this.auth=auth;this.receitas=receitas; }
    public AuthService.Sessao aceitar(String codigo,String senha) {
        if(codigo==null || !codigo.matches("[A-Za-z0-9_-]{43}")) throw EquipeService.conviteInvalido();
        String hash=OpaqueTokenGenerator.hash(codigo);var convite=busca.convite(hash).orElseThrow(EquipeService::conviteInvalido);
        var usuario=TenantContext.executarComo(convite.consultoriaId(),() -> {
            // Convite do sistema = primeiro acesso do administrador: confere as receitas padrão antes de consumir o convite,
            // para uma falha do provisionamento se corrigir aqui (e, se falhar de novo, o convite segue valendo).
            if(convite.doSistema()) receitas.garantirPadrao();
            return equipe.aceitar(hash,senha);
        });
        return auth.sessaoNova(usuario);
    }
}
