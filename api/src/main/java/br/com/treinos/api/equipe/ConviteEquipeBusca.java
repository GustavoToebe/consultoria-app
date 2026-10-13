package br.com.treinos.api.equipe;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.Optional;
import java.util.UUID;
/**
 * Exceção mínima pública: encontra somente a consultoria pelo hash (e se o convite é do sistema, o do administrador de
 * uma consultoria criada pela Central); o aceite abre transação dentro dela.
 */
@Component
public class ConviteEquipeBusca {
    private final JdbcTemplate jdbc;
    public ConviteEquipeBusca(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    /** {@code doSistema}: {@code criado_por} nulo, o convite que a Central emite no provisionamento. */
    public record Convite(UUID consultoriaId,boolean doSistema) { }
    public Optional<Convite> convite(String hash) {
        return jdbc.query("select consultoria_id, criado_por is null from usuario_convite where codigo_hash=? and usado_em is null and expira_em>now()",
                (rs,n) -> new Convite(rs.getObject(1,UUID.class),rs.getBoolean(2)),hash).stream().findFirst();
    }
}
