package br.com.treinos.api.alunos;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Única leitura de {@code aluno} fora de uma consultoria: o convite é público, então primeiro é preciso descobrir de
 * qual consultoria ele é (pelo hash do código). Devolve só o id da consultoria; o resto da leitura e o aceite rodam
 * dentro dela, com {@code @TenantId}. SQL nativo permitido no {@code ArquiteturaTest} por isso.
 */
@Component
public class ConviteBusca {

    private final JdbcTemplate jdbc;

    public ConviteBusca(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UUID> consultoriaDoConvite(String conviteHash) {
        List<UUID> ids = jdbc.query("select consultoria_id from aluno where convite_hash = ? "
                        + "and convite_expira_em > now() and usuario_id is null and ativo",
                (rs, n) -> rs.getObject(1, UUID.class), conviteHash);
        return ids.stream().findFirst();
    }
}
