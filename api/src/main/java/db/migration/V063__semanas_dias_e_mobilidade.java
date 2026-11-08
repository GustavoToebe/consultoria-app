package db.migration;

import br.com.treinos.api.receitas.SemanasPadrao;
import br.com.treinos.api.receitas.SemanasPadrao.ExercicioDaBiblioteca;
import br.com.treinos.api.receitas.SemanasPadrao.Modelo;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Grava Semanas, Dias e mobilidades nas consultorias que já existem. Consultoria nova recebe as mesmas por
 * {@code ReceitaService.garantirPadrao}. Só insere o nome que falta; não altera modelo que o treinador já tem.
 * Sem coleção. O exercício casa pelo nome sem acento. O {@code consultoria_id} vai explícito.
 */
public class V063__semanas_dias_e_mobilidade extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        JsonMapper json = JsonMapper.builder().build();
        for (UUID consultoria : consultorias(conexao)) {
            aplicar(conexao, consultoria, json);
        }
    }

    /** Uma consultoria. Idempotente pelo tipo e pelo nome. */
    public static void aplicar(Connection conexao, UUID consultoria, JsonMapper json) throws SQLException {
        Map<String, ExercicioDaBiblioteca> biblioteca = exercicios(conexao, consultoria);
        Set<String> nomes = nomes(conexao, consultoria);
        int ordem = proximaOrdem(conexao, consultoria);
        try (PreparedStatement insere = conexao.prepareStatement(
                "insert into receita (id, consultoria_id, tipo, nome, descricao, conteudo, ordem) "
                        + "values (?, ?, ?, ?, ?, cast(? as jsonb), ?)")) {
            boolean tem = false;
            for (Modelo modelo : SemanasPadrao.todos()) {
                if (!nomes.add(modelo.tipo() + "/" + modelo.nome())) {
                    continue;
                }
                Modelo resolvido = SemanasPadrao.comExercicios(modelo, biblioteca);
                insere.setObject(1, UUID.randomUUID());
                insere.setObject(2, consultoria);
                insere.setString(3, resolvido.tipo().name());
                insere.setString(4, resolvido.nome());
                insere.setString(5, resolvido.descricao());
                insere.setString(6, json.writeValueAsString(resolvido.conteudo()));
                insere.setInt(7, ordem++);
                insere.addBatch();
                tem = true;
            }
            if (tem) {
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

    private static Map<String, ExercicioDaBiblioteca> exercicios(Connection conexao, UUID consultoria) throws SQLException {
        Map<String, ExercicioDaBiblioteca> porBusca = new HashMap<>();
        Map<String, Boolean> ativo = new HashMap<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select id, nome, modalidade, ativo from exercicio where consultoria_id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String busca = Buscas.semAcento(rs.getString("nome"));
                    boolean esteAtivo = rs.getBoolean("ativo");
                    Boolean jaAtivo = ativo.get(busca);
                    if (jaAtivo == null || (!jaAtivo && esteAtivo)) {
                        porBusca.put(busca, new ExercicioDaBiblioteca(rs.getObject("id", UUID.class),
                                rs.getString("nome"), rs.getString("modalidade")));
                        ativo.put(busca, esteAtivo);
                    }
                }
            }
        }
        return porBusca;
    }

    private static Set<String> nomes(Connection conexao, UUID consultoria) throws SQLException {
        Set<String> nomes = new HashSet<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select tipo, nome from receita where consultoria_id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    nomes.add(rs.getString("tipo") + "/" + rs.getString("nome"));
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
