package db.migration;

import br.com.treinos.api.receitas.ReceitasPadrao;
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
 * Recria em toda consultoria as receitas padrão que a V022 apagou (metodologia, séries, dias e semanas de treino), já
 * no formato novo, com a mesma regra de {@code ReceitaService.garantirPadrao}: só o que falta (mesmo tipo e nome). Assim
 * a dieta e as refeições padrão que ficaram não se repetem, e uma consultoria sem receita nenhuma recebe todas. É
 * migration em Java porque o JSON sai de {@link ReceitasPadrao} (mudou lá, muda aqui) e não se escreve à mão. Roda com
 * o papel do Flyway, fora do {@code TenantContext}: o {@code consultoria_id} vai explícito em cada linha. Fica no pacote
 * {@code db.migration} (o lugar das migrations do Flyway), fora do escopo do {@code ArquiteturaTest}.
 */
public class V023__receitas_padrao_do_formato_novo extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        JsonMapper json = JsonMapper.builder().build();
        for (UUID consultoria : consultorias(conexao)) {
            Set<String> existentes = existentes(conexao, consultoria);
            try (PreparedStatement insere = conexao.prepareStatement(
                    "insert into receita (id, consultoria_id, tipo, nome, descricao, conteudo, ordem) "
                            + "values (?, ?, ?, ?, ?, cast(? as jsonb), ?)")) {
                int ordem = 0;
                for (ReceitasPadrao.Padrao p : ReceitasPadrao.todas()) {
                    ordem++;
                    if (!existentes.add(p.tipo().name() + "/" + p.nome())) {
                        continue;
                    }
                    insere.setObject(1, UUID.randomUUID());
                    insere.setObject(2, consultoria);
                    insere.setString(3, p.tipo().name());
                    insere.setString(4, p.nome());
                    insere.setString(5, p.descricao());
                    insere.setString(6, json.writeValueAsString(p.conteudo()));
                    insere.setInt(7, ordem);
                    insere.addBatch();
                }
                insere.executeBatch();
            }
        }
    }

    private static List<UUID> consultorias(Connection conexao) throws SQLException {
        List<UUID> ids = new ArrayList<>();
        try (Statement st = conexao.createStatement(); ResultSet rs = st.executeQuery("select id from consultoria")) {
            while (rs.next()) {
                ids.add(rs.getObject("id", UUID.class));
            }
        }
        return ids;
    }

    private static Set<String> existentes(Connection conexao, UUID consultoria) throws SQLException {
        Set<String> chaves = new HashSet<>();
        try (PreparedStatement ps = conexao.prepareStatement("select tipo, nome from receita where consultoria_id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    chaves.add(rs.getString("tipo") + "/" + rs.getString("nome"));
                }
            }
        }
        return chaves;
    }
}
