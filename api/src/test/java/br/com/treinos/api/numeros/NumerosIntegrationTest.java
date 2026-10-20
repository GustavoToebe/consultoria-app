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
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
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
    private UUID atualizacao(UUID consultoria, UUID aluno, UUID versao, LocalDate data, LocalDate atrasoAte, Timestamp enviadaEm) {
        UUID pasta = UUID.randomUUID();
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício',?,?)",
                pasta, consultoria, aluno, data.minusDays(27), data);
        banco.update("insert into atualizacao(id,consultoria_id,aluno_id,pasta_id,data_atualizacao,estado,respostas,enviada_em,"
                        + "atraso_ate,questionario_versao_id) values (?,?,?,?,?,?,'{}'::jsonb,?,?,?)",
                UUID.randomUUID(), consultoria, aluno, pasta, data, enviadaEm == null ? "ABERTA" : "ENVIADA", enviadaEm,
                atrasoAte, enviadaEm == null ? null : versao);
        return pasta;
    }

    /** Aluno e consultoria já existentes há cinco meses, para os prazos passados caberem na vida do aluno. */
    private UUID alunoAntigo(JsonNode treinador, String nome) throws Exception {
        UUID aluno = api.criarAluno(treinador, nome);
        banco.update("update consultoria set criado_em=? where id=?", quando(atual.minusMonths(5), 1, 12, 0), consultoriaDe(aluno));
        banco.update("update aluno set criado_em=? where id=?", quando(atual.minusMonths(5), 2, 12, 0), aluno);
        return aluno;
    }

    /** Plano publicado (treino ou dieta) ligado à pasta; é o que faz o painel tratar a pasta como "com atualização". */
    private void planoPublicado(UUID consultoria, UUID aluno, UUID pasta, String tabela) {
        banco.update("insert into " + tabela + "(id,consultoria_id,aluno_id,titulo,fim,rascunho,versao_publicada,publicado_em,pasta_id) "
                + "values (?,?,?,'Plano fictício',(select fim from pasta_plano where id=?),'{}'::jsonb,1,now(),?)",
                UUID.randomUUID(), consultoria, aluno, pasta, pasta);
    }

    /** Pasta com {@code fim} e plano publicado, sem linha de atualização (ninguém enviou nem avisou atraso). */
    private UUID pastaSemLinha(UUID consultoria, UUID aluno, LocalDate fim, String tabelaDoPlano) {
        UUID pasta = UUID.randomUUID();
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício',?,?)",
                pasta, consultoria, aluno, fim.minusDays(27), fim);
        if (tabelaDoPlano != null) {
            planoPublicado(consultoria, aluno, pasta, tabelaDoPlano);
        }
        return pasta;
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
    void pastaVencidaSemLinhaContaComoAtrasadaSemContarDuasVezes() throws Exception {
        UUID aluno = alunoAntigo(admin, "Aluno com pastas vencidas");
        UUID consultoria = consultoriaDe(aluno);
        UUID versao = versaoDoQuestionario(consultoria);
        YearMonth m2 = atual.minusMonths(2);
        YearMonth m1 = atual.minusMonths(1);
        // M-2: uma pasta com treino publicado e outra só com dieta publicada, nenhuma com linha: duas atrasadas.
        pastaSemLinha(consultoria, aluno, m2.atDay(10), "plano_treino");
        pastaSemLinha(consultoria, aluno, m2.atDay(12), "plano_dieta");
        // M-2: pasta com envio no prazo e plano publicado: no prazo, e a pasta não conta de novo como sem linha.
        UUID comEnvio = atualizacao(consultoria, aluno, versao, m2.atDay(20), null, quando(m2, 19, 12, 0));
        planoPublicado(consultoria, aluno, comEnvio, "plano_treino");
        // M-1: pasta com linha aberta e vencida (aviso de atraso) e plano publicado: atrasada uma vez só.
        UUID comAviso = atualizacao(consultoria, aluno, versao, m1.atDay(3), m1.atDay(6), null);
        planoPublicado(consultoria, aluno, comAviso, "plano_treino");
        // M-1: pasta sem plano publicado não é "atualização" do painel: não conta.
        pastaSemLinha(consultoria, aluno, m1.atDay(8), null);

        JsonNode corpo = numeros(admin);
        assertThat(mes(corpo, 3).path("atualizacoesAtrasadas").asLong()).isEqualTo(2);
        assertThat(mes(corpo, 3).path("atualizacoesNoPrazo").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 4).path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 4).path("atualizacoesNoPrazo").asLong()).isZero();
        // Mês sem pasta nenhuma continua sem dado.
        assertThat(mes(corpo, 2).path("atualizacoesAtrasadas").isNull()).isTrue();
        assertThat(mes(corpo, 2).path("atualizacoesNoPrazo").isNull()).isTrue();
    }

    @Test
    void pastaVencidaComEnvioNoPrazoNaoContaComoAtrasada() throws Exception {
        UUID aluno = alunoAntigo(admin, "Aluno que enviou no prazo");
        UUID consultoria = consultoriaDe(aluno);
        YearMonth m1 = atual.minusMonths(1);
        UUID pasta = atualizacao(consultoria, aluno, versaoDoQuestionario(consultoria), m1.atDay(10), null, quando(m1, 9, 12, 0));
        planoPublicado(consultoria, aluno, pasta, "plano_treino");

        JsonNode corpo = numeros(admin);
        assertThat(mes(corpo, 4).path("atualizacoesNoPrazo").asLong()).isEqualTo(1);
        assertThat(mes(corpo, 4).path("atualizacoesAtrasadas").asLong()).isZero();
    }

    @Test
    void pastaArquivadaOuPrazoDeHojeEmDianteNaoContaComoAtrasada() throws Exception {
        UUID aluno = alunoAntigo(admin, "Aluno com pastas que não contam");
        UUID consultoria = consultoriaDe(aluno);
        YearMonth m1 = atual.minusMonths(1);
        UUID arquivada = pastaSemLinha(consultoria, aluno, m1.atDay(10), "plano_treino");
        banco.update("update pasta_plano set arquivado=true where id=?", arquivada);
        // Plano arquivado numa pasta não arquivada: o painel também não a trata como pasta com atualização.
        UUID planoArquivado = pastaSemLinha(consultoria, aluno, m1.atDay(11), "plano_treino");
        banco.update("update plano_treino set arquivado=true where pasta_id=?", planoArquivado);
        // Prazo de hoje e do futuro: ainda não venceu.
        pastaSemLinha(consultoria, aluno, hoje, "plano_treino");
        pastaSemLinha(consultoria, aluno, hoje.plusDays(10), "plano_dieta");

        JsonNode corpo = numeros(admin);
        for (int i = 0; i < 6; i++) {
            assertThat(mes(corpo, i).path("atualizacoesAtrasadas").isNull()).as("mês %s", i).isTrue();
            assertThat(mes(corpo, i).path("atualizacoesNoPrazo").isNull()).as("mês %s", i).isTrue();
        }
    }

    @Test
    void pastaVencidaDeOntemContaNoMesDoPrazo() throws Exception {
        UUID aluno = alunoAntigo(admin, "Aluno com pasta vencida ontem");
        UUID consultoria = consultoriaDe(aluno);
        LocalDate ontem = hoje.minusDays(1);
        pastaSemLinha(consultoria, aluno, ontem, "plano_treino");

        JsonNode corpo = numeros(admin);
        int indice = YearMonth.from(ontem).equals(atual) ? 5 : 4;
        assertThat(mes(corpo, indice).path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
        assertThat(mes(corpo, indice).path("atualizacoesNoPrazo").asLong()).isZero();
    }

    @Test
    void alunoInativadoOuAnonimizadoAntesDoPrazoNaoTemPastaAtrasada() throws Exception {
        UUID inativado = alunoAntigo(admin, "Aluno inativado antes do prazo");
        UUID anonimizado = api.criarAluno(admin, "Aluno anonimizado antes do prazo");
        UUID inativadoDepois = api.criarAluno(admin, "Aluno inativado depois do prazo");
        UUID consultoria = consultoriaDe(inativado);
        YearMonth m2 = atual.minusMonths(2);
        banco.update("update aluno set criado_em=? where id in (?,?)", quando(atual.minusMonths(5), 2, 12, 0), anonimizado,
                inativadoDepois);
        banco.update("update aluno set ativo=false, inativado_em=? where id=?", quando(m2, 5, 12, 0), inativado);
        banco.update("update aluno set ativo=false, inativado_em=?, anonimizado_em=? where id=?", quando(m2, 6, 12, 0),
                quando(m2, 6, 12, 0), anonimizado);
        banco.update("update aluno set ativo=false, inativado_em=? where id=?", quando(m2, 20, 12, 0), inativadoDepois);
        pastaSemLinha(consultoria, inativado, m2.atDay(10), "plano_treino");
        pastaSemLinha(consultoria, anonimizado, m2.atDay(10), "plano_treino");
        // Inativado só depois do prazo: no prazo estava ativo, então a pasta vencida conta naquele mês.
        pastaSemLinha(consultoria, inativadoDepois, m2.atDay(10), "plano_treino");

        JsonNode corpo = numeros(admin);
        assertThat(mes(corpo, 3).path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
    }

    @Test
    void pastaVencidaDeAlunoCriadoDepoisDoPrazoNaoConta() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno que chegou depois");
        UUID consultoria = consultoriaDe(aluno);
        banco.update("update consultoria set criado_em=? where id=?", quando(atual.minusMonths(5), 1, 12, 0), consultoria);
        YearMonth m2 = atual.minusMonths(2);
        banco.update("update aluno set criado_em=? where id=?", quando(m2, 20, 12, 0), aluno);
        pastaSemLinha(consultoria, aluno, m2.atDay(10), "plano_treino");

        JsonNode corpo = numeros(admin);
        assertThat(mes(corpo, 3).path("atualizacoesAtrasadas").isNull()).isTrue();
    }

    @Test
    void pastaVencidaDeOutraConsultoriaNaoEntraNaContagem() throws Exception {
        UUID meu = alunoAntigo(admin, "Aluno da consultoria A");
        pastaSemLinha(consultoriaDe(meu), meu, atual.minusMonths(1).atDay(10), "plano_treino");

        JsonNode outro = api.novoTreinador();
        alunoAntigo(outro, "Aluno da consultoria B");
        JsonNode deB = numeros(outro);
        for (int i = 0; i < 6; i++) {
            assertThat(mes(deB, i).path("atualizacoesAtrasadas").isNull()).as("B, mês %s", i).isTrue();
        }
        assertThat(mes(numeros(admin), 4).path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
    }

    @Test
    void semAsPermissoesDoPainelNegaEFechaOQueOPainelFecha() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno para o relatório");
        UUID consultoria = consultoriaDe(aluno);
        atualizacao(consultoria, aluno, versaoDoQuestionario(consultoria), hoje, null, Timestamp.from(java.time.Instant.now()));
        // Pasta vencida sem linha no mês passado: também fica fechada sem as permissões do painel.
        banco.update("update consultoria set criado_em=? where id=?", quando(atual.minusMonths(5), 1, 12, 0), consultoria);
        banco.update("update aluno set criado_em=? where id=?", quando(atual.minusMonths(5), 2, 12, 0), aluno);
        pastaSemLinha(consultoria, aluno, atual.minusMonths(1).atDay(10), "plano_treino");

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
        assertThat(mes(numeros(completo), 4).path("atualizacoesAtrasadas").asLong()).isEqualTo(1);
        assertThat(mes(numeros(soPainel), 4).path("atualizacoesAtrasadas").isNull()).isTrue();
    }

    @Test
    void semLoginResponde401() throws Exception {
        api.get("/numeros", null, 401);
    }
}
