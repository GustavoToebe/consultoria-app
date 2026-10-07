package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.ConvitePublico;
import br.com.treinos.api.auth.AuthService;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Rotas públicas do convite. Sem transação aqui: primeiro descobre a consultoria do convite ({@link ConviteBusca}),
 * depois roda a leitura ou o aceite com ela no {@link TenantContext} (a transação abre dentro do bloco, então o
 * Hibernate já filtra pela consultoria certa). A sessão do aluno é emitida no fim.
 */
@Service
public class ConvitePublicoService {

    private final ConviteBusca busca;
    private final ConviteService convites;
    private final AuthService authService;

    public ConvitePublicoService(ConviteBusca busca, ConviteService convites, AuthService authService) {
        this.busca = busca;
        this.convites = convites;
        this.authService = authService;
    }

    public ConvitePublico consultar(String codigo) {
        String hash = ConviteService.hash(codigo);
        UUID consultoriaId = busca.consultoriaDoConvite(hash).orElseThrow(ConviteService::invalido);
        return TenantContext.executarComo(consultoriaId, () -> convites.ler(hash));
    }

    public AuthService.Sessao aceitar(String codigo, String email, String senha, DestinoCliente cliente) {
        String hash = ConviteService.hash(codigo);
        UUID consultoriaId = busca.consultoriaDoConvite(hash).orElseThrow(ConviteService::invalido);
        Usuario usuario = TenantContext.executarComo(consultoriaId, () -> convites.aceitar(hash, email, senha));
        return authService.sessaoNova(usuario, cliente);
    }
}
