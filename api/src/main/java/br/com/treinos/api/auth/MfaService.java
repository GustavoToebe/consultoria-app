package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.Mfa;
import br.com.plataforma.comum.auth.MfaException;
import br.com.plataforma.comum.seguranca.login.LimiteLogin;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.dto.MfaDtos.Preparacao;
import br.com.treinos.api.web.Emails;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Ativação, desativação e estado do segundo fator do treinador. O TOTP, os códigos de recuperação e a cifra dos segredos são do
 * {@link Mfa} da plataforma; aqui ficam a conferência da senha atual, a trava da linha do usuário (a mesma da troca de senha),
 * a subida da versão das credenciais (os tokens de acesso antigos deixam de valer) e a auditoria. Ativar e desativar devolvem
 * uma sessão nova, como a troca de senha: as demais caem e esta continua aberta.
 */
@Service
public class MfaService {

    private static final String EMISSOR = "Treinos";

    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final Mfa mfa;
    private final LimiteLogin limite;
    private final AuthService authService;
    private final Auditoria auditoria;
    private final TransactionTemplate transacao;

    public MfaService(UsuarioRepository usuarios, PasswordEncoder senhas, Mfa mfa, LimiteLogin limite,
                      AuthService authService, Auditoria auditoria, PlatformTransactionManager transacoes) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.mfa = mfa;
        this.limite = limite;
        this.authService = authService;
        this.auditoria = auditoria;
        this.transacao = new TransactionTemplate(transacoes);
    }

    /**
     * Cada tentativa de ativar, desativar ou preparar passa pelo mesmo limite do login (IP e conta): sem isso o código de
     * 6 dígitos poderia ser adivinhado por quem já tem a sessão. Lança {@code LimiteLoginException} (429).
     */
    public void limitar(UUID usuarioId, String ip) {
        String email = usuarios.findById(usuarioId).map(u -> Emails.normalizar(u.getEmail())).orElse(null);
        limite.registrar(ip, email);
    }

    public Mfa.Status status(UUID usuarioId) {
        return mfa.status(usuarioId.toString());
    }

    public Preparacao preparar(UUID usuarioId, String senha) {
        Usuario usuario = transacao.execute(status -> conferirSenha(usuarioId, senha));
        Mfa.Preparacao preparacao = mfa.preparar(usuarioId.toString());
        transacao.executeWithoutResult(status -> auditoria.registrarEvento("MFA_PREPARADO", "USUARIO", usuarioId,
                "Começou a configurar a verificação em duas etapas."));
        return new Preparacao(preparacao.segredo(), preparacao.expiraEm(), uri(usuario.getEmail(), preparacao.segredo()));
    }

    /** @return os códigos de recuperação (mostrados uma vez) e a sessão nova */
    public Ativacao ativar(UUID usuarioId, String senha, String codigo, String ip) {
        AtomicReference<List<String>> codigos = new AtomicReference<>();
        long versao = transacao.execute(status -> {
            Usuario usuario = conferirSenha(usuarioId, senha);
            codigos.set(mfa.ativar(usuarioId.toString(), codigo).codigos());
            usuario.subirVersaoDeCredenciais();
            usuarios.saveAndFlush(usuario);
            auditoria.registrarEvento("MFA_ATIVADO", "USUARIO", usuarioId, "Ativou a verificação em duas etapas.");
            return usuario.getCredenciaisVersao();
        });
        return new Ativacao(codigos.get(), authService.reabrirSessao(usuarioId, versao, ip));
    }

    public AuthService.Sessao desativar(UUID usuarioId, String senha, String codigo, String ip) {
        long versao = transacao.execute(status -> {
            Usuario usuario = conferirSenha(usuarioId, senha);
            mfa.desativar(usuarioId.toString(), codigo);
            usuario.subirVersaoDeCredenciais();
            usuarios.saveAndFlush(usuario);
            auditoria.registrarEvento("MFA_DESATIVADO", "USUARIO", usuarioId, "Desativou a verificação em duas etapas.");
            return usuario.getCredenciaisVersao();
        });
        return authService.reabrirSessao(usuarioId, versao, ip);
    }

    private Usuario conferirSenha(UUID usuarioId, String senha) {
        Usuario usuario = usuarios.buscarParaAlterar(usuarioId).filter(Usuario::isAtivo)
                .orElseThrow(() -> new UnauthorizedException("Sessão inválida. Entre de novo."));
        if (!senhas.matches(senha, usuario.getSenhaHash())) {
            throw new MfaException(HttpStatus.BAD_REQUEST, "A senha atual não confere.", "MFA_SENHA_INVALIDA");
        }
        return usuario;
    }

    /** Link {@code otpauth://} para abrir direto no aplicativo autenticador (no celular não dá para ler o próprio QR). */
    static String uri(String email, String segredo) {
        return UriComponentsBuilder.newInstance().scheme("otpauth").host("totp")
                .path("/" + EMISSOR + ":" + email)
                .queryParam("secret", segredo).queryParam("issuer", EMISSOR).queryParam("digits", 6).queryParam("period", 30)
                .encode().build().toUriString();
    }

    public record Ativacao(List<String> codigosDeRecuperacao, AuthService.Sessao sessao) {
        @Override
        public String toString() {
            return "Ativacao[***]";
        }
    }
}
