package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.Autenticador;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.RegrasSenha;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Acesso definido pelo treinador: e-mail de login e uma senha <b>provisória</b>, que o aluno troca no primeiro login
 * (o treinador nunca fica sabendo a senha definitiva). Sem conta, cria o usuário e consome o convite pendente; com conta,
 * troca a senha (e o e-mail, se mudou) e derruba as sessões abertas. O e-mail do cadastro ({@code aluno.email}) não muda:
 * login e cadastro continuam separados.
 */
@Service
public class AcessoDoAlunoService {

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final AlunoService alunoService;
    private final PasswordEncoder passwordEncoder;
    private final Autenticador autenticador;
    private final br.com.treinos.api.push.PushService push;
    private final Auditoria auditoria;
    private final AvisoDeTrocaDeEmailDeAcesso aviso;

    public AcessoDoAlunoService(AlunoRepository alunos, UsuarioRepository usuarios, AlunoService alunoService,
                                PasswordEncoder passwordEncoder, Autenticador autenticador, br.com.treinos.api.push.PushService push,
                                Auditoria auditoria, AvisoDeTrocaDeEmailDeAcesso aviso) {
        this.auditoria = auditoria;
        this.aviso = aviso;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.alunoService = alunoService;
        this.passwordEncoder = passwordEncoder;
        this.autenticador = autenticador;
        this.push = push;
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao = "ALUNO_ACESSO_DEFINIDO", entidade = "ALUNO",
            resumo = "Definiu o acesso do aluno com senha provisória.")
    public AlunoDetalhe definir(UUID alunoId, String email, String senha) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId)
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative para dar acesso.", "ALUNO_INATIVO");
        }
        if (aluno.getAcessoDesativadoEm() != null) {
            throw new ConflictException("Reative o acesso antes.", "ACESSO_DESATIVADO");
        }
        String normalizado = Emails.normalizar(email);
        RegrasSenha.validar(senha, normalizado);
        String hash = passwordEncoder.encode(senha);
        if (aluno.getUsuarioId() == null) {
            criarUsuario(aluno, normalizado, hash);
        } else {
            trocarAcesso(aluno.getUsuarioId(), normalizado, hash);
        }
        return alunoService.detalheDe(aluno);
    }

    /** Resumos fixos da auditoria: nunca e-mail, nome nem motivo. */
    static final String RESUMO_EMAIL = "Alterou o e-mail de acesso do aluno.";
    static final String RESUMO_DESATIVADO = "Desativou o acesso do aluno ao app.";
    static final String RESUMO_REATIVADO = "Reativou o acesso do aluno ao app.";

    /**
     * Troca só o e-mail de login (o {@code aluno.email} do cadastro não muda, como em {@link #definir}). O mesmo e-mail é um
     * 200 sem gravar nem auditar. Sobe {@code cv}, apaga o push e encerra as sessões por último. Os avisos aos dois endereços
     * saem depois do commit ({@link AvisoDeTrocaDeEmailDeAcesso}).
     */
    @Transactional
    public AlunoDetalhe alterarEmail(UUID alunoId, String email) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative para trocar o e-mail de acesso.", "ALUNO_INATIVO");
        }
        Usuario usuario = usuarioDe(aluno);
        String novo = Emails.normalizar(email);
        String anterior = Emails.normalizar(usuario.getEmail());
        if (novo.equals(anterior)) {
            return alunoService.detalheDe(aluno);
        }
        if (usuarios.existeEmail(novo)) {
            throw emailEmUso();
        }
        usuario.alterarEmail(novo);
        try {
            usuarios.saveAndFlush(usuario);
        } catch (DataIntegrityViolationException corrida) {
            throw emailEmUso();
        }
        auditoria.registrarEvento("ALUNO_EMAIL_DE_ACESSO_ALTERADO", "ALUNO", aluno.getId(), RESUMO_EMAIL);
        aviso.agendar(aluno.getConsultoriaId(), anterior, novo);
        encerrarAcesso(usuario);
        return alunoService.detalheDe(aluno);
    }

    /** Idempotente: já desativado = 200 sem regravar nem auditar. Nada é apagado; o aluno continua ativo. */
    @Transactional
    public AlunoDetalhe desativar(UUID alunoId, MotivoDoAcessoDesativado motivo) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        Usuario usuario = usuarioDe(aluno);
        if (aluno.getAcessoDesativadoEm() != null) {
            return alunoService.detalheDe(aluno);
        }
        aluno.desativarAcesso(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS), motivo); // o banco guarda microssegundos: a resposta já sai igual à leitura seguinte
        alunos.saveAndFlush(aluno);
        usuario.alterarAtivo(false);
        usuarios.saveAndFlush(usuario);
        auditoria.registrarEvento("ALUNO_ACESSO_DESATIVADO", "ALUNO", aluno.getId(), RESUMO_DESATIVADO);
        encerrarAcesso(usuario);
        return alunoService.detalheDe(aluno);
    }

    /** Só se estava desativado (senão 200 sem mudar). Aluno inativo continua sem acesso: 409 {@code ALUNO_INATIVO}. */
    @Transactional
    public AlunoDetalhe reativar(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (aluno.getAcessoDesativadoEm() == null) {
            return alunoService.detalheDe(aluno);
        }
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative o aluno antes de reativar o acesso.", "ALUNO_INATIVO");
        }
        Usuario usuario = usuarioDe(aluno);
        aluno.reativarAcesso();
        alunos.saveAndFlush(aluno);
        usuario.alterarAtivo(true);
        usuarios.saveAndFlush(usuario);
        auditoria.registrarEvento("ALUNO_ACESSO_REATIVADO", "ALUNO", aluno.getId(), RESUMO_REATIVADO);
        return alunoService.detalheDe(aluno);
    }

    /** O usuário travado do aluno; sem ele não há acesso a trocar nem desativar (409 {@code ALUNO_SEM_ACESSO}). */
    private Usuario usuarioDe(Aluno aluno) {
        if (aluno.getUsuarioId() == null) {
            throw new ConflictException("Este aluno ainda não tem acesso ao app.", "ALUNO_SEM_ACESSO");
        }
        return usuarios.buscarParaAlterar(aluno.getUsuarioId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
    }

    /** Por último: a revogação das sessões não volta atrás se algo depois falhar. O push do aparelho antigo cai junto. */
    private void encerrarAcesso(Usuario usuario) {
        push.apagarDoUsuario(usuario.getConsultoriaId(), usuario.getId());
        autenticador.encerrarSessoes(usuario.getId().toString());
    }

    private void criarUsuario(Aluno aluno, String email, String hash) {
        if (usuarios.existeEmail(email)) {
            throw emailEmUso();
        }
        Usuario usuario = Usuario.aluno(aluno.getConsultoriaId(), aluno.getId(), email, aluno.getNome(), hash);
        usuario.definirSenhaProvisoria(hash);
        usuario.alterarTelefone(aluno.tirarTelefoneSemAcesso()); // o telefone guardado no cadastro passa ao usuário
        try {
            usuario = usuarios.saveAndFlush(usuario);
        } catch (DataIntegrityViolationException corrida) {
            throw emailEmUso();
        }
        aluno.ligarUsuario(usuario.getId()); // também consome o convite pendente: o link antigo deixa de valer
        alunos.saveAndFlush(aluno);
    }

    private void trocarAcesso(UUID usuarioId, String email, String hash) {
        Usuario usuario = usuarios.buscarParaAlterar(usuarioId)
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (!email.equals(Emails.normalizar(usuario.getEmail()))) {
            if (usuarios.existeEmail(email)) {
                throw emailEmUso();
            }
            usuario.alterarEmail(email);
        }
        usuario.definirSenhaProvisoria(hash);
        try {
            usuarios.saveAndFlush(usuario);
        } catch (DataIntegrityViolationException corrida) {
            throw emailEmUso();
        }
        // Por último: a revogação das sessões não volta atrás se algo depois falhar. O push do aparelho antigo cai junto.
        push.apagarDoUsuario(usuario.getConsultoriaId(), usuarioId);
        autenticador.encerrarSessoes(usuarioId.toString());
    }

    private static ConflictException emailEmUso() {
        return new ConflictException("Este e-mail já tem uma conta.", "EMAIL_EM_USO");
    }
}
