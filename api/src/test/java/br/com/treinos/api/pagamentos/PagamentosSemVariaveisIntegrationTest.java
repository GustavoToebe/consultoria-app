package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A API subindo como na produção ANTES de existir qualquer variável do recebimento online: as quatro variáveis vazias
 * ({@code TREINOS_PAGAMENTOS_CHAVES}, {@code _CHAVE_ATIVA}, {@code _URL_PUBLICA}) e as duas flags desligadas. O
 * {@code application-test.yml} liga tudo com chaves de teste; aqui as propriedades dinâmicas esvaziam cada uma, então
 * este contexto não herda nada. Prova que a subida não exige nada, que nada do recebimento online responde e que uma
 * credencial cifrada parada no banco (alguém ligou, configurou e desligou) não derruba a subida com a flag desligada.
 */
@AutoConfigureMockMvc
class PagamentosSemVariaveisIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void semNenhumaVariavel(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.habilitado", () -> "false");
        registry.add("treinos.pagamentos.chaves", () -> "");
        registry.add("treinos.pagamentos.chave-ativa", () -> "");
        registry.add("treinos.pagamentos.infinitepay.habilitado", () -> "false");
        registry.add("treinos.pagamentos.infinitepay.url-publica", () -> "");
        // Como a produção: o conciliador agendado vale, mas com a flag desligada ele sai sem fazer nada.
        registry.add("treinos.pagamentos.infinitepay.conciliacao-ativa", () -> "true");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PagamentosProperties pagamentos;
    @Autowired private InfinitePayProperties infinitePay;
    @Autowired private CifraDePagamento cifra;
    @Autowired private VerificacaoDasCredenciais verificacao;
    @Autowired private ConciliadorInfinitePay conciliador;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @Test
    void oContextoSobeSemExigirNadaEAsConfiguracoesFicamVazias() {
        assertThat(pagamentos.habilitado()).isFalse();
        assertThat(pagamentos.chaves()).isEmpty();
        assertThat(pagamentos.chaveAtiva()).isEmpty();
        assertThat(infinitePay.habilitado()).isFalse();
        assertThat(infinitePay.urlPublica()).isEmpty();
        assertThat(infinitePay.conciliacaoAtiva()).isTrue();
        assertThat(cifra.configurada()).isFalse();
        assertThat(cifra.idsDasChaves()).isEmpty();
        assertThatThrownBy(() -> cifra.cifrar(UUID.randomUUID(), "segredo-qualquer-123")).isInstanceOf(CifraIndisponivelException.class);
        // O conciliador agendado, ligado por padrão, sai sem consultar nem gravar nada.
        assertThatCode(conciliador::conciliarAgora).doesNotThrowAnyException();
    }

    @Test
    void euDizQueNadaEstaLigadoETodasAsRotasDoRecebimentoOnlineRespondem503() throws Exception {
        JsonNode eu = api.get("/eu", admin, 200);
        assertThat(eu.get("pagamentosHabilitados").asBoolean()).isFalse();
        assertThat(eu.get("recebimentoOnlineHabilitado").asBoolean()).isFalse();

        String cobranca = UUID.randomUUID().toString();
        JsonNode aluno = api.convidarEEntrar(admin, api.criarAluno(admin, "Aluno Fictício Sem Variáveis " + UUID.randomUUID()));
        String indisponivel = "FINANCEIRO_INDISPONIVEL";
        assertThat(api.get("/financeiro/recebimento-online", admin, 503).path("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "treinador-fake"), 503)
                .path("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.delete("/financeiro/recebimento-online", admin, 503).path("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.get("/financeiro/conferencias", admin, 503).path("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.post("/financeiro/conferencias/" + cobranca + "/conferido", admin, Map.of(), 503)
                .path("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.post("/cobrancas/" + cobranca + "/link", admin, Map.of(), 503).path("codigo").asString())
                .isEqualTo(indisponivel);
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobranca + "/link", aluno, Map.of(), 503)
                .path("codigo").asString()).isEqualTo(indisponivel);

        var aviso = mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/infinitepay/" + "C".repeat(43))
                .contentType("application/json").content("{}")).andReturn().getResponse();
        assertThat(aviso.getStatus()).isEqualTo(503);
        assertThat(json.readTree(aviso.getContentAsString()).path("codigo").asString()).isEqualTo(indisponivel);
    }

    @Test
    void credencialCifradaParadaNoBancoNaoDerrubaASubidaComAFlagDesligada() throws Exception {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
        UUID credencial = UUID.randomUUID();
        // Id de chave ("teste") que a suíte conhece e este contexto não tem: é o caso que a conferência da subida recusaria.
        jdbc.update("insert into credencial_pagamento(id, consultoria_id, provedor, conta, segredo_cifrado, token_aviso) "
                + "values (?::uuid, ?::uuid, 'INFINITEPAY', 'treinador-fake', 'v1:teste:AAAAAAAAAAAAAAAA:BBBB', ?)",
                credencial.toString(), consultoria.toString(), "T".repeat(43));
        try {
            assertThatCode(() -> verificacao.run(null)).doesNotThrowAnyException();

            // Com a flag ligada a mesma credencial derrubaria a subida (a conferência continua valendo).
            var ligada = new InfinitePayProperties(true, null, "https://api.teste.local", false);
            assertThatThrownBy(() -> new VerificacaoDasCredenciais(jdbc, cifra, ligada).run(null))
                    .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("teste:");
        } finally {
            jdbc.update("delete from credencial_pagamento where id = ?::uuid", credencial.toString());
        }
    }
}
