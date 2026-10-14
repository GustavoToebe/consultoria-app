package br.com.treinos.api.termos;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Aceite do termo de uso e do aviso de privacidade: vale para treinador e aluno, e a versão nova pede novo aceite. */
@Service
public class TermosService {

    public record Resposta(String versao, boolean rascunho, boolean aceito, List<Termos.Documento> documentos) { }

    private final AceiteTermoRepository aceites;
    private final UsuarioRepository usuarios;
    private final Auditoria auditoria;

    public TermosService(AceiteTermoRepository aceites, UsuarioRepository usuarios, Auditoria auditoria) {
        this.aceites = aceites;
        this.usuarios = usuarios;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public Resposta consultar(UUID usuarioId) {
        return new Resposta(Termos.VERSAO, Termos.RASCUNHO, !pendente(usuarioId), Termos.documentos());
    }

    @Transactional(readOnly = true)
    public boolean pendente(UUID usuarioId) {
        return !aceites.existsByUsuarioIdAndVersao(usuarioId, Termos.VERSAO);
    }

    /** Idempotente: aceitar de novo a mesma versão responde igual e não grava outra linha. */
    @Transactional
    public Resposta aceitar(UUID usuarioId, String versao) {
        if (!Termos.VERSAO.equals(versao)) {
            throw new ConflictException("Os termos foram atualizados. Leia a versão nova antes de aceitar.",
                    "TERMOS_DESATUALIZADOS");
        }
        // Trava a linha do usuário: dois toques seguidos em "Li e aceito" ficam em série.
        if (usuarios.buscarParaAlterar(usuarioId).isEmpty()) {
            throw new NaoEncontradoException("Usuário não encontrado.");
        }
        if (pendente(usuarioId)) {
            aceites.saveAndFlush(new AceiteTermo(usuarioId, Termos.VERSAO));
            auditoria.registrarEvento("TERMOS_ACEITOS", "USUARIO", usuarioId,
                    "Aceitou o termo de uso e o aviso de privacidade.");
        }
        return consultar(usuarioId);
    }
}
