package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tira o prefixo "Suplementos / " das categorias do catálogo Heavy Suppz (A12, D4 do plano da atualização visual):
 * "Suplementos / Whey" vira "Whey". Só muda a linha que ainda é exatamente a do catálogo padrão: mesmo nome do item
 * padrão e categoria igual à gravada pela V028. Categoria que o treinador editou, e item que ele criou com outro nome,
 * ficam como estão. A lista abaixo é fixa de propósito (é o que a V028 gravou), para a migration não depender do
 * {@code heavysuppz.json} atual, que já vem sem o prefixo para as consultorias novas. Cada consultoria é tratada
 * separadamente, com {@code consultoria_id} explícito em cada UPDATE.
 */
public class V047__categorias_dos_suplementos extends BaseJavaMigration {

    private static final String PREFIXO = "Suplementos / ";

    /** Nome do item padrão e a categoria nova (a antiga é o prefixo mais ela). */
    private static final Map<String, String> NOVAS = novas();

    private static Map<String, String> novas() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("Dose única - Killer Whey - Whey Protein Concentrado - 35g", "Whey");
        m.put("Creatina Monohidratada - CREABLOOD 300g", "Creatina");
        m.put("Intra Treino - Intensity Hunter 600g", "Intra Treino");
        m.put("Whey Protein Concentrado - Killer Whey (Limited Edition) 450g", "Whey");
        m.put("Super Multivitamínico - 100 Caps", "Vitaminas");
        m.put("KIT - 6 Doses Únicas - Killer Whey - Whey Protein Concentrado - 35g(cada)", "Whey");
        m.put("Pré Sono - Rest In Peace 300g", "Sono");
        m.put("Dose Única - Fofista Crusher - Pré Treino - 15g", "Pré Treino");
        m.put("Panqueca Proteica - Deadly Punkakes 600g", "Whey");
        m.put("Pré Treino - Fofista Beater 750g (30 doses)", "Pré Treino");
        m.put("Vitamina D3 - 5.000UI - 100 cápsulas", "Vitaminas");
        m.put("Ômega 3 - 1.200mg - 100 cápsulas", "Vitaminas");
        m.put("Cafeína - 100mg - 100 cápsulas", "Vitaminas");
        m.put("Vitamina C - 500mg - 100 cápsulas", "Vitaminas");
        m.put("Dose única - Pré Sono - Rest In Peace - 10g", "Sono");
        m.put("Dose única - Fofista Beater - 25g", "Pré Treino");
        m.put("Dose única - Intra Treino - Intensity Hunter - 20g", "Intra Treino");
        return m;
    }

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        List<UUID> consultorias = new ArrayList<>();
        try (Statement st = conexao.createStatement(); ResultSet rs = st.executeQuery("select id from consultoria")) {
            while (rs.next()) consultorias.add(rs.getObject(1, UUID.class));
        }
        for (UUID consultoria : consultorias) {
            tirarPrefixo(conexao, consultoria);
        }
    }

    /** Troca a categoria só do item padrão que ainda está com a categoria do catálogo. Devolve quantas linhas mudou. */
    public static int tirarPrefixo(Connection conexao, UUID consultoria) throws SQLException {
        String sql = "update suplemento set categoria = ? where consultoria_id = ? and nome = ? and categoria = ?";
        int mudadas = 0;
        try (PreparedStatement altera = conexao.prepareStatement(sql)) {
            for (Map.Entry<String, String> item : NOVAS.entrySet()) {
                altera.setString(1, item.getValue());
                altera.setObject(2, consultoria);
                altera.setString(3, item.getKey());
                altera.setString(4, PREFIXO + item.getValue());
                mudadas += altera.executeUpdate();
            }
        }
        return mudadas;
    }
}
