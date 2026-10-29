package br.com.treinos.api.sessoesconcluidas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.RegistroSessaoConcluida;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessaoConcluidaLinha;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Concluir treino": o aluno conclui e reabre sessões do treino. Idempotência, versão de treino publicada do próprio aluno,
 * janela de datas, resultado e duração coerentes, comentário (dado sensível) e isolamento. Só dados fictícios.
 */
@AutoConfigureMockMvc
class SessaoConcluidaIntegrationTest extends AbstractIntegrationTest {

    private static final String COMENTARIO = "Comentário fictício SEGREDO-ABC-123";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;
    private ApiDeTeste.TreinoDeTeste treino;
    private String versaoId;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício");
        treino = ApiDeTeste.treino();
        api.publicarTreino(treinador, alunoId, treino.conteudo());
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = versaoDoTreino(aluno);
    }

    private String versaoDoTreino(JsonNode login) throws Exception {
        return api.get("/aluno/painel", login, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void concluirEReenviarNaoDuplicaEOGetDevolveSoOAceitoComOComentarioDoProprioAluno() throws Exception {
        UUID id = UUID.randomUUID();
        var lote = List.of(registro(id, hoje, true, "COMPLETA", 3600L, COMENTARIO, Instant.now()));

        assertThat(situacoes(enviar(lote))).containsExactly("ACEITO");
        // Reenvio do mesmo registro (a fila do aparelho repete até confirmar): não duplica nem muda nada.
        assertThat(situacoes(enviar(lote))).containsExactly("IGNORADO_ANTIGO");
        assertThat(contar()).isEqualTo(1);

        JsonNode lido = api.get("/aluno/sessoes-concluidas", aluno, 200);
        assertThat(lido.get("totalConcluidos").asLong()).isEqualTo(1);
        assertThat(lido.get("sessoes")).hasSize(1);
        JsonNode s = lido.get("sessoes").get(0);
        assertThat(s.get("planoVersaoId").asString()).isEqualTo(versaoId);
        assertThat(s.get("sessaoUid").asString()).isEqualTo(treino.sessaoUid().toString());
        assertThat(s.get("data").asString()).isEqualTo(hoje.toString());
        assertThat(s.get("concluida").asBoolean()).isTrue();
        assertThat(s.get("resultado").asString()).isEqualTo("COMPLETA");
        assertThat(s.get("duracaoSegundos").asInt()).isEqualTo(3600);
        assertThat(s.get("comentario").asString()).isEqualTo(COMENTARIO);
        // O que o aluno lê leva o id do aparelho (o do "Visto", 0.5) e o nome da sessão, nunca a situação; sem "Visto".
        assertThat(s.get("id").asString()).isEqualTo(id.toString());
        assertThat(s.get("sessaoNome").asString()).isEqualTo("Segunda - Costas");
        assertThat(s.get("vistoEm").isNull()).isTrue();
        assertThat(s.has("situacao")).isFalse();
        // Chave ligada na suíte: o app mostra o recurso.
        assertThat(api.get("/eu", aluno, 200).get("retornoHabilitado").asBoolean()).isTrue();
    }

    @Test
    void oRegistroMaisNovoVenceInclusiveReabrirEOMaisAntigoQueChegaDepoisEIgnorado() throws Exception {
        UUID id = UUID.randomUUID();
        Instant concluiu = Instant.now().minusSeconds(120);
        Instant reabriu = concluiu.plusSeconds(60);

        enviar(List.of(registro(id, hoje, true, "PARCIAL", 1800L, COMENTARIO, concluiu)));
        // Reabrir é o mesmo registro com concluida = false, sem resultado nem duração (é o que o app manda).
        assertThat(situacoes(enviar(List.of(registro(id, hoje, false, null, null, null, reabriu))))).containsExactly("ACEITO");
        assertThat(contar()).isEqualTo(1);
        JsonNode lido = api.get("/aluno/sessoes-concluidas", aluno, 200);
        assertThat(lido.get("totalConcluidos").asLong()).isZero();
        JsonNode s = lido.get("sessoes").get(0);
        assertThat(s.get("concluida").asBoolean()).isFalse();
        assertThat(s.get("resultado").isNull()).isTrue();
        assertThat(s.get("duracaoSegundos").isNull()).isTrue();
        assertThat(s.get("comentario").isNull()).isTrue();

        // A conclusão mais antiga que chega depois não desfaz o "reabrir".
        assertThat(situacoes(enviar(List.of(registro(id, hoje, true, "COMPLETA", null, null, concluiu.plusSeconds(10))))))
                .containsExactly("IGNORADO_ANTIGO");
        assertThat(api.get("/aluno/sessoes-concluidas", aluno, 200).get("sessoes").get(0).get("concluida").asBoolean()).isFalse();

        // Concluir de novo, mais novo ainda, com outro id mas a mesma chave natural: atualiza a mesma linha.
        assertThat(situacoes(enviar(List.of(registro(UUID.randomUUID(), hoje, true, "COMPLETA", 2400L, null,
                reabriu.plusSeconds(60)))))).containsExactly("ACEITO");
        assertThat(contar()).isEqualTo(1);
        JsonNode depois = api.get("/aluno/sessoes-concluidas", aluno, 200);
        assertThat(depois.get("totalConcluidos").asLong()).isEqualTo(1);
        assertThat(depois.get("sessoes").get(0).get("resultado").asString()).isEqualTo("COMPLETA");
    }

    @Test
    void cadaRecusaPorRegistroNaoDerrubaOLoteENuncaRepeteOComentarioNemADuracao() throws Exception {
        String segredo = "SEGREDO-DA-RECUSA-777";
        List<Map<String, Object>> lote = new ArrayList<>();
        lote.add(registro(UUID.randomUUID(), hoje, true, "COMPLETA", 3000L, null, Instant.now()));
        // concluída sem resultado, com resultado desconhecido, reaberta com resultado ou com duração
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(1), true, null, 3333L, segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(2), true, "TOTAL", 3333L, segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(3), false, "COMPLETA", null, segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(4), false, null, 3333L, segredo, Instant.now()));
        // duração fora do intervalo
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(5), true, "COMPLETA", 59L, segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(6), true, "COMPLETA", 21601L, segredo, Instant.now()));
        // comentário longo demais, data no futuro e antiga, horário do aparelho absurdo
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(7), true, "COMPLETA", 3333L, "x".repeat(301), Instant.now()));
        // caractere nulo no comentário: o Postgres não o guarda, e isso não pode derrubar o lote
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(9), true, "COMPLETA", 3333L, "a\u0000b " + segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.plusDays(1), true, "COMPLETA", 3333L, segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(61), true, "COMPLETA", 3333L, segredo, Instant.now()));
        lote.add(registro(UUID.randomUUID(), hoje.minusDays(8), true, "COMPLETA", 3333L, segredo,
                Instant.now().plusSeconds(3 * 86400L)));

        JsonNode resposta = enviar(lote);
        List<String> situacoes = situacoes(resposta);
        assertThat(situacoes.get(0)).isEqualTo("ACEITO");
        assertThat(situacoes.subList(1, situacoes.size())).hasSize(11).containsOnly("RECUSADO");
        assertThat(contar()).isEqualTo(1);
        // Nem o motivo nem nada na resposta repete o comentário ou a duração que o aluno mandou.
        assertThat(resposta.toString()).doesNotContain(segredo).doesNotContain("3333").doesNotContain("xxxxxxxxxx");
        assertThat(resposta.get("resultados").get(9).get("motivo").asString()).contains("futuro");
    }

    @Test
    void registroIncompletoEVersaoInexistenteSaoRecusados() throws Exception {
        List<Map<String, Object>> lote = new ArrayList<>();
        for (String campo : List.of("id", "planoVersaoId", "sessaoUid", "data", "concluida", "alteradoNoAparelhoEm")) {
            Map<String, Object> r = registro(UUID.randomUUID(), hoje, true, "COMPLETA", null, null, Instant.now());
            r.remove(campo);
            lote.add(r);
        }
        Map<String, Object> versaoInexistente = registro(UUID.randomUUID(), hoje, true, "COMPLETA", null, null, Instant.now());
        versaoInexistente.put("planoVersaoId", UUID.randomUUID().toString());
        lote.add(versaoInexistente);

        JsonNode resposta = enviar(lote);
        assertThat(situacoes(resposta)).containsOnly("RECUSADO").hasSize(7);
        assertThat(resposta.get("resultados").get(1).get("motivo").asString()).isEqualTo("Registro incompleto.");
        assertThat(resposta.get("resultados").get(6).get("motivo").asString()).contains("não encontrado");
        assertThat(contar()).isZero();
    }

    @Test
    void versaoDeOutroAlunoDeDietaOuDeMobilidadeERecusadaComAMesmaMensagem() throws Exception {
        UUID outroAlunoId = api.criarAluno(treinador, "Outro Aluno Fictício");
        api.publicarTreino(treinador, outroAlunoId, ApiDeTeste.treino().conteudo());
        JsonNode outro = api.convidarEEntrar(treinador, outroAlunoId);
        String versaoDoOutro = versaoDoTreino(outro);

        api.publicarMobilidade(treinador, alunoId, ApiDeTeste.mobilidade().conteudo());
        String versaoDeMobilidade = api.get("/aluno/mobilidade", aluno, 200).get("mobilidade").get("id").asString();
        publicarDieta(alunoId);
        String versaoDeDieta = api.get("/aluno/dieta", aluno, 200).get("dieta").get("id").asString();

        List<Map<String, Object>> lote = new ArrayList<>();
        for (String versao : List.of(versaoDoOutro, versaoDeMobilidade, versaoDeDieta)) {
            Map<String, Object> r = registro(UUID.randomUUID(), hoje, true, "COMPLETA", null, null, Instant.now());
            r.put("planoVersaoId", versao);
            lote.add(r);
        }
        JsonNode resposta = enviar(lote);
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "RECUSADO");
        assertThat(resposta.get("resultados").valueStream().map(r -> r.get("motivo").asString()).distinct().toList())
                .containsExactly("Treino não encontrado para este aluno.");
        assertThat(contar()).isZero();
        assertThat(contarDe(outroAlunoId)).isZero();
    }

    @Test
    void sessaoForaDaVersaoERecusadaEGuardadaSemComentarioENinguemLe() throws Exception {
        UUID bom = UUID.randomUUID();
        UUID inexistente = UUID.randomUUID();
        Map<String, Object> ruim = registro(inexistente, hoje, true, "COMPLETA", 3600L, COMENTARIO, Instant.now());
        ruim.put("sessaoUid", UUID.randomUUID().toString());

        JsonNode resposta = enviar(List.of(
                registro(bom, hoje, true, "COMPLETA", null, null, Instant.now()), ruim));
        assertThat(situacoes(resposta)).containsExactly("ACEITO", "RECUSADO");
        assertThat(resposta.get("resultados").get(1).get("motivo").asString()).contains("não existe");
        assertThat(resposta.toString()).doesNotContain("SEGREDO-ABC-123");

        // Guardada como RECUSADO (a versão é imutável, então é permanente), sem resultado, duração nem comentário.
        Map<String, Object> linha = jdbc.queryForMap("select concluida, resultado, duracao_segundos, comentario, motivo "
                + "from sessao_concluida where id = ?", inexistente);
        assertThat(linha.get("concluida")).isEqualTo(false);
        assertThat(linha.get("resultado")).isNull();
        assertThat(linha.get("duracao_segundos")).isNull();
        assertThat(linha.get("comentario")).isNull();
        assertThat(jdbc.queryForObject("select situacao from sessao_concluida where id = ?", String.class, inexistente))
                .isEqualTo("RECUSADO");
        // Ninguém lê o recusado.
        assertThat(api.get("/aluno/sessoes-concluidas", aluno, 200).get("sessoes")).hasSize(1);
        assertThat(api.get("/alunos/" + alunoId + "/sessoes-concluidas", treinador, 200).get("sessoes")).hasSize(1);
    }

    @Test
    void janelaDeDatasHojeESessentaDiasAtrasAceitosAmanhaE61DiasRecusados() throws Exception {
        JsonNode resposta = enviar(List.of(
                registro(UUID.randomUUID(), hoje.plusDays(1), true, "COMPLETA", null, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(61), true, "COMPLETA", null, null, Instant.now()),
                registro(UUID.randomUUID(), hoje, true, "COMPLETA", null, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(60), true, "COMPLETA", null, null, Instant.now())));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "ACEITO", "ACEITO");
        assertThat(contar()).isEqualTo(2);
    }

    @Test
    void duracaoDe60A21600SegundosVale59E21601SaoRecusadasEAusenteVale() throws Exception {
        JsonNode resposta = enviar(List.of(
                registro(UUID.randomUUID(), hoje.minusDays(1), true, "COMPLETA", 59L, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(2), true, "COMPLETA", 21601L, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(3), true, "COMPLETA", 60L, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(4), true, "PARCIAL", 21600L, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(5), true, "PARCIAL", null, null, Instant.now())));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "ACEITO", "ACEITO", "ACEITO");
        assertThat(jdbc.queryForList("select duracao_segundos from sessao_concluida where aluno_id = ? and duracao_segundos is not null "
                + "order by duracao_segundos", Integer.class, alunoId)).containsExactly(60, 21600);
    }

    @Test
    void comentarioDe300CaracteresVale301ERecusadoEBrancoViraNulo() throws Exception {
        UUID branco = UUID.randomUUID();
        UUID comEspacos = UUID.randomUUID();
        JsonNode resposta = enviar(List.of(
                registro(UUID.randomUUID(), hoje.minusDays(1), true, "COMPLETA", null, "a".repeat(301), Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(2), true, "COMPLETA", null, "a".repeat(300), Instant.now()),
                registro(branco, hoje.minusDays(3), true, "COMPLETA", null, "   \n  ", Instant.now()),
                // O limite é contado depois do strip: 300 letras com espaços em volta cabem.
                registro(comEspacos, hoje.minusDays(4), true, "COMPLETA", null, "  " + "b".repeat(300) + "  ", Instant.now())));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "ACEITO", "ACEITO", "ACEITO");
        assertThat(jdbc.queryForObject("select comentario from sessao_concluida where id = ?", String.class, branco)).isNull();
        assertThat(jdbc.queryForObject("select comentario from sessao_concluida where id = ?", String.class, comEspacos))
                .isEqualTo("b".repeat(300));
    }

    @Test
    void totalConcluidosContaSoAsConcluidasEInclusiveAsForaDoPeriodo() throws Exception {
        enviar(List.of(
                registro(UUID.randomUUID(), hoje, true, "COMPLETA", null, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(1), true, "PARCIAL", null, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(2), false, null, null, null, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(40), true, "COMPLETA", null, null, Instant.now())));

        // Padrão: 13 dias para trás. A de 40 dias não aparece na lista, mas conta no total.
        JsonNode padrao = api.get("/aluno/sessoes-concluidas", aluno, 200);
        assertThat(padrao.get("sessoes")).hasSize(3);
        assertThat(padrao.get("totalConcluidos").asLong()).isEqualTo(3);
        JsonNode curto = api.get("/aluno/sessoes-concluidas?de=" + hoje + "&ate=" + hoje, aluno, 200);
        assertThat(curto.get("sessoes")).hasSize(1);
        assertThat(curto.get("totalConcluidos").asLong()).isEqualTo(3);
        assertThat(api.get("/aluno/sessoes-concluidas?de=" + hoje.minusDays(50) + "&ate=" + hoje, aluno, 200).get("sessoes"))
                .hasSize(4);
        // Do mais novo para o mais antigo.
        assertThat(padrao.get("sessoes").get(0).get("data").asString()).isEqualTo(hoje.toString());

        api.get("/aluno/sessoes-concluidas?de=" + hoje.minusDays(400) + "&ate=" + hoje, aluno, 400);
        api.get("/aluno/sessoes-concluidas?de=" + hoje.minusDays(366) + "&ate=" + hoje, aluno, 200);
        api.get("/aluno/sessoes-concluidas?de=" + hoje + "&ate=" + hoje.minusDays(1), aluno, 400);
    }

    @Test
    void idDeOutroAlunoERecusadoEORegistroDeLeNaoMuda() throws Exception {
        UUID outroAlunoId = api.criarAluno(treinador, "Outro Aluno Fictício");
        api.publicarTreino(treinador, outroAlunoId, ApiDeTeste.treino().conteudo());
        JsonNode outro = api.convidarEEntrar(treinador, outroAlunoId);
        // Sessão do outro aluno: o uid vem do painel dele.
        JsonNode painel = api.get("/aluno/painel", outro, 200).get("treino");
        String versaoDoOutro = painel.get("versaoId").asString();
        String sessaoDoOutro = painel.get("conteudo").get("sessoes").get(0).get("uid").asString();

        UUID idDoOutro = UUID.randomUUID();
        Map<String, Object> deB = registro(idDoOutro, hoje, true, "COMPLETA", 3000L, COMENTARIO, Instant.now().minusSeconds(20));
        deB.put("planoVersaoId", versaoDoOutro);
        deB.put("sessaoUid", sessaoDoOutro);
        assertThat(situacoes(api.post("/aluno/sessoes-concluidas", outro, Map.of("registros", List.of(deB)), 200)))
                .containsExactly("ACEITO");

        JsonNode colisao = enviar(List.of(registro(idDoOutro, hoje, false, null, null, null, Instant.now())));
        assertThat(situacoes(colisao)).containsExactly("RECUSADO");
        assertThat(colisao.get("resultados").get(0).get("motivo").asString()).contains("já usado");

        assertThat(api.get("/aluno/sessoes-concluidas", aluno, 200).get("sessoes")).isEmpty();
        JsonNode doOutro = api.get("/aluno/sessoes-concluidas", outro, 200);
        assertThat(doOutro.get("sessoes")).hasSize(1);
        assertThat(doOutro.get("sessoes").get(0).get("concluida").asBoolean()).isTrue();
        assertThat(doOutro.get("totalConcluidos").asLong()).isEqualTo(1);
    }

    @Test
    void treinadorSemAlunoSensivelLerNaoVeOComentarioEComEleVe() throws Exception {
        enviar(List.of(registro(UUID.randomUUID(), hoje, true, "COMPLETA", 3000L, COMENTARIO, Instant.now())));
        String url = "/alunos/" + alunoId + "/sessoes-concluidas";

        JsonNode semSensivel = api.get(url, membro(Set.of("REGISTRO_LER", "ALUNO_LER")), 200);
        assertThat(semSensivel.toString()).doesNotContain("SEGREDO-ABC-123");
        assertThat(semSensivel.get("totalConcluidos").asLong()).isEqualTo(1);
        JsonNode linha = semSensivel.get("sessoes").get(0);
        assertThat(linha.get("comentario").isNull()).isTrue();
        // O resto da linha continua lá.
        assertThat(linha.get("resultado").asString()).isEqualTo("COMPLETA");
        assertThat(linha.get("duracaoSegundos").asInt()).isEqualTo(3000);

        assertThat(api.get(url, membro(Set.of("REGISTRO_LER", "ALUNO_LER", "ALUNO_SENSIVEL_LER")), 200)
                .get("sessoes").get(0).get("comentario").asString()).isEqualTo(COMENTARIO);
        assertThat(api.get(url, treinador, 200).get("sessoes").get(0).get("comentario").asString()).isEqualTo(COMENTARIO);
        // Sem REGISTRO_LER nem isso.
        api.get(url, membro(Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER")), 403);
    }

    @Test
    void outraConsultoriaRecebe404ESoOAlunoGravaETreinadorNaoUsaARotaDoAluno() throws Exception {
        JsonNode deOutraConsultoria = api.novoTreinador();
        api.get("/alunos/" + alunoId + "/sessoes-concluidas", deOutraConsultoria, 404);
        api.get("/alunos/" + alunoId + "/sessoes-concluidas", null, 401);
        // O aluno não chama a rota do treinador; o treinador não chama a do aluno.
        api.get("/alunos/" + alunoId + "/sessoes-concluidas", aluno, 403);
        api.post("/aluno/sessoes-concluidas", treinador, Map.of("registros", List.of()), 403);
        api.get("/aluno/sessoes-concluidas", treinador, 403);
        api.post("/aluno/sessoes-concluidas", null, Map.of("registros", List.of()), 401);
    }

    @Test
    void loteComMaisDe300RegistrosERecusado() throws Exception {
        List<Map<String, Object>> grande = new ArrayList<>();
        for (int i = 0; i < 301; i++) {
            grande.add(registro(UUID.randomUUID(), hoje, true, "COMPLETA", null, null, Instant.now()));
        }
        api.post("/aluno/sessoes-concluidas", aluno, Map.of("registros", grande), 400);
        assertThat(contar()).isZero();
    }

    @Test
    void toStringDosDtosNaoRepeteOComentarioNemADuracao() {
        UUID id = UUID.randomUUID();
        var registro = new RegistroSessaoConcluida(id, id, id, hoje, true, "COMPLETA", 4321L, COMENTARIO, Instant.now());
        var linha = new SessaoConcluidaLinha(id, id, id, "Treino A", hoje, true, "COMPLETA", 4321, COMENTARIO, null);
        var lote = new SessaoConcluidaDtos.LoteSessoesConcluidasRequest(List.of(registro));
        var resposta = new SessaoConcluidaDtos.SessoesConcluidasResponse(1, List.of(linha));
        for (Object o : List.of(registro, linha, lote, resposta)) {
            assertThat(o.toString()).doesNotContain("SEGREDO-ABC-123").doesNotContain("4321");
        }
        assertThat(new SessaoConcluidaUpsert.Linha(id, id, id, id, id, hoje, true, "COMPLETA", 4321, COMENTARIO, "ACEITO",
                null, Instant.now()).toString()).doesNotContain("SEGREDO-ABC-123").doesNotContain("4321");
    }

    // ---- ajudantes ----

    private Map<String, Object> registro(UUID id, LocalDate data, boolean concluida, String resultado, Long duracaoSegundos,
                                         String comentario, Instant quando) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("data", data.toString());
        r.put("concluida", concluida);
        r.put("resultado", resultado);
        r.put("duracaoSegundos", duracaoSegundos);
        r.put("comentario", comentario);
        r.put("alteradoNoAparelhoEm", quando.toString());
        return r;
    }

    private JsonNode enviar(List<Map<String, Object>> registros) throws Exception {
        return api.post("/aluno/sessoes-concluidas", aluno, Map.of("registros", registros), 200);
    }

    private static List<String> situacoes(JsonNode resposta) {
        return resposta.get("resultados").valueStream().map(r -> r.get("situacao").asString()).toList();
    }

    private int contar() {
        return contarDe(alunoId);
    }

    private int contarDe(UUID aluno) {
        Integer n = jdbc.queryForObject("select count(*) from sessao_concluida where aluno_id = ?", Integer.class, aluno);
        return n == null ? 0 : n;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private void publicarDieta(UUID alunoDaDieta) throws Exception {
        Item arroz = new Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz branco cozido", new BigDecimal("150"), "g",
                new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(arroz))))), List.of(), null, List.of(), List.of());
        JsonNode criado = api.post("/alunos/" + alunoDaDieta + "/planos-dieta", treinador, Map.of("titulo", "Dieta de teste"), 200);
        String id = criado.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta de teste", conteudo, criado.get("plano").get("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
    }
}
