package br.com.treinos.api.equipe;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.Optional;
import java.util.UUID;
/** Exceção mínima pública: encontra somente a consultoria pelo hash; o aceite abre transação dentro dela. */
@Component
public class ConviteEquipeBusca {
    private final JdbcTemplate jdbc;
    public ConviteEquipeBusca(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Optional<UUID> consultoria(String hash) {
        return jdbc.query("select consultoria_id from usuario_convite where codigo_hash=? and usado_em is null and expira_em>now()",
                (rs,n) -> rs.getObject(1,UUID.class),hash).stream().findFirst();
    }
}
