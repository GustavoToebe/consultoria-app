package br.com.treinos.api.inscricoes;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Única leitura de {@code questionario} fora de uma consultoria: o link é público, então primeiro é preciso descobrir de
 * qual consultoria ele é (pelo código). Devolve só o id da consultoria de um link aberto (formulário de INSCRICAO, aberto e
 * não arquivado, a mesma regra de {@code Questionario.isLinkPublicoAberto}); a leitura e a gravação rodam dentro dela, com
 * {@code @TenantId}. SQL nativo permitido no {@code ArquiteturaTest} por isso.
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
        return jdbc.query("select consultoria_id from questionario where codigo_publico = ? and finalidade = 'INSCRICAO'"
                        + " and publico_aberto and not arquivado",
                (rs, n) -> rs.getObject(1, UUID.class), codigo).stream().findFirst();
    }
}
