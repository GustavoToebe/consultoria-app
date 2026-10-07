package br.com.treinos.api.tenant;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Seção 15.1, item 2 (parte da fase 1): o {@code @TenantId} isola as consultorias e falha de forma segura sem
 * contexto. As rotas de treinador e aluno ganham os testes HTTP de isolamento na fase 2.
 */
@AutoConfigureMockMvc
class IsolamentoTenantIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private AlunoRepository alunos;

    private UUID consultoriaA;
    private UUID consultoriaB;
    private JsonNode loginA;

    @BeforeEach
    void criarDuasConsultorias() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        loginA = api.cadastrarTreinador(ApiDeTeste.emailUnico("a"));
        consultoriaA = UUID.fromString(loginA.get("marca").get("id").asString());
        consultoriaB = UUID.fromString(api.cadastrarTreinador(ApiDeTeste.emailUnico("b")).get("marca").get("id").asString());
    }

    @AfterEach
    void semContextoSobrando() {
        assertThat(TenantContext.get()).isNull();
    }

    @Test
    void consultoriaBNaoEnxergaAlunoDaA() {
        Aluno doA = TenantContext.executarComo(consultoriaA,
                () -> alunos.saveAndFlush(new Aluno("Aluno Fictício A", null, null, null)));
        assertThat(doA.getConsultoriaId()).isEqualTo(consultoriaA);

        assertThat(TenantContext.executarComo(consultoriaA, () -> alunos.findById(doA.getId()))).isPresent();
        assertThat(TenantContext.executarComo(consultoriaB, () -> alunos.findById(doA.getId()))).isEmpty();
        List<Aluno> vistosPorB = TenantContext.executarComo(consultoriaB, () -> alunos.findAll());
        assertThat(vistosPorB).extracting(Aluno::getId).doesNotContain(doA.getId());
    }

    @Test
    void semContextoLeituraVoltaVaziaEEscritaFalha() {
        TenantContext.executarComo(consultoriaA,
                () -> alunos.saveAndFlush(new Aluno("Aluno Fictício", null, null, null)));

        assertThat(alunos.findAll()).isEmpty();
        assertThatThrownBy(() -> alunos.saveAndFlush(new Aluno("Sem consultoria", null, null, null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void consultoriaDaSessaoVemDoBancoENaoDoToken() throws Exception {
        mvc.perform(get("/eu").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marca.id").value(consultoriaA.toString()));
    }
}
