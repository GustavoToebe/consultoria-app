package br.com.treinos.api.vitrine;

import br.com.treinos.api.inscricoes.CodigoDeInscricao;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Única leitura de {@code vitrine_configuracao} fora de uma consultoria: o link da loja é público, então primeiro é preciso descobrir
 * de qual consultoria ele é (pelo código), como {@code InscricaoBusca}. Devolve só o id da consultoria de uma página ligada, com o
 * código no formato (conferido antes de ir ao banco); a leitura dos itens roda depois, dentro dela, com {@code @TenantId}. Nunca
 * devolve nada além disso. SQL nativo permitido no {@code ArquiteturaTest} por isso.
 */
@Component
class VitrinePublicaRepositorio {

    private final JdbcTemplate jdbc;

    VitrinePublicaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Optional<UUID> consultoriaDaPaginaLigada(String codigo) {
        if (!CodigoDeInscricao.valido(codigo)) {
            return Optional.empty();
        }
        return jdbc.query("select consultoria_id from vitrine_configuracao where codigo_publico = ? and pagina_ligada",
                (rs, n) -> rs.getObject(1, UUID.class), codigo).stream().findFirst();
    }
}
