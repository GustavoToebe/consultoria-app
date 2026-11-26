package br.com.treinos.api.importacao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.alunos.AcessoDoAlunoService;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * Importação de alunos x "Desativar acesso" (MANUAL) ao mesmo tempo, com duas transações reais: a planilha diz "ativo" para
 * um aluno inativo e, em qualquer ordem, o resultado é MANUAL com o login bloqueado ({@code usuario.ativo = false}), sem
 * deadlock (um deadlock no Postgres aborta um dos lados em ~1 s, e o teste exige os dois com sucesso). Com telefone na
 * planilha a importação trava o usuário, e a ordem das travas (aluno antes do usuário) tem de ser a do desativar.
 * Quem segura a transação aberta espera o outro lado estar de fato bloqueado nela ({@code pg_blocking_pids}), sem sleep fixo.
 * Só dados fictícios.
 */
@AutoConfigureMockMvc
class ImportacaoEDesativarAcessoIntegrationTest extends AbstractIntegrationTest {

    private static final int SEGUNDOS = 20;

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private TransactionTemplate transacao;
    @Autowired private AlunoRepository alunos;
    @Autowired private AcessoDoAlunoService acessos;
    @Autowired private ImportacaoService importacao;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoriaId;
    private ExecutorService pool;

    private record Cenario(UUID alunoId, String texto, String config, String hash) {
        byte[] csv() {
            return texto.getBytes(StandardCharsets.UTF_8);
        }
    }

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        consultoriaId = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.get("usuario").get("id").asString());
        pool = Executors.newFixedThreadPool(2);
    }

    @AfterEach
    void desligar() {
        pool.shutdownNow();
    }

    /**
     * O desativar trava o aluno antes da importação ler a ficha e só grava depois que ela está esperando: ela relê sob a trava.
     * Sem a releitura, a importação ligava o usuário pelo motivo nulo que tinha em memória.
     */
    @Test
    void desativarEmAndamentoNaoTemOLoginReligadoPelaImportacao() throws Exception {
        corridaComODesativarEmAndamento(cenario("Corrida Desativa Antes", false));
    }

    /** Com telefone a importação trava também o usuário: antes ela o travava antes do aluno e o desativar dava deadlock. */
    @Test
    void desativarEmAndamentoComTelefoneNaPlanilhaNaoTravaEmCirculo() throws Exception {
        corridaComODesativarEmAndamento(cenario("Corrida Desativa Telefone", true));
    }

    private void corridaComODesativarEmAndamento(Cenario c) throws Exception {
        CountDownLatch travou = new CountDownLatch(1);
        CountDownLatch liberar = new CountDownLatch(1);
        AtomicInteger pid = new AtomicInteger();
        Future<?> desativa = pool.submit(() -> TenantContext.executarComo(consultoriaId, () -> transacao.execute(st -> {
            assertThat(alunos.buscarParaAlterar(c.alunoId())).isPresent();
            pid.set(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
            travou.countDown();
            esperar(liberar);
            acessos.desativar(c.alunoId()); // o mesmo serviço da rota, na transação que já segura o aluno
            return null;
        })));
        assertThat(travou.await(SEGUNDOS, TimeUnit.SECONDS)).isTrue();
        Future<Integer> importa = pool.submit(() -> confirmarPelaRota(c));
        esperarAlguemBloqueadoPor(pid.get());
        liberar.countDown();

        desativa.get(SEGUNDOS, TimeUnit.SECONDS);
        assertThat(importa.get(SEGUNDOS, TimeUnit.SECONDS)).isEqualTo(200);
        exigirManualEBloqueado(c.alunoId());
    }

    /** A importação grava primeiro e segura a transação; o desativar espera a trava do aluno e vence depois. */
    @Test
    void importacaoEmAndamentoEDepoisDesativarTerminaEmManual() throws Exception {
        Cenario c = cenario("Corrida Importa Antes", true);
        UUID treinadorId = UUID.fromString(treinador.get("usuario").get("id").asString());
        UsuarioAutenticado eu = new UsuarioAutenticado(treinadorId, consultoriaId, "TREINADOR", null);
        CountDownLatch travou = new CountDownLatch(1);
        CountDownLatch liberar = new CountDownLatch(1);
        AtomicInteger pid = new AtomicInteger();
        Future<?> importa = pool.submit(() -> {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(eu, null, List.of(
                    new SimpleGrantedAuthority("PERM_ALUNO_ALTERAR"), new SimpleGrantedAuthority("PERM_ALUNO_LER"))));
            try {
                return TenantContext.executarComo(consultoriaId, () -> transacao.execute(st -> {
                    importacao.confirmar(eu, "alunos", "corrida.csv", c.csv(), c.config(), c.hash());
                    pid.set(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
                    travou.countDown();
                    esperar(liberar);
                    return null;
                }));
            } finally {
                SecurityContextHolder.clearContext();
            }
        });
        assertThat(travou.await(SEGUNDOS, TimeUnit.SECONDS)).isTrue();
        Future<Integer> desativa = pool.submit(() -> desativarPelaRota(c.alunoId()));
        esperarAlguemBloqueadoPor(pid.get());
        liberar.countDown();

        importa.get(SEGUNDOS, TimeUnit.SECONDS);
        assertThat(desativa.get(SEGUNDOS, TimeUnit.SECONDS)).isEqualTo(200);
        exigirManualEBloqueado(c.alunoId());
    }

    /** Guarda de regressão (passava também antes da correção: a leitura do começo já vê o MANUAL). */
    @Test
    void desativarJaConfirmadoAntesDaImportacaoNaoEReligado() throws Exception {
        Cenario c = cenario("Desativado Antes", true);
        assertThat(desativarPelaRota(c.alunoId())).isEqualTo(200);
        assertThat(confirmarPelaRota(c)).isEqualTo(200);
        exigirManualEBloqueado(c.alunoId());
    }

    // ---- apoio ----

    /** Aluno inativo com acesso e a prévia (sem trava) de uma planilha que o reativa e, se pedido, troca o telefone. */
    private Cenario cenario(String nome, boolean comTelefone) throws Exception {
        String email = ApiDeTeste.emailUnico("corrida-importacao");
        UUID alunoId = UUID.fromString(api.post("/alunos", treinador, Map.of("nome", nome, "email", email), 200).get("id").asString());
        api.convidarEEntrar(treinador, alunoId);
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        String texto = "nome;email;telefone;situacao\n" + nome + ";" + email + ";" + (comTelefone ? "(45) 98888-2222" : "") + ";ativo\n";
        String config = json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", 1, "chave", "email", "existentes", "ATUALIZAR",
                "mapeamento", Map.of("nome", 0, "email", 1, "telefone", 2, "situacao", 3)));
        JsonNode previa = json.readTree(enviar("alunos/previa", texto.getBytes(StandardCharsets.UTF_8), config, null).getContentAsString(StandardCharsets.UTF_8));
        assertThat(previa.path("atualizados").asInt()).isEqualTo(1);
        assertThat(previa.path("comErro").asInt()).isZero();
        return new Cenario(alunoId, texto, config, previa.path("hash").asString());
    }

    private int confirmarPelaRota(Cenario c) throws Exception {
        return enviar("alunos", c.csv(), c.config(), c.hash()).getStatus();
    }

    private org.springframework.mock.web.MockHttpServletResponse enviar(String caminho, byte[] csv, String config, String hash)
            throws Exception {
        var pedido = multipart("/importacoes/" + caminho)
                .file(new MockMultipartFile("arquivo", "corrida.csv", "text/csv", csv))
                .file(new MockMultipartFile("configuracao", "config.json", "application/json", config.getBytes(StandardCharsets.UTF_8)))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                .header("X-Treinos-Cliente", "nativo");
        if (hash != null) {
            pedido.param("hash", hash);
        }
        return mvc.perform(pedido).andReturn().getResponse();
    }

    private int desativarPelaRota(UUID alunoId) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.post("/alunos/" + alunoId + "/acesso/desativar")
                        .header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andReturn().getResponse().getStatus();
    }

    private void exigirManualEBloqueado(UUID alunoId) {
        assertThat(jdbc.queryForObject("select acesso_desativado_motivo from aluno where id = ?", String.class, alunoId))
                .isEqualTo("MANUAL");
        assertThat(jdbc.queryForObject("select ativo from aluno where id = ?", Boolean.class, alunoId)).isTrue();
        assertThat(jdbc.queryForObject("select u.ativo from usuario u join aluno a on a.usuario_id = u.id where a.id = ?",
                Boolean.class, alunoId)).as("usuario.ativo").isFalse();
    }

    /** Espera até outra sessão do Postgres estar bloqueada pela {@code pid} (prova que a segunda operação espera a trava). */
    private void esperarAlguemBloqueadoPor(int pid) throws InterruptedException {
        long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(SEGUNDOS);
        while (System.nanoTime() < limite) {
            Integer n = jdbc.queryForObject("select count(*) from pg_stat_activity where ? = any(pg_blocking_pids(pid))",
                    Integer.class, pid);
            if (n != null && n > 0) {
                return;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("Ninguém ficou esperando a trava da transação aberta.");
    }

    private static void esperar(CountDownLatch latch) {
        try {
            if (!latch.await(SEGUNDOS, TimeUnit.SECONDS)) {
                throw new AssertionError("A transação aberta não foi liberada a tempo.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }
}
