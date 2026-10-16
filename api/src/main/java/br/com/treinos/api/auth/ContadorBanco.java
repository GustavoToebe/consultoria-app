package br.com.treinos.api.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Contador de tentativas no banco (tabela global {@code login_tentativa}), cópia do desenho da Central: vale entre
 * réplicas e sobrevive a reinício. Uma instrução só conta e lê, então tentativas concorrentes não passam do limite.
 * A chave já chega como hash com sal; nenhum e-mail nem IP é gravado em claro.
 */
@Component
class ContadorBanco {

    record Estado(int tentativas, long ateMs) {
    }

    private static final String SQL = """
            insert into login_tentativa(chave, janela_ate, tentativas) values (?, ?, 1)
            on conflict (chave) do update set
              tentativas = case when login_tentativa.janela_ate <= ? then 1 else login_tentativa.tentativas + 1 end,
              janela_ate = case when login_tentativa.janela_ate <= ? then ? else login_tentativa.janela_ate end
            returning tentativas, janela_ate
            """;

    private final JdbcTemplate jdbc;
    private final AtomicLong proximaLimpeza = new AtomicLong();

    ContadorBanco(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Estado tentar(String chave, long agoraMs, long janelaMs) {
        limparSeNecessario(agoraMs);
        Timestamp agora = Timestamp.from(Instant.ofEpochMilli(agoraMs));
        Timestamp fim = Timestamp.from(Instant.ofEpochMilli(agoraMs + janelaMs));
        return jdbc.queryForObject(SQL, (rs, n) -> new Estado(rs.getInt(1), rs.getTimestamp(2).getTime()),
                chave, fim, agora, agora, fim);
    }

    /** Só lê (não conta): quantas tentativas a chave tem na janela corrente, ou zero se a janela já venceu. */
    Estado ler(String chave, long agoraMs) {
        Timestamp agora = Timestamp.from(Instant.ofEpochMilli(agoraMs));
        return jdbc.query("select tentativas, janela_ate from login_tentativa where chave = ? and janela_ate > ?",
                (rs, n) -> new Estado(rs.getInt(1), rs.getTimestamp(2).getTime()), chave, agora)
                .stream().findFirst().orElse(new Estado(0, agoraMs));
    }

    /** Apaga a linha de uma chave (esquecer o e-mail de um aluno anonimizado). */
    void apagar(String chave) {
        jdbc.update("delete from login_tentativa where chave = ?", chave);
    }

    /** Remove janelas vencidas há mais de uma hora, no máximo uma vez por minuto por processo. */
    private void limparSeNecessario(long agoraMs) {
        long previsto = proximaLimpeza.get();
        if (agoraMs >= previsto && proximaLimpeza.compareAndSet(previsto, agoraMs + 60000)) {
            jdbc.update("delete from login_tentativa where janela_ate < ?",
                    Timestamp.from(Instant.ofEpochMilli(agoraMs - 3600000)));
        }
    }
}
