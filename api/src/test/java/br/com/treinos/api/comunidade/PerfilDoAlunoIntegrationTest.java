package br.com.treinos.api.comunidade;

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
 * V070: {@code GET}/{@code PUT /aluno/comunidade/perfil}. Aluno novo nasce com a escolha nula (regra da idade), destaque só de
 * conquista já ganha (até 4, sem repetir), cor e moldura da lista fechada, auditoria só quando muda e com resumo fixo, e o
 * aluno nunca mexe no perfil de outro. Só dados fictícios.
 */
@AutoConfigureMockMvc
class PerfilDoAlunoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private JsonNode login;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Ana Fictícia Perfil");
        login = api.convidarEEntrar(admin, aluno);
    }

    private JsonNode perfil() throws Exception {
        return api.get("/aluno/comunidade/perfil", login, 200);
    }

    private Map<String, Object> pedido(Boolean reservado, List<String> destaques, String cor, String moldura) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("perfilReservado", reservado);
        m.put("destaques", destaques);
        m.put("cor", cor);
        m.put("moldura", moldura);
        return m;
    }

    private int auditorias() {
        return jdbc.queryForObject("select count(*) from auditoria where acao = 'ALUNO_PERFIL_COMUNIDADE_ALTERADO' and entidade_id = ?",
                Integer.class, aluno);
    }

    /** Conclui um treino: dá a conquista PRIMEIRO_TREINO. */
    private void ganharPrimeiroTreino() throws Exception {
        var treino = ApiDeTeste.treino();
        api.publicarTreino(admin, aluno, treino.conteudo());
        String versao = api.get("/aluno/painel", login, 200).get("treino").get("versaoId").asString();
        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", UUID.randomUUID().toString());
        sessao.put("planoVersaoId", versao);
        sessao.put("sessaoUid", treino.sessaoUid().toString());
        sessao.put("data", LocalDate.now(Fuso.BRASILIA).toString());
        sessao.put("concluida", true);
        sessao.put("resultado", "COMPLETA");
        sessao.put("duracaoSegundos", 3000);
        sessao.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/sessoes-concluidas", login, Map.of("registros", List.of(sessao)), 200);
    }

    @Test
    void alunoNovoNasceSemEscolhaEReservadoPelaRegraDaIdade() throws Exception {
        JsonNode p = perfil();
        assertThat(p.get("perfilReservado").isNull()).isTrue();
        assertThat(p.get("reservadoEfetivo").asBoolean()).isTrue();
        assertThat(p.get("cor").asString()).isEqualTo("AZUL");
        assertThat(p.get("moldura").asString()).isEqualTo("SIMPLES");
        assertThat(p.get("destaques")).isEmpty();
        assertThat(p.get("opcoesDeDestaque")).isEmpty();
        assertThat(jdbc.queryForObject("select perfil_reservado is null from aluno where id = ?", Boolean.class, aluno)).isTrue();

        // Adulto sem escolha fica visível; a escolha explícita vale mais que a idade.
        jdbc.update("update aluno set data_nascimento = date '1990-05-20' where id = ?", aluno);
        assertThat(perfil().get("reservadoEfetivo").asBoolean()).isFalse();
        assertThat(api.put("/aluno/comunidade/perfil", login, pedido(true, null, null, null), 200).get("reservadoEfetivo").asBoolean())
                .isTrue();
        // Voltar ao nulo devolve a regra da idade.
        JsonNode volta = api.put("/aluno/comunidade/perfil", login, pedido(null, null, null, null), 200);
        assertThat(volta.get("perfilReservado").isNull()).isTrue();
        assertThat(volta.get("reservadoEfetivo").asBoolean()).isFalse();
    }

    @Test
    void perfilReservadoEObrigatorioNoPutMasNuloExplicitoValeEVoltaARegraDaIdade() throws Exception {
        api.put("/aluno/comunidade/perfil", login, pedido(true, null, "ROXO", null), 200);
        // Sem o campo: 422 no campo, nada muda (o aluno que reservou não volta à regra da idade sem querer).
        Map<String, Object> semCampo = pedido(true, null, "ROXO", null);
        semCampo.remove("perfilReservado");
        JsonNode erro = api.put("/aluno/comunidade/perfil", login, semCampo, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PERFIL_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("perfilReservado");
        assertThat(perfil().get("perfilReservado").asBoolean()).isTrue();
        // Outro tipo de valor também é recusado, sem repetir o que veio.
        Map<String, Object> texto = pedido(true, null, "ROXO", null);
        texto.put("perfilReservado", "talvez-xyz");
        JsonNode ruim = api.put("/aluno/comunidade/perfil", login, texto, 422);
        assertThat(ruim.get("fieldErrors").get(0).get("field").asString()).isEqualTo("perfilReservado");
        assertThat(ruim.toString()).doesNotContain("talvez-xyz");
        // Nulo explícito é a escolha "voltar à regra da idade".
        assertThat(api.put("/aluno/comunidade/perfil", login, pedido(null, null, "ROXO", null), 200).get("perfilReservado").isNull()).isTrue();
    }

    @Test
    void destaqueSoDeConquistaGanhaAteQuatroSemRepetirEComOrdem() throws Exception {
        JsonNode semConquista = api.put("/aluno/comunidade/perfil", login, pedido(false, List.of("PRIMEIRO_TREINO"), null, null), 422);
        assertThat(semConquista.get("codigo").asString()).isEqualTo("PERFIL_INVALIDO");
        assertThat(semConquista.get("fieldErrors").get(0).get("field").asString()).isEqualTo("destaques");

        ganharPrimeiroTreino();
        JsonNode ok = api.put("/aluno/comunidade/perfil", login, pedido(false, List.of("PRIMEIRO_TREINO"), "ROXO", "DUPLA"), 200);
        assertThat(ok.get("destaques")).hasSize(1);
        assertThat(ok.get("cor").asString()).isEqualTo("ROXO");
        assertThat(ok.get("moldura").asString()).isEqualTo("DUPLA");
        assertThat(ok.get("opcoesDeDestaque").get(0).get("tipo").asString()).isEqualTo("PRIMEIRO_TREINO");
        assertThat(perfil().get("destaques").get(0).asString()).isEqualTo("PRIMEIRO_TREINO");

        // Tipo que não existe, repetido e mais de quatro: 422 no campo, sem repetir o valor.
        for (List<String> ruim : List.of(List.of("INVENTADO_XYZ"), List.of("PRIMEIRO_TREINO", "PRIMEIRO_TREINO"),
                List.of("A", "B", "C", "D", "E"))) {
            JsonNode erro = api.put("/aluno/comunidade/perfil", login, pedido(false, ruim, null, null), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("PERFIL_INVALIDO");
            assertThat(erro.toString()).doesNotContain("INVENTADO_XYZ");
        }
        // Lista vazia limpa.
        assertThat(api.put("/aluno/comunidade/perfil", login, pedido(false, List.of(), null, null), 200).get("destaques")).isEmpty();
    }

    @Test
    void corEMolduraForaDaListaDao422SemRepetirOValor() throws Exception {
        JsonNode erro = api.put("/aluno/comunidade/perfil", login, pedido(false, null, "FUCSIA_INVENTADA", "OVAL_INVENTADA"), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PERFIL_INVALIDO");
        assertThat(erro.toString()).doesNotContain("FUCSIA_INVENTADA").doesNotContain("OVAL_INVENTADA");
        assertThat(erro.get("fieldErrors")).hasSize(2);
        // Nada foi gravado.
        assertThat(jdbc.queryForObject("select perfil_cor is null and perfil_moldura is null and perfil_reservado is null from aluno where id = ?",
                Boolean.class, aluno)).isTrue();
        // Em branco volta ao padrão; as quatro cores e molduras da lista passam.
        for (String cor : List.of("AZUL", "VERDE", "ROXO", "LARANJA", "ROSA")) {
            assertThat(api.put("/aluno/comunidade/perfil", login, pedido(false, null, cor, "  "), 200).get("cor").asString()).isEqualTo(cor);
        }
        for (String moldura : List.of("SIMPLES", "DUPLA", "TRACEJADA", "GROSSA")) {
            assertThat(api.put("/aluno/comunidade/perfil", login, pedido(false, null, null, moldura), 200).get("moldura").asString())
                    .isEqualTo(moldura);
        }
    }

    @Test
    void auditaSoQuandoMudaComResumoFixoENaoSobeAVersaoDaFicha() throws Exception {
        long versao = api.get("/alunos/" + aluno, admin, 200).get("versao").asLong();
        api.put("/aluno/comunidade/perfil", login, pedido(true, null, "ROXO", "GROSSA"), 200);
        assertThat(auditorias()).isEqualTo(1);
        api.put("/aluno/comunidade/perfil", login, pedido(true, null, "ROXO", "GROSSA"), 200);
        assertThat(auditorias()).isEqualTo(1);
        api.put("/aluno/comunidade/perfil", login, pedido(false, null, "ROXO", "GROSSA"), 200);
        assertThat(auditorias()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from auditoria a where a.acao = 'ALUNO_PERFIL_COMUNIDADE_ALTERADO'"
                + " and a.entidade_id = ? and (a::text like '%ROXO%' or a::text like '%GROSSA%')", Integer.class, aluno)).isZero();
        // Preferência não é edição do cadastro: o treinador não leva 409 por causa dela.
        assertThat(api.get("/alunos/" + aluno, admin, 200).get("versao").asLong()).isEqualTo(versao);
    }

    @Test
    void soAlunoUsaARotaEAnonimizadoRecebe409() throws Exception {
        api.get("/aluno/comunidade/perfil", admin, 403);
        api.put("/aluno/comunidade/perfil", admin, pedido(true, null, null, null), 403);
        api.get("/aluno/comunidade/perfil", null, 401);

        jdbc.update("update aluno set anonimizado_em = now() where id = ?", aluno);
        assertThat(api.get("/aluno/comunidade/perfil", login, 409).get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(api.put("/aluno/comunidade/perfil", login, pedido(true, null, null, null), 409).get("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
    }
}
