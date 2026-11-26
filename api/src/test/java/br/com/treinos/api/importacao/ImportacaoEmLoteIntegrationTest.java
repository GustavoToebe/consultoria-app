package br.com.treinos.api.importacao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Importação de ~500 alunos e ~2000 pesos de uma vez: o resultado por linha é o mesmo, gravado em lote. Dados fictícios. */
@AutoConfigureMockMvc
class ImportacaoEmLoteIntegrationTest extends AbstractIntegrationTest {

    private static final int ALUNOS = 500;
    private static final int PESOS_POR_ALUNO = 4;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        treinador = new ApiDeTeste(mvc, json).novoTreinador();
    }

    @Test
    void alunosEPesosEmLote() throws Exception {
        String prefixo = UUID.randomUUID().toString().substring(0, 8);
        String padrao = "lote-" + prefixo + "-%";
        List<String> emails = new ArrayList<>();
        StringBuilder alunos = new StringBuilder("nome;email;cpf\n");
        String primeiroCpf = null;
        for (int i = 0; i < ALUNOS; i++) {
            String email = "lote-" + prefixo + "-" + i + "@exemplo.com";
            emails.add(email);
            String cpf = Documentos.cpf();
            primeiroCpf = primeiroCpf == null ? cpf : primeiroCpf;
            alunos.append("Aluno Lote ").append(i).append(';').append(email).append(';').append(cpf).append('\n');
        }
        // última linha: CPF repetido na própria planilha, com outro e-mail
        alunos.append("Repetido Lote;repetido-").append(prefixo).append("@exemplo.com;").append(primeiroCpf).append('\n');
        String configAluno = json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", 1, "chave", "email",
                "existentes", "ATUALIZAR", "mapeamento", Map.of("nome", 0, "email", 1, "cpf", 2)));

        JsonNode resultadoAlunos = enviar("alunos", alunos.toString(), configAluno);
        assertThat(resultadoAlunos.path("novos").asInt()).isEqualTo(ALUNOS);
        assertThat(resultadoAlunos.path("comErro").asInt()).isEqualTo(1);
        assertThat(resultadoAlunos.path("erros").get(0).path("linha").asInt()).isEqualTo(ALUNOS + 2);
        assertThat(resultadoAlunos.path("erros").get(0).path("campo").asString()).isEqualTo("cpf");
        assertThat(jdbc.queryForObject("select count(*) from aluno where email like ?", Integer.class, padrao)).isEqualTo(ALUNOS);

        StringBuilder pesos = new StringBuilder("aluno;data;peso\n");
        for (int i = 0; i < ALUNOS; i++) {
            for (int d = 0; d < PESOS_POR_ALUNO; d++) {
                pesos.append(emails.get(i)).append(";0").append(d + 1).append("/01/2026;").append(70 + d).append(",5\n");
            }
        }
        pesos.append("naoexiste-").append(prefixo).append("@exemplo.com;01/01/2026;70\n"); // aluno desconhecido
        pesos.append(emails.get(0)).append(";01/01/2026;99\n"); // mesmo dia da primeira linha: vira atualização
        String configPeso = json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", 1, "chave", "email",
                "existentes", "SUBSTITUIR", "mapeamento", Map.of("aluno", 0, "data", 1, "peso", 2)));

        JsonNode resultadoPesos = enviar("pesos", pesos.toString(), configPeso);
        assertThat(resultadoPesos.path("novos").asInt()).isEqualTo(ALUNOS * PESOS_POR_ALUNO);
        assertThat(resultadoPesos.path("atualizados").asInt()).isEqualTo(1);
        assertThat(resultadoPesos.path("comErro").asInt()).isEqualTo(1);
        assertThat(resultadoPesos.path("erros").get(0).path("linha").asInt()).isEqualTo(ALUNOS * PESOS_POR_ALUNO + 2);
        assertThat(jdbc.queryForObject("""
                select count(*) from registro_peso p join aluno a on a.id = p.aluno_id where a.email like ?""",
                Integer.class, padrao)).isEqualTo(ALUNOS * PESOS_POR_ALUNO);
        assertThat(jdbc.queryForObject("""
                select p.peso_kg from registro_peso p join aluno a on a.id = p.aluno_id
                 where a.email = ? and p.data = date '2026-01-01'""", BigDecimal.class, emails.get(0)))
                .isEqualByComparingTo("99");

        // segunda passada: tudo que existe é atualizado (alunos) ou substituído (pesos), sem erro novo
        JsonNode denovoAlunos = enviar("alunos", alunos.toString(), configAluno);
        assertThat(denovoAlunos.path("novos").asInt()).isZero();
        assertThat(denovoAlunos.path("atualizados").asInt()).isEqualTo(ALUNOS);
        JsonNode denovoPesos = enviar("pesos", pesos.toString(), configPeso);
        assertThat(denovoPesos.path("novos").asInt()).isZero();
        assertThat(denovoPesos.path("atualizados").asInt()).isEqualTo(ALUNOS * PESOS_POR_ALUNO + 1);
    }

    /** Prévia, depois confirmação com o hash dela; só a confirmação é cronometrada (a saída vai para o relatório). */
    private JsonNode enviar(String destino, String csv, String config) throws Exception {
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        JsonNode previa = multipartar(destino + "/previa", bytes, config, null);
        long inicio = System.nanoTime();
        JsonNode confirmada = multipartar(destino, bytes, config, previa.path("hash").asString());
        System.out.printf("MEDIDA confirmar %s: %d ms%n", destino, (System.nanoTime() - inicio) / 1_000_000);
        return confirmada;
    }

    private JsonNode multipartar(String caminho, byte[] bytes, String config, String hash) throws Exception {
        var pedido = multipart("/importacoes/" + caminho)
                .file(new MockMultipartFile("arquivo", "lote.csv", "text/csv", bytes))
                .file(new MockMultipartFile("configuracao", "config.json", "application/json", config.getBytes(StandardCharsets.UTF_8)))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                .header("X-Treinos-Cliente", "nativo");
        if (hash != null) {
            pedido.param("hash", hash);
        }
        String texto = mvc.perform(pedido).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(texto);
    }
}
