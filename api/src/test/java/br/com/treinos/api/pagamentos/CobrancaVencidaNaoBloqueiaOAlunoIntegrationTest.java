package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobrança aberta e vencida (e outra vencida há muito) com o módulo de pagamentos ligado: o aluno continua lendo o treino, a
 * mobilidade e o financeiro e registrando o que treinou. O financeiro é só informação; nenhum acesso é negado por dívida
 * (a regra de arquitetura em {@code ArquiteturaTest} impede que algo fora de {@code pagamentos/} sequer leia a cobrança).
 */
@AutoConfigureMockMvc
class CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void vencidaHaPoucosDiasEVencidaHaMuitoTempoNaoTiramNadaDoAluno() throws Exception {
        for (int diasDeAtraso : new int[] {3, 400}) {
            UUID alunoId = api.criarAluno(treinador, "Aluno Fictício " + UUID.randomUUID());
            var treino = ApiDeTeste.treino();
            var mobilidade = ApiDeTeste.mobilidade();
            api.publicarTreino(treinador, alunoId, treino.conteudo());
            api.publicarMobilidade(treinador, alunoId, mobilidade.conteudo());
            JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
            String cobrancaId = contratarEVencer(alunoId, diasDeAtraso);
            String versaoTreino = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
            String versaoMobilidade = api.get("/aluno/mobilidade", aluno, 200).get("mobilidade").get("id").asString();

            // O financeiro mostra a dívida, sem esconder nada.
            JsonNode financeiro = api.get("/aluno/financeiro", aluno, 200);
            assertThat(financeiro.toString()).contains(cobrancaId);
            // Plano, pastas, progresso e histórico seguem abertos.
            api.get("/aluno/pastas", aluno, 200);
            api.get("/aluno/progresso?exercicioId=" + treino.exercicioId(), aluno, 200);
            api.get("/aluno/execucoes", aluno, 200);
            api.get("/aluno/dieta", aluno, 200);
            // Registrar o treino e marcar a mobilidade continua valendo.
            Map<String, Object> serie = new LinkedHashMap<>();
            serie.put("id", UUID.randomUUID().toString());
            serie.put("planoVersaoId", versaoTreino);
            serie.put("sessaoUid", treino.sessaoUid().toString());
            serie.put("exercicioUid", treino.exercicioUid().toString());
            serie.put("serieUid", treino.wsUid().toString());
            serie.put("data", hoje.toString());
            serie.put("carga", "30");
            serie.put("repeticoes", 6);
            serie.put("concluida", true);
            serie.put("alteradoNoAparelhoEm", Instant.now().toString());
            JsonNode lote = api.post("/aluno/execucoes/lote", aluno, Map.of("registros", List.of(serie)), 200);
            assertThat(lote.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");

            Map<String, Object> marca = new LinkedHashMap<>();
            marca.put("id", UUID.randomUUID().toString());
            marca.put("planoVersaoId", versaoMobilidade);
            marca.put("secaoUid", mobilidade.secaoUid().toString());
            marca.put("itemUid", mobilidade.itemUid().toString());
            marca.put("data", hoje.toString());
            marca.put("feito", true);
            marca.put("alteradoNoAparelhoEm", Instant.now().toString());
            JsonNode marcas = api.post("/aluno/mobilidade/registros", aluno, Map.of("registros", List.of(marca)), 200);
            assertThat(marcas.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");
            api.get("/aluno/mobilidade/registros", aluno, 200);
            api.get("/eu", aluno, 200);
        }
    }

    /**
     * Avulsa vencida e várias mensalidades vencidas (a geração todo mês deixa meses atrás em aberto): o aluno segue acessando
     * treino, dieta, mobilidade, atualização (lê e envia) e anamnese (lê e envia), e o financeiro só informa.
     */
    @Test
    void avulsaVencidaEVariasMensalidadesVencidasNaoTiramTreinoDietaMobilidadeAtualizacaoNemAnamnese() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício " + UUID.randomUUID());
        // Pasta com treino publicado (a atualização vem dela), mobilidade e a anamnese atribuída pelo treinador.
        String pasta = api.post("/alunos/" + alunoId + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", hoje.minusDays(26).toString(), "fim", hoje.plusDays(1).toString()), 200)
                .get("id").asString();
        JsonNode criado = api.post("/alunos/" + alunoId + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String planoId = criado.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + planoId + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + planoId + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        api.publicarMobilidade(treinador, alunoId, ApiDeTeste.mobilidade().conteudo());
        JsonNode anamnese = api.post("/alunos/" + alunoId + "/anamneses", treinador,
                Map.of("questionarioId", anamnesePublicada().get("id").asString()), 200);
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);

        // Quatro mensalidades (início há três meses) e uma avulsa, todas vencidas e abertas.
        JsonNode plano = api.post("/financeiro/planos", treinador,
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 15_000, "periodicidade", "MENSAL"), 200);
        Map<String, Object> contratar = new LinkedHashMap<>();
        contratar.put("planoComercialId", plano.get("id").asString());
        contratar.put("inicio", hoje.minusMonths(3).toString());
        contratar.put("diaVencimento", hoje.getDayOfMonth());
        contratar.put("gerarMesesAnteriores", true);
        api.post("/alunos/" + alunoId + "/contratacoes", treinador, contratar, 200);
        api.post("/financeiro/cobrancas-avulsas", treinador, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(alunoId.toString()),
                "descricao", "Camiseta fictícia", "valorCentavos", 3_000, "primeiroVencimento", hoje.minusDays(20).toString(),
                "parcelas", 1), 201);
        jdbc.update("update cobranca_aluno set vencimento = ? where aluno_id = ?::uuid and tipo = 'MENSALIDADE'",
                hoje.minusDays(8), alunoId.toString());

