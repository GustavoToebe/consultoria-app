package br.com.treinos.api.inscricoes;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Única leitura de {@code inscricao_configuracao} fora de uma consultoria: o link é público, então primeiro é preciso
 * descobrir de qual consultoria ele é (pelo código). Devolve só o id da consultoria de um link aberto; a leitura e a
 * gravação rodam dentro dela, com {@code @TenantId}. SQL nativo permitido no {@code ArquiteturaTest} por isso.
 */
@Component
public class InscricaoBusca {

    private final JdbcTemplate jdbc;

    public InscricaoBusca(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UUID> consultoriaDoLinkAberto(String codigo) {
        if (!CodigoDeInscricao.valido(codigo)) {
            return Optional.empty();
        }
        List<UUID> ids = jdbc.query("select consultoria_id from inscricao_configuracao where codigo = ? and aberta",
                (rs, n) -> rs.getObject(1, UUID.class), codigo);
        return ids.stream().findFirst();
    }
}
