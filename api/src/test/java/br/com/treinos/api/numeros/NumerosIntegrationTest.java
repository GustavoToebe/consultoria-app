package br.com.treinos.api.numeros;

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

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Relatório "Números": contagens por mês, sem nome. Cenário montado com dados fictícios; as datas passadas (criação da
 * consultoria e dos alunos, inativação, anonimização, prazo e envio das atualizações) são ajustadas por JDBC pelo id do
 * próprio teste, sempre relativas ao mês corrente de Brasília.
 */
@AutoConfigureMockMvc
class NumerosIntegrationTest extends AbstractIntegrationTest {

    private static final String CONTEUDO = """
        {"formato":2,"instrucoes":[],"secoes":[{"uid":"s1","titulo":"Geral","perguntas":[
          {"id":"sono","tipo":"NOTA","rotulo":"Sono","obrigatoria":false}]}]}
        """;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode admin;
    private YearMonth atual;
    private LocalDate hoje;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        hoje = LocalDate.now(Fuso.BRASILIA);
        atual = YearMonth.from(hoje);
    }

    private Timestamp quando(YearMonth mes, int dia, int hora, int minuto) {
        return Timestamp.from(ZonedDateTime.of(mes.getYear(), mes.getMonthValue(), dia, hora, minuto, 0, 0, Fuso.BRASILIA)
                .toInstant());
    }

    private UUID consultoriaDe(UUID aluno) {
        return banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
    }

    private JsonNode numeros(JsonNode quem) throws Exception {
        return api.get("/numeros", quem, 200);
    }

    private JsonNode mes(JsonNode corpo, int indice) {
        return corpo.path("meses").get(indice);
    }

    private JsonNode membroComPermissoes(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil de números " + UUID.randomUUID(),
                "permissoes", permissoes), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/" + convite.path("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    private UUID versaoDoQuestionario(UUID consultoria) {
        UUID q = UUID.randomUUID(), v = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) "
                + "values (?,?,?,?::jsonb,1,now())", q, consultoria, "Fictício " + q, CONTEUDO);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) "
                + "values (?,?,?,1,?::jsonb)", v, consultoria, q, CONTEUDO);
        return v;
    }

    /** Uma pasta por atualização (a atualização é única por pasta). */
    private void atualizacao(UUID consultoria, UUID aluno, UUID versao, LocalDate data, LocalDate atrasoAte, Timestamp enviadaEm) {
        UUID pasta = UUID.randomUUID();
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício',?,?)",
                pasta, consultoria, aluno, data.minusDays(27), data);
        banco.update("insert into atualizacao(id,consultoria_id,aluno_id,pasta_id,data_atualizacao,estado,respostas,enviada_em,"
                        + "atraso_ate,questionario_versao_id) values (?,?,?,?,?,?,'{}'::jsonb,?,?,?)",
                UUID.randomUUID(), consultoria, aluno, pasta, data, enviadaEm == null ? "ABERTA" : "ENVIADA", enviadaEm,
                atrasoAte, enviadaEm == null ? null : versao);
    }

    @Test
    void contaAlunosAtivosEAtualizacoesPorMesComNuloQuandoNaoHaDado() throws Exception {
        UUID agora = api.criarAluno(admin, "Aluno criado agora");
        UUID inativado = api.criarAluno(admin, "Aluno inativado");
        UUID entrouDepois = api.criarAluno(admin, "Aluno que entrou depois");
        UUID anonimizado = api.criarAluno(admin, "Aluno anonimizado depois");
        UUID consultoria = consultoriaDe(agora);

        // A consultoria nasceu no primeiro dia de M-4: M-5 não tem dado; M-4 em diante tem (zero é zero).
        banco.update("update consultoria set criado_em=? where id=?", quando(atual.minusMonths(4), 1, 12, 0), consultoria);
        // Ativo em M-4 e M-3; inativado no dia 10 de M-2.
        banco.update("update aluno set criado_em=?, ativo=false, inativado_em=? where id=?",
                quando(atual.minusMonths(4), 5, 12, 0), quando(atual.minusMonths(2), 10, 12, 0), inativado);
        // Entrou em M-3 e segue ativo.
        banco.update("update aluno set criado_em=? where id=?", quando(atual.minusMonths(3), 3, 12, 0), entrouDepois);
        // Anonimizado no primeiro dia de M-1 (sem inativado_em: vale a anonimização).
        banco.update("update aluno set criado_em=?, ativo=false, anonimizado_em=? where id=?",
                quando(atual.minusMonths(4), 2, 12, 0), quando(atual.minusMonths(1), 1, 12, 0), anonimizado);

        UUID versao = versaoDoQuestionario(consultoria);
        // M-3: no prazo (enviada antes), atrasada (enviada depois), no prazo com aviso de atraso às 23:30 de Brasília (já é
        // dia seguinte em UTC) e atrasada com aviso, enviada 00:30 do dia seguinte ao prazo.
        YearMonth m3 = atual.minusMonths(3);
        atualizacao(consultoria, entrouDepois, versao, m3.atDay(10), null, quando(m3, 9, 10, 0));
        atualizacao(consultoria, entrouDepois, versao, m3.atDay(15), null, quando(m3, 17, 12, 0));
        atualizacao(consultoria, entrouDepois, versao, m3.atDay(20), m3.atDay(25), quando(m3, 25, 23, 30));
        atualizacao(consultoria, entrouDepois, versao, m3.atDay(20), m3.atDay(25), quando(m3, 26, 0, 30));
        // Data em M-3, prazo (aviso de atraso) em M-2: conta em M-2, no prazo.
        YearMonth m2 = atual.minusMonths(2);
        atualizacao(consultoria, entrouDepois, versao, m3.atDay(28), m2.atDay(3), quando(m2, 2, 9, 0));
        // M-2: nunca enviada e com prazo (aviso de atraso) já passado: atrasada.
        atualizacao(consultoria, entrouDepois, versao, m2.atDay(5), m2.atDay(8), null);
        // Mês corrente: enviada hoje (no prazo) e aberta com prazo hoje (não entra em nenhum dos dois).
        atualizacao(consultoria, entrouDepois, versao, hoje, null, Timestamp.from(java.time.Instant.now()));
        atualizacao(consultoria, agora, versao, hoje, null, null);

        JsonNode corpo = numeros(admin);
        assertThat(corpo.path("meses")).hasSize(6);
        for (int i = 0; i < 6; i++) {
            YearMonth esperado = atual.minusMonths(5L - i);
            assertThat(mes(corpo, i).path("mes").asString()).isEqualTo(esperado.toString());
            assertThat(mes(corpo, i).path("parcial").asBoolean()).isEqualTo(i == 5);
        }

        // M-5: a consultoria ainda não existia.
        assertThat(mes(corpo, 0).has("alunosAtivos")).isTrue();
        assertThat(mes(corpo, 0).path("alunosAtivos").isNull()).isTrue();
        assertThat(mes(corpo, 0).path("atualizacoesNoPrazo").isNull()).isTrue();
        assertThat(mes(corpo, 0).path("atualizacoesAtrasadas").isNull()).isTrue();
        // M-4: inativado + anonimizado ainda ativos; sem atualização = null (não zero).
        assertThat(mes(corpo, 1).path("alunosAtivos").asLong()).isEqualTo(2);
        assertThat(mes(corpo, 1).has("atualizacoesNoPrazo")).isTrue();
        assertThat(mes(corpo, 1).path("atualizacoesNoPrazo").isNull()).isTrue();
        assertThat(mes(corpo, 1).path("atualizacoesAtrasadas").isNull()).isTrue();
        // M-3: os três.
        assertThat(mes(corpo, 2).path("alunosAtivos").asLong()).isEqualTo(3);
        assertThat(mes(corpo, 2).path("atualizacoesNoPrazo").asLong()).isEqualTo(2);
        assertThat(mes(corpo, 2).path("atualizacoesAtrasadas").asLong()).isEqualTo(2);
        // M-2: o inativado saiu no dia 10; uma enviada no prazo (data em M-3, prazo em M-2) e uma nunca enviada, já vencida.
        assertThat(mes(corpo, 3).path("alunosAtivos").asLong()).isEqualTo(2);
        assertThat(mes(corpo, 3).path("atualizacoesNoPrazo").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 3).path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
        // M-1: o anonimizado saiu; sem atualização.
        assertThat(mes(corpo, 4).path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 4).path("atualizacoesNoPrazo").isNull()).isTrue();
        // Mês corrente ("até hoje"): quem entrou depois + o criado agora (o inativado e o anonimizado não contam).
        assertThat(mes(corpo, 5).path("alunosAtivos").asLong()).isEqualTo(2);
        assertThat(mes(corpo, 5).path("atualizacoesNoPrazo").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 5).path("atualizacoesAtrasadas").asLong()).isZero();
        assertThat(mes(corpo, 5).path("atualizacoesAtrasadas").isNull()).isFalse();
        // Nada de nome nem id de pessoa no relatório.
        assertThat(corpo.toString()).doesNotContain("Aluno").doesNotContain(agora.toString());
    }

    @Test
    void outraConsultoriaNaoEntraNaContagem() throws Exception {
        UUID meu = api.criarAluno(admin, "Aluno da consultoria A");
        UUID consultoria = consultoriaDe(meu);
        banco.update("update consultoria set criado_em=? where id=?", quando(atual.minusMonths(5), 1, 12, 0), consultoria);
        banco.update("update aluno set criado_em=? where id=?", quando(atual.minusMonths(5), 2, 12, 0), meu);
        atualizacao(consultoria, meu, versaoDoQuestionario(consultoria), atual.minusMonths(1).atDay(5), null,
                quando(atual.minusMonths(1), 4, 12, 0));

        JsonNode outro = api.novoTreinador();
        api.criarAluno(outro, "Aluno da consultoria B");
        JsonNode deB = numeros(outro);
        for (int i = 0; i < 5; i++) {
            assertThat(mes(deB, i).path("alunosAtivos").isNull()).as("B antes de existir, mês %s", i).isTrue();
            assertThat(mes(deB, i).path("atualizacoesNoPrazo").isNull()).isTrue();
            assertThat(mes(deB, i).path("atualizacoesAtrasadas").isNull()).isTrue();
        }
        assertThat(mes(deB, 5).path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(mes(deB, 5).path("atualizacoesNoPrazo").isNull()).isTrue();

        JsonNode deA = numeros(admin);
        assertThat(mes(deA, 0).path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(mes(deA, 4).path("atualizacoesNoPrazo").asLong()).isEqualTo(1);
        assertThat(mes(deA, 4).path("atualizacoesAtrasadas").asLong()).isZero();
        assertThat(mes(deA, 5).path("alunosAtivos").asLong()).isEqualTo(1);
    }

    @Test
    void semAsPermissoesDoPainelNegaEFechaOQueOPainelFecha() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno para o relatório");
        UUID consultoria = consultoriaDe(aluno);
        atualizacao(consultoria, aluno, versaoDoQuestionario(consultoria), hoje, null, Timestamp.from(java.time.Instant.now()));

        JsonNode semPainel = membroComPermissoes(Set.of("ALUNO_LER"));
        api.get("/numeros", semPainel, 403);

        // Só PAINEL_VER: vê os alunos ativos, mas as atualizações seguem fechadas (como no painel): null, não zero.
        JsonNode soPainel = membroComPermissoes(Set.of("PAINEL_VER"));
        JsonNode corpo = numeros(soPainel);
        assertThat(mes(corpo, 5).path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 5).has("atualizacoesNoPrazo")).isTrue();
        assertThat(mes(corpo, 5).path("atualizacoesNoPrazo").isNull()).isTrue();
        assertThat(mes(corpo, 5).path("atualizacoesAtrasadas").isNull()).isTrue();

        JsonNode completo = membroComPermissoes(Set.of("PAINEL_VER", "ALUNO_LER", "ATUALIZACAO_LER", "ALUNO_SENSIVEL_LER"));
        assertThat(mes(numeros(completo), 5).path("atualizacoesNoPrazo").asLong()).isEqualTo(1);
    }

    @Test
    void semLoginResponde401() throws Exception {
        api.get("/numeros", null, 401);
    }
}
