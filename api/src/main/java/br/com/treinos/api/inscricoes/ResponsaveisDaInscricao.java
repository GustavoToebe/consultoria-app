package br.com.treinos.api.inscricoes;

import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Responsável de uma inscrição (ou o padrão do link) é membro ativo da equipe da consultoria da sessão, a mesma regra
 * do responsável do aluno. {@code Usuario} é global: aqui a consultoria é sempre conferida à mão.
 */
@Component
class ResponsaveisDaInscricao {

    private final UsuarioRepository usuarios;

    ResponsaveisDaInscricao(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    /** {@code null} continua nulo (sem responsável); outro id precisa ser membro ativo, senão 404. */
    UUID exigirValido(UUID id) {
        if (id == null) return null;
        if (!ativo(id)) throw new NaoEncontradoException("Responsável não encontrado.");
        return id;
    }

    boolean ativo(UUID id) {
        return id != null && usuarios.findById(id).filter(this::daConsultoria)
                .filter(u -> u.isAtivo() && u.getPapel() == Papel.TREINADOR).isPresent();
    }

    /** Nome de cada usuário da consultoria (para responsável, autor da nota e quem confirmou o pagamento). */
    Map<UUID, String> nomes(Collection<UUID> ids) {
        Map<UUID, String> nomes = new HashMap<>();
        var unicos = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (unicos.isEmpty()) return nomes;
        usuarios.findAllById(unicos).stream().filter(this::daConsultoria).forEach(u -> nomes.put(u.getId(), u.getNome()));
        return nomes;
    }

    private boolean daConsultoria(Usuario u) {
        return u.getConsultoriaId().equals(TenantContext.get());
    }
}
