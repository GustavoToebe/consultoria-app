package db.migration;

import br.com.treinos.api.biblioteca.GrupoDoAlimento;
import br.com.treinos.api.biblioteca.SuplementosPadrao;
import br.com.treinos.api.biblioteca.WheyDoRotulo;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.receitas.DietasPadrao;
import br.com.treinos.api.web.Buscas;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Grava as 11 dietas padrão nas consultorias que já existem. Consultoria nova recebe as mesmas por
 * {@code ReceitaService.garantirPadrao}. Antes de resolver o {@code alimentoId}, copia do catálogo o que falta
 * (nome sem acento): kcal, macros, base e os fatores já gravados, sem estimar. O item da receita recebe a conta
 * proporcional desses números (a mesma de {@code DietasPadrao.comAlimentoIds}). Antes disso chama a mesma regra de
 * {@code BibliotecaService.garantirSuplementosPadrao} (Heavy Suppz e o Whey do rótulo; nome que já existe, mesmo
 * inativo, fica). Não altera alimento nem receita que o treinador já tem. A segunda execução
 * não duplica. O {@code consultoria_id} vai explícito. Fica no pacote {@code db.migration}, fora do
 * {@code ArquiteturaTest}.
 */
public class V062__dietas_padrao extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        for (UUID consultoria : consultorias(conexao)) {
            aplicar(conexao, consultoria);
        }
    }

    /** Uma consultoria. Idempotente: nome que já existe não é recriado nem alterado. */
    public static void aplicar(Connection conexao, UUID consultoria) throws SQLException {
        JsonMapper json = JsonMapper.builder().build();
        garantirSuplementosPadrao(conexao, consultoria, json);
        Map<String, DietasPadrao.Nutrientes> nutrientes = alimentos(conexao, consultoria);
        for (String busca : DietasPadrao.buscasParaResolver()) {
            if (nutrientes.containsKey(busca)) {
                continue;
            }
            DietasPadrao.Nutrientes copiado = copiarCatalogo(conexao, consultoria, busca);
            if (copiado != null) {
                nutrientes.put(busca, copiado);
            }
        }
        Set<String> nomes = nomesDeDieta(conexao, consultoria);
        int ordem = proximaOrdem(conexao, consultoria);
        try (PreparedStatement insere = conexao.prepareStatement(
                "insert into receita (id, consultoria_id, tipo, nome, descricao, conteudo, ordem) "
                        + "values (?, ?, 'PLANO_DIETA', ?, ?, cast(? as jsonb), ?)")) {
            boolean tem = false;
            for (DietasPadrao.Modelo modelo : DietasPadrao.modelos()) {
                if (!nomes.add(modelo.nome())) {
                    continue;
                }
                ConteudoDieta conteudo = DietasPadrao.comAlimentoIds(modelo.conteudo(), nutrientes);
                insere.setObject(1, UUID.randomUUID());
                insere.setObject(2, consultoria);
                insere.setString(3, modelo.nome());
                insere.setString(4, modelo.descricao());
                insere.setString(5, json.writeValueAsString(conteudo));
                insere.setInt(6, ordem++);
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

    /** Ativo ganha de inativo quando os dois têm o mesmo nome sem acento. */
    private static Map<String, DietasPadrao.Nutrientes> alimentos(Connection conexao, UUID consultoria) throws SQLException {
        Map<String, DietasPadrao.Nutrientes> nutrientes = new HashMap<>();
        Map<String, Boolean> ativo = new HashMap<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select id, nome, ativo, base_quantidade, base_unidade, kcal, proteina, carboidrato, gordura, "
                        + "gramas_por_unidade from alimento where consultoria_id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String busca = Buscas.semAcento(rs.getString("nome"));
                    boolean esteAtivo = rs.getBoolean("ativo");
                    Boolean jaAtivo = ativo.get(busca);
                    if (jaAtivo == null || (!jaAtivo && esteAtivo)) {
                        nutrientes.put(busca, nutrientes(rs));
                        ativo.put(busca, esteAtivo);
                    }
                }
            }
        }
        return nutrientes;
    }

    private static DietasPadrao.Nutrientes nutrientes(ResultSet rs) throws SQLException {
        return new DietasPadrao.Nutrientes(rs.getObject("id", UUID.class), rs.getBigDecimal("base_quantidade"),
                rs.getString("base_unidade"), rs.getBigDecimal("kcal"), rs.getBigDecimal("proteina"),
                rs.getBigDecimal("carboidrato"), rs.getBigDecimal("gordura"), rs.getBigDecimal("gramas_por_unidade"));
    }

    /**
     * A mesma regra de {@code BibliotecaService.garantirSuplementosPadrao}, em JDBC: o Flyway ainda não tem o
     * serviço. Nome sem acento que já existe, inclusive inativo, não é recriado nem alterado. O Whey leva o rótulo;
     * o Heavy Suppz fica sem kcal.
     */
    private static void garantirSuplementosPadrao(Connection conexao, UUID consultoria, JsonMapper json) throws SQLException {
        Set<String> nomes = new HashSet<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select nome from alimento where consultoria_id = ? and tipo = 'SUPLEMENTO'")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    nomes.add(Buscas.semAcento(rs.getString("nome")));
                }
            }
        }
        for (SuplementosPadrao.Item item : SuplementosPadrao.itens(json)) {
            String busca = Buscas.semAcento(item.nome());
            if (!nomes.add(busca)) {
                continue;
            }
            inserirSuplemento(conexao, consultoria, item.nome(), new BigDecimal("100"), null, null, null, null,
                    Buscas.opcional(item.categoria()), Buscas.opcional(item.marca()), item.link(),
                    Buscas.opcional(item.porcao()), Buscas.opcional(item.porcoesPorEmbalagem()),
                    json.writeValueAsString(item.sabores()), busca);
        }
        String buscaWhey = Buscas.semAcento(WheyDoRotulo.NOME);
        if (nomes.add(buscaWhey)) {
            inserirSuplemento(conexao, consultoria, WheyDoRotulo.NOME, WheyDoRotulo.BASE, WheyDoRotulo.KCAL,
                    WheyDoRotulo.PROTEINA, WheyDoRotulo.CARBOIDRATO, WheyDoRotulo.GORDURA, null, null, null,
                    WheyDoRotulo.PORCAO, WheyDoRotulo.PORCOES, WheyDoRotulo.SABORES, buscaWhey);
        }
    }

    private static void inserirSuplemento(Connection conexao, UUID consultoria, String nome, BigDecimal base,
                                          BigDecimal kcal, BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                                          String grupo, String marca, String link, String porcao, String porcoes,
                                          String sabores, String nomeBusca) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement(
                "insert into alimento (id, consultoria_id, nome, base_quantidade, base_unidade, kcal, proteina, "
                        + "carboidrato, gordura, grupo, marca, link, tipo, sabores, porcoes_por_embalagem, porcao, "
                        + "nome_busca, origem) values (?, ?, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, 'SUPLEMENTO', "
                        + "cast(? as jsonb), ?, ?, ?, 'MANUAL')")) {
            ps.setObject(1, UUID.randomUUID());
            ps.setObject(2, consultoria);
            ps.setString(3, nome);
            ps.setBigDecimal(4, base);
            numero(ps, 5, kcal);
            numero(ps, 6, proteina);
            numero(ps, 7, carboidrato);
            numero(ps, 8, gordura);
            ps.setString(9, grupo);
            ps.setString(10, marca);
            ps.setString(11, link);
            ps.setString(12, sabores);
            ps.setString(13, porcoes);
            ps.setString(14, porcao);
            ps.setString(15, nomeBusca);
            ps.executeUpdate();
        }
    }

    /**
     * Uma linha do catálogo com esse nome sem acento. Zero ou mais de uma: não copia (não escolhe parecido).
     * Não chama {@code FatoresDeRendimento.completar}.
     */
    private static DietasPadrao.Nutrientes copiarCatalogo(Connection conexao, UUID consultoria, String busca)
            throws SQLException {
        List<Catalogo> linhas = new ArrayList<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select nome, base_quantidade, base_unidade, kcal, proteina, carboidrato, gordura, "
                        + "gramas_por_unidade, fonte, fator_correcao, fator_coccao, grupo "
                        + "from catalogo_alimento where nome_busca = ?")) {
            ps.setString(1, busca);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    linhas.add(new Catalogo(rs.getString("nome"), rs.getBigDecimal("base_quantidade"),
                            rs.getString("base_unidade"), rs.getBigDecimal("kcal"), rs.getBigDecimal("proteina"),
                            rs.getBigDecimal("carboidrato"), rs.getBigDecimal("gordura"),
                            rs.getBigDecimal("gramas_por_unidade"), rs.getString("fonte"),
                            rs.getBigDecimal("fator_correcao"), rs.getBigDecimal("fator_coccao"),
                            rs.getString("grupo")));
                }
            }
        }
        if (linhas.size() != 1) {
            return null;
        }
        Catalogo c = linhas.get(0);
        UUID id = UUID.randomUUID();
        try (PreparedStatement ps = conexao.prepareStatement(
                "insert into alimento (id, consultoria_id, nome, base_quantidade, base_unidade, kcal, proteina, "
                        + "carboidrato, gordura, gramas_por_unidade, fonte, fator_correcao, fator_coccao, grupo, "
                        + "tipo, origem) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALIMENTO', 'CATALOGO')")) {
            ps.setObject(1, id);
            ps.setObject(2, consultoria);
            ps.setString(3, c.nome());
            ps.setBigDecimal(4, c.baseQuantidade());
            ps.setString(5, c.baseUnidade());
            ps.setBigDecimal(6, c.kcal());
            numero(ps, 7, c.proteina());
            numero(ps, 8, c.carboidrato());
            numero(ps, 9, c.gordura());
            numero(ps, 10, c.gramasPorUnidade());
            ps.setString(11, c.fonte());
            numero(ps, 12, c.fatorCorrecao());
            numero(ps, 13, c.fatorCoccao());
            ps.setString(14, GrupoDoAlimento.doCatalogo(c.grupo()));
            ps.executeUpdate();
        }
        return new DietasPadrao.Nutrientes(id, c.baseQuantidade(), c.baseUnidade(), c.kcal(), c.proteina(),
                c.carboidrato(), c.gordura(), c.gramasPorUnidade());
    }

    private static void numero(PreparedStatement ps, int indice, BigDecimal valor) throws SQLException {
        if (valor == null) {
            ps.setNull(indice, Types.NUMERIC);
        } else {
            ps.setBigDecimal(indice, valor);
        }
    }

    private static Set<String> nomesDeDieta(Connection conexao, UUID consultoria) throws SQLException {
        Set<String> nomes = new HashSet<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select nome from receita where consultoria_id = ? and tipo = 'PLANO_DIETA'")) {
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

    private record Catalogo(String nome, BigDecimal baseQuantidade, String baseUnidade, BigDecimal kcal,
                            BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                            BigDecimal gramasPorUnidade, String fonte, BigDecimal fatorCorrecao,
                            BigDecimal fatorCoccao, String grupo) {
    }
}
