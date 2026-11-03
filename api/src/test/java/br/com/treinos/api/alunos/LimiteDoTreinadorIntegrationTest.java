package br.com.treinos.api.alunos;

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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.LimiteDoTreinadorDeTeste.exigirRecusa;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Limite de alunos por treinador (supervisão da equipe, D3 a D8, D15): cada caminho que dá um aluno ativo a um membro
 * (criar, editar, lote e reativar) barra com 409 {@code LIMITE_DO_TREINADOR}, e o que a D8 e a D15 liberam passa. Aceite de
 * inscrição, importações e a disputa por threads têm classe própria. O limite do plano fica desligado (padrão) para provar
 * que as duas regras são independentes. Só dados fictícios.
 */
@AutoConfigureMockMvc
class LimiteDoTreinadorIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private Membro membro;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        membro = lim.membro();
    }

    private long alunosComONome(String nome) {
        return banco.queryForObject("select count(*) from aluno where nome = ?", Long.class, nome);
    }

    // ---- Criar ----

    @Test
    void criarComOMembroNoLimiteComoResponsavelRecusa() throws Exception {
        lim.limite(membro, 1);
        Map<String, Object> primeiro = Map.of("nome", "Primeiro Fictício " + UUID.randomUUID(), "responsavelId", membro.id());
        api.post("/alunos", admin, primeiro, 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        String nome = "Segundo Fictício " + UUID.randomUUID();
        JsonNode erro = api.post("/alunos", admin, Map.of("nome", nome, "responsavelId", membro.id()), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), membro.email(), nome);
        assertThat(alunosComONome(nome)).isZero();
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    /** O criador é gravado direto como responsável (AlunoService.criar): quando é o membro cheio, também conta. */
    @Test
    void criarPeloProprioMembroNoLimiteRecusaPorqueELeOResponsavel() throws Exception {
        lim.limite(membro, 1);
        api.post("/alunos", membro.login(), Map.of("nome", "Do Membro Fictício " + UUID.randomUUID()), 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        String nome = "Barrado Fictício " + UUID.randomUUID();
        JsonNode erro = api.post("/alunos", membro.login(), Map.of("nome", nome), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), nome);
        assertThat(alunosComONome(nome)).isZero();

        // Quem tem vaga continua criando: o Administrador cria para si mesmo (sem limite).
        api.post("/alunos", admin, Map.of("nome", "Do Admin Fictício " + UUID.randomUUID()), 200);
    }

    @Test
    void criarParaOutroResponsavelComVagaNaoEBarradoPeloLimiteDoCriador() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        // O membro cheio cria um aluno e põe o Administrador (sem limite) como responsável: só quem recebe é conferido (D8).
        api.post("/alunos", membro.login(), Map.of("nome", "Para o Admin Fictício " + UUID.randomUUID(),
                "responsavelId", lim.idDoAdmin()), 200);
        // Já para si mesmo ele não pode: o membro cheio seria o responsável.
        api.post("/alunos", membro.login(), Map.of("nome", "Para Si Fictício " + UUID.randomUUID()), 409);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    // ---- Editar ----

    @Test
    void editarTrocandoParaMembroNoLimiteRecusaEMantemOResponsavel() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        UUID aluno = lim.aluno(null);

        JsonNode erro = lim.editarResponsavel(aluno, membro.id(), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), lim.nomeDe(aluno), aluno.toString());
        assertThat(lim.responsavelDe(aluno)).isEqualTo(lim.idDoAdmin());
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    @Test
    void trocarParaMembroComVagaPassa() throws Exception {
        lim.limite(membro, 2);
        lim.aluno(membro);
        UUID aluno = lim.aluno(null);
        lim.editarResponsavel(aluno, membro.id(), 200);
        assertThat(lim.responsavelDe(aluno)).isEqualTo(membro.id());
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
        // Agora cheio: o próximo é barrado.
        lim.editarResponsavel(lim.aluno(null), membro.id(), 409);
    }

    /** D4 e D15: quem já passou do limite não perde ninguém, e editar mantendo o mesmo responsável nunca é barrado. */
    @Test
    void membroAcimaDoLimiteEditaAlunoMantendoOMesmoResponsavel() throws Exception {
        lim.alunos(membro, 3);
        lim.limite(membro, 1); // baixar o limite abaixo do que ele já tem é aceito (D4)
        UUID dele = UUID.fromString(banco.queryForList("select id::text from aluno where responsavel_id = ?::uuid and ativo = true",
                String.class, membro.id()).getFirst());

        // O mesmo responsável repetido no corpo, e também o corpo sem responsável.
        lim.editarResponsavel(dele, membro.id(), 200);
        JsonNode atual = api.get("/alunos/" + dele, admin, 200);
        Map<String, Object> semResponsavel = new HashMap<>();
        semResponsavel.put("nome", "Renomeado Fictício " + UUID.randomUUID());
        semResponsavel.put("versao", atual.path("versao").asLong());
        api.put("/alunos/" + dele, admin, semResponsavel, 200);

        assertThat(lim.ativosDe(membro)).isEqualTo(3);
        assertThat(lim.responsavelDe(dele)).isEqualTo(membro.id());
        // Já acima do limite, não recebe mais ninguém.
        exigirRecusa(lim.editarResponsavel(lim.aluno(null), membro.id(), 409));
    }

    /** D15: o aluno inativo atribuído a membro cheio passa; reativar depois é que é conferido. */
    @Test
    void alunoInativoAtribuidoAMembroCheioPassaEReativarDepoisRecusa() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        UUID inativo = lim.aluno(null);
        lim.inativar(inativo);

        lim.editarResponsavel(inativo, membro.id(), 200);
        assertThat(lim.responsavelDe(inativo)).isEqualTo(membro.id());
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        JsonNode erro = api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", true), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), lim.nomeDe(inativo), inativo.toString());
        assertThat(lim.ativo(inativo)).isFalse();
    }

    // ---- Lote ----

    @Test
    void loteParaMembroNoLimiteRecusaETudoOuNada() throws Exception {
        lim.limite(membro, 2);
        lim.aluno(membro);
        UUID a = lim.aluno(null);
        UUID b = lim.aluno(null);

        // Vaga para um só e dois selecionados: nenhum dos dois muda (tudo ou nada).
        JsonNode erro = api.post("/alunos/lote/responsavel", admin,
                Map.of("alunoIds", List.of(a, b), "responsavelId", membro.id()), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), lim.nomeDe(a), lim.nomeDe(b), a.toString(), b.toString());
        assertThat(lim.responsavelDe(a)).isEqualTo(lim.idDoAdmin());
        assertThat(lim.responsavelDe(b)).isEqualTo(lim.idDoAdmin());
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        // Um só cabe.
        JsonNode ok = api.post("/alunos/lote/responsavel", admin, Map.of("alunoIds", List.of(a), "responsavelId", membro.id()), 200);
        assertThat(ok.path("alterados").asInt()).isEqualTo(1);
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
    }

    /** D15: três selecionados, dois já dele, vaga para um: só o que chega de novo conta. */
    @Test
    void loteComSelecionadosQueJaSaoDoMembroConfereSoOsNovos() throws Exception {
        lim.limite(membro, 3);
        UUID jaDele1 = lim.aluno(membro);
        UUID jaDele2 = lim.aluno(membro);
        UUID novo = lim.aluno(null);

        JsonNode r = api.post("/alunos/lote/responsavel", admin,
                Map.of("alunoIds", List.of(jaDele1, jaDele2, novo), "responsavelId", membro.id()), 200);
        assertThat(r.path("selecionados").asInt()).isEqualTo(3);
        assertThat(r.path("alterados").asInt()).isEqualTo(1);
        assertThat(lim.ativosDe(membro)).isEqualTo(3);
        // Agora lotou: mais um novo já não cabe.
        api.post("/alunos/lote/responsavel", admin, Map.of("alunoIds", List.of(lim.aluno(null)), "responsavelId", membro.id()), 409);
    }

    @Test
    void loteComAlunoInativoNaoOcupaVaga() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        UUID inativo = lim.aluno(null);
        lim.inativar(inativo);
        api.post("/alunos/lote/responsavel", admin, Map.of("alunoIds", List.of(inativo), "responsavelId", membro.id()), 200);
        assertThat(lim.responsavelDe(inativo)).isEqualTo(membro.id());
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
        // Um ativo no mesmo lote já não cabe: o membro está no limite.
        api.post("/alunos/lote/responsavel", admin, Map.of("alunoIds", List.of(lim.aluno(null)), "responsavelId", membro.id()), 409);
    }

    // ---- Reativar ----

    @Test
    void reativarComOResponsavelNoLimiteRecusaEPassaQuandoHaVaga() throws Exception {
        lim.limite(membro, 1);
        UUID dele = lim.aluno(membro);
        lim.inativar(dele);
        lim.aluno(membro); // outro ocupa a vaga enquanto ele está inativo

        JsonNode erro = api.patch("/alunos/" + dele + "/situacao", admin, Map.of("ativo", true), 409);
        exigirRecusa(erro, membro.nome(), membro.id(), lim.nomeDe(dele), dele.toString());
        assertThat(lim.ativo(dele)).isFalse();
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        lim.limite(membro, 2);
        api.patch("/alunos/" + dele + "/situacao", admin, Map.of("ativo", true), 200);
        assertThat(lim.ativo(dele)).isTrue();
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
    }

    @Test
    void ativarQuemJaEstaAtivoENuncaBarrado() throws Exception {
        lim.alunos(membro, 2);
        UUID inativoDele = lim.aluno(membro);
        lim.inativar(inativoDele);
        lim.limite(membro, 1);
        UUID dele = UUID.fromString(banco.queryForList("select id::text from aluno where responsavel_id = ?::uuid and ativo = true",
                String.class, membro.id()).getFirst());
        api.patch("/alunos/" + dele + "/situacao", admin, Map.of("ativo", true), 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
        // Quem estava inativo é outro caso: reativar passa a ocupar vaga que não existe.
        api.patch("/alunos/" + inativoDele + "/situacao", admin, Map.of("ativo", true), 409);
    }

    @Test
    void desativarNuncaEBarradoEAbreAVaga() throws Exception {
        lim.limite(membro, 1);
        UUID dele = lim.aluno(membro);
        lim.editarResponsavel(lim.aluno(null), membro.id(), 409);
        lim.inativar(dele);
        assertThat(lim.ativosDe(membro)).isZero();
        lim.editarResponsavel(lim.aluno(null), membro.id(), 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    // ---- Sem limite, zero e só ativos ----

    @Test
    void semLimiteRecebeQuantosForem() throws Exception {
        lim.alunos(membro, 6);
        assertThat(lim.ativosDe(membro)).isEqualTo(6);
        // E apagar o limite com null volta a ser sem limite.
        lim.limite(membro, 1);
        lim.editarResponsavel(lim.aluno(null), membro.id(), 409);
        lim.limite(membro, null);
        lim.editarResponsavel(lim.aluno(null), membro.id(), 200);
        assertThat(lim.ativosDe(membro)).isEqualTo(7);
    }

    /** D14: 0 = não recebe aluno novo; D4: o que ele já tem fica. */
    @Test
    void limiteZeroNaoRecebeAlunoNovoMasNaoTiraOsQueTem() throws Exception {
        UUID dele = lim.aluno(membro);
        lim.limite(membro, 0);
        exigirRecusa(api.post("/alunos", admin, Map.of("nome", "Zero Fictício " + UUID.randomUUID(),
                "responsavelId", membro.id()), 409), membro.nome(), membro.id());
        exigirRecusa(lim.editarResponsavel(lim.aluno(null), membro.id(), 409));
        assertThat(lim.responsavelDe(dele)).isEqualTo(membro.id());
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
        lim.editarResponsavel(dele, membro.id(), 200);
    }

    /** D6: inativo e anonimizado não contam. */
    @Test
    void soAlunosAtivosOcupamVaga() throws Exception {
        lim.limite(membro, 2);
        UUID inativo = lim.aluno(membro);
        UUID anonimizado = lim.aluno(membro);
        lim.aluno(membro);
        lim.inativar(inativo);
        // Estado de banco que a API sozinha não produz (anonimizar exige inativo): prova que o filtro olha o anonimizado.
        banco.update("update aluno set anonimizado_em = now() where id = ?", anonimizado);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        lim.editarResponsavel(lim.aluno(null), membro.id(), 200); // 1 ativo + 1 novo = 2
        lim.editarResponsavel(lim.aluno(null), membro.id(), 409); // agora sim, cheio
    }

    @Test
    void limiteDeUmMembroNaoAfetaOutroMembro() throws Exception {
        Membro outro = lim.membro();
        lim.limite(membro, 1);
        lim.aluno(membro);
        lim.alunos(outro, 3); // o outro membro não tem limite
        assertThat(lim.ativosDe(outro)).isEqualTo(3);
        lim.editarResponsavel(lim.aluno(null), membro.id(), 409);
        lim.editarResponsavel(lim.aluno(null), outro.id(), 200);
    }
}
