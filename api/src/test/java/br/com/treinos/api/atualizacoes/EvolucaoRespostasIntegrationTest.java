package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Evolução das respostas numéricas ({@code GET /alunos/{id}/atualizacoes/evolucao}). Dados fictícios; atualizações e
 * versões gravadas direto no banco para cobrir várias versões do questionário e o limite sem passar pelo envio.
 */
@AutoConfigureMockMvc
class EvolucaoRespostasIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private UUID consultoria;

    private static final String V1 = """
        {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
          {"id":"peso","tipo":"PESO","rotulo":"Peso","obrigatoria":false},
          {"id":"sono","tipo":"NOTA","rotulo":"Sono","obrigatoria":false},
          {"id":"cintura","tipo":"NUMERO","rotulo":"Cintura","obrigatoria":false,"unidade":"cm","casas":1},
          {"id":"obs","tipo":"TEXTO","rotulo":"Observações","obrigatoria":false},
          {"id":"dias","tipo":"NOTAS_POR_DIA","rotulo":"Fome por dia","obrigatoria":false,"dias":[1,2]}]}]}
        """;
    /** Mesmos ids, rótulo novo no sono, ordem trocada e uma pergunta que ninguém respondeu. */
    private static final String V2 = """
        {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
          {"id":"cintura","tipo":"NUMERO","rotulo":"Medida da cintura","obrigatoria":false,"unidade":"cm","casas":1},
          {"id":"sono","tipo":"NOTA","rotulo":"Qualidade do sono","rotuloCurto":"Sono","obrigatoria":false},
          {"id":"energia","tipo":"NOTA","rotulo":"Energia","obrigatoria":false}]}]}
        """;

    @BeforeEach void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Evolução");
        consultoria = banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
    }

    private UUID questionario(String nome) {
        UUID q = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) values (?,?,?,?::jsonb,1,now())",
                q, consultoria, nome, V1);
        return q;
    }
    private UUID versao(UUID questionario, int numero, String conteudo) {
        UUID v = UUID.randomUUID();
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,?,?::jsonb)",
                v, consultoria, questionario, numero, conteudo);
        return v;
    }
    /** Uma pasta por atualização (a atualização é única por pasta). */
    private UUID atualizacao(LocalDate data, String estado, UUID versao, String respostas) {
        UUID pasta = UUID.randomUUID(), id = UUID.randomUUID();
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício',?,?)",
                pasta, consultoria, aluno, data.minusDays(27), data);
        banco.update("insert into atualizacao(id,consultoria_id,aluno_id,pasta_id,data_atualizacao,estado,respostas,enviada_em,questionario_versao_id) "
                + "values (?,?,?,?,?,?,?::jsonb,case when ? = 'ABERTA' then null else now() end,?)",
                id, consultoria, aluno, pasta, data, estado, respostas, estado, versao);
        return id;
    }
    private String caminho() { return "/alunos/" + aluno + "/atualizacoes/evolucao"; }

    @Test void agrupaPorIdComORotuloDaVersaoMaisRecenteESoComOQueFoiRespondido() throws Exception {
        UUID q = questionario("Fictício");
        UUID v1 = versao(q, 1, V1), v2 = versao(q, 2, V2);
        UUID primeira = atualizacao(LocalDate.of(2026, 1, 31), "ENVIADA", v1,
                "{\"peso\":80,\"sono\":6,\"cintura\":90.5,\"obs\":\"Texto fictício\",\"dias\":{\"1\":5}}");
        // Zero é resposta; cintura sem resposta não vira ponto (nunca zero).
        atualizacao(LocalDate.of(2026, 3, 2), "REVISADA", v1, "{\"sono\":0,\"peso\":79}");
        UUID ultima = atualizacao(LocalDate.of(2026, 4, 1), "ENVIADA", v2, "{\"sono\":8,\"cintura\":88}");
        // Aberta (ainda sem envio) não entra.
        atualizacao(LocalDate.of(2026, 5, 1), "ABERTA", null, "{}");

        JsonNode evolucao = api.get(caminho(), treinador, 200);
        assertThat(evolucao.path("limite").asInt()).isEqualTo(EvolucaoRespostasService.LIMITE);
        assertThat(evolucao.path("atualizacoes").asInt()).isEqualTo(3);
        JsonNode series = evolucao.path("series");
        // Ordem da versão mais recente; PESO, TEXTO e NOTAS_POR_DIA ficam de fora; "energia" não tem ponto.
        assertThat(series.valueStream().map(s -> s.path("perguntaId").asString()).toList()).containsExactly("cintura", "sono");

        JsonNode cintura = series.get(0);
        assertThat(cintura.path("tipo").asString()).isEqualTo("NUMERO");
        assertThat(cintura.path("rotulo").asString()).isEqualTo("Medida da cintura");
        assertThat(cintura.path("unidade").asString()).isEqualTo("cm");
        assertThat(cintura.path("casas").asInt()).isEqualTo(1);
        assertThat(cintura.path("pontos")).hasSize(2);
        assertThat(cintura.path("pontos").get(0).path("data").asString()).isEqualTo("2026-01-31");
        assertThat(cintura.path("pontos").get(0).path("valor").decimalValue()).isEqualByComparingTo("90.5");
        assertThat(cintura.path("pontos").get(0).path("atualizacaoId").asString()).isEqualTo(primeira.toString());
        assertThat(cintura.path("pontos").get(1).path("valor").decimalValue()).isEqualByComparingTo("88");

        JsonNode sono = series.get(1);
        assertThat(sono.path("rotulo").asString()).isEqualTo("Qualidade do sono");
        assertThat(sono.path("rotuloCurto").asString()).isEqualTo("Sono");
        assertThat(sono.path("unidade").isNull()).isTrue();
        assertThat(sono.path("pontos").valueStream().map(p -> p.path("data").asString()).toList())
                .containsExactly("2026-01-31", "2026-03-02", "2026-04-01");
        assertThat(sono.path("pontos").valueStream().map(p -> p.path("valor").asInt()).toList()).containsExactly(6, 0, 8);
        assertThat(sono.path("pontos").get(2).path("atualizacaoId").asString()).isEqualTo(ultima.toString());

        // O mesmo id em outro questionário é a mesma série.
        UUID outro = questionario("Outro fictício");
        atualizacao(LocalDate.of(2026, 4, 20), "ENVIADA", versao(outro, 1, V1), "{\"sono\":9}");
        JsonNode depois = api.get(caminho(), treinador, 200).path("series");
        JsonNode sonoDepois = depois.valueStream().filter(s -> s.path("perguntaId").asString().equals("sono")).findFirst().orElseThrow();
        assertThat(sonoDepois.path("pontos")).hasSize(4);
        // A versão mais recente agora é a V1 do outro questionário: o rótulo acompanha.
        assertThat(sonoDepois.path("rotulo").asString()).isEqualTo("Sono");
    }

    @Test void semAtualizacaoEnviadaNaoHaSerie() throws Exception {
        JsonNode evolucao = api.get(caminho(), treinador, 200);
        assertThat(evolucao.path("atualizacoes").asInt()).isZero();
        assertThat(evolucao.path("series")).isEmpty();
        // Respostas apagadas (aluno anonimizado) também não viram zero.
        atualizacao(LocalDate.of(2026, 1, 31), "ENVIADA", versao(questionario("Fictício"), 1, V1), "{}");
        assertThat(api.get(caminho(), treinador, 200).path("series")).isEmpty();
    }

    @Test void leSoAsUltimasVinteEQuatroAtualizacoes() throws Exception {
        UUID v1 = versao(questionario("Fictício"), 1, V1);
        LocalDate inicio = LocalDate.of(2024, 1, 1);
        for (int i = 0; i < EvolucaoRespostasService.LIMITE + 2; i++)
            atualizacao(inicio.plusWeeks(i), "ENVIADA", v1, "{\"sono\":" + (i % 11) + "}");
        JsonNode evolucao = api.get(caminho(), treinador, 200);
        assertThat(evolucao.path("atualizacoes").asInt()).isEqualTo(EvolucaoRespostasService.LIMITE);
        JsonNode pontos = evolucao.path("series").get(0).path("pontos");
        assertThat(pontos).hasSize(EvolucaoRespostasService.LIMITE);
        // As duas mais antigas ficam de fora.
        assertThat(pontos.get(0).path("data").asString()).isEqualTo(inicio.plusWeeks(2).toString());
        assertThat(pontos.valueStream().map(p -> p.path("data").asString()).toList()).isSorted();
    }

    @Test void outraConsultoriaAlunoESemPermissaoNaoLeem() throws Exception {
        atualizacao(LocalDate.of(2026, 1, 31), "ENVIADA", versao(questionario("Fictício"), 1, V1), "{\"sono\":7}");
        api.get(caminho(), api.novoTreinador(), 404);
        api.get("/alunos/" + UUID.randomUUID() + "/atualizacoes/evolucao", treinador, 404);
        api.get(caminho(), api.convidarEEntrar(treinador, aluno), 403);
        // Perfil sem ATUALIZACAO_LER nem ALUNO_SENSIVEL_LER.
        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        UUID vazio = UUID.randomUUID();
        banco.update("insert into perfil(id,consultoria_id,nome) values(?,?,'Sem acesso fictício')", vazio, consultoria);
        banco.update("update usuario set perfil_id=? where id=?", vazio, usuario);
        api.get(caminho(), treinador, 403);
    }
}
