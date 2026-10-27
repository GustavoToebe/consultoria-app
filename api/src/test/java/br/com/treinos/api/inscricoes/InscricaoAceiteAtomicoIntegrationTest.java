package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.alunos.ConviteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

/**
 * "Nada pela metade" no aceite de inscrição: falha <b>depois</b> de criar o aluno, aceitar a inscrição e atribuir a
 * anamnese (o convite é o último efeito) e prova que tudo é desfeito, inclusive as auditorias da mesma transação.
 * Fica numa classe própria porque o {@code @MockitoSpyBean} muda o contexto de teste: na {@link InscricoesIntegrationTest}
 * ele faria o contexto de todos os testes dela ser outro. Só dados fictícios.
 */
@AutoConfigureMockMvc
class InscricaoAceiteAtomicoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @MockitoSpyBean private ConviteService convites;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    private long contar(String tabela, UUID consultoria) {
        Long total = banco.queryForObject("select count(*) from " + tabela + " where consultoria_id = ?", Long.class,
                consultoria);
        return total == null ? 0 : total;
    }

    private long auditorias(UUID consultoria, String acao) {
        Long total = banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Long.class,
                consultoria, acao);
        return total == null ? 0 : total;
    }

    /** Questionário de anamnese fictício e simples (uma pergunta de texto), publicado. */
    private String anamnesePublicada(String nome) throws Exception {
        JsonNode q = api.post("/questionarios", admin, Map.of("nome", nome, "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        String id = q.path("id").asString();
        Map<String, Object> pergunta = Map.of("id", "queixa", "tipo", "TEXTO", "rotulo", "Conte sobre você.", "obrigatoria", false);
        Map<String, Object> conteudo = Map.of("instrucoes", List.of(),
                "secoes", List.of(Map.of("uid", "s1", "titulo", "Geral", "perguntas", List.of(pergunta))));
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("conteudo", conteudo);
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + id, admin, corpo, 200);
        api.post("/questionarios/" + id + "/publicar", admin,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", false), 200);
        return id;
    }

    /** Abre o link, recebe uma inscrição com e-mail e devolve {id, versao}. */
    private String[] inscricaoNova(String email) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", admin, 200);
        Map<String, Object> config = new HashMap<>();
        config.put("aberta", true);
        config.put("responsavelId", null);
        config.put("texto", null);
        config.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        String codigo = api.put("/inscricoes/configuracao", admin, config, 200).path("codigo").asString();

        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", "Pessoa Fictícia " + UUID.randomUUID());
        corpo.put("whatsapp", "11987654321");
        corpo.put("email", email);
        corpo.put("objetivo", "Objetivo fictício");
        corpo.put("observacao", "Observação fictícia");
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);

        JsonNode lista = api.get("/inscricoes", admin, 200);
        assertThat(lista.path("total").asLong()).isEqualTo(1);
        String id = lista.path("itens").get(0).path("id").asString();
        return new String[] {id, String.valueOf(api.get("/inscricoes/" + id, admin, 200).path("versao").asLong())};
    }

    private Map<String, Object> aceiteComConvite(String versao, String questionarioId) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("convidar", true);
        corpo.put("versao", Long.parseLong(versao));
        corpo.put("anamneseQuestionarioId", questionarioId);
        return corpo;
    }

    /** Status do aceite; a exceção que chega ao MockMvc sem tradução também é uma falha 5xx, só não é bonita. */
    private int statusDoAceite(String inscricaoId, Map<String, Object> corpo) throws Exception {
        try {
            return mvc.perform(MockMvcRequestBuilders.post("/inscricoes/" + inscricaoId + "/aceitar")
                            .header("X-Treinos-Cliente", "nativo")
                            .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                    .andReturn().getResponse().getStatus();
        } catch (jakarta.servlet.ServletException e) {
            return 500;
        }
    }

    @Test
    void falhaAoGerarOConviteDepoisDeCriarAlunoAceitarEAtribuirAnamneseDesfazTudo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String email = ApiDeTeste.emailUnico("aceite-atomico");
        String questionario = anamnesePublicada("Anamnese fictícia " + UUID.randomUUID());
        String[] insc = inscricaoNova(email);
        long alunosAntes = contar("aluno", consultoria);

        int status;
        doThrow(new IllegalStateException("falha simulada")).when(convites).gerar(any(UUID.class));
        try {
            status = statusDoAceite(insc[0], aceiteComConvite(insc[1], questionario));
            // O aceite chegou até o último efeito: foi o convite que falhou, não uma checagem anterior.
            verify(convites).gerar(any(UUID.class));
        } finally {
            reset(convites);
        }

        assertThat(status).isGreaterThanOrEqualTo(500);
        assertThat(contar("aluno", consultoria)).isEqualTo(alunosAntes);
        assertThat(api.get("/inscricoes/" + insc[0], admin, 200).path("situacao").asString()).isEqualTo("NOVA");
        assertThat(contar("anamnese", consultoria)).isZero();
        assertThat(banco.queryForObject("select count(*) from aluno where consultoria_id = ? and lower(email) = ?",
                Long.class, consultoria, email)).isZero();
        assertThat(auditorias(consultoria, "ALUNO_CRIADO")).isZero();
        assertThat(auditorias(consultoria, "ANAMNESE_ATRIBUIDA")).isZero();
        assertThat(auditorias(consultoria, "ALUNO_CONVIDADO")).isZero();
        assertThat(auditorias(consultoria, "INSCRICAO_ACEITA")).isZero();

        // Controle: sem a falha simulada o mesmo pedido passa e todos os efeitos aparecem, uma vez cada.
        JsonNode aceite = api.post("/inscricoes/" + insc[0] + "/aceitar", admin, aceiteComConvite(insc[1], questionario), 200);
        assertThat(aceite.path("convite").path("codigo").asString()).hasSize(10);
        assertThat(aceite.path("anamneseId").asString()).isNotBlank();
        assertThat(contar("aluno", consultoria)).isEqualTo(alunosAntes + 1);
        assertThat(auditorias(consultoria, "ALUNO_CRIADO")).isEqualTo(1);
        assertThat(auditorias(consultoria, "ANAMNESE_ATRIBUIDA")).isEqualTo(1);
        assertThat(auditorias(consultoria, "ALUNO_CONVIDADO")).isEqualTo(1);
        assertThat(auditorias(consultoria, "INSCRICAO_ACEITA")).isEqualTo(1);
    }
}
