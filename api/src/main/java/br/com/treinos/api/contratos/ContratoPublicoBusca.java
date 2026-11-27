package br.com.treinos.api.contratos;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Única leitura de {@code contrato_aluno} fora de uma consultoria: a página do responsável é pública, então primeiro é preciso
 * descobrir de qual consultoria é o link (pelo hash do código, como {@code ConviteBusca}). Só acha contrato pendente com link ainda
 * vigente e devolve apenas o id da consultoria; consulta, conferência do CPF e assinatura rodam dentro dela, com {@code @TenantId}.
 * SQL nativo permitido no {@code ArquiteturaTest} por isso.
 */
@Component
public class ContratoPublicoBusca {

    private final JdbcTemplate jdbc;

    public ContratoPublicoBusca(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UUID> consultoriaDoLink(String linkHash) {
        return jdbc.query("select consultoria_id from contrato_aluno where link_hash = ? and situacao = 'PENDENTE' "
                        + "and link_expira_em > now()",
                (rs, n) -> rs.getObject(1, UUID.class), linkHash).stream().findFirst();
    }
}
