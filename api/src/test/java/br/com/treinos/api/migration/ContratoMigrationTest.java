package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V105 sobre dados da V104 (e, no segundo teste, a V109 sobre o esquema da V105): o prazo da consultoria (1 a 60), o nome único do modelo entre os ativos, a FK composta do contrato com o
 * aluno, o pedido único por consultoria, o CHECK das evidências da assinatura, o cancelamento com motivo, o texto só no modelo, o
 * limite do arquivo e a FK sem cascata do aluno. Usa outro banco na mesma instância, migrado até a V104. Só dados fictícios.
 */
class ContratoMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeee1051");
    private static final UUID OUTRA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeee1052");
    private static final UUID ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa1051");
    private static final UUID CONSULTORIA_109 = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeee1091");
    private static final UUID ALUNO_109 = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa1091");
    private static final String HASH = "a".repeat(64);

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void v105AceitaOContratoERecusaOQueFereAsRegras() throws Exception {
        String banco = "v105_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("104").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID consultoria : new UUID[]{CONSULTORIA, OUTRA}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + consultoria + "', 'Consultoria fictícia V105', 'v105-"
                            + consultoria + "')");
                }
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ALUNO + "', '" + CONSULTORIA + "', 'Aluno fictício')");

                assertThat(flyway(banco).target("105").load().migrate().migrationsExecuted).isEqualTo(1);

                // Prazo da consultoria: nulo vale, 1 a 60 vale, fora disso não.
                st.execute("update consultoria set contrato_prazo_dias = 7 where id = '" + CONSULTORIA + "'");
                assertThatThrownBy(() -> st.execute("update consultoria set contrato_prazo_dias = 0 where id = '" + CONSULTORIA + "'"))
                        .hasMessageContaining("ck_consultoria_contrato_prazo");
                assertThatThrownBy(() -> st.execute("update consultoria set contrato_prazo_dias = 61 where id = '" + CONSULTORIA + "'"))
                        .hasMessageContaining("ck_consultoria_contrato_prazo");

                // Modelo: nome único entre os ativos (sem diferença de caixa); arquivar libera o nome.
                UUID modelo = UUID.randomUUID();
                st.execute(modelo(CONSULTORIA, modelo, "Contrato padrão"));
                assertThatThrownBy(() -> st.execute(modelo(CONSULTORIA, UUID.randomUUID(), "CONTRATO PADRÃO")))
                        .hasMessageContaining("ux_contrato_modelo_nome");
                st.execute("update contrato_modelo set arquivado_em = now() where id = '" + modelo + "'");
                st.execute(modelo(CONSULTORIA, UUID.randomUUID(), "Contrato padrão"));
                st.execute(modelo(OUTRA, UUID.randomUUID(), "Contrato padrão"));

                // Contrato pendente, o pedido único e o aluno de outra consultoria.
                UUID pedido = UUID.randomUUID();
                UUID contrato = UUID.randomUUID();
                st.execute(contrato(CONSULTORIA, contrato, ALUNO, pedido));
                assertThatThrownBy(() -> st.execute(contrato(CONSULTORIA, UUID.randomUUID(), ALUNO, pedido)))
                        .hasMessageContaining("ux_contrato_pedido");
                assertThatThrownBy(() -> st.execute(contrato(OUTRA, UUID.randomUUID(), ALUNO, UUID.randomUUID())))
                        .hasMessageContaining("fk_contrato_aluno");
                // O hash só vale com 64 hexadecimais minúsculos.
                assertThatThrownBy(() -> st.execute(contrato(CONSULTORIA, UUID.randomUUID(), ALUNO, UUID.randomUUID())
                        .replace(HASH, "Z".repeat(64)))).hasMessageContaining("ck_contrato_sha256");

                // Assinado exige todas as evidências; evidência numa pendente também é recusada.
                assertThatThrownBy(() -> st.execute("update contrato_aluno set situacao = 'ASSINADO' where id = '" + contrato + "'"))
                        .hasMessageContaining("ck_contrato_assinado");
                assertThatThrownBy(() -> st.execute("update contrato_aluno set assinante_ip = '127.0.0.1' where id = '" + contrato + "'"))
                        .hasMessageContaining("ck_contrato_assinado");
                // Cancelado exige data e motivo.
                assertThatThrownBy(() -> st.execute("update contrato_aluno set situacao = 'CANCELADO' where id = '" + contrato + "'"))
                        .hasMessageContaining("ck_contrato_cancelado");
                st.execute("update contrato_aluno set situacao = 'CANCELADO', cancelado_em = now(), "
                        + "motivo_cancelamento = 'Erro de digitação' where id = '" + contrato + "'");

                // PDF: sem texto e sem modelo; o arquivo sai junto com o contrato.
                UUID pdf = UUID.randomUUID();
                st.execute("insert into contrato_aluno(id, consultoria_id, aluno_id, origem, titulo, sha256, signatario, pedido_id) values ('"
                        + pdf + "', '" + CONSULTORIA + "', '" + ALUNO + "', 'PDF', 'Contrato em PDF', '" + HASH
                        + "', 'ALUNO', gen_random_uuid())");
                assertThatThrownBy(() -> st.execute("update contrato_aluno set texto = 'qualquer' where id = '" + pdf + "'"))
                        .hasMessageContaining("ck_contrato_texto_so_no_modelo");
                st.execute("insert into contrato_arquivo(contrato_id, consultoria_id, bytes) values ('" + pdf + "', '" + CONSULTORIA
                        + "', '\\x255044462d'::bytea)");
                assertThat(contar(c, "select count(*) from contrato_arquivo where contrato_id = '" + pdf + "'")).isEqualTo(1);

                // Sem cascata (D25): o aluno com contrato não se apaga; o arquivo sai junto com o contrato.
                assertThatThrownBy(() -> st.execute("delete from aluno where id = '" + ALUNO + "'"))
                        .hasMessageContaining("fk_contrato_aluno");
                st.execute("delete from contrato_aluno where id = '" + pdf + "'");
                assertThat(contar(c, "select count(*) from contrato_arquivo where contrato_id = '" + pdf + "'")).isZero();
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    /**
     * V109 sobre o esquema da V105: o responsável só assina com a declaração de responsável legal e o aluno nunca a leva; {@code apagado_em}
     * só existe no assinado e, nele, sem nenhuma evidência (a guarda do D16); o texto do modelo só pode sumir com {@code apagado_em}; o
     * grupo do par aluno + responsável é uma coluna livre.
     */
    @Test
    void v109ExigeADeclaracaoDoResponsavelEApagadoEmSoNoAssinado() throws Exception {
        String banco = "v109_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("105").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA_109 + "', 'Consultoria fictícia V109', 'v109-"
                        + CONSULTORIA_109 + "')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ALUNO_109 + "', '" + CONSULTORIA_109
                        + "', 'Aluno fictício')");
                flyway(banco).load().migrate();

                // Responsável pendente com link e grupo; o aluno do par é outra linha do mesmo grupo.
                UUID grupo = UUID.randomUUID();
                UUID responsavel = UUID.randomUUID();
                st.execute("insert into contrato_aluno(id, consultoria_id, aluno_id, origem, titulo, texto, sha256, signatario, pedido_id,"
                        + " grupo_id, link_hash, link_expira_em) values ('" + responsavel + "', '" + CONSULTORIA_109 + "', '" + ALUNO_109
                        + "', 'MODELO', 'Contrato fictício', 'Texto fictício.', '" + HASH + "', 'RESPONSAVEL', gen_random_uuid(), '"
                        + grupo + "', '" + "b".repeat(64) + "', now() + interval '1 day')");
                UUID doAluno = UUID.randomUUID();
                st.execute(contrato(CONSULTORIA_109, doAluno, ALUNO_109, UUID.randomUUID()));
                st.execute("update contrato_aluno set grupo_id = '" + grupo + "' where id = '" + doAluno + "'");
                assertThat(contar(c, "select count(*) from contrato_aluno where grupo_id = '" + grupo + "'")).isEqualTo(2);

                // Responsável assinado exige o CPF e a declaração: sem ela (nula ou falsa) o CHECK recusa.
                String evidencias = "situacao = 'ASSINADO', assinado_em = now(), assinante_nome = 'Responsável Fictício', "
                        + "assinante_cpf = '123.456.789-09', assinante_ip = '127.0.0.1', assinante_agente = 'teste'";
                String assinar = "update contrato_aluno set " + evidencias + " where id = '" + responsavel + "'";
                assertThatThrownBy(() -> st.execute(assinar)).hasMessageContaining("ck_contrato_assinado");
                assertThatThrownBy(() -> st.execute("update contrato_aluno set " + evidencias
                        + ", assinante_declarou_responsavel = false where id = '" + responsavel + "'"))
                        .hasMessageContaining("ck_contrato_assinado");
                st.execute("update contrato_aluno set " + evidencias + ", assinante_declarou_responsavel = true where id = '"
                        + responsavel + "'");
                // O aluno nunca leva a declaração, e a declaração sem assinatura também é recusada.
                assertThatThrownBy(() -> st.execute("update contrato_aluno set assinante_declarou_responsavel = true where id = '"
                        + doAluno + "'")).hasMessageContaining("ck_contrato_assinado");

                // apagado_em só no assinado (o pendente recusa) e, nele, sem nenhuma evidência.
                assertThatThrownBy(() -> st.execute("update contrato_aluno set apagado_em = now() where id = '" + doAluno + "'"))
                        .hasMessageContaining("ck_contrato_apagado");
                assertThatThrownBy(() -> st.execute("update contrato_aluno set apagado_em = now() where id = '" + responsavel + "'"))
                        .hasMessageContaining("ck_contrato_assinado");
                // O texto do modelo só sai com apagado_em (a guarda), nunca de um contrato vivo.
                assertThatThrownBy(() -> st.execute("update contrato_aluno set texto = null where id = '" + doAluno + "'"))
                        .hasMessageContaining("ck_contrato_texto_so_no_modelo");
                st.execute("update contrato_aluno set apagado_em = now(), texto = null, assinado_em = null, assinante_nome = null, "
                        + "assinante_cpf = null, assinante_ip = null, assinante_agente = null, assinante_declarou_responsavel = null, "
                        + "link_hash = null, link_expira_em = null where id = '" + responsavel + "'");
                assertThat(contar(c, "select count(*) from contrato_aluno where id = '" + responsavel
                        + "' and situacao = 'ASSINADO' and apagado_em is not null")).isEqualTo(1);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String modelo(UUID consultoria, UUID id, String nome) {
        return "insert into contrato_modelo(id, consultoria_id, nome, texto) values ('" + id + "', '" + consultoria + "', '" + nome
                + "', 'Texto fictício do contrato.')";
    }

    private static String contrato(UUID consultoria, UUID id, UUID aluno, UUID pedido) {
        return "insert into contrato_aluno(id, consultoria_id, aluno_id, origem, titulo, texto, sha256, signatario, pedido_id) values ('"
                + id + "', '" + consultoria + "', '" + aluno + "', 'MODELO', 'Contrato fictício', 'Texto fictício.', '" + HASH
                + "', 'ALUNO', '" + pedido + "')";
    }

    private static int contar(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private FluentConfiguration flyway(String banco) {
        return Flyway.configure().dataSource(urlDe(banco), usuarioAdmin, senhaAdmin)
                .locations("classpath:db/migration").placeholders(Map.of("papelApp", ""));
    }

    private void admin(String banco, String comando) throws Exception {
        try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
            st.execute(comando);
        }
    }

    private String urlDe(String banco) {
        int barra = urlPadrao.indexOf('/', "jdbc:postgresql://".length());
        int interrogacao = urlPadrao.indexOf('?', barra);
        String resto = interrogacao < 0 ? "" : urlPadrao.substring(interrogacao);
        return urlPadrao.substring(0, barra + 1) + banco + resto;
    }
}
