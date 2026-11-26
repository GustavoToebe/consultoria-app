package br.com.treinos.api.planos.liberacao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Data de liberação do plano para o aluno (V105): agendar, o aluno seguir no plano ou na versão anterior (pacote sem a versão
 * futura), a rotina das 00:05 antes e depois da meia-noite de Brasília, "Alterar data" e "Liberar agora", outra consultoria 404,
 * Publicar tudo com data e o aviso gerado uma vez só (aviso no app e push). Dados fictícios. A rotina é chamada por consultoria
 * ({@code rodarNa}), para não liberar o agendamento de outro teste do banco compartilhado.
 */
@AutoConfigureMockMvc
class LiberacaoDePlanoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private RotinaDeLiberacaoDePlanos rotina;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode login;
    private UUID usuarioId;
    private UUID consultoriaId;
    private LocalDate hoje;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício Liberação");
        login = api.convidarEEntrar(treinador, alunoId);
        usuarioId = UUID.fromString(login.path("usuario").path("id").asString());
        consultoriaId = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class, usuarioId);
        hoje = LocalDate.now(Fuso.BRASILIA);
    }

    @AfterEach
    void limpar() {
        // Push pendente que sobrou não pode ser enviado (nem contado) por outro teste do banco compartilhado.
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'TESTE' where situacao = 'PENDENTE' and consultoria_id = ?",
                consultoriaId);
    }

    // ---- auxiliares ----

    private JsonNode rascunhoDeTreino(UUID doAluno, UUID pasta) throws Exception {
        Map<String, Object> corpo = new HashMap<>(Map.of("titulo", "Plano de teste"));
        if (pasta != null) corpo.put("pastaId", pasta);
        JsonNode plano = api.post("/alunos/" + doAluno + "/planos-treino", treinador, corpo, 200);
        return api.put("/planos-treino/" + plano.path("plano").path("id").asString() + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano de teste", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
    }

    private static Map<String, Object> corpoPublicar(JsonNode detalhe, LocalDate liberarEm, Boolean avisar) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("versao", detalhe.path("plano").path("versao").asLong());
        corpo.put("confirmarAvisos", true);
        if (liberarEm != null) corpo.put("liberarEm", liberarEm.toString());
        if (avisar != null) corpo.put("avisarAluno", avisar);
        return corpo;
    }

    private JsonNode publicarTreino(JsonNode detalhe, LocalDate liberarEm, Boolean avisar, int esperado) throws Exception {
        return api.post("/planos-treino/" + detalhe.path("plano").path("id").asString() + "/publicar", treinador,
                corpoPublicar(detalhe, liberarEm, avisar), esperado);
    }

    private JsonNode detalheDoTreino(JsonNode detalhe) throws Exception {
        return api.get("/planos-treino/" + detalhe.path("plano").path("id").asString(), treinador, 200);
    }

    private JsonNode painel() throws Exception {
        return api.get("/aluno/painel", login, 200);
    }

    /** Sem treino no pacote: o campo vem nulo ou ausente, conforme a serialização. */
    private boolean semTreino() throws Exception {
        JsonNode treino = painel().path("treino");
        return treino.isMissingNode() || treino.isNull();
    }

    private int avisosNaoVistos() throws Exception {
        return api.get("/aluno/avisos-de-plano", login, 200).size();
    }

    private int avisosCriados() {
        return jdbc.queryForObject("select count(*) from aviso_plano_liberado where aluno_id = ?", Integer.class, alunoId);
    }

    private int pushsDePlano() {
        return jdbc.queryForObject("select count(*) from push_envio where usuario_id = ? and tipo = 'PLANO_LIBERADO'",
                Integer.class, usuarioId);
    }

    private void registrarTokenDoAparelho() throws Exception {
        api.put("/aluno/push-token", login, Map.of("token", "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]",
                "plataforma", "ANDROID"), 204);
    }

    /** Instante em Brasília (UTC-3 o ano todo desde 2019). */
    private static Instant emBrasilia(LocalDate dia, int hora, int minuto, int segundo) {
        return ZonedDateTime.of(dia, java.time.LocalTime.of(hora, minuto, segundo), Fuso.BRASILIA).toInstant();
    }

    // ---- agendar ----

    @Test
    void publicarComDataAgendaOPlanoENaoMostraAoAluno() throws Exception {
        LocalDate dia = hoje.plusDays(3);
        JsonNode publicado = publicarTreino(rascunhoDeTreino(alunoId, null), dia, null, 200);

        JsonNode plano = publicado.path("plano");
        assertThat(plano.path("versaoPublicada").asInt()).isEqualTo(1);
        assertThat(plano.path("versaoLiberada").asInt()).isZero();
        assertThat(plano.path("liberarEm").asString()).isEqualTo(dia.toString());
        assertThat(plano.path("ativo").asBoolean()).isFalse();
        // A versão existe para o treinador, mas o aluno não vê nada (pacote, pastas e demonstrações).
        assertThat(semTreino()).isTrue();
        assertThat(api.get("/aluno/pastas", login, 200).size()).isZero();
    }

    @Test
    void dataForaDaFaixaEDeHojeOuDoPassadoDa422() throws Exception {
        JsonNode rascunho = rascunhoDeTreino(alunoId, null);
        for (LocalDate invalida : List.of(hoje, hoje.minusDays(1), hoje.plusYears(20))) {
            JsonNode erro = publicarTreino(rascunho, invalida, null, 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("LIBERACAO_INVALIDA");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("liberarEm");
        }
        // Nada foi publicado.
        assertThat(detalheDoTreino(rascunho).path("plano").path("versaoPublicada").asInt()).isZero();
        // Amanhã é a menor data aceita.
        publicarTreino(rascunho, hoje.plusDays(1), null, 200);
    }

    @Test
    void publicarDeNovoSubstituiOAgendamentoEPublicarSemDataLiberaNaHora() throws Exception {
        JsonNode rascunho = rascunhoDeTreino(alunoId, null);
        publicarTreino(rascunho, hoje.plusDays(5), null, 200);
        JsonNode atual = detalheDoTreino(rascunho);

        JsonNode trocado = publicarTreino(atual, hoje.plusDays(9), null, 200);
        assertThat(trocado.path("plano").path("liberarEm").asString()).isEqualTo(hoje.plusDays(9).toString());
        assertThat(trocado.path("plano").path("versaoPublicada").asInt()).isEqualTo(2);

        JsonNode agora = publicarTreino(detalheDoTreino(rascunho), null, null, 200);
        assertThat(agora.path("plano").path("liberarEm").isNull()).isTrue();
        assertThat(agora.path("plano").path("ativo").asBoolean()).isTrue();
        assertThat(agora.path("plano").path("versaoLiberada").asInt()).isEqualTo(3);
        assertThat(painel().path("treino").path("numero").asInt()).isEqualTo(3);
    }

    @Test
    void versaoNovaDoMesmoPlanoAgendadaNaoTiraAVersaoQueOAlunoVe() throws Exception {
        JsonNode rascunho = rascunhoDeTreino(alunoId, null);
        publicarTreino(rascunho, null, null, 200);
        String versaoVista = painel().path("treino").path("versaoId").asString();

        LocalDate dia = hoje.plusDays(2);
        JsonNode v2 = publicarTreino(detalheDoTreino(rascunho), dia, null, 200);
        assertThat(v2.path("plano").path("versaoPublicada").asInt()).isEqualTo(2);
        assertThat(v2.path("plano").path("versaoLiberada").asInt()).isEqualTo(1);
        assertThat(v2.path("plano").path("ativo").asBoolean()).isTrue();

        // O pacote do aluno segue na versão 1, nunca leva a futura.
        JsonNode treino = painel().path("treino");
        assertThat(treino.path("numero").asInt()).isEqualTo(1);
        assertThat(treino.path("versaoId").asString()).isEqualTo(versaoVista);

        rotina.rodarNa(consultoriaId, dia);
        assertThat(painel().path("treino").path("numero").asInt()).isEqualTo(2);
    }

    @Test
    void planoAgendadoEmOutraPastaSoSubstituiOVigenteNaData() throws Exception {
        UUID pastaA = pasta("Ciclo A");
        JsonNode a = rascunhoDeTreino(alunoId, pastaA);
        publicarTreino(a, null, null, 200);
        String planoA = a.path("plano").path("id").asString();

        UUID pastaB = pasta("Ciclo B");
        JsonNode b = rascunhoDeTreino(alunoId, pastaB);
        LocalDate dia = hoje.plusDays(2);
        publicarTreino(b, dia, null, 200);

        // Até a data: o aluno só tem o plano A (pacote, pastas), e o plano A segue o vigente.
        assertThat(painel().path("treino").path("planoId").asString()).isEqualTo(planoA);
        assertThat(api.get("/aluno/pastas", login, 200).size()).isEqualTo(1);
        assertThat(api.get("/aluno/pastas/" + pastaB, login, 404).path("codigo").asString()).isNotEmpty();
        assertThat(api.get("/alunos/" + alunoId + "/pastas/vigente", treinador, 200).path("pasta").path("id").asString())
                .isEqualTo(pastaA.toString());
        // O treinador vê o selo na pasta B e no plano B.
        JsonNode pastas = api.get("/alunos/" + alunoId + "/pastas", treinador, 200);
        for (JsonNode p : pastas) {
            assertThat(p.path("liberarEm").asString(null)).isEqualTo(p.path("id").asString().equals(pastaB.toString()) ? dia.toString() : null);
        }

        rotina.rodarNa(consultoriaId, dia);

        assertThat(painel().path("treino").path("planoId").asString()).isEqualTo(b.path("plano").path("id").asString());
        assertThat(api.get("/aluno/pastas", login, 200).size()).isEqualTo(2);
        assertThat(api.get("/alunos/" + alunoId + "/pastas/vigente", treinador, 200).path("pasta").path("id").asString())
                .isEqualTo(pastaB.toString());
        assertThat(detalheDoTreino(a).path("plano").path("ativo").asBoolean()).isFalse();
    }

    private UUID pasta(String titulo) throws Exception {
        JsonNode p = api.post("/alunos/" + alunoId + "/pastas", treinador,
                Map.of("titulo", titulo, "inicio", hoje.toString(), "fim", hoje.plusDays(29).toString()), 200);
        return UUID.fromString(p.path("id").asString());
    }

    // ---- rotina e meia-noite de Brasília ----

    @Test
    void rotinaSoLiberaDepoisDaMeiaNoiteDeBrasilia() throws Exception {
        LocalDate dia = hoje.plusDays(4);
        JsonNode agendado = publicarTreino(rascunhoDeTreino(alunoId, null), dia, null, 200);

        // 23:59:59 de Brasília do dia anterior: ainda não é o dia (mesmo que em UTC já fosse o dia seguinte às 02:59:59).
        assertThat(rotina.rodarNa(consultoriaId, emBrasilia(dia.minusDays(1), 23, 59, 59)).liberados()).isZero();
        assertThat(semTreino()).isTrue();
        assertThat(detalheDoTreino(agendado).path("plano").path("liberarEm").asString()).isEqualTo(dia.toString());

        // 00:00:01 de Brasília do dia: libera.
        assertThat(rotina.rodarNa(consultoriaId, emBrasilia(dia, 0, 0, 1)).liberados()).isEqualTo(1);
        JsonNode plano = detalheDoTreino(agendado).path("plano");
        assertThat(plano.path("liberarEm").isNull()).isTrue();
        assertThat(plano.path("ativo").asBoolean()).isTrue();
        assertThat(plano.path("versaoLiberada").asInt()).isEqualTo(1);
        assertThat(painel().path("treino").path("numero").asInt()).isEqualTo(1);
    }

    @Test
    void diaDeBrasiliaDoInstanteViraNaMeiaNoiteLocal() {
        // 02:59:59Z = 23:59:59 do dia anterior em Brasília; 03:00:00Z = 00:00:00 do dia.
        assertThat(RotinaDeLiberacaoDePlanos.diaDeBrasilia(Instant.parse("2026-11-27T02:59:59Z"))).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(RotinaDeLiberacaoDePlanos.diaDeBrasilia(Instant.parse("2026-11-27T03:00:00Z"))).isEqualTo(LocalDate.of(2026, 11, 27));
    }

    @Test
    void rotinaRepetidaNaoLiberaNemAvisaDeNovo() throws Exception {
        registrarTokenDoAparelho();
        LocalDate dia = hoje.plusDays(2);
        publicarTreino(rascunhoDeTreino(alunoId, null), dia, null, 200);

        assertThat(rotina.rodarNa(consultoriaId, dia).liberados()).isEqualTo(1);
        assertThat(rotina.rodarNa(consultoriaId, dia).liberados()).isZero();
        assertThat(rotina.rodarNa(consultoriaId, dia.plusDays(1)).liberados()).isZero();

        assertThat(avisosCriados()).isEqualTo(1);
        assertThat(avisosNaoVistos()).isEqualTo(1);
        assertThat(pushsDePlano()).isEqualTo(1);
    }

    @Test
    void planoArquivadoDepoisDeAgendadoNuncaELiberado() throws Exception {
        LocalDate dia = hoje.plusDays(2);
        JsonNode agendado = publicarTreino(rascunhoDeTreino(alunoId, null), dia, null, 200);
        api.delete("/planos-treino/" + agendado.path("plano").path("id").asString(), treinador, 204);

        assertThat(rotina.rodarNa(consultoriaId, dia.plusDays(10)).liberados()).isZero();
        assertThat(semTreino()).isTrue();
        assertThat(avisosCriados()).isZero();
    }

    // ---- alterar data e liberar agora ----

    @Test
    void alterarDataELiberarAgoraDePlanoAgendado() throws Exception {
        JsonNode agendado = publicarTreino(rascunhoDeTreino(alunoId, null), hoje.plusDays(3), null, 200);
        String id = agendado.path("plano").path("id").asString();

        JsonNode nova = api.put("/planos-treino/" + id + "/liberacao", treinador, Map.of("liberarEm", hoje.plusDays(6).toString()), 200);
        assertThat(nova.path("liberarEm").asString()).isEqualTo(hoje.plusDays(6).toString());
        assertThat(api.put("/planos-treino/" + id + "/liberacao", treinador, Map.of("liberarEm", hoje.toString()), 422)
                .path("codigo").asString()).isEqualTo("LIBERACAO_INVALIDA");
        // O alterar não libera nada, mesmo com a rotina rodando antes da nova data.
        assertThat(rotina.rodarNa(consultoriaId, hoje.plusDays(3)).liberados()).isZero();

        JsonNode liberado = api.post("/planos-treino/" + id + "/liberar-agora", treinador, Map.of(), 200);
        assertThat(liberado.path("liberarEm").isNull()).isTrue();
        assertThat(liberado.path("ativo").asBoolean()).isTrue();
        assertThat(liberado.path("versaoLiberada").asInt()).isEqualTo(1);
        assertThat(painel().path("treino").path("numero").asInt()).isEqualTo(1);
        assertThat(avisosNaoVistos()).isEqualTo(1);

        // Já liberado: não há mais o que alterar nem liberar.
        assertThat(api.post("/planos-treino/" + id + "/liberar-agora", treinador, Map.of(), 409).path("codigo").asString())
                .isEqualTo("PLANO_NAO_AGENDADO");
        assertThat(api.put("/planos-treino/" + id + "/liberacao", treinador, Map.of("liberarEm", hoje.plusDays(8).toString()), 409)
                .path("codigo").asString()).isEqualTo("PLANO_NAO_AGENDADO");
    }

    @Test
    void outraConsultoriaRecebe404NasRotasDeLiberacao() throws Exception {
        JsonNode agendado = publicarTreino(rascunhoDeTreino(alunoId, null), hoje.plusDays(3), null, 200);
        String id = agendado.path("plano").path("id").asString();
        JsonNode intruso = api.novoTreinador();

        api.put("/planos-treino/" + id + "/liberacao", intruso, Map.of("liberarEm", hoje.plusDays(6).toString()), 404);
        api.post("/planos-treino/" + id + "/liberar-agora", intruso, Map.of(), 404);
        api.post("/planos-treino/" + id + "/publicar", intruso, Map.of("versao", 1, "confirmarAvisos", true,
                "liberarEm", hoje.plusDays(6).toString()), 404);
        // O plano segue agendado, do jeito que estava.
        assertThat(detalheDoTreino(agendado).path("plano").path("liberarEm").asString()).isEqualTo(hoje.plusDays(3).toString());
    }

    // ---- Publicar tudo com data ----

    @Test
    void publicarTudoComDataAgendaTodosOsPlanosDaPasta() throws Exception {
        UUID pasta = pasta("Ciclo com data");
        JsonNode treino = rascunhoDeTreino(alunoId, pasta);
        JsonNode mobilidadePlano = api.post("/alunos/" + alunoId + "/planos-mobilidade", treinador,
                Map.of("titulo", "Mobilidade de teste", "pastaId", pasta), 200);
        JsonNode mobilidade = api.put("/planos-mobilidade/" + mobilidadePlano.path("plano").path("id").asString() + "/rascunho",
                treinador, ApiDeTeste.rascunho("Mobilidade de teste", ApiDeTeste.mobilidade().conteudo(),
                        mobilidadePlano.path("plano").path("versao").asLong()), 200);
        LocalDate dia = hoje.plusDays(2);
        Map<String, Object> versoes = Map.of(treino.path("plano").path("id").asString(), treino.path("plano").path("versao").asLong(),
                mobilidade.path("plano").path("id").asString(), mobilidade.path("plano").path("versao").asLong());

        // Data inválida: 422 e nada publicado.
        api.post("/pastas/" + pasta + "/publicar", treinador, Map.of("confirmarAvisos", true, "versoes", versoes,
                "liberarEm", hoje.toString()), 422);
        assertThat(detalheDoTreino(treino).path("plano").path("versaoPublicada").asInt()).isZero();

        JsonNode resposta = api.post("/pastas/" + pasta + "/publicar", treinador,
                Map.of("confirmarAvisos", true, "versoes", versoes, "liberarEm", dia.toString()), 200);
        assertThat(resposta.path("publicados").size()).isEqualTo(2);
        for (JsonNode p : resposta.path("publicados")) {
            assertThat(p.path("liberarEm").asString()).isEqualTo(dia.toString());
        }
        // Aluno: nada ainda. Treinador: selo na pasta e nos planos.
        assertThat(semTreino()).isTrue();
        assertThat(api.get("/aluno/mobilidade", login, 404).path("codigo").asString()).isNotEmpty();
        assertThat(api.get("/alunos/" + alunoId + "/pastas", treinador, 200).get(0).path("liberarEm").asString()).isEqualTo(dia.toString());
        assertThat(avisosCriados()).isZero();

        assertThat(rotina.rodarNa(consultoriaId, dia).liberados()).isEqualTo(2);

        assertThat(painel().path("treino").path("numero").asInt()).isEqualTo(1);
        assertThat(api.get("/aluno/mobilidade", login, 200).isObject()).isTrue();
        // Dois planos liberados no mesmo dia: um aviso só para o aluno.
        assertThat(avisosCriados()).isEqualTo(1);
        assertThat(api.get("/alunos/" + alunoId + "/pastas", treinador, 200).get(0).path("liberarEm").isNull()).isTrue();
    }

    // ---- aviso ----

    @Test
    void publicarSemDataAvisaOAlunoPorPadraoESemAvisarNao() throws Exception {
        registrarTokenDoAparelho();
        publicarTreino(rascunhoDeTreino(alunoId, null), null, false, 200);
        assertThat(avisosCriados()).isZero();
        assertThat(pushsDePlano()).isZero();

        publicarTreino(detalheDoTreino(rascunhoDeTreino(alunoId, null)), null, null, 200);
        assertThat(avisosCriados()).isEqualTo(1);
        assertThat(pushsDePlano()).isEqualTo(1);

        // Outra publicação com um aviso ainda não visto não cria outro (a frase é genérica).
        JsonNode outro = rascunhoDeTreino(alunoId, null);
        publicarTreino(outro, null, true, 200);
        assertThat(avisosCriados()).isEqualTo(1);
        assertThat(pushsDePlano()).isEqualTo(1);
    }

    @Test
    void agendadoSemAvisarNaoGeraAvisoNaLiberacao() throws Exception {
        LocalDate dia = hoje.plusDays(2);
        publicarTreino(rascunhoDeTreino(alunoId, null), dia, false, 200);
        assertThat(rotina.rodarNa(consultoriaId, dia).liberados()).isEqualTo(1);
        assertThat(avisosCriados()).isZero();
        assertThat(avisosNaoVistos()).isZero();
    }

    @Test
    void avisoDoAppListaMarcaVistoEOutroAlunoRecebe404() throws Exception {
        publicarTreino(rascunhoDeTreino(alunoId, null), null, null, 200);
        JsonNode avisos = api.get("/aluno/avisos-de-plano", login, 200);
        assertThat(avisos.size()).isEqualTo(1);
        String id = avisos.get(0).path("id").asString();

        // Outro aluno (mesma consultoria) e outra consultoria: 404, e o aviso segue não visto.
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício Liberação");
        JsonNode loginOutro = api.convidarEEntrar(treinador, outroAluno);
        api.post("/aluno/avisos-de-plano/" + id + "/visto", loginOutro, null, 404);
        assertThat(avisosNaoVistos()).isEqualTo(1);

        api.post("/aluno/avisos-de-plano/" + id + "/visto", login, null, 204);
        api.post("/aluno/avisos-de-plano/" + id + "/visto", login, null, 204); // idempotente
        assertThat(avisosNaoVistos()).isZero();
        // Treinador não usa a rota do aluno.
        api.get("/aluno/avisos-de-plano", treinador, 403);
    }

    @Test
    void publicarTudoSemDataAvisaOAlunoPorPadraoESemAvisarNao() throws Exception {
        for (Boolean avisar : new Boolean[] {false, null}) {
            UUID outro = api.criarAluno(treinador, "Aluno Fictício Publicar Tudo " + avisar);
            JsonNode loginOutro = api.convidarEEntrar(treinador, outro);
            UUID pasta = UUID.fromString(api.post("/alunos/" + outro + "/pastas", treinador,
                    Map.of("titulo", "Ciclo", "inicio", hoje.toString(), "fim", hoje.plusDays(29).toString()), 200).path("id").asString());
            JsonNode treino = rascunhoDeTreino(outro, pasta);
            Map<String, Object> corpo = new HashMap<>();
            corpo.put("confirmarAvisos", true);
            corpo.put("versoes", Map.of(treino.path("plano").path("id").asString(), treino.path("plano").path("versao").asLong()));
            if (avisar != null) corpo.put("avisarAluno", avisar);
            api.post("/pastas/" + pasta + "/publicar", treinador, corpo, 200);

            int criados = jdbc.queryForObject("select count(*) from aviso_plano_liberado where aluno_id = ?", Integer.class, outro);
            assertThat(criados).isEqualTo(avisar == null ? 1 : 0);
            assertThat(api.get("/aluno/avisos-de-plano", loginOutro, 200).size()).isEqualTo(avisar == null ? 1 : 0);
        }
    }

    // ---- LGPD ----

    @Test
    void exportacaoTrazOsAvisosDoProprioAlunoEAnonimizacaoOsApaga() throws Exception {
        publicarTreino(rascunhoDeTreino(alunoId, null), null, null, 200);
        UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício Exportação");
        api.convidarEEntrar(treinador, outro);
        publicarTreino(rascunhoDeTreino(outro, null), null, null, 200);

        JsonNode itens = api.get("/alunos/" + alunoId + "/exportacao", treinador, 200).path("avisosDePlanoLiberado").path("itens");
        assertThat(itens.size()).isEqualTo(1);
        assertThat(itens.get(0).path("criadoEm").asString()).isNotEmpty();
        assertThat(itens.get(0).path("vistoEm").isMissingNode() || itens.get(0).path("vistoEm").isNull()).isTrue();
        // Só datas: nada de texto, id de aviso, plano ou aluno.
        assertThat(itens.get(0).size()).isLessThanOrEqualTo(2);
        // Outra consultoria não exporta este aluno.
        api.get("/alunos/" + alunoId + "/exportacao", api.novoTreinador(), 404);

        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício Liberação"), 200);
        assertThat(avisosCriados()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from aviso_plano_liberado where aluno_id = ?", Integer.class, outro)).isEqualTo(1);
    }
}
