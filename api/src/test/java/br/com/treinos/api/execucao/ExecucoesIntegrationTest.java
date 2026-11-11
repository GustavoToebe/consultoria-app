package br.com.treinos.api.execucao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Fuso;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Seção 15.1, item 4: lote idempotente, registro antigo, série e versão inválidas, exercicio_id da versão. */
@AutoConfigureMockMvc
class ExecucoesIntegrationTest extends AbstractIntegrationTest {

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
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void loteAceitoEReenviadoNaoDuplica() throws Exception {
        UUID id = UUID.randomUUID();
        Instant quando = Instant.now();
        List<Map<String, Object>> lote = List.of(registro(id, treino.wsUid(), "32.5", 5, quando));

        assertThat(situacoes(enviar(lote))).containsExactly("ACEITO");
        assertThat(situacoes(enviar(lote))).containsExactly("IGNORADO_ANTIGO");
        assertThat(contar()).isEqualTo(1);

        // Mais novo atualiza; mais antigo é ignorado.
        assertThat(situacoes(enviar(List.of(registro(id, treino.wsUid(), "35", 4, quando.plusSeconds(60))))))
                .containsExactly("ACEITO");
        assertThat(situacoes(enviar(List.of(registro(id, treino.wsUid(), "20", 9, quando.minusSeconds(60))))))
                .containsExactly("IGNORADO_ANTIGO");
        assertThat(jdbc.queryForObject("select carga from execucao_serie where id = ?", java.math.BigDecimal.class, id))
                .isEqualByComparingTo("35");
        assertThat(contar()).isEqualTo(1);
    }

    @Test
    void observacaoDaSerieSoApareceParaQuemLeDadoSensivel() throws Exception {
        Map<String, Object> r = registro(UUID.randomUUID(), treino.wsUid(), "30", 6, Instant.now());
        r.put("observacao", "Dor leve no ombro (texto fictício)");
        enviar(List.of(r));
        String url = "/alunos/" + alunoId + "/execucoes";
        JsonNode comSensivel = membro(Set.of("REGISTRO_LER", "ALUNO_LER", "ALUNO_SENSIVEL_LER"));
        JsonNode semSensivel = membro(Set.of("REGISTRO_LER", "ALUNO_LER"));
        assertThat(api.get(url, treinador, 200).toString()).contains("Dor leve");
        assertThat(api.get(url, comSensivel, 200).toString()).contains("Dor leve");
        JsonNode lista = api.get(url, semSensivel, 200);
        assertThat(lista.toString()).doesNotContain("Dor leve");
        // A série continua lá, só sem a observação; e o aluno vê a própria.
        assertThat(lista.get(0).get("sessoes").get(0).get("exercicios").get(0).get("series")).hasSize(1);
        assertThat(api.get("/aluno/execucoes", aluno, 200).toString()).contains("Dor leve");
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void exercicioIdETrabalhoVemDaVersaoENaoDoCliente() throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> r = registro(id, treino.wsUid(), "30", 6, Instant.now());
        r.put("exercicioId", UUID.randomUUID().toString());
        enviar(List.of(r));
        Map<String, Object> linha = jdbc.queryForMap(
                "select exercicio_id, serie_trabalho from execucao_serie where id = ?", id);
        assertThat(linha.get("exercicio_id")).isEqualTo(treino.exercicioId());
        assertThat(linha.get("serie_trabalho")).isEqualTo(true);
    }

