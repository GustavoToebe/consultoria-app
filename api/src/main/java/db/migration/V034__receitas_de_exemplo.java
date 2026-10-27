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
 * Grava nas consultorias que já existem as duas receitas de série de exemplo ("Exemplo: FS, WS e Cluster" e "Exemplo: FS
 * e Cluster"), que substituem os botões de exemplo do editor de treino. Consultoria nova já as recebe por
 * {@link ReceitasPadrao#todas()}. Insere só receita {@code SERIES} com esses nomes, e só quando ainda não há uma com o
 * mesmo nome: não apaga nem altera o que o treinador já tem. O {@code consultoria_id} vai explícito. Fica no pacote
 * {@code db.migration}, fora do {@code ArquiteturaTest}.
 */
public class V034__receitas_de_exemplo extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        JsonMapper json = JsonMapper.builder().build();
        for (UUID consultoria : consultorias(conexao)) {
            Set<String> nomes = nomesDeSeries(conexao, consultoria);
            int ordem = proximaOrdem(conexao, consultoria);
            try (PreparedStatement insere = conexao.prepareStatement(
                    "insert into receita (id, consultoria_id, tipo, nome, descricao, conteudo, ordem) "
                            + "values (?, ?, ?, ?, ?, cast(? as jsonb), ?)")) {
                boolean tem = false;
                for (ReceitasPadrao.Padrao p : ReceitasPadrao.exemplos()) {
                    if (!nomes.add(p.nome())) {
                        continue;
                    }
                    insere.setObject(1, UUID.randomUUID());
                    insere.setObject(2, consultoria);
                    insere.setString(3, p.tipo().name());
                    insere.setString(4, p.nome());
                    insere.setString(5, p.descricao());
                    insere.setString(6, json.writeValueAsString(p.conteudo()));
                    insere.setInt(7, ordem++);
                    insere.addBatch();
                    tem = true;
                }
                if (tem) {
                    insere.executeBatch();
                }
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

    private static Set<String> nomesDeSeries(Connection conexao, UUID consultoria) throws SQLException {
        Set<String> nomes = new HashSet<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select nome from receita where consultoria_id = ? and tipo = 'SERIES'")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    nomes.add(rs.getString("nome"));
                }
            }
        }
        return nomes;
    }

    private static int proximaOrdem(Connection conexao, UUID consultoria) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement(
                "select coalesce(max(ordem), 0) + 1 from receita where consultoria_id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }
}
