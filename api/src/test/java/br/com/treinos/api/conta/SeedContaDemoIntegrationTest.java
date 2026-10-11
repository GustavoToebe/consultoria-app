package br.com.treinos.api.conta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Dados de demonstração da Minha conta: completos, fictícios, só da consultoria pedida e sem duplicar ao repetir. */
@AutoConfigureMockMvc
class SeedContaDemoIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private SeedContaDemo seed;

    private UUID novaConsultoria() throws Exception {
        JsonNode login = new ApiDeTeste(mvc, json).novoTreinador();
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    private int contar(String tabela, UUID consultoria) {
        return jdbc.queryForObject("select count(*) from " + tabela + " where consultoria_id = ?", Integer.class, consultoria);
    }

    @Test
    void criaPlanoDadosComerciaisESeisCobrancasFicticias() throws Exception {
        UUID consultoria = novaConsultoria();
        UUID outra = novaConsultoria();
        seed.semear(consultoria, "Consultoria Fictícia");

        assertThat(jdbc.queryForMap("select situacao, plano_nome, acesso_liberado, limites::text as limites from direitos_locais "
                + "where consultoria_id = ?", consultoria))
                .containsEntry("situacao", "ATIVA").containsEntry("plano_nome", "Profissional")
                .containsEntry("acesso_liberado", true);
        assertThat(jdbc.queryForObject("select limites ->> 'alunos_ativos' from direitos_locais where consultoria_id = ?",
                String.class, consultoria)).isEqualTo("150");
        assertThat(jdbc.queryForObject("select limites ->> 'membros_equipe' from direitos_locais where consultoria_id = ?",
                String.class, consultoria)).isEqualTo("5");
        assertThat(jdbc.queryForObject("select array_to_string(funcionalidades, ',') from direitos_locais where consultoria_id = ?",
                String.class, consultoria)).isEqualTo("CHECKIN,MOBILIDADE,PDF,EQUIPE");

        assertThat(jdbc.queryForObject("select cliente ->> 'documento' from conta_comercial_local where consultoria_id = ?",
                String.class, consultoria)).isEqualTo("00.000.000/0001-00");
        assertThat(jdbc.queryForObject("select contratacao ->> 'planoNome' from conta_comercial_local where consultoria_id = ?",
                String.class, consultoria)).isEqualTo("Profissional");
        assertThat(jdbc.queryForObject("select cliente -> 'contatos' -> 0 ->> 'email' from conta_comercial_local "
                + "where consultoria_id = ?", String.class, consultoria)).endsWith(".invalid");

        assertThat(contar("cobranca_local", consultoria)).isEqualTo(6);
        assertThat(jdbc.queryForObject("select count(*) from cobranca_local where consultoria_id = ? and situacao = 'PAGA' "
                + "and pago_em is not null", Integer.class, consultoria)).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from cobranca_local where consultoria_id = ? and situacao = 'ABERTA' "
                + "and vencimento < current_date", Integer.class, consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from cobranca_local where consultoria_id = ? and situacao = 'ABERTA' "
                + "and vencimento >= current_date", Integer.class, consultoria)).isEqualTo(1);

        // Só a consultoria pedida ganha dados.
        assertThat(contar("direitos_locais", outra) + contar("conta_comercial_local", outra) + contar("cobranca_local", outra))
                .isZero();
    }

    @Test
    void repetirNaoDuplicaNemSobrescreve() throws Exception {
        UUID consultoria = novaConsultoria();
        seed.semear(consultoria, "Consultoria Fictícia");
        UUID contratacao = jdbc.queryForObject("select contratacao_id from direitos_locais where consultoria_id = ?",
                UUID.class, consultoria);
        seed.semear(consultoria, "Outro nome");
        assertThat(contar("cobranca_local", consultoria)).isEqualTo(6);
        assertThat(contar("direitos_locais", consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select contratacao_id from direitos_locais where consultoria_id = ?", UUID.class,
                consultoria)).isEqualTo(contratacao);
        assertThat(jdbc.queryForObject("select cliente ->> 'nome' from conta_comercial_local where consultoria_id = ?",
                String.class, consultoria)).isEqualTo("Consultoria Fictícia");
    }

    @Test
    void cobrancaVencidaEAbertaComVencimentoAntesDeHoje() {
        var hoje = java.time.LocalDate.of(2026, 10, 11);
        var base = new CobrancaLocal(UUID.randomUUID(), hoje.withDayOfMonth(1), hoje.withDayOfMonth(31), hoje.minusDays(1),
                new java.math.BigDecimal("150.00"), CobrancaLocal.ABERTA, null);
        assertThat(base.vencida(hoje)).isTrue();
        assertThat(new CobrancaLocal(base.id(), base.competenciaInicio(), base.competenciaFim(), hoje, base.valor(),
                CobrancaLocal.ABERTA, null).vencida(hoje)).isFalse();
        for (String situacao : List.of(CobrancaLocal.PAGA, CobrancaLocal.CANCELADA, CobrancaLocal.ISENTA)) {
            assertThat(new CobrancaLocal(base.id(), base.competenciaInicio(), base.competenciaFim(), hoje.minusDays(30),
                    base.valor(), situacao, null).vencida(hoje)).as(situacao).isFalse();
        }
    }
}
