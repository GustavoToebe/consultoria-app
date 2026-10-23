package db.migration;

import br.com.treinos.api.biblioteca.SuplementosPadrao;
import br.com.treinos.api.web.Buscas;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Toda consultoria que já existe recebe os suplementos Heavy Suppz que ainda não tem, pelo nome.
 * Não altera o que o treinador digitou. Consultoria nova recebe a mesma lista em
 * {@code ReceitaService.garantirPadrao}. Outra marca é outro arquivo e outra migration.
 */
public class V028__suplementos_heavy_suppz extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        JsonMapper json = JsonMapper.builder().build();
        List<UUID> consultorias = new ArrayList<>();
        try (Statement st = conexao.createStatement(); ResultSet rs = st.executeQuery("select id from consultoria")) {
            while (rs.next()) consultorias.add(rs.getObject(1, UUID.class));
        }
        for (UUID consultoria : consultorias) {
            gravarFaltantes(conexao, consultoria, json);
        }
    }

    /** Insere só o nome que a consultoria ainda não tem. Não mexe no que já está gravado. */
    public static int gravarFaltantes(Connection conexao, UUID consultoria, JsonMapper json) throws SQLException {
        Set<String> nomes = new HashSet<>();
        try (PreparedStatement consulta = conexao.prepareStatement("select nome_busca from suplemento where consultoria_id = ?")) {
            consulta.setObject(1, consultoria);
            try (ResultSet rs = consulta.executeQuery()) {
                while (rs.next()) nomes.add(rs.getString(1));
            }
        }
        int criados = 0;
        String sql = "insert into suplemento (id, consultoria_id, nome, nome_busca, marca, categoria, porcao, "
                + "porcoes_por_embalagem, sabores, link) values (?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?)";
        try (PreparedStatement insere = conexao.prepareStatement(sql)) {
            for (SuplementosPadrao.Item item : SuplementosPadrao.itens(json)) {
                String busca = Buscas.semAcento(item.nome());
                if (!nomes.add(busca)) continue;
                insere.setObject(1, UUID.randomUUID());
                insere.setObject(2, consultoria);
                insere.setString(3, item.nome());
                insere.setString(4, busca);
                insere.setString(5, item.marca());
                insere.setString(6, item.categoria());
                insere.setString(7, item.porcao());
                insere.setString(8, item.porcoesPorEmbalagem());
                insere.setString(9, json.writeValueAsString(item.sabores()));
                insere.setString(10, item.link());
                insere.executeUpdate();
                criados++;
            }
        }
        return criados;
    }
}
