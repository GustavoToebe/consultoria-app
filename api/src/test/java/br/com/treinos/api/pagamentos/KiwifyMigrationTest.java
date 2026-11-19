package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A V095 (Kiwify automática): o que o esquema garante sozinho, sem passar pela API. Dados fictícios. */
@AutoConfigureMockMvc
class KiwifyMigrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private UUID consultoria;
    private UUID outraConsultoria;

    @BeforeEach
    void preparar() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        consultoria = consultoriaDe(api.novoTreinador());
        outraConsultoria = consultoriaDe(api.novoTreinador());
    }

    /** As credenciais de mentira (id de chave "a") derrubariam a subida de qualquer contexto com a Kiwify ligada no banco compartilhado. */
    @AfterEach
    void apagarCredenciais() {
        jdbc.update("delete from credencial_kiwify where consultoria_id in (?, ?)", consultoria, outraConsultoria);
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private void plano(UUID dono, String periodicidade, boolean assinatura, String produto, boolean arquivado) {
        jdbc.update("insert into plano_comercial(id, consultoria_id, nome, valor_centavos, periodicidade, kiwify_assinatura, "
                + "kiwify_produto_id, arquivado_em) values (?, ?, ?, 10000, ?, ?, ?, " + (arquivado ? "now()" : "null") + ")",
                UUID.randomUUID(), dono, "Plano " + UUID.randomUUID(), periodicidade, assinatura, produto);
    }

    private void credencial(UUID dono, String caminho, String anterior, boolean comValidade) {
        jdbc.update("insert into credencial_kiwify(id, consultoria_id, token_webhook_cifrado, client_id_cifrado, "
                + "client_secret_cifrado, account_id_cifrado, token_caminho, token_webhook_anterior_cifrado, anterior_valido_ate) "
                + "values (?, ?, 'v1:a:b:c', 'v1:a:b:c', 'v1:a:b:c', 'v1:a:b:c', ?, ?, " + (comValidade ? "now()" : "null") + ")",
                UUID.randomUUID(), dono, caminho, anterior);
    }

    @Test
    void asColunasNovasExistem() {
        List<String> plano = jdbc.queryForList("select column_name from information_schema.columns "
                + "where table_name = 'plano_comercial' and column_name like 'kiwify_%' order by 1", String.class);
        List<String> aviso = jdbc.queryForList("select column_name from information_schema.columns "
                + "where table_name = 'aviso_de_pagamento' and column_name in ('evento_tipo', 'assinatura_id') order by 1", String.class);
        List<String> credencial = jdbc.queryForList("select column_name from information_schema.columns "
                + "where table_name = 'credencial_kiwify'", String.class);

        assertThat(plano).containsExactly("kiwify_assinatura", "kiwify_produto_id");
        assertThat(aviso).containsExactly("assinatura_id", "evento_tipo");
        assertThat(credencial).contains("token_caminho", "token_webhook_cifrado", "client_id_cifrado", "client_secret_cifrado",
                "account_id_cifrado", "token_webhook_anterior_cifrado", "anterior_valido_ate", "versao");
        // Nenhuma coluna guarda segredo em claro nem o e-mail do comprador.
        assertThat(credencial).noneMatch(c -> c.equals("client_secret") || c.equals("token_webhook") || c.contains("email"));
    }

    @Test
    void aFormaKiwifyEntraNoCheckDaCobranca() {
        String definicao = jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint "
                + "where conname = 'ck_cobranca_forma'", String.class);

        assertThat(definicao).contains("'KIWIFY'", "'DINHEIRO'", "'PIX_DIRETO'", "'TRANSFERENCIA'", "'OUTRO'", "'PIX'", "'BOLETO'", "'CARTAO'");
    }

    @Test
    void oProvedorKiwifyJaCabeNosPadroesDeProvedor() {
        for (String tabela : new String[] {"cobranca_aluno", "aviso_de_pagamento"}) {
            String definicao = jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint where conrelid = ?::regclass "
                    + "and conname in ('ck_cobranca_provedor', 'ck_aviso_provedor')", String.class, tabela);
            assertThat(definicao).contains("[A-Z0-9_]");
        }
    }

    @Test
    void produtoSoComAssinaturaLigadaEEmFormatoValido() {
        assertThatThrownBy(() -> plano(consultoria, "MENSAL", false, "prod-1", false))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_plano_kiwify_produto");
        assertThatThrownBy(() -> plano(consultoria, "MENSAL", true, "com espaco", false))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_plano_kiwify_produto_formato");
        assertThatThrownBy(() -> plano(consultoria, "MENSAL", true, "x".repeat(100) + "y", false))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatCode(() -> plano(consultoria, "MENSAL", true, "x".repeat(100), false)).doesNotThrowAnyException();
        assertThatCode(() -> plano(consultoria, "MENSAL", true, "prod_A-1", false)).doesNotThrowAnyException();
        // Assinatura ligada pode ficar sem produto no banco (a regra "obrigatório" é do serviço, 422 no campo).
        assertThatCode(() -> plano(consultoria, "MENSAL", true, null, false)).doesNotThrowAnyException();
    }

    @Test
    void assinaturaDaKiwifySoEmPlanoMensal() {
        for (String periodicidade : new String[] {"TRIMESTRAL", "SEMESTRAL", "ANUAL", "PARCELA_UNICA"}) {
            assertThatThrownBy(() -> plano(consultoria, periodicidade, true, "prod-" + periodicidade, false))
                    .as(periodicidade).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("ck_plano_kiwify_so_mensal");
        }
        assertThatCode(() -> plano(consultoria, "ANUAL", false, null, false)).doesNotThrowAnyException();
    }

    @Test
    void oProdutoEUnicoPorConsultoriaEntreOsNaoArquivados() {
        String produto = "prod-unico-" + UUID.randomUUID();
        plano(consultoria, "MENSAL", true, produto, false);

        assertThatThrownBy(() -> plano(consultoria, "MENSAL", true, produto, false))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ux_plano_kiwify_produto");
        // Arquivado não ocupa o produto, e outra consultoria pode usar o mesmo id.
        assertThatCode(() -> plano(consultoria, "MENSAL", true, produto, true)).doesNotThrowAnyException();
        assertThatCode(() -> plano(outraConsultoria, "MENSAL", true, produto, false)).doesNotThrowAnyException();
    }

    @Test
    void aCredencialEUmaPorConsultoriaEOTokenDoCaminhoEUnicoNoBanco() {
        String caminho = "c".repeat(43) + UUID.randomUUID().toString().substring(0, 8);
        credencial(consultoria, caminho, null, false);

        assertThatThrownBy(() -> credencial(consultoria, "d".repeat(50) + UUID.randomUUID().toString().substring(0, 8), null, false))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ux_credencial_kiwify_consultoria");
        assertThatThrownBy(() -> credencial(outraConsultoria, caminho, null, false))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ux_credencial_kiwify_token_caminho");
    }

    @Test
    void oTokenAnteriorSempreTemValidade() {
        String caminho = "e".repeat(43) + UUID.randomUUID().toString().substring(0, 8);

        assertThatThrownBy(() -> credencial(consultoria, caminho, "v1:a:b:c", false))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_credencial_kiwify_anterior");
        assertThatThrownBy(() -> credencial(consultoria, caminho, null, true))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_credencial_kiwify_anterior");
        assertThatCode(() -> credencial(consultoria, caminho, "v1:a:b:c", true)).doesNotThrowAnyException();
    }
}
