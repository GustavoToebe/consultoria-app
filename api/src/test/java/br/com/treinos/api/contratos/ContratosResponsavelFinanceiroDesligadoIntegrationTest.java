package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Com o financeiro desligado ({@code TREINOS_PAGAMENTOS_HABILITADO=false}) o responsável financeiro não existe para o contrato (D12,
 * S2): pedir o responsável é 409 {@code CONTRATO_RESPONSAVEL_INDISPONIVEL} e só o aluno assina, qualquer que seja a idade.
 */
@AutoConfigureMockMvc
class ContratosResponsavelFinanceiroDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registro) {
        registro.add("treinos.pagamentos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void pedirOResponsavelE409ESoOAlunoAssinaAteOMenor() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        JsonNode modelo = api.post("/contratos/modelos", admin,
                Map.of("nome", "Modelo " + UUID.randomUUID(), "texto", "Contrato de {aluno_nome}, CPF {aluno_cpf}."), 201);
        UUID adulto = aluno(api, admin, null);
        UUID menor = aluno(api, admin, LocalDate.now(Fuso.BRASILIA).minusYears(10));

        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("pedidoId", UUID.randomUUID().toString());
        pedido.put("modeloId", modelo.get("id").asString());
        pedido.put("signatario", "RESPONSAVEL");
        assertThat(api.post("/alunos/" + adulto + "/contratos", admin, pedido, 409).get("codigo").asString())
                .isEqualTo("CONTRATO_RESPONSAVEL_INDISPONIVEL");
        assertThat(api.post("/alunos/" + adulto + "/contratos/previa", admin, pedido, 409).get("codigo").asString())
                .isEqualTo("CONTRATO_RESPONSAVEL_INDISPONIVEL");

        // Sem o financeiro, o adulto e o menor recebem o contrato do aluno, sem link.
        for (UUID quem : new UUID[] {adulto, menor}) {
            pedido.put("pedidoId", UUID.randomUUID().toString());
            pedido.remove("signatario");
            JsonNode criado = api.post("/alunos/" + quem + "/contratos", admin, pedido, 201);
            assertThat(criado.get("signatario").asString()).isEqualTo("ALUNO");
            assertThat(criado.get("link").isNull()).isTrue();
            assertThat(criado.get("grupoId").isNull()).isTrue();
        }
    }

    private static UUID aluno(ApiDeTeste api, JsonNode admin, LocalDate nascimento) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Aluno Sem Financeiro " + UUID.randomUUID());
        corpo.put("cpf", Documentos.cpf());
        if (nascimento != null) {
            corpo.put("dataNascimento", nascimento.toString());
        }
        return UUID.fromString(api.post("/alunos", admin, corpo, 200).get("id").asString());
    }
}
