package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import db.migration.V059__limpeza_da_producao;
import db.migration.V073__historico_financeiro_parcial;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A V073 (aviso de histórico financeiro parcial): pela lógica pública e estática, com ids próprios ({@code marcar} liga só a
 * consultoria escolhida, as outras e as novas ficam {@code false}, repetir não muda nada e id inexistente não faz nada), e
 * pelo {@code migrate(Context)} real, que liga só a consultoria do Saraiva e é idempotente. A própria migration já rodou na
 * subida do contexto (a consultoria do Saraiva não existe aqui: 0 linhas, sem erro).
 */
class HistoricoFinanceiroParcialMigrationTest extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate banco;
    @Autowired private DataSource dataSource;
    @Autowired private ConsultoriaRepository consultorias;

    private UUID consultoria() {
        UUID id = UUID.randomUUID();
        banco.update("insert into consultoria (id, nome, slug) values (?, ?, ?)", id, "Histórico " + id, "historico-" + id);
        return id;
    }

    private int marcar(UUID id) {
        return banco.execute((ConnectionCallback<Integer>) c -> V073__historico_financeiro_parcial.marcar(c, id));
    }

    private boolean valorNoBanco(UUID id) {
        return Boolean.TRUE.equals(banco.queryForObject(
                "select historico_financeiro_parcial from consultoria where id = ?", Boolean.class, id));
    }

    @Test
    void marcaSoAEscolhidaERepetirNaoMudaNada() {
        UUID escolhida = consultoria();
        UUID outra = consultoria();
        assertThat(valorNoBanco(escolhida)).isFalse();
        assertThat(valorNoBanco(outra)).isFalse();

        assertThat(marcar(escolhida)).isEqualTo(1);
        assertThat(valorNoBanco(escolhida)).isTrue();
        assertThat(valorNoBanco(outra)).isFalse();
        // Idempotente: de novo, o mesmo resultado e nada muda.
        assertThat(marcar(escolhida)).isEqualTo(1);
        assertThat(valorNoBanco(escolhida)).isTrue();
        assertThat(valorNoBanco(outra)).isFalse();
        // A consultoria que nasce depois também começa sem o aviso.
        assertThat(valorNoBanco(consultoria())).isFalse();
        // Criar a coluna de novo não apaga a marca.
        banco.execute((ConnectionCallback<Void>) c -> {
            V073__historico_financeiro_parcial.criarColuna(c);
            return null;
        });
        assertThat(valorNoBanco(escolhida)).isTrue();
    }

    @Test
    void idInexistenteNaoFazNadaESemErro() {
        UUID existente = consultoria();
        assertThat(marcar(UUID.randomUUID())).isZero();
        assertThat(valorNoBanco(existente)).isFalse();
    }

    private static void inserirConsultoria(Connection conexao, UUID id) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement("insert into consultoria (id, nome, slug) values (?, ?, ?)")) {
            ps.setObject(1, id);
            ps.setString(2, "Migrate " + id);
            ps.setString(3, "migrate-" + id);
            ps.executeUpdate();
        }
    }

    /** Lê pela conexão da própria transação: outra conexão não enxerga a linha ainda não confirmada. */
    private static boolean marcadaNaConexao(Connection conexao, UUID id) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement("select historico_financeiro_parcial from consultoria where id = ?")) {
            ps.setObject(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).as("a consultoria inserida deveria existir").isTrue();
                return rs.getBoolean(1);
            }
        }
    }

    /**
     * O {@code migrate(Context)} de verdade, não só as partes estáticas: liga a consultoria do Saraiva (id da V059) e deixa as
     * comuns em {@code false}; rodar de novo dá o mesmo resultado. Tudo numa conexão sem autocommit e desfeito no fim, porque o
     * banco de teste é compartilhado e não pode ficar linha nem a consultoria do Saraiva.
     */
    @Test
    void migrateRealLigaSoOSaraivaEEIdempotente() throws Exception {
        UUID saraiva = V059__limpeza_da_producao.ID_DA_CONSULTORIA_DO_SARAIVA;
        UUID comumA = UUID.randomUUID();
        UUID comumB = UUID.randomUUID();
        Connection conexao = dataSource.getConnection();
        try {
            conexao.setAutoCommit(false);
            inserirConsultoria(conexao, saraiva);
            inserirConsultoria(conexao, comumA);
            inserirConsultoria(conexao, comumB);
            Context contexto = mock(Context.class);
            when(contexto.getConnection()).thenReturn(conexao);
            V073__historico_financeiro_parcial migration = new V073__historico_financeiro_parcial();

            for (int vez = 1; vez <= 2; vez++) {
                migration.migrate(contexto);
                assertThat(marcadaNaConexao(conexao, saraiva)).as("Saraiva, execução %d", vez).isTrue();
                assertThat(marcadaNaConexao(conexao, comumA)).as("comum A, execução %d", vez).isFalse();
                assertThat(marcadaNaConexao(conexao, comumB)).as("comum B, execução %d", vez).isFalse();
            }
        } finally {
            try {
                conexao.rollback();
            } finally {
                conexao.close();
            }
        }
        assertThat(banco.queryForObject("select count(*) from consultoria where id in (?, ?, ?)", Integer.class,
                saraiva, comumA, comumB)).isZero();
    }

    @Test
    void aEntidadeCarregadaPelaJpaTrazOValor() {
        UUID marcada = consultoria();
        UUID comum = consultoria();
        marcar(marcada);
        assertThat(consultorias.findById(marcada).orElseThrow().isHistoricoFinanceiroParcial()).isTrue();
        assertThat(consultorias.findById(comum).orElseThrow().isHistoricoFinanceiroParcial()).isFalse();
    }
}
