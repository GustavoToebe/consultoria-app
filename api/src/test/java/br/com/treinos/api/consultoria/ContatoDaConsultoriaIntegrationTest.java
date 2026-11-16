package br.com.treinos.api.consultoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contato da consultoria, nível 1 (plano contato-da-consultoria, C1/C3/C7): os três campos da Marca (grava, limpa, recusa por
 * campo sem repetir o valor, isolamento), o nome padrão do remetente e o número do WhatsApp só na resposta autenticada do aluno.
 * O envio dos e-mails com esses campos é testado onde o e-mail já é testado (lembrete e convite de equipe).
 */
@AutoConfigureMockMvc
class ContatoDaConsultoriaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private Map<String, Object> marca(JsonNode quem, Map<String, Object> contato) throws Exception {
        JsonNode atual = api.get("/consultoria", quem, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", atual.get("marca").get("nome").asString());
        corpo.put("corPrimaria", atual.get("marca").get("corPrimaria").asString());
        corpo.put("fonteTitulo", "PADRAO");
        corpo.put("temaPadrao", "CLARO");
        corpo.put("versao", atual.get("versao").asLong());
        corpo.putAll(contato);
        return corpo;
    }

    private JsonNode gravar(JsonNode quem, Map<String, Object> contato) throws Exception {
        return api.put("/consultoria/marca", quem, marca(quem, contato), 200);
    }

    @Test
    void gravaOsTresCamposNormalizadosELimpaComBranco() throws Exception {
        JsonNode antes = api.get("/consultoria", treinador, 200);
        assertThat(antes.get("whatsapp").isNull()).isTrue();
        assertThat(antes.get("emailRemetenteNome").isNull()).isTrue();
        assertThat(antes.get("emailResponderPara").isNull()).isTrue();

        JsonNode salva = gravar(treinador, Map.of("whatsapp", "+55 45 99999-8888", "emailRemetenteNome", "  Time Fictício  ",
                "emailResponderPara", " contato@teste.local "));
        assertThat(salva.get("whatsapp").asString()).isEqualTo("(45) 99999-8888");
        assertThat(salva.get("emailRemetenteNome").asString()).isEqualTo("Time Fictício");
        assertThat(salva.get("emailResponderPara").asString()).isEqualTo("contato@teste.local");
        JsonNode lida = api.get("/consultoria", treinador, 200);
        assertThat(lida.get("whatsapp").asString()).isEqualTo("(45) 99999-8888");
        assertThat(lida.get("emailRemetenteNome").asString()).isEqualTo("Time Fictício");
        assertThat(lida.get("emailResponderPara").asString()).isEqualTo("contato@teste.local");
        assertThat(lida.get("versao").asLong()).isGreaterThan(antes.get("versao").asLong());

        // Em branco apaga, campo por campo; nulo ou ausente mantém o gravado (como o telefone do aluno).
        JsonNode branco = gravar(treinador, Map.of("whatsapp", "  ", "emailRemetenteNome", "", "emailResponderPara", " "));
        assertThat(branco.get("whatsapp").isNull()).isTrue();
        assertThat(branco.get("emailRemetenteNome").isNull()).isTrue();
        assertThat(branco.get("emailResponderPara").isNull()).isTrue();
    }

