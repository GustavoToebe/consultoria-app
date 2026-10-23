package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.Autenticador;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.auth.RegrasSenha;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public AcessoDoAlunoService(AlunoRepository alunos, UsuarioRepository usuarios, AlunoService alunoService,
                                PasswordEncoder passwordEncoder, Autenticador autenticador) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.alunoService = alunoService;
        this.passwordEncoder = passwordEncoder;
        this.autenticador = autenticador;
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

    private void criarUsuario(Aluno aluno, String email, String hash) {
        if (usuarios.existeEmail(email)) {
            throw emailEmUso();
        }
        Usuario usuario = Usuario.aluno(aluno.getConsultoriaId(), aluno.getId(), email, aluno.getNome(), hash);
        usuario.definirSenhaProvisoria(hash);
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
        // Por último: a revogação das sessões não volta atrás se algo depois falhar.
        autenticador.encerrarSessoes(usuarioId.toString());
    }

    private static ConflictException emailEmUso() {
        return new ConflictException("Este e-mail já tem uma conta.", "EMAIL_EM_USO");
    }
}
