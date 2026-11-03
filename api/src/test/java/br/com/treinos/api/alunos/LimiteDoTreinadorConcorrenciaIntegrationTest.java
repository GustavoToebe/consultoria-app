package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste.Membro;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Disputa pela última vaga do mesmo membro (D9, D12): duas ou mais requisições chegam juntas por uma barreira; só as que
 * cabem no limite passam (200) e as outras levam 409 {@code LIMITE_DO_TREINADOR}, e o total de ativos do membro termina
 * exatamente no limite. Cada par mistura caminhos de trava diferentes (editar, lote, reativar, aceite de inscrição): a ordem
 * consultoria, inscrição e alunos tem de valer para todos, senão a disputa trava (o teste falha por tempo, não fica preso).
 * A classe não é transacional: cada requisição abre a própria transação, como em produção. Só dados fictícios.
 */
@AutoConfigureMockMvc
class LimiteDoTreinadorConcorrenciaIntegrationTest extends AbstractIntegrationTest {

    private static final int SEGUNDOS = 60;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private TransactionTemplate transacao;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private LimiteDoTreinador limiteDoTreinador;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private Membro membro;
    private ExecutorService pool;

    private record Resposta(int status, JsonNode corpo) {
    }

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        membro = lim.membro();
        pool = Executors.newFixedThreadPool(8);
    }

    @AfterEach
    void encerrar() {
        pool.shutdownNow();
    }

    private Resposta chamar(MockHttpServletRequestBuilder pedido, Object corpo) throws Exception {
        pedido.header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin));
        if (corpo != null) {
            pedido.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo));
        }
        var r = mvc.perform(pedido).andReturn().getResponse();
        String texto = r.getContentAsString(StandardCharsets.UTF_8);
        return new Resposta(r.getStatus(), texto.isBlank() ? json.nullNode() : json.readTree(texto));
    }

    private Callable<Resposta> editar(UUID aluno) throws Exception {
        return editarPara(aluno, membro);
    }

    private Callable<Resposta> editarPara(UUID aluno, Membro destino) throws Exception {
        JsonNode atual = api.get("/alunos/" + aluno, admin, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", atual.path("nome").asString());
        corpo.put("versao", atual.path("versao").asLong());
        corpo.put("responsavelId", destino.id());
        return () -> chamar(MockMvcRequestBuilders.put("/alunos/" + aluno), corpo);
    }

    private Callable<Resposta> lote(UUID... alunos) {
        Map<String, Object> corpo = Map.of("alunoIds", List.of(alunos), "responsavelId", membro.id());
        return () -> chamar(MockMvcRequestBuilders.post("/alunos/lote/responsavel"), corpo);
    }

    private Callable<Resposta> reativar(UUID aluno) {
        return () -> chamar(MockMvcRequestBuilders.patch("/alunos/" + aluno + "/situacao"), Map.of("ativo", true));
    }

    private Callable<Resposta> aceitar(String[] inscricao) {
        Map<String, Object> corpo = Map.of("convidar", false, "versao", Long.parseLong(inscricao[1]));
        return () -> chamar(MockMvcRequestBuilders.post("/inscricoes/" + inscricao[0] + "/aceitar"), corpo);
    }

    /** Dispara todas juntas por uma barreira e espera o resultado de cada uma. */
    private List<Resposta> disputar(List<Callable<Resposta>> chamadas) throws Exception {
        CyclicBarrier largada = new CyclicBarrier(chamadas.size());
        List<Future<Resposta>> futuros = new ArrayList<>();
        for (Callable<Resposta> chamada : chamadas) {
            futuros.add(pool.submit(() -> {
                largada.await(SEGUNDOS, TimeUnit.SECONDS);
                return chamada.call();
            }));
        }
        List<Resposta> respostas = new ArrayList<>();
        for (Future<Resposta> futuro : futuros) {
            respostas.add(futuro.get(SEGUNDOS, TimeUnit.SECONDS));
        }
        return respostas;
    }

    private static void exigirResultado(List<Resposta> respostas, int aceitas) {
        long ok = respostas.stream().filter(r -> r.status() == 200).count();
        List<Resposta> recusadas = respostas.stream().filter(r -> r.status() != 200).toList();
        assertThat(ok).as("requisições aceitas").isEqualTo(aceitas);
        assertThat(recusadas).hasSize(respostas.size() - aceitas);
        for (Resposta r : recusadas) {
            assertThat(r.status()).isEqualTo(409);
            assertThat(r.corpo().path("codigo").asString()).isEqualTo(LimiteDoTreinadorDeTeste.CODIGO);
        }
    }

    @Test
    void duasEdicoesDisputandoAUltimaVagaUmaPassaEAOutraRecebe409() throws Exception {
        lim.limite(membro, 1);
        List<Resposta> r = disputar(List.of(editar(lim.aluno(null)), editar(lim.aluno(null))));
        exigirResultado(r, 1);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    @Test
    void seisEdicoesParaDoisLugaresDeixamExatamenteDois() throws Exception {
        lim.limite(membro, 2);
        List<Callable<Resposta>> chamadas = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            chamadas.add(editar(lim.aluno(null)));
        }
        exigirResultado(disputar(chamadas), 2);
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
    }

    @Test
    void loteContraEdicaoNaUltimaVaga() throws Exception {
        lim.limite(membro, 1);
        UUID doLote = lim.aluno(null);
        List<Resposta> r = disputar(List.of(lote(doLote), editar(lim.aluno(null))));
        exigirResultado(r, 1);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    @Test
    void reativacaoContraEdicaoNaUltimaVaga() throws Exception {
        lim.limite(membro, 1);
        UUID inativo = lim.aluno(membro);
        lim.inativar(inativo);
        List<Resposta> r = disputar(List.of(reativar(inativo), editar(lim.aluno(null))));
        exigirResultado(r, 1);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    /** A ordem das travas da D9 (consultoria, inscrição, alunos): o aceite e a edição disputam sem travar em círculo. */
    @Test
    void aceiteDeInscricaoContraEdicaoNaUltimaVaga() throws Exception {
        lim.limite(membro, 1);
        String[] inscricao = lim.inscricaoNova(ApiDeTeste.emailUnico("disputa"), membro);
        List<Resposta> r = disputar(List.of(aceitar(inscricao), editar(lim.aluno(null))));
        exigirResultado(r, 1);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
    }

    @Test
    void disputaEntreDoisMembrosNaoSeMistura() throws Exception {
        Membro outro = lim.membro();
        lim.limite(membro, 1);
        lim.limite(outro, 1);
        // Dois candidatos para a única vaga de cada membro: passa um por membro, e a vaga de um não cobre a do outro.
        List<Resposta> r = disputar(List.of(editarPara(lim.aluno(null), membro), editarPara(lim.aluno(null), membro),
                editarPara(lim.aluno(null), outro), editarPara(lim.aluno(null), outro)));
        exigirResultado(r, 2);
        assertThat(lim.ativosDe(membro)).isEqualTo(1);
        assertThat(lim.ativosDe(outro)).isEqualTo(1);
    }

    /**
     * O limite muda entre a hora em que a operação carregou o membro (já no cache do Hibernate, com limite nulo) e a conferência:
     * a conferência trava a consultoria e lê o limite por consulta escalar, que não passa pelo cache, então enxerga o novo valor.
     */
    @Test
    void limiteMudadoDepoisDeCarregarOMembroNoCacheValeNaConferencia() throws Exception {
        UUID consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, membro.id());
        UUID id = UUID.fromString(membro.id());
        assertThatThrownBy(() -> TenantContext.executarComo(consultoria, () -> transacao.execute(status -> {
            assertThat(usuarios.findById(id).orElseThrow().getLimiteDeAlunos()).isNull(); // no cache, sem limite
            try { // outra thread = outra conexão: grava e confirma (na desta thread o JdbcTemplate entraria na mesma transação)
                pool.submit(() -> banco.update("update usuario set limite_de_alunos = 0 where id = ?", id)).get(SEGUNDOS, TimeUnit.SECONDS);
            } catch (Exception e) {
                throw new AssertionError(e);
            }
            limiteDoTreinador.exigirVaga(id, 1, null);
            return null;
        }))).isInstanceOf(ConflictException.class);
    }
}