    @Test
    void ausenteOuNuloMantemOGravadoEBrancoApagaCadaCampoSozinho() throws Exception {
        gravar(treinador, Map.of("whatsapp", "(45) 3030-4040", "emailRemetenteNome", "Time Fixo", "emailResponderPara", "fixo@teste.local"));

        // Sem os três campos (a Marca salva sem tocar no contato): nada muda.
        JsonNode semCampos = gravar(treinador, Map.of());
        assertThat(semCampos.get("whatsapp").asString()).isEqualTo("(45) 3030-4040");
        assertThat(semCampos.get("emailRemetenteNome").asString()).isEqualTo("Time Fixo");
        assertThat(semCampos.get("emailResponderPara").asString()).isEqualTo("fixo@teste.local");

        // Nulo explícito é o mesmo que ausente.
        Map<String, Object> nulos = new LinkedHashMap<>();
        nulos.put("whatsapp", null);
        nulos.put("emailRemetenteNome", null);
        nulos.put("emailResponderPara", null);
        JsonNode comNulos = gravar(treinador, nulos);
        assertThat(comNulos.get("whatsapp").asString()).isEqualTo("(45) 3030-4040");
        assertThat(comNulos.get("emailRemetenteNome").asString()).isEqualTo("Time Fixo");
        assertThat(comNulos.get("emailResponderPara").asString()).isEqualTo("fixo@teste.local");

        // Os campos são independentes: em branco só o nome apaga o nome; trocar só o e-mail troca só o e-mail.
        JsonNode semNome = gravar(treinador, Map.of("emailRemetenteNome", "   "));
        assertThat(semNome.get("emailRemetenteNome").isNull()).isTrue();
        assertThat(semNome.get("whatsapp").asString()).isEqualTo("(45) 3030-4040");
        assertThat(semNome.get("emailResponderPara").asString()).isEqualTo("fixo@teste.local");
        JsonNode outroEmail = gravar(treinador, Map.of("emailResponderPara", "novo@teste.local"));
        assertThat(outroEmail.get("emailResponderPara").asString()).isEqualTo("novo@teste.local");
        assertThat(outroEmail.get("whatsapp").asString()).isEqualTo("(45) 3030-4040");

        // Um campo inválido não apaga nem troca os outros: 422 e nada é gravado.
        api.put("/consultoria/marca", treinador, marca(treinador, Map.of("whatsapp", "", "emailResponderPara", "sem-arroba")), 422);
        JsonNode depois = api.get("/consultoria", treinador, 200);
        assertThat(depois.get("whatsapp").asString()).isEqualTo("(45) 3030-4040");
        assertThat(depois.get("emailResponderPara").asString()).isEqualTo("novo@teste.local");

        JsonNode semWhats = gravar(treinador, Map.of("whatsapp", ""));
        assertThat(semWhats.get("whatsapp").isNull()).isTrue();
        assertThat(semWhats.get("emailResponderPara").asString()).isEqualTo("novo@teste.local");
    }

