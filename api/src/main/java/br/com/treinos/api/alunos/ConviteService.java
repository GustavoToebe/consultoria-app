package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.ConvitePublico;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.auth.RegrasSenha;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * Convite do aluno: código de 10 caracteres sem letras ambíguas, válido por 7 dias, de uso único. O
 * banco guarda só o SHA-256; o código aparece uma vez, na resposta de quem gerou. Gerar outro invalida o anterior.
 * Os métodos públicos rodam com a consultoria do convite já no {@code TenantContext} ({@link ConvitePublicoService}).
 */
@Service
public class ConviteService {

    static final String ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    static final int TAMANHO = 10;
    private static final Duration VALIDADE = Duration.ofDays(7);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final MarcaService marcas;
    private final String appUrl;

    public ConviteService(AlunoRepository alunos, UsuarioRepository usuarios, PasswordEncoder passwordEncoder,
                          MarcaService marcas, @Value("${treinos.app-url}") String appUrl) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.marcas = marcas;
        this.appUrl = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_CONVIDADO",entidade="ALUNO",resumo="Gerou um convite de aluno.")
    public ConviteResponse gerar(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId)
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (!aluno.isAtivo()) {
            throw new ConflitoException("Aluno inativo. Reative para convidar.", "ALUNO_INATIVO");
        }
        if (aluno.getUsuarioId() != null) {
            throw new ConflitoException("Este aluno já tem acesso.", "ALUNO_COM_ACESSO");
        }
        String codigo = novoCodigo();
        Instant expiraEm = Instant.now().plus(VALIDADE);
        aluno.novoConvite(hash(codigo), expiraEm);
        alunos.saveAndFlush(aluno);
        return new ConviteResponse(codigo, appUrl + "/convite?codigo=" + URLEncoder.encode(codigo, StandardCharsets.UTF_8),
                expiraEm);
    }

    @Transactional(readOnly = true)
    public ConvitePublico ler(String conviteHash) {
        Aluno aluno = alunos.buscarPorConvite(conviteHash).filter(ConviteService::utilizavel)
                .orElseThrow(ConviteService::invalido);
        return new ConvitePublico(marcas.marca(aluno.getConsultoriaId()), primeiroNome(aluno.getNome()));
    }

    /** Cria o usuário ALUNO e consome o convite na mesma transação, com o aluno travado (uso único). */
    @Transactional
    public Usuario aceitar(String conviteHash, String email, String senha) {
        Aluno aluno = alunos.buscarPorConviteParaAlterar(conviteHash).filter(ConviteService::utilizavel)
                .orElseThrow(ConviteService::invalido);
        String normalizado = Emails.normalizar(email);
        RegrasSenha.validar(senha, normalizado);
        if (usuarios.existeEmail(normalizado)) {
            throw emailEmUso();
        }
        Usuario usuario;
        try {
            usuario = usuarios.saveAndFlush(Usuario.aluno(aluno.getConsultoriaId(), aluno.getId(), normalizado,
                    aluno.getNome(), passwordEncoder.encode(senha)));
        } catch (DataIntegrityViolationException corrida) {
            throw emailEmUso();
        }
        aluno.ligarUsuario(usuario.getId());
        alunos.saveAndFlush(aluno);
        return usuario;
    }

    public static String hash(String codigo) {
        return OpaqueTokenGenerator.hash(codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT));
    }

    private static boolean utilizavel(Aluno a) {
        return a.isAtivo() && a.getUsuarioId() == null && a.getConviteExpiraEm() != null
                && a.getConviteExpiraEm().isAfter(Instant.now());
    }

    private static String novoCodigo() {
        StringBuilder codigo = new StringBuilder(TAMANHO);
        for (int i = 0; i < TAMANHO; i++) {
            codigo.append(ALFABETO.charAt(RANDOM.nextInt(ALFABETO.length())));
        }
        return codigo.toString();
    }

    private static String primeiroNome(String nome) {
        String limpo = nome.trim();
        int espaco = limpo.indexOf(' ');
        return espaco < 0 ? limpo : limpo.substring(0, espaco);
    }

    /** Inválido, expirado ou já usado: sempre o mesmo 404, sem dizer qual. */
    static NaoEncontradoException invalido() {
        return new NaoEncontradoException("Convite inválido ou expirado. Peça um novo ao seu treinador.");
    }

    private static ConflitoException emailEmUso() {
        return new ConflitoException("Este e-mail já tem uma conta.", "EMAIL_EM_USO");
    }
}
