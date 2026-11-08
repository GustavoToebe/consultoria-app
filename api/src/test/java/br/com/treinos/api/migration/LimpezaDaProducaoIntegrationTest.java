package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import db.migration.V059__limpeza_da_producao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A V059 (limpeza da produção) pela lógica pública e estática da migration ({@code limpar}), com ids próprios: a Toebe some
 * inteira (usuários, sessões e MFA no esquema plataforma), a consultoria passada como "do Saraiva" fica só com o que se mantém
 * e uma terceira, de outro id, não é tocada. Como a migration só zera o id que recebe (nunca varre as consultorias), o teste não
 * mexe no dado dos outros testes, que dividem o mesmo banco. A própria migration já rodou, vazia, na subida do contexto.
 */
@AutoConfigureMockMvc
class LimpezaDaProducaoIntegrationTest extends AbstractIntegrationTest {

    /** Tabelas que a limpeza do conteúdo mantém, linha a linha, na consultoria que continua. */
    private static final Set<String> IGUAIS = Set.of("perfil", "usuario_convite", "inscricao_configuracao", "direitos_locais",
            "conta_comercial_local", "cobranca_local", "alimento", "ergogenico", "exercicio", "exercicio_imagem",
            "plano_comercial", "lancamento_financeiro", "credencial_pagamento", "lembrete_configuracao", "auditoria");

    /** Têm conferência própria: sobra só o treinador / só o dele; a fila é global e entra pelos ids das fotos. */
    private static final Set<String> ESPECIAIS = Set.of("usuario", "aceite_termo", "foto_remocao");

    private static final List<String> DO_PLATAFORMA = List.of("refresh_token", "mfa", "mfa_recuperacao", "redefinicao_token");

    private static final Pattern MARCADOR = Pattern.compile("\\{([A-Z0-9]+)}");

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private DataSource dataSource;
    @Autowired private PasswordEncoder codificador;

    /** Uma consultoria de teste: o treinador, o aluno com acesso e as fotos que entram na fila. */
    private record Cenario(UUID consultoria, UUID treinador, String emailTreinador, UUID usuarioDoAluno, String emailDoAluno,
                           UUID aluno, UUID foto1, UUID foto2, UUID fotoJaRemovida) {
    }

