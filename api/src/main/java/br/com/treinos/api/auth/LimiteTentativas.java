package br.com.treinos.api.auth;

import br.com.treinos.api.web.MuitasRequisicoesException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;

/**
 * Limita as tentativas das rotas públicas que não são o login (o login é do módulo de autenticação da plataforma:
 * {@code LimiteLogin}): cadastro de treinador e convite público por IP (10 e 30), refresh por IP (120), logo pública por IP (300),
 * inscrição pelo link por IP (20 envios e 300 consultas da página) e falhas da
 * verificação humana por IP (20), com janela fixa
 * de 600 s e contador no banco. A chave é um SHA-256 com o sal {@code plataforma.auth.login.sal}; cada ação tem prefixo
 * próprio, então uma não consome o limite da outra.
 */
@Component
public class LimiteTentativas {

    private final ContadorBanco contador;
    private final Limites limites;
    private final long janelaMs;
    private final Clock clock;
    private final String sal;

    LimiteTentativas(ContadorBanco contador,
                     @Value("${treinos.limites.cadastro-ip:10}") int cadastroIp,
                     @Value("${treinos.limites.convite-ip:30}") int conviteIp,
                     @Value("${treinos.limites.refresh-ip:120}") int refreshIp,
                     @Value("${treinos.limites.verificacao-ip:20}") int verificacaoIp,
                     @Value("${treinos.limites.logo-ip:300}") int logoIp,
                     @Value("${treinos.limites.inscricao-ip:20}") int inscricaoIp,
                     @Value("${treinos.limites.inscricao-consulta-ip:300}") int inscricaoConsultaIp,
                     @Value("${treinos.limites.convite-equipe-consulta-ip:30}") int conviteEquipeConsultaIp,
                     @Value("${treinos.limites.janela-segundos:600}") long janelaSegundos,
                     @Value("${plataforma.auth.login.sal:}") String sal) {
        this.limites = new Limites(cadastroIp, conviteIp, refreshIp, verificacaoIp, logoIp, inscricaoIp, inscricaoConsultaIp,
                conviteEquipeConsultaIp);
        if (cadastroIp < 1 || conviteIp < 1 || refreshIp < 1 || verificacaoIp < 1 || logoIp < 1 || inscricaoIp < 1
                || inscricaoConsultaIp < 1 || conviteEquipeConsultaIp < 1 || janelaSegundos < 1 || janelaSegundos > 86400) {
            throw new IllegalArgumentException("Limites de tentativas inválidos.");
        }
        this.contador = contador;
        this.janelaMs = janelaSegundos * 1000;
        this.clock = Clock.systemUTC();
        this.sal = "limite-tentativas:" + sal;
    }

    public void cadastro(String ip) {
        porIp("cadastro-ip", ip, limites.cadastroIp());
    }

    public void convite(String ip) {
        porIp("convite-ip", ip, limites.conviteIp());
    }

    /** Logo pública da consultoria (sem login): cada resposta lê a imagem do banco, então o IP tem um teto por janela. */
    public void logo(String ip) {
        porIp("logo-ip", ip, limites.logoIp());
    }

    /** Envio de inscrição pelo link público (sem login): grava uma linha por envio, então o teto é baixo. */
    public void inscricao(String ip) {
        porIp("inscricao-ip", ip, limites.inscricaoIp());
    }

    /** Consulta da página pública da inscrição (marca e texto da consultoria). */
    public void inscricaoConsulta(String ip) {
        porIp("inscricao-consulta-ip", ip, limites.inscricaoConsultaIp());
    }

    /**
     * Consulta pública do convite de equipe (marca da consultoria antes do aceite). Contador próprio: não gasta o do aceite
     * nem o do convite do aluno, e quem chuta códigos aqui esbarra no teto sem travar quem está aceitando.
     */
    public void conviteEquipeConsulta(String ip) {
        porIp("convite-equipe-consulta-ip", ip, limites.conviteEquipeConsultaIp());
    }

    public void refresh(String ip) {
        porIp("refresh-ip", ip, limites.refreshIp());
    }

    /**
     * Verificação humana: antes de chamar a Cloudflare, recusa o IP que já gastou as falhas da janela (não conta nada, assim
     * quem está bloqueado também não gera chamada ao siteverify).
     */
    public void verificacaoBloqueada(String ip) {
        long agora = clock.millis();
        var estado = contador.ler(chave("verificacao-ip", ip), agora);
        if (estado.tentativas() >= limites.verificacaoIp()) {
            throw new MuitasRequisicoesException(segundosAte(estado.ateMs(), agora));
        }
    }

    /** Conta uma verificação humana que falhou (token ausente ou recusado); a que cruza o limite já recebe o 429. */
    public void verificacaoFalhou(String ip) {
        porIp("verificacao-ip", ip, limites.verificacaoIp());
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

    private record Limites(int cadastroIp, int conviteIp, int refreshIp, int verificacaoIp, int logoIp, int inscricaoIp,
                           int inscricaoConsultaIp, int conviteEquipeConsultaIp) {
    }
}