    @Test
    void invalidosDao422PorCampoSemRepetirOValorENadaEGravado() throws Exception {
        String telefone = "12345";
        String nome = "Ruim <b>" + UUID.randomUUID();
        String email = "sem-arroba-" + UUID.randomUUID();
        JsonNode erro = api.put("/consultoria/marca", treinador, marca(treinador,
                Map.of("whatsapp", telefone, "emailRemetenteNome", nome, "emailResponderPara", email)), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("MARCA_INVALIDA");
        List<String> campos = erro.get("fieldErrors").valueStream().map(e -> e.get("field").asString()).toList();
        assertThat(campos).containsExactlyInAnyOrder("whatsapp", "emailRemetenteNome", "emailResponderPara");
        assertThat(erro.toString()).doesNotContain(telefone).doesNotContain(nome).doesNotContain(email);

        // Cada regra do nome da biblioteca recusa sozinha: tamanho, quebra de linha, aspas, controle e separador de linha.
        for (String ruim : List.of("x".repeat(61), "Linha\nnova", "Com \"aspas\"", "Com\u0007controle", "Separador\u2028de linha", "Mais >",
                "Com \\ barra", "Com " + Character.toString(0x202E) + "bidi", "Com" + Character.toString(0x200B) + "largura zero")) {
            JsonNode r = api.put("/consultoria/marca", treinador, marca(treinador, Map.of("emailRemetenteNome", ruim)), 422);
            assertThat(r.get("fieldErrors").get(0).get("field").asString()).isEqualTo("emailRemetenteNome");
        }
        // 60 caracteres (e acentos, por caractere) cabem.
        gravar(treinador, Map.of("emailRemetenteNome", "é".repeat(60)));
        api.put("/consultoria/marca", treinador, marca(treinador, Map.of("emailResponderPara", "a b@teste.local")), 422);
        api.put("/consultoria/marca", treinador, marca(treinador, Map.of("emailResponderPara", "x".repeat(250) + "@t.local")), 422);

        JsonNode depois = api.get("/consultoria", treinador, 200);
        assertThat(depois.get("whatsapp").isNull()).isTrue();
        assertThat(depois.get("emailResponderPara").isNull()).isTrue();
    }

    @Test
    void outraConsultoriaNaoVeNemAlteraOContato() throws Exception {
        gravar(treinador, Map.of("whatsapp", "(45) 99999-8888", "emailRemetenteNome", "Time A", "emailResponderPara", "a@teste.local"));
        JsonNode outro = api.novoTreinador();
        JsonNode docOutro = api.get("/consultoria", outro, 200);
        assertThat(docOutro.get("whatsapp").isNull()).isTrue();
        assertThat(docOutro.get("emailResponderPara").isNull()).isTrue();

        gravar(outro, Map.of("whatsapp", "(11) 98888-7777"));
        JsonNode meu = api.get("/consultoria", treinador, 200);
        assertThat(meu.get("whatsapp").asString()).isEqualTo("(45) 99999-8888");
        assertThat(meu.get("emailRemetenteNome").asString()).isEqualTo("Time A");
    }

    @Test
    void nomePadraoDoRemetenteEONomeDaConsultoriaSaneadoECortado() {
        var c = new Consultoria("  Time <Forte> \"Pro\"\u2028 Fit\n", "slug-" + UUID.randomUUID());
        assertThat(RemetenteDaConsultoria.de(c).nomeRemetente()).isEqualTo("Time Forte Pro Fit");

        var longa = new Consultoria("Consultoria ".repeat(10), "slug-" + UUID.randomUUID());
        String nome = RemetenteDaConsultoria.de(longa).nomeRemetente();
        assertThat(nome).hasSizeLessThanOrEqualTo(60).isEqualTo(("Consultoria ".repeat(10)).substring(0, 60).strip());
        assertThat(RemetenteDaConsultoria.nomeValido(nome)).isTrue();

        assertThat(RemetenteDaConsultoria.de(new Consultoria("<>\"\n", "slug-" + UUID.randomUUID())).nomeRemetente()).isNull();

        c.definirContato(null, "Nome da Marca", "r@teste.local");
        var r = RemetenteDaConsultoria.de(c);
        assertThat(r.nomeRemetente()).isEqualTo("Nome da Marca");
        assertThat(r.responderPara()).isEqualTo("r@teste.local");
        assertThat(r.remetente()).isNull();
    }

    @Test
    void numeroChegaSoAoAlunoPeloEuEFicaForaDaMarcaPublica() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Contato Fictício");
        JsonNode semNumero = api.convidarEEntrar(treinador, alunoId);
        assertThat(api.get("/eu", semNumero, 200).has("whatsappDaConsultoria")).as("sem número, o campo some").isFalse();

        gravar(treinador, Map.of("whatsapp", "(45) 99999-8888"));
        assertThat(api.get("/eu", semNumero, 200).get("whatsappDaConsultoria").asString()).isEqualTo("45999998888");
        // O treinador não recebe o campo no /eu (ele lê o número formatado em GET /consultoria).
        assertThat(api.get("/eu", treinador, 200).has("whatsappDaConsultoria")).isFalse();

        // Nunca na marca que vai sem sessão: login, convite consultado e logo.
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício");
        String codigo = api.post("/alunos/" + outroAluno + "/convite", treinador, null, 200).get("codigo").asString();
        JsonNode consulta = api.post("/publico/convites/consultar", null, Map.of("codigo", codigo), 200);
        assertThat(consulta.toString()).doesNotContainIgnoringCase("whatsapp").doesNotContain("9999-8888").doesNotContain("45999998888");
        JsonNode login = api.convidarEEntrar(treinador, outroAluno);
        assertThat(login.get("marca").toString()).doesNotContainIgnoringCase("whatsapp").doesNotContain("45999998888");
    }
}