    @Test
    void apagaATesteInteiraZeraAOutraEMantemATerceira() throws Exception {
        Cenario toebe = criar(V059__limpeza_da_producao.ID_DA_CONSULTORIA_DE_TESTE, V059__limpeza_da_producao.NOME_DA_CONSULTORIA_DE_TESTE);
        Cenario saraiva = criar(UUID.randomUUID(), "Consultoria que continua " + UUID.randomUUID());
        Cenario terceira = criar(UUID.randomUUID(), "Terceira consultoria " + UUID.randomUUID());
        for (Cenario c : List.of(toebe, saraiva, terceira)) {
            assertThat(login(c.emailTreinador())).isEqualTo(200);
            assertThat(login(c.emailDoAluno())).isEqualTo(200);
            assertThat(sessoes(c)).isPositive();
        }
        List<String> tabelas = tabelasPorConsultoria();
        assertThat(tabelas).hasSizeGreaterThan(60).contains("receita", "aluno", "auditoria", "usuario");
        Map<String, Long> toebeAntes = contagens(tabelas, toebe.consultoria());
        Map<String, Long> saraivaAntes = contagens(tabelas, saraiva.consultoria());
        Map<String, Long> terceiraAntes = contagens(tabelas, terceira.consultoria());
        assertThat(saraivaAntes.get("receita")).isPositive();
        assertThat(saraivaAntes.get("questionario")).isPositive();
        assertThat(toebeAntes.get("alimento")).isPositive();

        // Trava: o id da Toebe com outro nome esperado não apaga nada, e um id a zerar que não existe também não zera nada.
        executar(c -> assertThat(V059__limpeza_da_producao.limpar(c, toebe.consultoria(), "Outro nome", UUID.randomUUID()))
                .isEqualTo(new V059__limpeza_da_producao.Resultado(false, false)));
        // Id da Toebe que não existe: também não.
        executar(c -> assertThat(V059__limpeza_da_producao.limpar(c, UUID.randomUUID(), "Toebe", UUID.randomUUID()))
                .isEqualTo(new V059__limpeza_da_producao.Resultado(false, false)));
        assertThat(contagens(tabelas, toebe.consultoria())).isEqualTo(toebeAntes);
        assertThat(contagens(tabelas, saraiva.consultoria())).isEqualTo(saraivaAntes);
        assertThat(contagens(tabelas, terceira.consultoria())).isEqualTo(terceiraAntes);
        assertThat(existe(toebe.consultoria())).isTrue();
        assertThat(login(toebe.emailTreinador())).isEqualTo(200);

        // A Toebe some inteira e só a consultoria passada como "do Saraiva" é zerada. A fila das fotos é conferida antes do
        // commit, para o job das fotos não esvaziá-la no meio.
        executar(c -> {
            assertThat(V059__limpeza_da_producao.limpar(c, toebe.consultoria(), V059__limpeza_da_producao.NOME_DA_CONSULTORIA_DE_TESTE,
                    saraiva.consultoria())).isEqualTo(new V059__limpeza_da_producao.Resultado(true, true));
            assertThat(naFila(c, toebe)).containsExactlyInAnyOrder(toebe.foto1(), toebe.foto2());
            assertThat(naFila(c, saraiva)).containsExactlyInAnyOrder(saraiva.foto1(), saraiva.foto2());
            assertThat(naFila(c, terceira)).isEmpty();
        });
        assertThat(existe(toebe.consultoria())).isFalse();
        assertThat(contagens(tabelas, toebe.consultoria()).values()).containsOnly(0L);
        assertThat(contagemDoUsuario(toebe)).isZero();
        assertThat(sessoes(toebe)).isZero();
        assertThat(login(toebe.emailTreinador())).isEqualTo(401);
        assertThat(login(toebe.emailDoAluno())).isEqualTo(401);
        // Outra consultoria (nem a da Toebe nem a "do Saraiva") continua como estava, com o id e o nome diferentes.
        assertThat(contagens(tabelas, terceira.consultoria())).isEqualTo(terceiraAntes);

        // A zerada: sem conteúdo, com o que se mantém.
        assertThat(existe(saraiva.consultoria())).isTrue();
        Map<String, Long> saraivaDepois = contagens(tabelas, saraiva.consultoria());
        for (String tabela : tabelas) {
            if (IGUAIS.contains(tabela)) {
                assertThat(saraivaDepois.get(tabela)).as(tabela).isEqualTo(saraivaAntes.get(tabela)).isPositive();
            } else if (!ESPECIAIS.contains(tabela)) {
                assertThat(saraivaDepois.get(tabela)).as(tabela).isZero();
            }
        }
        // Só a equipe sobra; o aceite do termo e a auditoria do aluno apagado: o evento fica, sem autor.
        assertThat(saraivaDepois.get("usuario")).isEqualTo(1L);
        assertThat(saraivaDepois.get("aceite_termo")).isEqualTo(1L);
        assertThat(banco.queryForObject("select count(*) from usuario where id = ? and papel = 'TREINADOR'", Long.class, saraiva.treinador())).isEqualTo(1L);
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and usuario_id is null and acao in ('ACAO_ALUNO', 'ACAO_SISTEMA')",
                Long.class, saraiva.consultoria())).isEqualTo(2L);
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and usuario_id = ? and acao = 'ACAO_T'",
                Long.class, saraiva.consultoria(), saraiva.treinador())).isEqualTo(1L);
        assertThat(banco.queryForObject("select count(*) from auditoria where usuario_id = ?", Long.class, saraiva.usuarioDoAluno())).isZero();
        // Ip e user agent do aluno apagado saem da auditoria; os do treinador ficam.
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = 'ACAO_ALUNO' and ip is null and user_agent is null",
                Long.class, saraiva.consultoria())).isEqualTo(1L);
        assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = 'ACAO_T' and ip is not null and user_agent is not null",
                Long.class, saraiva.consultoria())).isEqualTo(1L);
        assertThat(banco.queryForObject("select count(*) from usuario where id = ?", Long.class, saraiva.usuarioDoAluno())).isZero();
        // Esquema plataforma: some o do aluno, fica o do treinador (MFA e links); o login do treinador continua e o do aluno não entra.
        assertThat(sessoesDe(saraiva.usuarioDoAluno())).isZero();
        assertThat(sessoesDe(saraiva.treinador())).isPositive();
        assertThat(banco.queryForObject("select count(*) from plataforma.mfa where sujeito = ?", Long.class, saraiva.treinador().toString())).isEqualTo(1L);
        assertThat(login(saraiva.emailTreinador())).isEqualTo(200);
        assertThat(login(saraiva.emailDoAluno())).isEqualTo(401);
        // A terceira consultoria segue intacta, com o aluno entrando.
        assertThat(contagens(tabelas, terceira.consultoria())).isEqualTo(terceiraAntes);
        assertThat(login(terceira.emailDoAluno())).isEqualTo(200);
        // Repetir a migration (a Toebe já não existe) só zera de novo e não muda nada.
        executar(c -> assertThat(V059__limpeza_da_producao.limpar(c, toebe.consultoria(), "Toebe", saraiva.consultoria()))
                .isEqualTo(new V059__limpeza_da_producao.Resultado(false, true)));
        // (o login do meio gravou auditoria, por isso ela fica de fora desta comparação)
        assertThat(contagens(tabelas, saraiva.consultoria())).usingRecursiveComparison().ignoringFields("auditoria").isEqualTo(saraivaDepois);
        assertThat(banco.queryForObject("select count(*) from foto_remocao where objeto = ?", Long.class, saraiva.fotoJaRemovida())).isZero();
    }

    // ---- Montagem do cenário ----

    private Cenario criar(UUID consultoria, String nome) throws Exception {
        String sufixo = UUID.randomUUID().toString().replace("-", "");
        UUID treinador = UUID.randomUUID();
        UUID usuarioDoAluno = UUID.randomUUID();
        UUID aluno = UUID.randomUUID();
        String emailTreinador = ApiDeTeste.emailUnico("limpeza-treinador");
        String emailDoAluno = ApiDeTeste.emailUnico("limpeza-aluno");
        String hash = codificador.encode(ApiDeTeste.SENHA);
        // O gatilho cria os perfis, os questionários padrão e as respostas prontas; o treinador nasce Administrador.
        banco.update("insert into consultoria (id, nome, slug) values (?, ?, ?)", consultoria, nome, "limpeza-" + sufixo);
        banco.update("insert into usuario (id, consultoria_id, email, nome, senha_hash, papel) values (?, ?, ?, 'Treinador fictício', ?, 'TREINADOR')",
                treinador, consultoria, emailTreinador, hash);
        banco.update("insert into usuario (id, consultoria_id, email, nome, senha_hash, papel) values (?, ?, ?, 'Aluno fictício', ?, 'ALUNO')",
                usuarioDoAluno, consultoria, emailDoAluno, hash);
        banco.update("insert into aluno (id, consultoria_id, nome, usuario_id, responsavel_id) values (?, ?, 'Aluno fictício', ?, ?)",
                aluno, consultoria, usuarioDoAluno, treinador);
        banco.update("update usuario set aluno_id = ? where id = ?", aluno, usuarioDoAluno);
        Map<String, String> ids = new HashMap<>(Map.of("C", consultoria.toString(), "T", treinador.toString(),
                "A", aluno.toString(), "U", usuarioDoAluno.toString(), "CODIGO", sufixo));
        String script = new String(getClass().getResourceAsStream("/limpeza/dados-da-consultoria.sql").readAllBytes(), StandardCharsets.UTF_8);
        banco.execute(MARCADOR.matcher(script).replaceAll(m -> ids.computeIfAbsent(m.group(1), k -> UUID.randomUUID().toString())));
        // Ip e user agent fictícios nos eventos do treinador e do aluno, para provar que só os do aluno apagado saem.
        banco.update("update auditoria set ip = '203.0.113.7', user_agent = 'agente-ficticio' where consultoria_id = ? and acao in ('ACAO_T', 'ACAO_ALUNO')",
                consultoria);
        return new Cenario(consultoria, treinador, emailTreinador, usuarioDoAluno, emailDoAluno, aluno,
                UUID.fromString(ids.get("FOTO1")), UUID.fromString(ids.get("FOTO2")), UUID.fromString(ids.get("FOTO3")));
    }

    // ---- Conferências ----

    @FunctionalInterface
    private interface ComConexao {
        void usar(Connection conexao) throws SQLException;
    }

    /** Como a migration: uma conexão, uma transação. */
    private void executar(ComConexao acao) throws SQLException {
        try (Connection conexao = dataSource.getConnection()) {
            conexao.setAutoCommit(false);
            try {
                acao.usar(conexao);
                conexao.commit();
            } catch (SQLException | RuntimeException | Error e) {
                conexao.rollback();
                throw e;
            }
        }
    }

    private int login(String email) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(new ApiDeTeste(mvc, json).corpoLogin(email, ApiDeTeste.SENHA)))
                .andReturn().getResponse().getStatus();
    }

    private List<String> tabelasPorConsultoria() {
        return banco.queryForList("select c.table_name from information_schema.columns c join information_schema.tables t "
                + "on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE' "
                + "where c.table_schema = 'public' and c.column_name = 'consultoria_id' order by 1", String.class);
    }

    /** Linhas por tabela da consultoria (o nome da tabela vem do catálogo do banco, não de entrada). */
    private Map<String, Long> contagens(List<String> tabelas, UUID consultoria) {
        Map<String, Long> mapa = new TreeMap<>();
        for (String tabela : tabelas) {
            if (!tabela.equals("foto_remocao")) {
                mapa.put(tabela, banco.queryForObject("select count(*) from " + tabela + " where consultoria_id = ?", Long.class, consultoria));
            }
        }
        return mapa;
    }

    private boolean existe(UUID consultoria) {
        return banco.queryForObject("select count(*) from consultoria where id = ?", Long.class, consultoria) == 1L;
    }

    private long contagemDoUsuario(Cenario c) {
        return banco.queryForObject("select count(*) from usuario where id in (?, ?)", Long.class, c.treinador(), c.usuarioDoAluno());
    }

    private long sessoes(Cenario c) {
        return sessoesDe(c.treinador()) + sessoesDe(c.usuarioDoAluno());
    }

    /** Tudo o que o esquema plataforma guarda por usuário (refresh, MFA, códigos de recuperação, links). */
    private long sessoesDe(UUID usuario) {
        long total = 0;
        for (String tabela : DO_PLATAFORMA) {
            total += banco.queryForObject("select count(*) from plataforma." + tabela + " where sujeito = ?", Long.class, usuario.toString());
        }
        return total;
    }

    /** Das fotos do cenário, as que estão na fila de remoção, vistas pela conexão da migration (ainda sem commit). */
    private List<UUID> naFila(Connection conexao, Cenario c) throws SQLException {
        List<UUID> achadas = new java.util.ArrayList<>();
        try (PreparedStatement ps = conexao.prepareStatement(
                "select objeto from foto_remocao where objeto in (?, ?, ?) and consultoria_id = ?")) {
            ps.setObject(1, c.foto1());
            ps.setObject(2, c.foto2());
            ps.setObject(3, c.fotoJaRemovida());
            ps.setObject(4, c.consultoria());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    achadas.add(rs.getObject(1, UUID.class));
                }
            }
        }
        return achadas;
    }
}
