package br.com.treinos.api.web;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C76: cada rota que recebe data confere a faixa do tipo de campo (planejamento: 01/01/2000 até 31/12 do ano de hoje + 5;
 * registro: 01/01/1900 até hoje) e responde 422 com o campo certo e sem repetir o valor. Reproduz também como o ano 0260
 * entrou na conta de teste (o app deixava digitar e a API gravava sem olhar). Só dados fictícios.
 */
@AutoConfigureMockMvc
class DatasValidasIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    /** Último dia aceito no planejamento: 31/12 do ano de hoje + 5. */
    private final LocalDate teto = LocalDate.of(hoje.getYear() + 5, 12, 31);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Datas Fictício");
    }

    /**
     * O valor recusado fora das mensagens da resposta. Confere só {@code message} e {@code fieldErrors}: o corpo
     * inteiro traz o {@code timestamp} em UTC, que depois das 21h de Brasília cai na data de "amanhã".
     */
    private static void semOValor(JsonNode resposta, String valorProibido) {
        assertThat(resposta.path("message").asString("")).doesNotContain(valorProibido);
        assertThat(resposta.path("fieldErrors").toString()).doesNotContain(valorProibido);
    }

    /** O erro no campo certo e o valor recusado fora do texto da resposta. */
    private static void recusa(JsonNode resposta, String campo, String valorProibido) {
        assertThat(resposta.get("fieldErrors")).extracting(e -> e.get("field").asString()).contains(campo);
        semOValor(resposta, valorProibido);
    }

    private static void recusaComCodigo(JsonNode resposta, String codigo, String campo, String valorProibido) {
        assertThat(resposta.get("codigo").asString()).isEqualTo(codigo);
        recusa(resposta, campo, valorProibido);
    }

    private static String mensagemDoCampo(JsonNode resposta, String campo) {
        for (JsonNode e : resposta.get("fieldErrors")) {
            if (campo.equals(e.get("field").asString())) return e.get("message").asString();
        }
        throw new AssertionError("sem erro no campo " + campo);
    }

    private JsonNode pasta(String inicio, String fim, int status) throws Exception {
        return api.post("/alunos/" + aluno + "/pastas", treinador, Map.of("titulo", "Plano", "inicio", inicio, "fim", fim), status);
    }

    @Test
    void reproduzOAno0260NaPasta() throws Exception {
        // Antes da correção a API gravava (200) a pasta de 0260; o app deixava digitar "01/11/0260" e enviava.
        JsonNode r = pasta("0260-11-01", "0260-11-30", 422);
        recusaComCodigo(r, "PERIODO_INVALIDO", "inicio", "0260");
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200)).isEmpty();
    }

    @Test
    void pastaConfereInicioEFimNaFaixaDePlanejamento() throws Exception {
        String depoisDoTeto = teto.plusDays(1).toString();
        JsonNode r = pasta("1999-12-31", depoisDoTeto, 422);
        recusa(r, "inicio", "1999");
        recusa(r, "fim", depoisDoTeto);
        assertThat(mensagemDoCampo(r, "inicio")).isEqualTo("Início da pasta: use uma data entre 01/01/2000 e 31/12/" + teto.getYear());
        // Dentro da faixa, nas duas bordas.
        String id = pasta("2000-01-01", teto.toString(), 200).get("id").asString();
        // Atualizar e replicar passam pela mesma conferência.
        recusa(api.put("/pastas/" + id, treinador, Map.of("titulo", "Plano", "inicio", "0261-01-01", "fim", "2026-12-01"), 422), "inicio", "0261");
        recusa(api.put("/pastas/" + id, treinador, Map.of("titulo", "Plano", "inicio", "2026-11-01", "fim", "9999-12-31"), 422), "fim", "9999");
        api.put("/pastas/" + id, treinador, Map.of("titulo", "Plano", "inicio", "2026-11-01", "fim", "2026-11-30"), 200);
        recusa(api.post("/pastas/" + id + "/replicar", treinador,
                Map.of("titulo", "Cópia", "inicio", "0260-12-01", "fim", "0260-12-30"), 422), "inicio", "0260");
        api.post("/pastas/" + id + "/replicar", treinador, Map.of("titulo", "Cópia", "inicio", "2026-12-01", "fim", "2026-12-30"), 200);
        // Fim antes do início continua 400, como antes.
        pasta("2026-12-30", "2026-12-01", 400);
    }

    @Test
    void finalizarPastaConfereADataDoPesoComoRegistro() throws Exception {
        String id = pasta("2026-09-01", "2026-09-30", 200).get("id").asString();
        String amanha = hoje.plusDays(1).toString();
        recusaComCodigo(api.post("/pastas/" + id + "/finalizar", treinador, Map.of("pesoKg", 80.5, "data", amanha), 422),
                "PESO_INVALIDO", "data", amanha);
        recusa(api.post("/pastas/" + id + "/finalizar", treinador, Map.of("pesoKg", 80.5, "data", "0260-09-30"), 422), "data", "0260");
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200).get(0).get("concluidaEm").isNull()).isTrue();
        api.post("/pastas/" + id + "/finalizar", treinador, Map.of("pesoKg", 80.5, "data", "2026-09-30"), 200);
    }

    @Test
    void pesoConfereARegistroSemFuturoEComPisoEm1900() throws Exception {
        String rota = "/alunos/" + aluno + "/pesos";
        String amanha = hoje.plusDays(1).toString();
        JsonNode futuro = api.post(rota, treinador, Map.of("data", amanha, "pesoKg", 80), 422);
        recusaComCodigo(futuro, "PESO_INVALIDO", "data", amanha);
        assertThat(mensagemDoCampo(futuro, "data")).isEqualTo("Data do peso: use uma data entre 01/01/1900 e hoje");
        recusa(api.post(rota, treinador, Map.of("data", "1899-12-31", "pesoKg", 80), 422), "data", "1899");
        api.post(rota, treinador, Map.of("data", "1900-01-01", "pesoKg", 80), 200);
        api.post(rota, treinador, Map.of("data", hoje.toString(), "pesoKg", 81), 200);
        assertThat(api.get(rota, treinador, 200)).hasSize(2);
    }

    @Test
    void lesaoConfereInicioEFimComoRegistro() throws Exception {
        String rota = "/alunos/" + aluno + "/lesoes";
        Map<String, Object> ok = Map.of("regiao", "Ombro", "dataInicio", "1900-01-01", "dataFim", hoje.toString(), "situacao", "RECUPERADA");
        Map<String, Object> ruim = Map.of("regiao", "Ombro", "dataInicio", "0260-03-01", "dataFim", hoje.plusDays(1).toString(),
                "situacao", "ATIVA");
        JsonNode r = api.post(rota, treinador, ruim, 422);
        recusaComCodigo(r, "LESAO_INVALIDA", "dataInicio", "0260");
        recusa(r, "dataFim", hoje.plusDays(1).toString());
        String id = api.post(rota, treinador, ok, 200).get("id").asString();
        recusa(api.put(rota + "/" + id, treinador, ruim, 422), "dataInicio", "0260");
        api.put(rota + "/" + id, treinador, ok, 200);
        // Fim antes do início continua 400.
        api.post(rota, treinador, Map.of("regiao", "Joelho", "dataInicio", "2026-03-01", "dataFim", "2026-02-01", "situacao", "ATIVA"), 400);
    }

    private Map<String, Object> compromisso(String data, Map<String, Object> repeticao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", List.of(aluno));
        corpo.put("responsavelId", treinador.path("usuario").path("id").asString());
        corpo.put("data", data);
        corpo.put("hora", "09:00");
        corpo.put("duracaoMinutos", 60);
        if (repeticao != null) corpo.put("repeticao", repeticao);
        return corpo;
    }

    @Test
    void compromissoConfereADataEOAteDaRepeticao() throws Exception {
        String rota = "/agenda/compromissos";
        String depoisDoTeto = teto.plusDays(1).toString();
        recusaComCodigo(api.post(rota, treinador, compromisso("0260-11-02", null), 422), "COMPROMISSO_INVALIDO", "data", "0260");
        recusa(api.post(rota, treinador, compromisso(depoisDoTeto, null), 422), "data", depoisDoTeto);
        recusa(api.post(rota, treinador, compromisso("1999-12-31", null), 422), "data", "1999");
        Map<String, Object> ate = Map.of("tipo", "DIARIA", "ate", "0261-01-01");
        JsonNode r = api.post(rota, treinador, compromisso(hoje.plusDays(1).toString(), ate), 422);
        recusa(r, "repeticao.ate", "0261");
        assertThat(mensagemDoCampo(r, "repeticao.ate")).startsWith("Última data da repetição: use uma data entre 01/01/2000 e 31/12/");
        // Dentro da faixa, inclusive na borda de cima.
        JsonNode criado = api.post(rota, treinador, compromisso(hoje.plusDays(1).toString(), null), 200);
        api.post(rota, treinador, compromisso(teto.toString(), null), 200);
        // Alterar passa pela mesma conferência.
        Map<String, Object> alteracao = compromisso("0260-11-02", null);
        alteracao.put("versao", criado.path("versao").asLong());
        recusa(api.put(rota + "/" + criado.path("id").asString(), treinador, alteracao, 422), "data", "0260");
    }

    private Map<String, Object> evento(String agendaId, String data, Map<String, Object> repeticao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("agendaId", agendaId);
        corpo.put("titulo", "Evento fictício");
        corpo.put("data", data);
        corpo.put("diaInteiro", true);
        if (repeticao != null) corpo.put("repeticao", repeticao);
        return corpo;
    }

    @Test
    void eventoConfereADataEOAteDaRepeticao() throws Exception {
        String agenda = api.post("/agenda/agendas", treinador, Map.of("nome", "Pessoal", "cor", "AZUL"), 200).path("id").asString();
        String depoisDoTeto = teto.plusDays(1).toString();
        recusaComCodigo(api.post("/agenda/eventos", treinador, evento(agenda, "0260-11-02", null), 422), "EVENTO_INVALIDO", "data", "0260");
        recusa(api.post("/agenda/eventos", treinador, evento(agenda, "2101-01-01", null), 422), "data", "2101");
        JsonNode r = api.post("/agenda/eventos", treinador,
                evento(agenda, hoje.plusDays(1).toString(), Map.of("tipo", "DIARIA", "ate", depoisDoTeto)), 422);
        recusaComCodigo(r, "REPETICAO_INVALIDA", "repeticao.ate", depoisDoTeto);
        api.post("/agenda/eventos", treinador, evento(agenda, hoje.plusDays(1).toString(), null), 200);
        api.post("/agenda/eventos", treinador, evento(agenda, "2000-01-01", null), 200);
    }

    @Test
    void planoSemPastaConfereOProprioPeriodo() throws Exception {
        String rota = "/alunos/" + aluno + "/planos-treino";
        JsonNode r = api.post(rota, treinador, Map.of("titulo", "Sem pasta", "inicio", "0260-11-01", "fim", "0260-11-30"), 422);
        recusaComCodigo(r, "PERIODO_INVALIDO", "inicio", "0260");
        assertThat(mensagemDoCampo(r, "inicio")).startsWith("Início do plano: use uma data entre 01/01/2000 e 31/12/");
        JsonNode criado = api.post(rota, treinador, Map.of("titulo", "Sem pasta", "inicio", "2026-11-01", "fim", "2026-11-30"), 200);
        String id = criado.path("plano").path("id").asString();
        Map<String, Object> rascunho = new HashMap<>(ApiDeTeste.rascunho("Sem pasta", ApiDeTeste.treino().conteudo(),
                criado.path("plano").path("versao").asLong()));
        rascunho.put("inicio", "0261-01-01");
        rascunho.put("fim", "2026-11-30");
        recusa(api.put("/planos-treino/" + id + "/rascunho", treinador, rascunho, 422), "inicio", "0261");
        // Plano dentro de pasta: quem dá o período é a pasta, já conferida; as datas do corpo não são lidas.
        String pasta = pasta("2026-11-01", "2026-11-30", 200).get("id").asString();
        api.post(rota, treinador, Map.of("titulo", "Na pasta", "pastaId", pasta, "inicio", "0260-01-01"), 200);
    }

    @Test
    void copiarPlanoParaOutroAlunoConfereOPeriodoDaPastaNova() throws Exception {
        UUID destino = api.criarAluno(treinador, "Aluno Destino Fictício");
        String plano = api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo()).path("plano").path("id").asString();
        String rota = "/planos-treino/" + plano + "/copiar-para-aluno";
        JsonNode r = api.post(rota, treinador,
                Map.of("alunoId", destino, "titulo", "Cópia", "inicio", "0260-11-01", "fim", "0260-11-30"), 422);
        // A pasta nova é criada pelo mesmo serviço das pastas: o erro diz "Início da pasta", e nada fica gravado.
        recusaComCodigo(r, "PERIODO_INVALIDO", "inicio", "0260");
        assertThat(api.get("/alunos/" + destino + "/pastas", treinador, 200)).isEmpty();
        assertThat(api.get("/alunos/" + destino + "/planos-treino", treinador, 200)).isEmpty();
        api.post(rota, treinador, Map.of("alunoId", destino, "titulo", "Cópia", "inicio", "2026-11-01", "fim", "2026-11-30"), 200);
    }

    @Test
    void replicarPlanoSemPastaConfereOPeriodo() throws Exception {
        JsonNode publicado = api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo());
        String plano = publicado.path("plano").path("id").asString();
        recusaComCodigo(api.post("/planos-treino/" + plano + "/replicar", treinador,
                Map.of("titulo", "Próximo ciclo", "inicio", "0261-01-01", "fim", "0261-01-30"), 422), "PERIODO_INVALIDO", "inicio", "0261");
        api.post("/planos-treino/" + plano + "/replicar", treinador,
                Map.of("titulo", "Próximo ciclo", "inicio", "2026-12-01", "fim", "2026-12-30"), 200);
    }

    @Test
    void aplicarModeloConfereOPeriodoAntesDeCriarQualquerCoisa() throws Exception {
        String modelo = api.post("/receitas", treinador,
                Map.of("tipo", "PLANO_TREINO", "nome", "Modelo fictício", "conteudo", ApiDeTeste.treino().conteudo()), 200).get("id").asString();
        JsonNode r = api.post("/receitas/" + modelo + "/aplicar", treinador,
                Map.of("alunoId", aluno, "titulo", "Cópia", "inicio", "0260-11-01", "fim", "0260-11-30"), 422);
        recusaComCodigo(r, "PERIODO_INVALIDO", "inicio", "0260");
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200)).isEmpty();
        assertThat(api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)).isEmpty();
        api.post("/receitas/" + modelo + "/aplicar", treinador,
                Map.of("alunoId", aluno, "titulo", "Cópia", "inicio", "2026-11-01", "fim", "2026-11-30"), 200);
    }

    @Test
    void filtrosDePeriodoDasListasConferemAFaixaDePlanejamento() throws Exception {
        String depoisDoTeto = teto.plusDays(1).toString();
        for (String rota : List.of("/atualizacoes", "/auditoria", "/importacoes", "/inscricoes", "/inscricoes/indicadores")) {
            JsonNode r = api.get(rota + "?de=0260-01-01&ate=2026-11-01", treinador, 400);
            assertThat(r.get("codigo").asString()).isEqualTo("PERIODO_INVALIDO");
            assertThat(r.get("message").asString()).isEqualTo("Data inicial: use uma data entre 01/01/2000 e 31/12/" + teto.getYear());
            semOValor(r, "0260");
            JsonNode depois = api.get(rota + "?de=2026-11-01&ate=" + depoisDoTeto, treinador, 400);
            assertThat(depois.get("message").asString()).startsWith("Data final: use uma data entre");
            semOValor(depois, depoisDoTeto);
            api.get(rota + "?de=2000-01-01&ate=2000-01-31", treinador, 200);
        }
    }
}
