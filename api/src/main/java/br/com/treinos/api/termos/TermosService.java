package br.com.treinos.api.termos;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Aceite do termo de uso e do aviso de privacidade: vale para treinador e aluno, e a versão nova pede novo aceite. */
@Service
public class TermosService {

    /**
     * {@code aceitoEm}: quando este usuário aceitou a versão vigente (nulo = ainda não aceitou). {@code notasInternas}: as
     * notas para a revisão do advogado, só para a equipe; o aluno recebe a lista vazia (e o texto nunca as traz).
     */
    public record Resposta(String versao, boolean rascunho, boolean aceito, Instant aceitoEm, List<Termos.Documento> documentos,
                           List<Termos.NotaInterna> notasInternas) { }

    private final AceiteTermoRepository aceites;
    private final UsuarioRepository usuarios;
    private final Auditoria auditoria;
    private final ConsultoriaRepository consultorias;

    public TermosService(AceiteTermoRepository aceites, UsuarioRepository usuarios, Auditoria auditoria,
                         ConsultoriaRepository consultorias) {
        this.aceites = aceites;
        this.usuarios = usuarios;
        this.auditoria = auditoria;
        this.consultorias = consultorias;
    }

    /** O contato do termo é o da consultoria da sessão (do {@code TenantContext}, nunca do cliente). */
    @Transactional(readOnly = true)
    public Resposta consultar(UUID usuarioId, boolean equipe) {
        String contato = consultorias.findById(TenantContext.get())
                .map(c -> ContatoDosTermos.montar(c.getNome(), c.getWhatsapp(), c.getEmailResponderPara()))
                .orElseGet(() -> ContatoDosTermos.montar(null, null, null));
        Instant aceitoEm = aceites.aceitoEm(usuarioId, Termos.VERSAO).orElse(null);
        return new Resposta(Termos.VERSAO, Termos.RASCUNHO, aceitoEm != null, aceitoEm, Termos.documentos(contato),
                equipe ? Termos.notasInternas() : List.of());
    }

    @Transactional(readOnly = true)
    public boolean pendente(UUID usuarioId) {
        return !aceites.existsByUsuarioIdAndVersao(usuarioId, Termos.VERSAO);
    }

    /** Idempotente: aceitar de novo a mesma versão responde igual e não grava outra linha. */
    @Transactional
    public Resposta aceitar(UUID usuarioId, boolean equipe, String versao) {
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
        return consultar(usuarioId, equipe);
    }
}
