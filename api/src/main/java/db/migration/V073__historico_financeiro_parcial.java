package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

/**
 * Aviso do Financeiro (13/11): a V059 apagou cobranças e contratações da consultoria do Saraiva, então parte do histórico
 * financeiro dela não existe mais. Esta migration cria {@code consultoria.historico_financeiro_parcial} (padrão {@code false})
 * e a liga <b>só</b> para essa consultoria, reaproveitando o id que a V059 já tem (o id continua em um lugar só). O campo é
 * apenas informativo: a API o devolve no painel e nos números para o app mostrar a ressalva; não altera valor, fórmula nem
 * permissão e não declara nenhum período completo. Sem data e sem período (a data real da limpeza em produção não foi
 * confirmada).
 * <p>
 * Roda com o papel do Flyway, fora do {@code TenantContext}: o UPDATE leva o {@code id} da consultoria explícito. Consultoria
 * inexistente (dev, teste) = 0 linhas, sem erro. A lógica é pública e estática para o teste chamá-la com ids próprios; fica no
 * pacote {@code db.migration}, fora do {@code ArquiteturaTest}.
 */
public class V073__historico_financeiro_parcial extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V073__historico_financeiro_parcial.class);

    @Override
    public void migrate(Context context) throws Exception {
        Connection conexao = context.getConnection();
        criarColuna(conexao);
        int ligadas = marcar(conexao, V059__limpeza_da_producao.ID_DA_CONSULTORIA_DO_SARAIVA);
        log.info("V073: consultoria marcada com histórico financeiro parcial: {}", ligadas == 1 ? "sim" : "não");
    }

    /** Idempotente: rodar de novo não muda nada. */
    public static void criarColuna(Connection conexao) throws SQLException {
        try (Statement st = conexao.createStatement()) {
            st.execute("alter table consultoria add column if not exists historico_financeiro_parcial "
                    + "boolean not null default false");
        }
    }

    /** Liga o aviso só na consultoria do id dado; devolve quantas linhas atualizou (0 se o id não existe). Idempotente. */
    public static int marcar(Connection conexao, UUID consultoria) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement(
                "update consultoria set historico_financeiro_parcial = true where id = ?")) {
            ps.setObject(1, consultoria);
            return ps.executeUpdate();
        }
    }
}
