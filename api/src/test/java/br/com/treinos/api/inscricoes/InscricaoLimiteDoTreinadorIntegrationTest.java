package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste.Membro;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.LimiteDoTreinadorDeTeste.exigirRecusa;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Aceite de inscrição com o responsável da inscrição no limite (D3, D7): 409 {@code LIMITE_DO_TREINADOR}, e como o aceite
 * é uma transação só, nada fica pela metade (nem aluno, nem aceite, nem auditoria). Só dados fictícios.
 */
@AutoConfigureMockMvc
class InscricaoLimiteDoTreinadorIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private Membro membro;
    private UUID consultoria;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        membro = lim.membro();
        consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.path("usuario").path("id").asString());
    }

    private long auditorias(String acao) {
        return banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Long.class,
                consultoria, acao);
    }

    @Test
    void aceiteComOResponsavelDaInscricaoNoLimiteRecusaENaoDeixaNada() throws Exception {
        lim.limite(membro, 1);
        UUID doMembro = lim.aluno(membro);
        String email = ApiDeTeste.emailUnico("aceite-limite");
        String[] insc = lim.inscricaoNova(email, membro);
        long alunosAntes = banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria);
        String nomeDaPessoa = api.get("/inscricoes/" + insc[0], admin, 200).path("nome").asString();

        JsonNode erro = api.post("/inscricoes/" + insc[0] + "/aceitar", admin,
                Map.of("convidar", false, "versao", Long.parseLong(insc[1])), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), nomeDaPessoa, email, insc[0]);

        assertThat(api.get("/inscricoes/" + insc[0], admin, 200).path("situacao").asString()).isEqualTo("NOVA");
        assertThat(banco.queryForObject("select count(*) from aluno where consultoria_id = ?", Long.class, consultoria))
                .isEqualTo(alunosAntes);
        assertThat(banco.queryForObject("select count(*) from aluno where consultoria_id = ? and lower(email) = ?",
                Long.class, consultoria, email)).isZero();
        assertThat(auditorias("INSCRICAO_ACEITA")).isZero();
        assertThat(auditorias("ALUNO_CRIADO")).isEqualTo(1); // só o do arranjo (o aluno de antes)
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        // Com vaga (o aluno de antes sai), o mesmo pedido passa e o aluno novo é do membro.
        lim.inativar(doMembro);
        JsonNode aceite = api.post("/inscricoes/" + insc[0] + "/aceitar", admin,
                Map.of("convidar", false, "versao", Long.parseLong(insc[1])), 200);
        assertThat(lim.responsavelDe(UUID.fromString(aceite.path("alunoId").asString()))).isEqualTo(membro.id());
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    @Test
    void aceiteComOResponsavelDaInscricaoComVagaOuSemLimitePassa() throws Exception {
        lim.limite(membro, 2);
        lim.aluno(membro);
        String[] insc = lim.inscricaoNova(ApiDeTeste.emailUnico("aceite-vaga"), membro);
        api.post("/inscricoes/" + insc[0] + "/aceitar", admin, Map.of("convidar", false, "versao", Long.parseLong(insc[1])), 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(2);

        // Lotou: a próxima, para o mesmo membro, já não cabe.
        String[] cheia = lim.inscricaoNova(ApiDeTeste.emailUnico("aceite-cheio"), membro);
        exigirRecusa(api.post("/inscricoes/" + cheia[0] + "/aceitar", admin,
                Map.of("convidar", false, "versao", Long.parseLong(cheia[1])), 409), membro.nome(), membro.id());

        // Sem limite (null): aceita à vontade.
        lim.limite(membro, null);
        String[] outra = lim.inscricaoNova(ApiDeTeste.emailUnico("aceite-livre"), membro);
        api.post("/inscricoes/" + outra[0] + "/aceitar", admin, Map.of("convidar", false, "versao", Long.parseLong(outra[1])), 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(3);
    }

    /** O limite 0 também vale no aceite: o membro que está saindo não recebe aluno de inscrição. */
    @Test
    void aceiteComLimiteZeroRecusa() throws Exception {
        lim.limite(membro, 0);
        String[] insc = lim.inscricaoNova(ApiDeTeste.emailUnico("aceite-zero"), membro);
        exigirRecusa(api.post("/inscricoes/" + insc[0] + "/aceitar", admin,
                Map.of("convidar", false, "versao", Long.parseLong(insc[1])), 409), membro.nome(), membro.id());
        assertThat(api.get("/inscricoes/" + insc[0], admin, 200).path("situacao").asString()).isEqualTo("NOVA");
    }
}