        JsonNode financeiro = api.get("/aluno/financeiro", aluno, 200);
        assertThat(financeiro.get("abertas")).hasSize(5);
        financeiro.get("abertas").forEach(c -> assertThat(c.get("vencida").asBoolean()).isTrue());

        api.get("/aluno/painel", aluno, 200);
        api.get("/aluno/pastas", aluno, 200);
        api.get("/aluno/dieta", aluno, 200);
        api.get("/aluno/mobilidade", aluno, 200);
        // Atualização: lê e envia.
        JsonNode atualizacao = api.get("/aluno/atualizacao", aluno, 200);
        assertThat(atualizacao.get("fase").asString()).isEqualTo("ABERTA");
        Map<String, Object> respostas = new LinkedHashMap<>(
                Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6));
        JsonNode enviada = api.post("/aluno/atualizacao/enviar", aluno, Map.of("pastaId", atualizacao.get("pastaId").asString(),
                "questionarioVersaoId", atualizacao.get("questionarioVersaoId").asString(), "respostas", respostas), 200);
        assertThat(enviada.get("fase").asString()).isEqualTo("ENVIADA");
        // Anamnese: lê e envia.
        JsonNode daAluno = api.get("/aluno/anamnese", aluno, 200);
        assertThat(daAluno.get("id").asString()).isEqualTo(anamnese.get("id").asString());
        JsonNode anamneseEnviada = api.post("/aluno/anamnese/" + anamnese.get("id").asString() + "/enviar", aluno,
                Map.of("questionarioVersaoId", daAluno.get("questionarioVersaoId").asString(), "respostas", Map.of("pergunta", true)), 200);
        assertThat(anamneseEnviada.get("situacao").asString()).isEqualTo("ENVIADA");
    }

    /**
     * Atraso sozinho nunca bloqueia o aluno, mas a pausa manual do treinador restringe com 403 ACESSO_PAUSADO_POR_ATRASO
     * e a quitação da última cobrança vencida reativa o acesso automaticamente.
     */
    @Test
    void pausaManualRestringeCom403EReativaAutomaticamenteAoQuitar() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício " + UUID.randomUUID());
        api.publicarTreino(treinador, alunoId, ApiDeTeste.treino().conteudo());
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);

        // Cria uma cobrança avulsa vencida: sem pausa manual, o aluno segue acessando o painel normalmente.
        api.post("/financeiro/cobrancas-avulsas", treinador, Map.of(
                "pedidoId", UUID.randomUUID().toString(),
                "alunoIds", List.of(alunoId.toString()),
                "descricao", "Mensalidade em atraso",
                "valorCentavos", 12_000,
                "primeiroVencimento", hoje.minusDays(5).toString(),
                "parcelas", 1), 201);
        JsonNode cobranca = api.get("/alunos/" + alunoId + "/cobrancas", treinador, 200).get(0);
        api.get("/aluno/painel", aluno, 200);

        // Treinador pausa manualmente: agora o painel responde 403 ACESSO_PAUSADO_POR_ATRASO, mas /aluno/financeiro continua aberto.
        JsonNode pausado = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200);
        assertThat(pausado.get("acessoPausado").asBoolean()).isTrue();
        JsonNode erro = api.get("/aluno/painel", aluno, 403);
        assertThat(erro.get("codigo").asString()).isEqualTo("ACESSO_PAUSADO_POR_ATRASO");
        api.get("/aluno/financeiro", aluno, 200);

        // Quitação da cobrança vencida reativa o acesso automaticamente.
        api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", treinador,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", cobranca.get("versao").asLong()), 200);
        assertThat(api.get("/eu", aluno, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", aluno, 200);
    }

    /** Anamnese fictícia mínima, publicada: uma pergunta sim ou não obrigatória. */
    private JsonNode anamnesePublicada() throws Exception {
        String nome = "Anamnese fictícia " + UUID.randomUUID();
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", nome, "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> pergunta = Map.of("id", "pergunta", "tipo", "SIM_NAO", "rotulo", "Pergunta fictícia?", "obrigatoria", true);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("conteudo", Map.of("instrucoes", List.of(),
                "secoes", List.of(Map.of("uid", "s1", "titulo", "Geral", "perguntas", List.of(pergunta)))));
        corpo.put("versao", q.get("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.get("id").asString(), treinador, corpo, 200);
        return api.post("/questionarios/" + q.get("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.get("versao").asLong(), "confirmarAvisos", true), 200);
    }

    /** Aluno com um plano mensal contratado hoje; a cobrança aberta que nasce ganha o vencimento no passado. */
    private String contratarEVencer(UUID alunoId, int diasDeAtraso) throws Exception {
        JsonNode plano = api.post("/financeiro/planos", treinador,
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 15_000, "periodicidade", "MENSAL",
                        "tempoMinimoMeses", 3), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        JsonNode contratacao = api.post("/alunos/" + alunoId + "/contratacoes", treinador, corpo, 200);
        // Além da mensalidade vencida, uma cobrança de saída vencida com o mínimo ainda no futuro: nada disso bloqueia o aluno.
        api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", treinador, Map.of("versao",
                contratacao.get("versao").asLong(), "saida", Map.of("opcao", "OUTRO", "valorCentavos", 5_000)), 200);
        jdbc.update("update cobranca_aluno set vencimento = ? where aluno_id = ?::uuid and tipo = 'SAIDA'",
                hoje.minusDays(diasDeAtraso), alunoId.toString());
        String cobrancaId = null;
        for (JsonNode c : api.get("/alunos/" + alunoId + "/cobrancas", treinador, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                cobrancaId = c.get("id").asString();
            }
        }
        assertThat(cobrancaId).isNotNull();
        jdbc.update("update cobranca_aluno set vencimento = ? where id = ?::uuid", hoje.minusDays(diasDeAtraso), cobrancaId);
        return cobrancaId;
    }
}
