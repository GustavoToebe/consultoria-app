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
 * Contrato de séries e técnicas (22/10): apaga, em toda consultoria, tudo que guarda série ou metodologia no formato da
 * V022/V023 (os registros de execução, as versões e os planos de treino, e os modelos de metodologia, de séries, de dia e
 * de semana e os pacotes) e recria as receitas padrão no contrato novo, com a mesma regra de
 * {@code ReceitaService.garantirPadrao}: só o que falta (mesmo tipo e nome). Sem compatibilidade: ainda não há cliente
 * real. Antes de qualquer push, o Gustavo confirma que não há nada a guardar na produção e que o backup do dia rodou.
 * É migration em Java porque o JSON sai de {@link ReceitasPadrao} (mudou lá, muda aqui) e não se escreve à mão. Roda com
 * o papel do Flyway, fora do {@code TenantContext}: o {@code consultoria_id} vai explícito em cada linha. Fica no pacote
 * {@code db.migration} (o lugar das migrations do Flyway), fora do escopo do {@code ArquiteturaTest}. A V022 e a V023
 * ficam como estão (migration já aplicada não se edita).
 */
public class V024__contrato_de_series_e_tecnicas extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        apagarFormatoAntigo(conexao);
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

    /** Ordem pelas chaves estrangeiras (execucao_serie -> plano_treino_versao -> plano_treino; nada aponta para receita). */
    private static void apagarFormatoAntigo(Connection conexao) throws SQLException {
        try (Statement st = conexao.createStatement()) {
            st.executeUpdate("delete from execucao_serie");
            st.executeUpdate("delete from plano_treino_versao");
            st.executeUpdate("delete from plano_treino");
            st.executeUpdate("delete from receita where tipo in "
                    + "('METODOLOGIA', 'SERIES', 'SESSAO_TREINO', 'PLANO_TREINO', 'PASTA_PLANO')");
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
