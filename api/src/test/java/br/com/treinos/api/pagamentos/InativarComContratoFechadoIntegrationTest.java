package br.com.treinos.api.pagamentos;

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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.pagamentos.ContratoDeTeste.HOJE;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.corpo;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.parcela;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Inativar pelo treinador (rota e lote) recusa o aluno com contrato fechado vigente (contratação ATIVA e fechada): 409
 * {@code CONTRATO_FECHADO_VIGENTE} na rota, {@code recusados} no lote, e nada muda. Encerrar o contrato libera. Anonimizar e excluir a
 * conta (LGPD) não são bloqueados, e o resumo da saída avisa. Só dados fictícios.
 */
@AutoConfigureMockMvc
class InativarComContratoFechadoIntegrationTest extends AbstractIntegrationTest {

    private static final String MENSAGEM = "Encerre o contrato antes de inativar (com ou sem multa).";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private ContratoDeTeste contrato;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        contrato = new ContratoDeTeste(api, admin);
    }

    /** Aluno novo com um contrato parcelado: uma parcela a vencer hoje e outra daqui a 30 dias. */
    private UUID comContrato(ContratoDeTeste dono) throws Exception {
        UUID aluno = dono.aluno();
        dono.contratar(aluno, corpo(dono.plano("TRIMESTRAL"), "PARCELADO_FIXO", 40_000L, null,
                List.of(parcela(HOJE, 20_000), parcela(HOJE.plusDays(30), 20_000))), 200);
        return aluno;
    }

    private JsonNode situacao(UUID aluno, boolean ativo, int esperado) throws Exception {
        return api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", ativo), esperado);
    }

    private boolean ativo(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno, admin, 200).get("ativo").asBoolean();
    }

    private String situacaoDaContratacao(UUID aluno) throws Exception {
        return contrato.contratacao(aluno).get("situacao").asString();
    }

    private void encerrar(UUID aluno) throws Exception {
        JsonNode c = contrato.contratacao(aluno);
        List<String> aCancelar = new ArrayList<>();
        api.get("/contratacoes/" + c.get("id").asString() + "/previa-de-encerramento", admin, 200)
                .get("cobrancasACancelar").forEach(id -> aCancelar.add(id.asString()));
        Map<String, Object> saida = new LinkedHashMap<>();
        saida.put("opcao", "NAO_COBRAR");
        saida.put("cobrancasACancelar", aCancelar);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("versao", c.get("versao").asLong());
        corpo.put("saida", saida);
        api.post("/contratacoes/" + c.get("id").asString() + "/encerrar", admin, corpo, 200);
    }

    @Test
    void inativarComContratoFechadoVigenteDa409ENadaMudaDepoisDeEncerrarPassa() throws Exception {
        UUID aluno = comContrato(contrato);

        JsonNode erro = situacao(aluno, false, 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_FECHADO_VIGENTE");
        assertThat(erro.get("message").asString()).isEqualTo(MENSAGEM);
        assertThat(ativo(aluno)).isTrue();
        assertThat(situacaoDaContratacao(aluno)).isEqualTo("ATIVA");
        assertThat(contrato.doTipo(aluno, "RENEGOCIACAO")).allMatch(c -> "ABERTA".equals(c.get("situacao").asString()));
        assertThat(jdbc.queryForObject("select count(*) from auditoria where entidade_id = ?::uuid and acao = 'ALUNO_SITUACAO'",
                Integer.class, aluno.toString())).as("recusa não audita").isZero();

        // PATCH ativo em quem já está ativo não muda nada, e a recusa se repete.
        situacao(aluno, true, 200);
        situacao(aluno, false, 409);

        encerrar(aluno);
        assertThat(situacaoDaContratacao(aluno)).isEqualTo("ENCERRADA");
        situacao(aluno, false, 200);
        assertThat(ativo(aluno)).isFalse();
        // Inativo é idempotente.
        situacao(aluno, false, 200);
        // Reativar não muda.
        situacao(aluno, true, 200);
        assertThat(ativo(aluno)).isTrue();
    }

    @Test
    void inativarSemContratoFechadoSegueComoSempre() throws Exception {
        UUID aluno = contrato.aluno();
        situacao(aluno, false, 200);
        assertThat(ativo(aluno)).isFalse();
    }

    @Test
    void oLoteRecusaSoQuemTemContratoFechadoVigenteEInativaOsDemais() throws Exception {
        UUID comContrato = comContrato(contrato);
        UUID semContrato = contrato.aluno();

        JsonNode r = api.post("/alunos/lote/desativar", admin,
                Map.of("alunoIds", List.of(comContrato.toString(), semContrato.toString())), 200);

        assertThat(r.get("selecionados").asInt()).isEqualTo(2);
        assertThat(r.get("alterados").asInt()).isEqualTo(1);
        assertThat(r.get("recusados")).hasSize(1);
        assertThat(r.get("recusados").get(0).get("alunoId").asString()).isEqualTo(comContrato.toString());
        assertThat(r.get("recusados").get(0).get("codigo").asString()).isEqualTo("CONTRATO_FECHADO_VIGENTE");
        assertThat(r.get("recusados").get(0).get("mensagem").asString()).isEqualTo(MENSAGEM);
        assertThat(ativo(comContrato)).isTrue();
        assertThat(ativo(semContrato)).isFalse();
        assertThat(situacaoDaContratacao(comContrato)).isEqualTo("ATIVA");
        assertThat(jdbc.queryForObject("select count(*) from auditoria where entidade_id = ?::uuid and acao = 'ALUNO_SITUACAO'",
                Integer.class, comContrato.toString())).isZero();

        // Encerrado o contrato, o mesmo lote inativa e não recusa ninguém.
        encerrar(comContrato);
        JsonNode depois = api.post("/alunos/lote/desativar", admin,
                Map.of("alunoIds", List.of(comContrato.toString(), semContrato.toString())), 200);
        assertThat(depois.get("alterados").asInt()).isEqualTo(1);
        assertThat(depois.get("recusados")).isEmpty();
        assertThat(ativo(comContrato)).isFalse();
    }

    @Test
    void asOutrasAcoesEmLoteDevolvemRecusadosVazio() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode r = api.post("/alunos/lote/questionario", admin, Map.of("alunoIds", List.of(aluno.toString())), 200);
        assertThat(r.get("recusados")).isEmpty();
    }

    @Test
    void anonimizarEExcluirAContaNaoSaoBloqueadosPeloContratoFechado() throws Exception {
        // Excluir a conta (LGPD): o aluno ativo com contrato vigente sai e a contratação é encerrada.
        UUID quemSai = comContrato(contrato);
        JsonNode loginDoAluno = api.convidarEEntrar(admin, quemSai);
        api.post("/aluno/conta/excluir", loginDoAluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(jdbc.queryForObject("select situacao from contratacao_aluno where aluno_id = ?::uuid", String.class,
                quemSai.toString())).isEqualTo("ENCERRADA");

        // Anonimizar pelo treinador pede aluno inativo (a importação pode ter deixado o contrato vigente).
        UUID inativo = comContrato(contrato);
        jdbc.update("update aluno set ativo = false, inativado_em = now() where id = ?::uuid", inativo.toString());
        api.post("/alunos/" + inativo + "/anonimizar", admin,
                Map.of("nomeConfirmado", api.get("/alunos/" + inativo, admin, 200).get("nome").asString()), 200);
        assertThat(api.get("/alunos/" + inativo, admin, 200).get("anonimizado").asBoolean()).isTrue();
    }

    @Test
    void oResumoDaSaidaTrazOContratoFechadoVigenteENuloSemEle() throws Exception {
        UUID semContrato = contrato.aluno();
        assertThat(api.get("/alunos/" + semContrato + "/resumo-da-saida", admin, 200).get("contratoFechadoVigente").isNull()).isTrue();

        UUID aluno = comContrato(contrato);
        String contratacaoId = contrato.contratacao(aluno).get("id").asString();
        JsonNode resumo = api.get("/alunos/" + aluno + "/resumo-da-saida", admin, 200);
        assertThat(resumo.get("contratoFechadoVigente").get("contratacaoId").asString()).isEqualTo(contratacaoId);
        // Os campos de sempre seguem lá.
        assertThat(resumo.has("aCancelar")).isTrue();
        assertThat(resumo.has("mesesQueFaltam")).isTrue();

        encerrar(aluno);
        assertThat(api.get("/alunos/" + aluno + "/resumo-da-saida", admin, 200).get("contratoFechadoVigente").isNull()).isTrue();
    }

    @Test
    void outraConsultoriaNaoEnxergaNemInativaNemLotaNemResume() throws Exception {
        UUID aluno = comContrato(contrato);
        JsonNode outro = api.novoTreinador();

        api.patch("/alunos/" + aluno + "/situacao", outro, Map.of("ativo", false), 404);
        api.post("/alunos/lote/desativar", outro, Map.of("alunoIds", List.of(aluno.toString())), 404);
        api.get("/alunos/" + aluno + "/resumo-da-saida", outro, 404);
        assertThat(ativo(aluno)).isTrue();
    }
}