    /**
     * Top set sem sugestão de carga (NENHUMA) não é série de trabalho: grava {@code serie_trabalho = false}, não vira a
     * "última carga" do exercício, mas segue contando no progresso (papel TRABALHO na metodologia).
     */
    @Test
    void topSetSemCargaNaoEhSerieDeTrabalhoENaoViraUltimaCarga() throws Exception {
        UUID outroId = api.criarAluno(treinador, "Aluno do Top set Fictício");
        UUID sessaoUid = UUID.randomUUID();
        UUID exercicioUid = UUID.randomUUID();
        UUID exercicioId = UUID.randomUUID();
        UUID ws = UUID.randomUUID();
        UUID top = UUID.randomUUID();
        UUID backOff = UUID.randomUUID();
        ConteudoTreino.ExercicioPlano ex = new ConteudoTreino.ExercicioPlano(exercicioUid, exercicioId, "Agachamento fictício",
                "MAQUINA", null, null, true, "kg", List.of(
                ConteudoTreino.Serie.de(ws, "WORKING", 3, 6, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO)),
                ConteudoTreino.Serie.de(top, "TOP_SET", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.NENHUMA)),
                ConteudoTreino.Serie.de(backOff, "BACK_OFF", 6, 8,
                        ConteudoTreino.Carga.percentual(ConteudoTreino.PERCENTUAL_WS, 80, null))));
        ConteudoTreino conteudo = new ConteudoTreino("Objetivo fictício", null, List.of(
                new ConteudoTreino.Sessao(sessaoUid, "Segunda - Pernas", 1, "TREINO", null, null, null, List.of(ex)),
                new ConteudoTreino.Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
        api.publicarTreino(treinador, outroId, conteudo);
        JsonNode outro = api.convidarEEntrar(treinador, outroId);
        String versao = api.get("/aluno/painel", outro, 200).get("treino").get("versaoId").asString();

        Instant quando = Instant.now();
        UUID idWs = UUID.randomUUID();
        UUID idTop = UUID.randomUUID();
        List<Map<String, Object>> registros = new java.util.ArrayList<>();
        // O Top set é registrado depois e mais pesado: se contasse como trabalho, viraria a "última carga".
        for (Object[] x : new Object[][] {{idWs, ws, "100", quando}, {idTop, top, "110", quando.plusSeconds(60)}}) {
            Map<String, Object> r = new LinkedHashMap<>(registro((UUID) x[0], (UUID) x[1], (String) x[2], 6, (Instant) x[3]));
            r.put("planoVersaoId", versao);
            r.put("sessaoUid", sessaoUid.toString());
            r.put("exercicioUid", exercicioUid.toString());
            registros.add(r);
        }
        assertThat(situacoes(api.post("/aluno/execucoes/lote", outro, Map.of("registros", registros), 200)))
                .containsExactly("ACEITO", "ACEITO");

        assertThat(jdbc.queryForObject("select serie_trabalho from execucao_serie where id = ?", Boolean.class, idWs)).isTrue();
        assertThat(jdbc.queryForObject("select serie_trabalho from execucao_serie where id = ?", Boolean.class, idTop)).isFalse();
        assertThat(jdbc.queryForObject("select conta_no_progresso from execucao_serie where id = ?", Boolean.class, idTop)).isTrue();
        JsonNode ultima = api.get("/aluno/painel", outro, 200).get("ultimasCargas").get(exercicioId.toString());
        assertThat(ultima.get("carga").decimalValue()).isEqualByComparingTo("100");
    }

    /** No mesmo dia, a última carga é a maior; no empate de carga, a de mais repetições (N16). */
    @Test
    void ultimaCargaNoMesmoDiaDesempataPelaCargaEDepoisPelasRepeticoes() throws Exception {
        UUID outroId = api.criarAluno(treinador, "Aluno da Progressão Fictício");
        UUID sessaoUid = UUID.randomUUID();
        UUID exercicioUid = UUID.randomUUID();
        UUID exercicioId = UUID.randomUUID();
        UUID outraUid = UUID.randomUUID();
        UUID outroExercicioId = UUID.randomUUID();
        UUID poucas = UUID.randomUUID();
        UUID muitas = UUID.randomUUID();
        UUID leve = UUID.randomUUID();
        UUID pesada = UUID.randomUUID();
        ConteudoTreino.ExercicioPlano empate = new ConteudoTreino.ExercicioPlano(exercicioUid, exercicioId, "Supino fictício",
                "MAQUINA", null, null, true, "kg", List.of(
                ConteudoTreino.Serie.de(poucas, "WORKING", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO)),
                ConteudoTreino.Serie.de(muitas, "WORKING", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO))));
        ConteudoTreino.ExercicioPlano maior = new ConteudoTreino.ExercicioPlano(outraUid, outroExercicioId, "Agachamento fictício",
                "MAQUINA", null, null, true, "kg", List.of(
                ConteudoTreino.Serie.de(leve, "WORKING", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO)),
                ConteudoTreino.Serie.de(pesada, "WORKING", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO))));
        ConteudoTreino conteudo = new ConteudoTreino("Objetivo fictício", null, List.of(
                new ConteudoTreino.Sessao(sessaoUid, "Segunda - Peito", 1, "TREINO", null, null, null, List.of(empate, maior)),
                new ConteudoTreino.Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
        api.publicarTreino(treinador, outroId, conteudo);
        JsonNode outro = api.convidarEEntrar(treinador, outroId);
        String versao = api.get("/aluno/painel", outro, 200).get("treino").get("versaoId").asString();

        Instant quando = Instant.now();
        List<Map<String, Object>> registros = new java.util.ArrayList<>();
        for (Object[] x : new Object[][] {
                {muitas, exercicioUid, "75", 6, quando},
                {poucas, exercicioUid, "75", 4, quando.plusSeconds(30)},
                {leve, outraUid, "70", 12, quando},
                {pesada, outraUid, "80", 3, quando.plusSeconds(30)}}) {
            Map<String, Object> r = new LinkedHashMap<>(registro(UUID.randomUUID(), (UUID) x[0], (String) x[2], (Integer) x[3], (Instant) x[4]));
            r.put("planoVersaoId", versao);
            r.put("sessaoUid", sessaoUid.toString());
            r.put("exercicioUid", ((UUID) x[1]).toString());
            registros.add(r);
        }
        assertThat(situacoes(api.post("/aluno/execucoes/lote", outro, Map.of("registros", registros), 200)))
                .containsExactly("ACEITO", "ACEITO", "ACEITO", "ACEITO");

        JsonNode cargas = api.get("/aluno/painel", outro, 200).get("ultimasCargas");
        JsonNode doEmpate = cargas.get(exercicioId.toString());
        assertThat(doEmpate.get("carga").decimalValue()).isEqualByComparingTo("75");
        assertThat(doEmpate.get("repeticoes").asInt()).isEqualTo(6);
        JsonNode daMaior = cargas.get(outroExercicioId.toString());
        assertThat(daMaior.get("carga").decimalValue()).isEqualByComparingTo("80");
        assertThat(daMaior.get("repeticoes").asInt()).isEqualTo(3);
    }

    /** Cada exercício usa a própria última data: a carga de uma data anterior do exercício A não pode vencer a de B. */
    @Test
    void ultimaCargaDeCadaExercicioVemDaUltimaDataDele() throws Exception {
        UUID outroId = api.criarAluno(treinador, "Aluno da Última Data Fictício");
        UUID sessaoUid = UUID.randomUUID();
        UUID exercicioUidA = UUID.randomUUID();
        UUID exercicioIdA = UUID.randomUUID();
        UUID exercicioUidB = UUID.randomUUID();
        UUID exercicioIdB = UUID.randomUUID();
        UUID serieA = UUID.randomUUID();
        UUID serieB = UUID.randomUUID();
        ConteudoTreino.ExercicioPlano a = new ConteudoTreino.ExercicioPlano(exercicioUidA, exercicioIdA, "Supino fictício",
                "MAQUINA", null, null, true, "kg", List.of(
                ConteudoTreino.Serie.de(serieA, "WORKING", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO))));
        ConteudoTreino.ExercicioPlano b = new ConteudoTreino.ExercicioPlano(exercicioUidB, exercicioIdB, "Remada fictícia",
                "MAQUINA", null, null, true, "kg", List.of(
                ConteudoTreino.Serie.de(serieB, "WORKING", 6, 8, ConteudoTreino.Carga.de(ConteudoTreino.CARGA_TRABALHO))));
        ConteudoTreino conteudo = new ConteudoTreino("Objetivo fictício", null, List.of(
                new ConteudoTreino.Sessao(sessaoUid, "Segunda - Costas", 1, "TREINO", null, null, null, List.of(a, b)),
                new ConteudoTreino.Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
        api.publicarTreino(treinador, outroId, conteudo);
        JsonNode outro = api.convidarEEntrar(treinador, outroId);
        String versao = api.get("/aluno/painel", outro, 200).get("treino").get("versaoId").asString();

        LocalDate d0 = hoje.minusDays(3);
        LocalDate d1 = hoje.minusDays(1);
        Instant quando = Instant.now();
        List<Map<String, Object>> registros = new java.util.ArrayList<>();
        for (Object[] x : new Object[][] {
                {serieA, exercicioUidA, "80", d0, quando},
                {serieA, exercicioUidA, "60", d1, quando.plusSeconds(30)},
                {serieB, exercicioUidB, "40", d0, quando}}) {
            Map<String, Object> r = new LinkedHashMap<>(registro(UUID.randomUUID(), (UUID) x[0], (String) x[2], 6, (Instant) x[4]));
            r.put("data", ((LocalDate) x[3]).toString());
            r.put("planoVersaoId", versao);
            r.put("sessaoUid", sessaoUid.toString());
            r.put("exercicioUid", ((UUID) x[1]).toString());
            registros.add(r);
        }
        assertThat(situacoes(api.post("/aluno/execucoes/lote", outro, Map.of("registros", registros), 200)))
                .containsExactly("ACEITO", "ACEITO", "ACEITO");

        JsonNode cargas = api.get("/aluno/painel", outro, 200).get("ultimasCargas");
        assertThat(cargas.get(exercicioIdA.toString()).get("carga").decimalValue()).isEqualByComparingTo("60");
        assertThat(cargas.get(exercicioIdB.toString()).get("carga").decimalValue()).isEqualByComparingTo("40");
    }

    @Test
    void serieInexistenteVersaoDeOutroAlunoEDataForaDoPeriodoSaoRecusados() throws Exception {
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício");
        String versaoDoOutro = api.publicarTreino(treinador, outroAluno, ApiDeTeste.treino().conteudo())
                .get("versoes").get(0).get("id").asString();

        Map<String, Object> serieErrada = registro(UUID.randomUUID(), UUID.randomUUID(), "30", 5, Instant.now());
        Map<String, Object> versaoErrada = registro(UUID.randomUUID(), treino.wsUid(), "30", 5, Instant.now());
        versaoErrada.put("planoVersaoId", versaoDoOutro);
        Map<String, Object> antigo = registro(UUID.randomUUID(), treino.wsUid(), "30", 5, Instant.now());
        antigo.put("data", hoje.minusDays(61).toString());
        Map<String, Object> cargaAbsurda = registro(UUID.randomUUID(), treino.wsUid(), "2500", 5, Instant.now());
        Map<String, Object> bom = registro(UUID.randomUUID(), treino.fsUid(), "15", 3, Instant.now());

        JsonNode resposta = enviar(List.of(serieErrada, versaoErrada, antigo, cargaAbsurda, bom));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO", "ACEITO");
        assertThat(resposta.get("resultados").get(0).get("motivo").asString()).isNotBlank();
        assertThat(contar()).isEqualTo(1);
    }

    @Test
    void idDeRegistroDeOutroAlunoERecusado() throws Exception {
        UUID id = UUID.randomUUID();
        enviar(List.of(registro(id, treino.wsUid(), "30", 5, Instant.now())));

        UUID outroAlunoId = api.criarAluno(treinador, "Outro Aluno Fictício");
        ApiDeTeste.TreinoDeTeste outroTreino = ApiDeTeste.treino();
        api.publicarTreino(treinador, outroAlunoId, outroTreino.conteudo());
        JsonNode outro = api.convidarEEntrar(treinador, outroAlunoId);
        String versaoDoOutro = api.get("/aluno/painel", outro, 200).get("treino").get("versaoId").asString();

        Map<String, Object> mesmoId = new LinkedHashMap<>(registro(id, outroTreino.wsUid(), "99", 1, Instant.now()));
        mesmoId.put("planoVersaoId", versaoDoOutro);
        mesmoId.put("sessaoUid", outroTreino.sessaoUid().toString());
        mesmoId.put("exercicioUid", outroTreino.exercicioUid().toString());
        JsonNode r = api.post("/aluno/execucoes/lote", outro, Map.of("registros", List.of(mesmoId)), 200);
        assertThat(situacoes(r)).containsExactly("RECUSADO");
        assertThat(jdbc.queryForObject("select aluno_id from execucao_serie where id = ?", UUID.class, id))
                .isEqualTo(alunoId);
    }

    @Test
    void historicoProgressoEUltimaCargaMostramSoORegistrado() throws Exception {
        enviar(List.of(
                registro(UUID.randomUUID(), treino.fsUid(), "15", 3, Instant.now()),
                registro(UUID.randomUUID(), treino.wsUid(), "30", 6, Instant.now()),
                registro(UUID.randomUUID(), treino.backOffUid(), "25.5", null, Instant.now())));

        JsonNode historico = api.get("/alunos/" + alunoId + "/execucoes", treinador, 200);
        JsonNode exercicio = historico.get(0).get("sessoes").get(0).get("exercicios").get(0);
        // Fora da biblioteca não há grupo muscular; nada é presumido.
        assertThat(exercicio.get("grupoMuscular").isNull()).isTrue();
        jdbc.update("insert into exercicio (id, consultoria_id, nome, grupo_muscular) "
                + "select ?, consultoria_id, 'Remada baixa na polia', 'Costas' from aluno where id = ?", treino.exercicioId(), alunoId);
        historico = api.get("/alunos/" + alunoId + "/execucoes", treinador, 200);
        exercicio = historico.get(0).get("sessoes").get(0).get("exercicios").get(0);
        assertThat(exercicio.get("grupoMuscular").asString()).isEqualTo("Costas");
        assertThat(historico.get(0).get("sessoes").get(0).get("sessao").asString()).isEqualTo("Segunda - Costas");
        assertThat(exercicio.get("nome").asString()).isEqualTo("Remada baixa na polia");
        assertThat(exercicio.get("series").valueStream().map(s -> s.get("tipo").asString()))
                .containsExactly("FS", "WS", "Back off");
        assertThat(exercicio.get("series").get(2).get("repeticoes").isNull()).isTrue();

        JsonNode progresso = api.get("/alunos/" + alunoId + "/progresso?exercicioId=" + treino.exercicioId(),
                treinador, 200);
        assertThat(progresso).hasSize(1);
        assertThat(progresso.get(0).get("maiorCargaTrabalho").decimalValue()).isEqualByComparingTo("30");

        JsonNode ultima = api.get("/aluno/painel", aluno, 200).get("ultimasCargas").get(treino.exercicioId().toString());
        assertThat(ultima.get("carga").decimalValue()).isEqualByComparingTo("30");
        assertThat(api.get("/aluno/execucoes", aluno, 200)).hasSize(1);

        // O aluno vê o próprio progresso; o treinador não usa esta rota (só ALUNO).
        JsonNode proprio = api.get("/aluno/progresso?exercicioId=" + treino.exercicioId(), aluno, 200);
        assertThat(proprio).hasSize(1);
        assertThat(proprio.get(0).get("maiorCargaTrabalho").decimalValue()).isEqualByComparingTo("30");
        api.get("/aluno/progresso?exercicioId=" + treino.exercicioId(), treinador, 403);
    }

    @Test
    void loteComMaisDe300RegistrosERecusado() throws Exception {
        List<Map<String, Object>> grande = new java.util.ArrayList<>();
        for (int i = 0; i < 301; i++) {
            grande.add(registro(UUID.randomUUID(), treino.wsUid(), "30", 5, Instant.now()));
        }
        api.post("/aluno/execucoes/lote", aluno, Map.of("registros", grande), 400);
    }

    /**
     * O histórico mostra o NOME do tipo, resolvido pela metodologia copiada na versão publicada: renomear o tipo na
     * receita METODOLOGIA depois não muda o que o aluno e o treinador veem na ficha já publicada (critério de aceitação),
     * e a ficha publicada depois leva o nome novo.
     */
    @Test
    void historicoMostraONomeDoTipoDaMetodologiaDaVersaoNaoDaReceitaDeHoje() throws Exception {
        enviar(List.of(
                registro(UUID.randomUUID(), treino.fsUid(), "15", 3, Instant.now()),
                registro(UUID.randomUUID(), treino.wsUid(), "30", 6, Instant.now()),
                registro(UUID.randomUUID(), treino.backOffUid(), "25.5", 6, Instant.now())));
        JsonNode metodologia = api.get("/receitas?tipo=METODOLOGIA", treinador, 200).get(0);
        ConfiguracaoConsultoria padrao = ConfiguracaoConsultoria.padrao();
        List<ConfiguracaoConsultoria.TipoDeSerie> renomeados = padrao.tipos().stream()
                .map(t -> t.codigo().equals("WORKING")
                        ? new ConfiguracaoConsultoria.TipoDeSerie(t.codigo(), "Série de trabalho", t.papel(), t.repeticoes(),
                        t.cargaPadrao(), t.esforcoPadrao(), t.regraPercentuais(), t.explicacao())
                        : t).toList();
        ConfiguracaoConsultoria nova = new ConfiguracaoConsultoria(renomeados, padrao.tecnicas(), padrao.combinacoes(),
                padrao.arredondamentoKg(), padrao.instrucoesTreino(), padrao.rodapePdf());
        api.put("/receitas/" + metodologia.get("id").asString() + "/conteudo", treinador,
                Map.of("nome", metodologia.get("nome").asString(), "conteudo", nova, "versao", metodologia.get("versao").asLong()),
                200);

        // A ficha já publicada continua com a metodologia que foi copiada nela.
        JsonNode historico = api.get("/alunos/" + alunoId + "/execucoes", treinador, 200);
        JsonNode exercicio = historico.get(0).get("sessoes").get(0).get("exercicios").get(0);
        assertThat(exercicio.get("series").valueStream().map(x -> x.get("tipo").asString()))
                .containsExactly("FS", "WS", "Back off");
        assertThat(api.get("/aluno/painel", aluno, 200).at("/treino/conteudo/metodologia/configuracao/tipos/2/nome").asString())
                .isEqualTo("WS");
        assertThat(api.get("/aluno/painel", aluno, 200).at("/configuracao/tipoTrabalho").asString()).isEqualTo("WS");

        // Um plano publicado depois copia a metodologia nova, e o histórico dele mostra o nome novo.
        UUID outroId = api.criarAluno(treinador, "Outro Aluno Fictício");
        ApiDeTeste.TreinoDeTeste outroTreino = ApiDeTeste.treino();
        api.publicarTreino(treinador, outroId, outroTreino.conteudo());
        JsonNode outro = api.convidarEEntrar(treinador, outroId);
        JsonNode painelOutro = api.get("/aluno/painel", outro, 200);
        List<Map<String, Object>> registros = new java.util.ArrayList<>();
        for (UUID serie : List.of(outroTreino.fsUid(), outroTreino.wsUid(), outroTreino.backOffUid())) {
            Map<String, Object> r = new LinkedHashMap<>(registro(UUID.randomUUID(), serie, "40", 5, Instant.now()));
            r.put("planoVersaoId", painelOutro.get("treino").get("versaoId").asString());
            r.put("sessaoUid", outroTreino.sessaoUid().toString());
            r.put("exercicioUid", outroTreino.exercicioUid().toString());
            registros.add(r);
        }
        api.post("/aluno/execucoes/lote", outro, Map.of("registros", registros), 200);
        JsonNode historicoOutro = api.get("/alunos/" + outroId + "/execucoes", treinador, 200);
        assertThat(historicoOutro.get(0).get("sessoes").get(0).get("exercicios").get(0).get("series").valueStream()
                .map(x -> x.get("tipo").asString())).containsExactly("FS", "Série de trabalho", "Back off");
    }

    private Map<String, Object> registro(UUID id, UUID serieUid, String carga, Integer reps, Instant quando) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("exercicioUid", treino.exercicioUid().toString());
        r.put("serieUid", serieUid.toString());
        r.put("data", hoje.toString());
        r.put("carga", carga);
        r.put("repeticoes", reps);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", quando.toString());
        return r;
    }

    private JsonNode enviar(List<Map<String, Object>> registros) throws Exception {
        return api.post("/aluno/execucoes/lote", aluno, Map.of("registros", registros), 200);
    }

    private static List<String> situacoes(JsonNode resposta) {
        return resposta.get("resultados").valueStream().map(r -> r.get("situacao").asString()).toList();
    }

    private int contar() {
        Integer n = jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?", Integer.class, alunoId);
        return n == null ? 0 : n;
    }
}
