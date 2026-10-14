package br.com.treinos.api.auth;

import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.MuitasRequisicoesException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;

/**
 * Limita tentativas antes do BCrypt, com o desenho da Central ({@code docs/login-limites.md} de lá): janela fixa de
 * 600 s, contador no banco, chave = SHA-256 com sal derivado do segredo JWT. Login conta por IP (60) e por conta
 * (10); cadastro de treinador e convite público por IP; refresh por IP com limite maior (120). Cada ação tem prefixo
 * próprio, então uma não consome o limite da outra.
 *
 * <p>Compromisso conhecido (o mesmo da Central): quem erra 10 vezes a senha de outra pessoa bloqueia a conta dela
 * pela janela.</p>
 */
@Component
public class LimiteTentativas {

    private final ContadorBanco contador;
    private final Limites limites;
    private final long janelaMs;
    private final Clock clock;
    private final String sal;

    LimiteTentativas(ContadorBanco contador,
                     @Value("${treinos.limites.login-ip:60}") int loginIp,
                     @Value("${treinos.limites.login-conta:10}") int loginConta,
                     @Value("${treinos.limites.cadastro-ip:10}") int cadastroIp,
                     @Value("${treinos.limites.convite-ip:30}") int conviteIp,
                     @Value("${treinos.limites.refresh-ip:120}") int refreshIp,
                     @Value("${treinos.limites.janela-segundos:600}") long janelaSegundos,
                     @Value("${treinos.security.jwt.secret:}") String segredo) {
        this.limites = new Limites(loginIp, loginConta, cadastroIp, conviteIp, refreshIp);
        if (loginIp < 1 || loginConta < 1 || cadastroIp < 1 || conviteIp < 1 || refreshIp < 1
                || janelaSegundos < 1 || janelaSegundos > 86400) {
            throw new IllegalArgumentException("Limites de tentativas inválidos.");
        }
        this.contador = contador;
        this.janelaMs = janelaSegundos * 1000;
        this.clock = Clock.systemUTC();
        this.sal = "limite-tentativas:" + segredo;
    }

    public void login(String ip, String email) {
        long agora = clock.millis();
        var porIp = contador.tentar(chave("login-ip", ip), agora, janelaMs);
        var porConta = contador.tentar(chave("login-conta", Emails.normalizar(email)), agora, janelaMs);
        boolean bloqueiaIp = porIp.tentativas() > limites.loginIp();
        boolean bloqueiaConta = porConta.tentativas() > limites.loginConta();
        if (bloqueiaIp || bloqueiaConta) {
            long ate = Math.max(bloqueiaIp ? porIp.ateMs() : agora, bloqueiaConta ? porConta.ateMs() : agora);
            // Só a tentativa que cruza o limite abre o bloqueio (e vira auditoria); as demais da janela só recebem 429.
            boolean abriu = (bloqueiaIp && porIp.tentativas() == limites.loginIp() + 1)
                    || (bloqueiaConta && porConta.tentativas() == limites.loginConta() + 1);
            throw new BloqueioDeLogin(segundosAte(ate, agora), abriu);
        }
    }

    /** Apaga o contador de login do e-mail (anonimização do aluno): a chave é só um hash, mas é derivada do e-mail antigo. */
    public void esquecerConta(String email) {
        contador.apagar(chave("login-conta", Emails.normalizar(email)));
    }

    /** Login bloqueado; {@code abriuAgora} é verdadeiro uma única vez por chave e janela. */
    public static class BloqueioDeLogin extends MuitasRequisicoesException {
        private final boolean abriuAgora;

        BloqueioDeLogin(long segundos, boolean abriuAgora) {
            super(segundos);
            this.abriuAgora = abriuAgora;
        }

        public boolean abriuAgora() {
            return abriuAgora;
        }
    }

    public void cadastro(String ip) {
        porIp("cadastro-ip", ip, limites.cadastroIp());
    }

    public void convite(String ip) {
        porIp("convite-ip", ip, limites.conviteIp());
    }

    public void refresh(String ip) {
        porIp("refresh-ip", ip, limites.refreshIp());
    }

    private void porIp(String acao, String ip, int limite) {
        long agora = clock.millis();
        var estado = contador.tentar(chave(acao, ip), agora, janelaMs);
        if (estado.tentativas() > limite) {
            throw new MuitasRequisicoesException(segundosAte(estado.ateMs(), agora));
        }
    }

    private static long segundosAte(long ateMs, long agoraMs) {
        return Math.max(1, (ateMs - agoraMs + 999) / 1000);
    }

    private String chave(String tipo, String valor) {
        String texto = sal + ":" + tipo + ":" + (valor == null || valor.isBlank() ? "desconhecido" : valor);
        try {
            return tipo + ":" + HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }

    private record Limites(int loginIp, int loginConta, int cadastroIp, int conviteIp, int refreshIp) {
    }
}
