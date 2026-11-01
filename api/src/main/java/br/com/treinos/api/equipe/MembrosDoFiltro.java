package br.com.treinos.api.equipe;

import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Confere os membros escolhidos num filtro de lista (responsável, pessoa da auditoria): cada id tem de ser um membro da
 * equipe (papel {@code TREINADOR}, ativo ou não) da consultoria da sessão, senão 404, como o filtro de responsável do
 * {@code GET /alunos}. {@code Usuario} é global: a consultoria é conferida à mão. Uma consulta só para todos os ids.
 */
@Component
public class MembrosDoFiltro {

    private final UsuarioRepository usuarios;

    public MembrosDoFiltro(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    public void exigir(Collection<UUID> ids) {
        exigir(ids, "Responsável não encontrado.");
    }

    public void exigir(Collection<UUID> ids, String mensagem) {
        conferir(ids, mensagem, true);
    }

    /** Qualquer usuário da consultoria (membro ou aluno): o autor de um evento da auditoria pode ser o próprio aluno. */
    public void exigirDaConsultoria(Collection<UUID> ids, String mensagem) {
        conferir(ids, mensagem, false);
    }

    private void conferir(Collection<UUID> ids, String mensagem, boolean soEquipe) {
        if (ids == null || ids.isEmpty()) return;
        UUID consultoria = TenantContext.get();
        Set<UUID> daEquipe = usuarios.findAllById(Set.copyOf(ids)).stream()
                .filter(u -> consultoria.equals(u.getConsultoriaId()) && (!soEquipe || u.getPapel() == Papel.TREINADOR))
                .map(br.com.treinos.api.auth.Usuario::getId)
                .collect(Collectors.toSet());
        if (!daEquipe.containsAll(ids)) throw new NaoEncontradoException(mensagem);
    }
}
