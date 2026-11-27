package db.migration;

import br.com.treinos.api.receitas.DietasPadrao;
import br.com.treinos.api.receitas.Receita;
import br.com.treinos.api.receitas.ReceitasPadrao;
import br.com.treinos.api.receitas.SemanasPadrao;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Origem da receita (aba "Minhas" da folha "Usar receita", 27/11): {@code PADRAO} é a do sistema ({@code garantirPadrao}
 * e as migrations V023, V024, V026, V034, V062 e V063); {@code CONSULTORIA} é a que a equipe criou, duplicou ou salvou.
 * Quem grava é sempre o servidor ({@code Receita}); o padrão da coluna é {@code CONSULTORIA} porque, na dúvida, a receita
 * aparece em "Minhas" (nunca some da lista da equipe) e porque as migrations antigas inserem sem a coluna.
 * O que já existe vira {@code PADRAO} quando tipo e nome batem com uma das listas padrão de hoje
 * ({@code ReceitasPadrao.todas()}, que já traz as do catálogo e os exemplos, {@code DietasPadrao.modelos()} e
 * {@code SemanasPadrao.todos()}); o resto fica {@code CONSULTORIA}. O update casa pelo par em todas as consultorias de uma
 * vez: é a mesma regra para todas, sem ler nem cruzar dado entre elas. Fica no pacote {@code db.migration}, fora do
 * {@code ArquiteturaTest}.
 */
public class V115__origem_da_receita extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        try (Statement st = conexao.createStatement()) {
            st.execute("alter table receita add column origem varchar(12) not null default 'CONSULTORIA'");
            st.execute("alter table receita add constraint ck_receita_origem check (origem in ('PADRAO', 'CONSULTORIA'))");
        }
        try (PreparedStatement marca = conexao.prepareStatement(
                "update receita set origem = 'PADRAO' where tipo = ? and nome = ?")) {
            for (String[] par : padroes()) {
                marca.setString(1, par[0]);
                marca.setString(2, par[1]);
                marca.addBatch();
            }
            marca.executeBatch();
        }
    }

    /** Tipo e nome de cada receita padrão de hoje. */
    public static List<String[]> padroes() {
        List<String[]> pares = new ArrayList<>();
        for (ReceitasPadrao.Padrao p : ReceitasPadrao.todas()) pares.add(new String[] {p.tipo().name(), p.nome()});
        for (DietasPadrao.Modelo m : DietasPadrao.modelos()) pares.add(new String[] {Receita.Tipo.PLANO_DIETA.name(), m.nome()});
        for (SemanasPadrao.Modelo m : SemanasPadrao.todos()) pares.add(new String[] {m.tipo().name(), m.nome()});
        return pares;
    }
}
