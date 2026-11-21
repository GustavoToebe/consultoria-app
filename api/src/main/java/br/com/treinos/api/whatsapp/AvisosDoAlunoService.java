package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.whatsapp.WhatsAppDtos.AvisosDoAlunoResponse;
import br.com.treinos.api.whatsapp.WhatsAppDtos.AvisosExportados;
import br.com.treinos.api.whatsapp.WhatsAppDtos.EnvioExportado;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * O opt-in do aluno aos avisos pelo WhatsApp da consultoria (sempre o da sessão) e a exportação LGPD da escolha e do histórico.
 * Sem opt-in nada entra na fila ({@link WhatsAppRepositorio#enfileirar}). Desligar (ou anonimizar, ou excluir a conta) cancela o
 * que ainda não saiu. O telefone só é consultado para saber se existe: nunca vai a resposta, log ou auditoria.
 */
@Service
public class AvisosDoAlunoService {

    private static final String RESUMO = "Aluno alterou o recebimento dos avisos pelo WhatsApp.";
    static final String ALUNO_DESLIGOU = "OPT_IN_DESLIGADO";

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final WhatsAppConexaoRepository conexoes;
    private final WhatsAppEnvioRepository envios;
    private final WhatsAppRepositorio fila;
    private final Auditoria auditoria;

    public AvisosDoAlunoService(AlunoRepository alunos, UsuarioRepository usuarios, WhatsAppConexaoRepository conexoes,
                                WhatsAppEnvioRepository envios, WhatsAppRepositorio fila, Auditoria auditoria) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.conexoes = conexoes;
        this.envios = envios;
        this.fila = fila;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public AvisosDoAlunoResponse doAluno(UsuarioAutenticado eu) {
        Aluno aluno = alunos.findById(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        return resposta(aluno);
    }

    /**
     * Liga ou desliga só para o aluno da sessão. Mesmo valor = nada muda (a data da autorização não é regravada e não há
     * auditoria). Ligar exige a consultoria conectada (409 {@code WHATSAPP_NAO_CONECTADO}) e telefone no cadastro (409
     * {@code TELEFONE_NECESSARIO}); desligar vale sempre e cancela o que ainda não saiu.
     */
    @Transactional
    public AvisosDoAlunoResponse definir(UsuarioAutenticado eu, boolean receber) {
        Aluno aluno = alunos.buscarParaAlterar(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.isAnonimizado()) {
            throw new ConflictException("Este aluno foi anonimizado e não pode mais ser alterado.", "ALUNO_ANONIMIZADO");
        }
        boolean recebia = aluno.getWhatsappAvisosAutorizadoEm() != null;
        if (receber == recebia) {
            return resposta(aluno);
        }
        if (receber) {
            if (conexoes.findFirstBy().isEmpty()) {
                throw new ConflictException("A consultoria ainda não conectou o WhatsApp.", "WHATSAPP_NAO_CONECTADO");
            }
            if (!temTelefone(aluno)) {
                throw new ConflictException("Cadastre um telefone para receber os avisos pelo WhatsApp.", "TELEFONE_NECESSARIO");
            }
            aluno.definirWhatsappAvisosAutorizadoEm(Instant.now());
        } else {
            aluno.definirWhatsappAvisosAutorizadoEm(null);
            fila.cancelarPendentesDoAluno(consultoriaAtual(), aluno.getId(), ALUNO_DESLIGOU);
        }
        auditoria.registrarEvento("AVISOS_PELO_WHATSAPP_DO_ALUNO_ALTERADOS", "ALUNO", aluno.getId(), RESUMO);
        return resposta(aluno);
    }

    /** Exportação do aluno (LGPD): quando autorizou e o histórico dos avisos (tipo, situação, datas), sem texto, telefone ou nome. */
    @Transactional(readOnly = true)
    public AvisosExportados exportarDoAluno(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        return new AvisosExportados(aluno.getWhatsappAvisosAutorizadoEm(),
                envios.findByAlunoIdOrderByCriadoEmAscIdAsc(alunoId).stream()
                        .map(e -> new EnvioExportado(e.getTipo(), e.getSituacao().name(), e.getCriadoEm(), e.getEnviadoEm(),
                                e.getEntregueEm(), e.getLidoEm())).toList());
    }

    private AvisosDoAlunoResponse resposta(Aluno aluno) {
        return new AvisosDoAlunoResponse(aluno.getWhatsappAvisosAutorizadoEm() != null, conexoes.findFirstBy().isPresent(),
                temTelefone(aluno));
    }

    private boolean temTelefone(Aluno aluno) {
        if (aluno.getUsuarioId() == null) {
            return false;
        }
        return usuarios.findById(aluno.getUsuarioId()).map(Usuario::getTelefone)
                .flatMap(NumeroDoWhatsApp::de).isPresent();
    }

    private static UUID consultoriaAtual() {
        UUID consultoria = TenantContext.get();
        if (consultoria == null) {
            throw new IllegalStateException("Sem consultoria na requisição.");
        }
        return consultoria;
    }
}
