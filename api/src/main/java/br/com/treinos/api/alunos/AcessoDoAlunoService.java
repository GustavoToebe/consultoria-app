package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.Autenticador;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.EmailDeAcessoAlteradoResponse;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.RegrasSenha;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.pagamentos.PagamentosDoAluno;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final TransactionTemplate transacao;
    private final PagamentosDoAluno pagamentos;

    public AcessoDoAlunoService(AlunoRepository alunos, UsuarioRepository usuarios, AlunoService alunoService,
                                PasswordEncoder passwordEncoder, Autenticador autenticador, br.com.treinos.api.push.PushService push,
                                Auditoria auditoria, AvisoDeTrocaDeEmailDeAcesso aviso,
                                PlatformTransactionManager transacoes, PagamentosDoAluno pagamentos) {
        this.transacao = new TransactionTemplate(transacoes);
        this.pagamentos = pagamentos;
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
        // Só o MANUAL bloqueia: na pausa por atraso o login segue valendo, e trocar a senha não a desfaz.
        if (aluno.getAcessoDesativadoMotivo() == MotivoDoAcessoDesativado.MANUAL) {
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
    static final String RESUMO_PAUSADO = "Pausou o acesso do aluno por atraso.";
    /** O 403 único do acesso do aluno: não diz o porquê, para não revelar a pausa por atraso a quem não vê o Financeiro. */
    static final String MENSAGEM_SEM_PERMISSAO = "Sem permissão para alterar o acesso deste aluno";
    static final String CODIGO_JA_DESATIVADO = "ACESSO_JA_DESATIVADO";
    static final String MENSAGEM_JA_DESATIVADO = "O acesso deste aluno foi desativado pela equipe. Só \"Reativar acesso\", em Acesso ao app, o libera.";

    /**
     * Troca só o e-mail de login (o {@code aluno.email} do cadastro não muda, como em {@link #definir}). O mesmo e-mail é um
     * 200 sem gravar nem auditar. Sobe {@code cv}, apaga o push e encerra as sessões por último. Não é transacional na ponta:
     * a troca commita primeiro e só então saem os avisos aos dois endereços ({@link AvisoDeTrocaDeEmailDeAcesso}), sem desfazer
     * a troca se o envio falhar. {@code emailEnviado} = o aviso ao e-mail NOVO foi entregue ao provedor.
     */
    public EmailDeAcessoAlteradoResponse alterarEmail(UUID alunoId, String email) {
        Troca troca = transacao.execute(status -> trocarEmail(alunoId, email));
        boolean enviado = troca.aviso() != null && aviso.enviar(troca.aviso());
        return new EmailDeAcessoAlteradoResponse(troca.detalhe(), enviado);
    }

    private record Troca(AlunoDetalhe detalhe, AvisoDeTrocaDeEmailDeAcesso.Preparado aviso) {
    }

    private Troca trocarEmail(UUID alunoId, String email) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative para trocar o e-mail de acesso.", "ALUNO_INATIVO");
        }
        Usuario usuario = usuarioDe(aluno);
        String novo = Emails.normalizar(email);
        String anterior = Emails.normalizar(usuario.getEmail());
        if (novo.equals(anterior)) {
            return new Troca(alunoService.detalheDe(aluno), null);
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
        var preparado = aviso.preparar(aluno.getConsultoriaId(), anterior, novo);
        encerrarAcesso(usuario);
        return new Troca(alunoService.detalheDe(aluno), preparado);
    }

    /**
     * Desativação manual (MANUAL): bloqueia o login ({@code usuario.ativo = false}) e encerra as sessões, sem apagar nada e
     * sem inativar o aluno. Já MANUAL = 200 sem regravar nem auditar; em pausa por atraso, troca o motivo para MANUAL, e isso
     * exige {@code FINANCEIRO_ALTERAR} (403 {@code PERMISSAO_NEGADA} neutro, antes de qualquer escrita: senão {@code ALUNO_CONVITE}
     * despausaria em duas chamadas, desativar e reativar). Ordem das travas: aluno, depois usuário (a mesma de {@link #definir}).
     */
    @Transactional
    public AlunoDetalhe desativar(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        exigirPermissaoDoAtraso(aluno.getAcessoDesativadoMotivo());
        Usuario usuario = usuarioDe(aluno);
        Instant quando = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS); // o banco guarda microssegundos: a resposta já sai igual à leitura seguinte
        if (alunos.desativarAcessoManualmente(aluno.getConsultoriaId(), aluno.getId(), quando) == 0) {
            return alunoService.detalheDe(aluno); // já MANUAL
        }
        aluno.desativarAcesso(quando, MotivoDoAcessoDesativado.MANUAL);
        usuario.alterarAtivo(false);
        usuarios.saveAndFlush(usuario);
        auditoria.registrarEvento("ALUNO_ACESSO_DESATIVADO", "ALUNO", aluno.getId(), RESUMO_DESATIVADO);
        encerrarAcesso(usuario);
        return alunoService.detalheDe(aluno);
    }

    /**
     * "Reativar acesso" do cartão Acesso ao app ({@code ALUNO_CONVITE}): limpa a desativação de qualquer motivo. Do MANUAL,
     * liga o usuário de novo; da pausa por atraso, só limpa (o usuário já estava ativo) e exige também {@code FINANCEIRO_ALTERAR}
     * (403 {@code PERMISSAO_NEGADA}, mensagem neutra). Sem desativação = 200 sem mudar.
     * Aluno inativo continua sem acesso: 409 {@code ALUNO_INATIVO}.
     */
    @Transactional
    public AlunoDetalhe reativar(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        MotivoDoAcessoDesativado motivo = aluno.getAcessoDesativadoMotivo();
        if (motivo == null) {
            return alunoService.detalheDe(aluno);
        }
        // O motivo ATRASO pode estar mascarado como MANUAL para quem não vê o Financeiro: a pausa só sai com a permissão dele,
        // e a mensagem não diz o porquê (não revela a inadimplência).
        exigirPermissaoDoAtraso(motivo);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative o aluno antes de reativar o acesso.", "ALUNO_INATIVO");
        }
        Usuario usuario = motivo == MotivoDoAcessoDesativado.MANUAL ? usuarioDe(aluno) : null;
        alunos.limparAcessoDesativado(aluno.getConsultoriaId(), aluno.getId());
        aluno.reativarAcesso();
        if (usuario != null) {
            usuario.alterarAtivo(true);
            usuarios.saveAndFlush(usuario);
        }
        auditoria.registrarEvento("ALUNO_ACESSO_REATIVADO", "ALUNO", aluno.getId(), RESUMO_REATIVADO);
        return alunoService.detalheDe(aluno);
    }

    /**
     * Pausa por atraso (ATRASO; decisão manual do treinador, nunca automática, {@code FINANCEIRO_ALTERAR}): o aluno continua
     * entrando, mas só usa as rotas liberadas do {@code AcessoPausadoInterceptor}. Não mexe no usuário, em vaga, agenda, grupo
     * nem cobranças. Trava o aluno antes de consultar as cobranças (a ordem única aluno, contratação, cobrança). Já MANUAL =
     * 409 {@code ACESSO_JA_DESATIVADO}; já pausado = 200 sem sobrescrever a data nem auditar de novo.
     */
    @Transactional
    public AlunoDetalhe pausarPorAtraso(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo não pode ter o acesso pausado.", "ALUNO_INATIVO");
        }
        if (aluno.getAcessoDesativadoMotivo() == MotivoDoAcessoDesativado.MANUAL) {
            throw new ConflictException(MENSAGEM_JA_DESATIVADO, CODIGO_JA_DESATIVADO);
        }
        if (!pagamentos.temCobrancaVencida(aluno.getId())) {
            throw new ConflictException("O aluno não tem cobrança vencida em aberto para pausar o acesso.", "SEM_COBRANCA_VENCIDA");
        }
        Instant quando = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        if (alunos.pausarAcessoPorAtraso(aluno.getConsultoriaId(), aluno.getId(), quando) == 1) {
            aluno.desativarAcesso(quando, MotivoDoAcessoDesativado.ATRASO);
            auditoria.registrarEvento("ALUNO_ACESSO_PAUSADO", "ALUNO", aluno.getId(), RESUMO_PAUSADO);
        }
        return alunoService.detalheDe(aluno);
    }

    /**
     * "Reativar acesso" do Financeiro ({@code FINANCEIRO_ALTERAR}): tira só a pausa por atraso. A desativação MANUAL não sai
     * por aqui (409 {@code ACESSO_JA_DESATIVADO}): é da equipe com {@code ALUNO_CONVITE}, em {@link #reativar}. Sem pausa = 200.
     */
    @Transactional
    public AlunoDetalhe reativarPausadoPorAtraso(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo não pode ter o acesso reativado por aqui.", "ALUNO_INATIVO");
        }
        if (aluno.getAcessoDesativadoMotivo() == MotivoDoAcessoDesativado.MANUAL) {
            throw new ConflictException(MENSAGEM_JA_DESATIVADO, CODIGO_JA_DESATIVADO);
        }
        if (alunos.reativarAcessoPausadoPorAtraso(aluno.getConsultoriaId(), aluno.getId()) == 1) {
            aluno.reativarAcesso();
            auditoria.registrarEvento("ALUNO_ACESSO_REATIVADO", "ALUNO", aluno.getId(), RESUMO_REATIVADO);
        }
        return alunoService.detalheDe(aluno);
    }

    /** Reativar ou converter em MANUAL o motivo ATRASO é do Financeiro; a mensagem não diz o porquê. */
    private static void exigirPermissaoDoAtraso(MotivoDoAcessoDesativado motivo) {
        if (motivo == MotivoDoAcessoDesativado.ATRASO && !br.com.treinos.api.equipe.AcessoAtual.pode("FINANCEIRO_ALTERAR")) {
            throw new br.com.plataforma.comum.web.ForbiddenException(MENSAGEM_SEM_PERMISSAO, "PERMISSAO_NEGADA");
        }
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
