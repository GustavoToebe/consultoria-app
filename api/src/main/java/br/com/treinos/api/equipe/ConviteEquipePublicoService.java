package br.com.treinos.api.equipe;
import br.com.treinos.api.auth.AuthService;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;
@Service
public class ConviteEquipePublicoService {
    private static final String FORMATO_DO_CODIGO="[A-Za-z0-9_-]{43}";
    private final ConviteEquipeBusca busca;
    private final EquipeService equipe;
    private final AuthService auth;
    private final ReceitaService receitas;
    private final MarcaService marcas;
    public ConviteEquipePublicoService(ConviteEquipeBusca busca,EquipeService equipe,AuthService auth,ReceitaService receitas,MarcaService marcas) { this.busca=busca;this.equipe=equipe;this.auth=auth;this.receitas=receitas;this.marcas=marcas; }
    /**
     * Marca da consultoria do convite, para a tela de aceite. Código fora do formato, inexistente, vencido ou já aceito dão a
     * mesma resposta ({@link EquipeService#conviteInvalido()}): quem consulta não descobre qual dos casos é.
     */
    public EquipeDtos.ConviteEquipePublico consultar(String codigo) {
        if(codigo==null || !codigo.matches(FORMATO_DO_CODIGO)) throw EquipeService.conviteInvalido();
        var convite=busca.convite(OpaqueTokenGenerator.hash(codigo)).orElseThrow(EquipeService::conviteInvalido);
        return new EquipeDtos.ConviteEquipePublico(TenantContext.executarComo(convite.consultoriaId(),() -> marcas.marca(convite.consultoriaId())));
    }
    public AuthService.Sessao aceitar(String codigo,String senha) {
        if(codigo==null || !codigo.matches(FORMATO_DO_CODIGO)) throw EquipeService.conviteInvalido();
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
