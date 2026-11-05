package db.migration;

import br.com.treinos.api.biblioteca.FatoresDeRendimento;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Troca os fatores vindos de planilha externa (V027) pela estimativa nativa ({@link FatoresDeRendimento}). Apaga os
 * itens artificiais do catálogo, preenche FC e FCc de todo alimento do catálogo e da biblioteca, e regrava os itens
 * das dietas já publicadas, dos rascunhos e dos modelos de dieta e de refeição. Depois remove {@code fonte_fatores} e
 * {@code fatores_do_catalogo}. O {@code consultoria_id} vai explícito em cada escrita de tabela da consultoria.
 */
public class V060__fatores_estimados_nativos extends BaseJavaMigration {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        apagarItensArtificiais(conexao);
        estimarCatalogo(conexao);
        estimarBiblioteca(conexao);
        Map<String, Fatores> alimentos = alimentos(conexao);
        atualizarJson(conexao, alimentos, "plano_dieta_versao", "conteudo", null);
        atualizarJson(conexao, alimentos, "plano_dieta", "rascunho", null);
        atualizarJson(conexao, alimentos, "receita", "conteudo", "tipo in ('PLANO_DIETA', 'REFEICAO')");
        try (Statement st = conexao.createStatement()) {
            st.execute("alter table catalogo_alimento drop column if exists fonte_fatores");
            st.execute("alter table alimento drop column if exists fatores_do_catalogo");
        }
    }

    private static void apagarItensArtificiais(Connection conexao) throws SQLException {
        try (Statement st = conexao.createStatement()) {
            st.execute("""
                    delete from catalogo_alimento
                    where (fonte ilike '%Oliveira%' or fonte ilike '%Cumbaru%' or fonte ilike '%Scienza%')
                      and fonte <> 'TACO 4ª ed. (2011), NEPA/UNICAMP'
                      and fonte not like 'Batel Grill.%'
                    """);
        }
    }

    private static void estimarCatalogo(Connection conexao) throws SQLException {
        List<Linha> linhas = new ArrayList<>();
        try (Statement st = conexao.createStatement();
             ResultSet rs = st.executeQuery("select id, nome, grupo, kcal, base_quantidade, base_unidade from catalogo_alimento")) {
            while (rs.next()) {
                linhas.add(new Linha(rs.getObject(1, UUID.class), null, rs.getString(2), rs.getString(3),
                        rs.getBigDecimal(4), rs.getBigDecimal(5), rs.getString(6)));
            }
        }
        try (PreparedStatement ps = conexao.prepareStatement(
                "update catalogo_alimento set fator_correcao = ?, fator_coccao = ? where id = ?")) {
            for (Linha linha : linhas) {
                var e = FatoresDeRendimento.estimar(linha.nome(), linha.grupo(), linha.kcal(), linha.base(), linha.unidade());
                ps.setBigDecimal(1, e.fatorCorrecao());
                ps.setBigDecimal(2, e.fatorCoccao());
                ps.setObject(3, linha.id());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static void estimarBiblioteca(Connection conexao) throws SQLException {
        List<Linha> linhas = new ArrayList<>();
        try (Statement st = conexao.createStatement();
             ResultSet rs = st.executeQuery("""
                     select id, consultoria_id, nome, grupo, kcal, base_quantidade, base_unidade from alimento
                     """)) {
            while (rs.next()) {
                linhas.add(new Linha(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getString(4), rs.getBigDecimal(5), rs.getBigDecimal(6), rs.getString(7)));
            }
        }
        try (PreparedStatement ps = conexao.prepareStatement("""
                update alimento set fator_correcao = ?, fator_coccao = ? where id = ? and consultoria_id = ?
                """)) {
            for (Linha linha : linhas) {
                var e = FatoresDeRendimento.estimar(linha.nome(), linha.grupo(), linha.kcal(), linha.base(), linha.unidade());
                ps.setBigDecimal(1, e.fatorCorrecao());
                ps.setBigDecimal(2, e.fatorCoccao());
                ps.setObject(3, linha.id());
                ps.setObject(4, linha.consultoria());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static Map<String, Fatores> alimentos(Connection conexao) throws SQLException {
        Map<String, Fatores> mapa = new HashMap<>();
        try (Statement st = conexao.createStatement();
             ResultSet rs = st.executeQuery(
                     "select id, consultoria_id, fator_correcao, fator_coccao, grupo from alimento")) {
            while (rs.next()) {
                mapa.put(rs.getObject(2, UUID.class) + ":" + rs.getObject(1, UUID.class),
                        new Fatores(rs.getBigDecimal(3), rs.getBigDecimal(4), rs.getString(5)));
            }
        }
        return mapa;
    }

    private static void atualizarJson(Connection conexao, Map<String, Fatores> alimentos, String tabela, String coluna,
                                      String filtro) throws SQLException {
        String where = filtro == null ? "" : " where " + filtro;
        List<Documento> documentos = new ArrayList<>();
        try (Statement st = conexao.createStatement();
             ResultSet rs = st.executeQuery("select id, consultoria_id, " + coluna + "::text from " + tabela + where)) {
            while (rs.next()) {
                documentos.add(new Documento(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3)));
            }
        }
        try (PreparedStatement ps = conexao.prepareStatement(
                "update " + tabela + " set " + coluna + " = cast(? as jsonb) where id = ? and consultoria_id = ?")) {
            for (Documento documento : documentos) {
                String novo = regravar(documento.texto(), documento.consultoria(), alimentos);
                if (novo == null || novo.equals(documento.texto())) continue;
                ps.setString(1, novo);
                ps.setObject(2, documento.id());
                ps.setObject(3, documento.consultoria());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    /** Devolve o JSON com os fatores dos itens, ou nulo se o texto não for um objeto. */
    static String regravar(String texto, UUID consultoria, Map<String, Fatores> alimentos) {
        if (texto == null || texto.isBlank()) return null;
        JsonNode raiz = JSON.readTree(texto);
        if (!(raiz instanceof ObjectNode objeto)) return null;
        visitar(objeto, consultoria, alimentos);
        return JSON.writeValueAsString(objeto);
    }

    private static void visitar(JsonNode no, UUID consultoria, Map<String, Fatores> alimentos) {
        if (no instanceof ObjectNode objeto) {
            if (objeto.has("nome") && objeto.has("unidade")) {
                preencherItem(objeto, consultoria, alimentos);
                return;
            }
            for (var campo : objeto.properties()) visitar(campo.getValue(), consultoria, alimentos);
        } else if (no instanceof ArrayNode lista) {
            lista.forEach(filho -> visitar(filho, consultoria, alimentos));
        }
    }

    private static void preencherItem(ObjectNode item, UUID consultoria, Map<String, Fatores> alimentos) {
        String nome = item.path("nome").asString("");
        String unidade = item.path("unidade").asString("g");
        String grupoItem = texto(item, "grupo");
        UUID alimentoId = uuid(item, "alimentoId");
        Fatores alimento = alimentoId == null ? null : alimentos.get(consultoria + ":" + alimentoId);
        BigDecimal fc;
        BigDecimal fcc;
        String grupo = grupoItem;
        if (alimento != null && alimento.fc() != null && alimento.fcc() != null) {
            fc = alimento.fc();
            fcc = alimento.fcc();
            if (alimento.grupo() != null && !alimento.grupo().isBlank()) grupo = alimento.grupo();
        } else {
            var e = FatoresDeRendimento.estimar(nome, grupoItem, decimal(item, "kcal"),
                    decimal(item, "quantidade"), unidade);
            fc = e.fatorCorrecao();
            fcc = e.fatorCoccao();
        }
        item.put("fatorCorrecao", fc);
        item.put("fatorCoccao", fcc);
        if (grupo != null && !grupo.isBlank()) item.put("grupo", grupo);
    }

    private static String texto(ObjectNode item, String campo) {
        JsonNode no = item.get(campo);
        if (no == null || no.isNull()) return null;
        String valor = no.asString();
        return valor == null || valor.isBlank() ? null : valor;
    }

    private static UUID uuid(ObjectNode item, String campo) {
        String valor = texto(item, campo);
        if (valor == null) return null;
        try {
            return UUID.fromString(valor);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static BigDecimal decimal(ObjectNode item, String campo) {
        JsonNode no = item.get(campo);
        if (no == null || no.isNull() || !no.isNumber()) return null;
        return no.decimalValue();
    }

    private record Linha(UUID id, UUID consultoria, String nome, String grupo, BigDecimal kcal, BigDecimal base,
                         String unidade) {
    }

    private record Fatores(BigDecimal fc, BigDecimal fcc, String grupo) {
    }

    private record Documento(UUID id, UUID consultoria, String texto) {
    }
}
