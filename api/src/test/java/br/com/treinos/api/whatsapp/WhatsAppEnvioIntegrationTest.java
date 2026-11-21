package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.pagamentos.LembretesDeCobranca;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assumptions.assumeThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A fila e o job dos avisos pelo WhatsApp (B8) e o webhook da Meta, com a Meta de mentira (servidor do JDK, nunca a real): o
 * aviso de compromisso e o lembrete de cobrança entram na fila só com opt-in, conexão e modelo; o job envia fora de transação
 * com o token decifrado; erro da Meta vira FALHOU com o código ou conta tentativa; duas reservas nunca pegam a mesma linha; uma
 * consultoria não toca a outra; e o webhook assinado atualiza a linha pelo id da mensagem. O job é chamado à mão
 * ({@code envio-agendado: false} nos testes). Só dados fictícios; cada consulta filtra pelo aluno do próprio teste.
 */
class WhatsAppEnvioIntegrationTest extends WhatsAppIntegrationTestBase {

    private static final String APP_SECRET = "segredo-do-app-so-de-teste";
    private static final String VERIFY_TOKEN = "verify-token-so-de-teste";

    @Autowired private WhatsAppDaFila fila;
    @Autowired private WhatsAppRepositorio repositorio;
    @Autowired private PlatformTransactionManager transacoes;
    @Autowired private LembretesDeCobranca lembretes;
    @Autowired private EnviadorDeEmail enviador;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    /** Cada teste começa com a conexão e o modelo de compromisso novo da consultoria do administrador. */
    @BeforeEach
    void conectarEModelar() throws Exception {
        conectar(admin, token);
        modelo(admin, "COMPROMISSO_NOVO", "compromisso_novo");
    }

    // ---- ajudantes ----

    private AlunoDeTeste alunoPronto(String primeiroNome) throws Exception {
        AlunoDeTeste aluno = alunoComTelefone(admin, primeiroNome + " Fictício " + UUID.randomUUID());
        autorizar(aluno, true, 200);
        return aluno;
    }

    private String idExterno(AlunoDeTeste aluno) {
        return (String) envioDe(aluno.id()).get("id_externo");
    }

    private void tentarDeNovoJa(UUID alunoId) {
        jdbc.update("update whatsapp_envio set proxima_tentativa = now() where aluno_id = ?", alunoId);
    }

    private String nomeDaConsultoria() throws Exception {
        return api.get("/consultoria", admin, 200).path("marca").path("nome").asString();
    }

    private static String assinatura(byte[] corpo) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + java.util.HexFormat.of().formatHex(mac.doFinal(corpo));
    }

    private static String status(String id, String situacao, Integer codigoDoErro) {
        String erros = codigoDoErro == null ? "" : ",\"errors\":[{\"code\":" + codigoDoErro + ",\"title\":\"texto da Meta\"}]";
        return "{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"1\",\"changes\":[{\"field\":\"messages\","
                + "\"value\":{\"statuses\":[{\"id\":\"" + id + "\",\"status\":\"" + situacao + "\"" + erros + "}]}}]}]}";
    }

    private int webhook(String corpo, String assinatura) throws Exception {
        var req = post("/publico/whatsapp/meta").contentType(MediaType.APPLICATION_JSON)
                .content(corpo.getBytes(StandardCharsets.UTF_8));
        if (assinatura != null) {
            req.header("X-Hub-Signature-256", assinatura);
        }
        return mvc.perform(req).andReturn().getResponse().getStatus();
    }

    private int webhookAssinado(String corpo) throws Exception {
        return webhook(corpo, assinatura(corpo.getBytes(StandardCharsets.UTF_8)));
    }

    // ---- compromisso ----

    @Test
    void compromissoGeraOAvisoEOJobEnviaOModeloComOTokenDecifrado() throws Exception {
        String phoneNumberId = api.get("/whatsapp/conexao", admin, 200).path("phoneNumberId").asString();
        AlunoDeTeste aluno = alunoPronto("Carla");
        marcar(admin, aluno.id());
        Map<String, Object> pendente = envioDe(aluno.id());
        assertThat(pendente.get("tipo")).isEqualTo("COMPROMISSO_NOVO");
        assertThat(pendente.get("situacao")).isEqualTo("PENDENTE");
        assertThat(META.enviosDe(token)).as("nada sai dentro da requisição da agenda").isEmpty();

        assertThat(fila.rodar().executou()).isTrue();

        List<MetaFalsa.Chamada> envios = META.enviosDe(token);
        assertThat(envios).hasSize(1);
        MetaFalsa.Chamada chamada = envios.get(0);
        assertThat(chamada.caminho()).isEqualTo("/" + MetaCliente.VERSAO_DA_API + "/" + phoneNumberId + "/messages");
        assertThat(chamada.autorizacao()).isEqualTo("Bearer " + token);
        assertThat(chamada.para()).isEqualTo(aluno.destino());
        assertThat(chamada.corpo()).contains("\"type\":\"template\"").contains("\"name\":\"compromisso_novo\"")
                .contains("\"code\":\"pt_BR\"").contains("\"text\":\"" + nomeDaConsultoria() + "\"")
                .doesNotContain("Sala fictícia").doesNotContain("Carla");
        Map<String, Object> enviado = envioDe(aluno.id());
        assertThat(enviado.get("situacao")).isEqualTo("ENVIADO");
        assertThat((String) enviado.get("id_externo")).startsWith("wamid.");
        assertThat(enviado.get("enviado_em")).isNotNull();
        assertThat(enviado.get("tentativas")).isEqualTo(1);

        // Nada pendente: a segunda rodada não manda de novo. A fila não guarda telefone, nome nem texto.
        fila.rodar();
        assertThat(META.enviosDe(token)).hasSize(1);
        assertThat(jdbc.queryForList("select column_name from information_schema.columns where table_name = 'whatsapp_envio'",
                String.class)).doesNotContain("telefone", "para", "texto", "nome", "mensagem", "token");
    }

    @Test
    void optInDesligadoNaoEntraNaFilaECancelaOPendente() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Davi");
        marcar(admin, aluno.id());
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("PENDENTE");

        autorizar(aluno, false, 200);
        Map<String, Object> cancelado = envioDe(aluno.id());
        assertThat(cancelado.get("situacao")).isEqualTo("CANCELADO");
        assertThat(cancelado.get("motivo")).isEqualTo("OPT_IN_DESLIGADO");

        marcar(admin, aluno.id());
        assertThat(enviosDe(aluno.id())).as("sem opt-in o aviso nem nasce").isEqualTo(1);
        fila.rodar();
        assertThat(META.enviosDe(token)).isEmpty();
    }

    @Test
    void optInDesligadoDepoisDeReservadoCancelaNaConferenciaDoEnvio() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Elisa");
        marcar(admin, aluno.id());
        // O aluno desligou por fora da rota (sem cancelar a linha): o job confere de novo antes de enviar.
        jdbc.update("update aluno set whatsapp_avisos_autorizado_em = null where id = ?", aluno.id());

        fila.rodar();

        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("CANCELADO");
        assertThat(envioDe(aluno.id()).get("motivo")).isEqualTo("OPT_IN_DESLIGADO");
        assertThat(META.enviosDe(token)).isEmpty();
    }

    @Test
    void tipoSemModeloNaoEnviaEModeloRemovidoDepoisCancela() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Fábio");
        // Sem modelo do tipo CANCELADO, cancelar o compromisso não cria linha.
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        assertThat(META.enviosDe(token)).hasSize(1);
        api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao", admin,
                Map.of("cancelado", true, "versao", c.path("versao").asLong()), 200);
        assertThat(enviosDe(aluno.id())).as("sem modelo CANCELADO a linha nem nasce").isEqualTo(1);

        // O modelo do tipo existe quando o aviso nasce e some antes do envio: cancela com SEM_MODELO.
        AlunoDeTeste outro = alunoPronto("Gabi");
        marcar(admin, outro.id());
        api.delete("/whatsapp/modelos/COMPROMISSO_NOVO", admin, 204);
        fila.rodar();
        assertThat(envioDe(outro.id()).get("situacao")).isEqualTo("CANCELADO");
        assertThat(envioDe(outro.id()).get("motivo")).isEqualTo("SEM_MODELO");
        assertThat(META.enviosDe(token)).as("só o primeiro saiu").hasSize(1);

        // Sem modelo nenhum do tipo, o aviso novo nem nasce.
        marcar(admin, outro.id());
        assertThat(enviosDe(outro.id())).isEqualTo(1);
    }

    @Test
    void tokenInvalidoViraFalhouComOCodigoEUmaChamadaSo() throws Exception {
        META.modo(MetaFalsa.Modo.TOKEN_INVALIDO);
        AlunoDeTeste aluno = alunoPronto("Helena");
        marcar(admin, aluno.id());

        WhatsAppDaFila.Resultado r = fila.rodar();

        Map<String, Object> linha = envioDe(aluno.id());
        assertThat(linha.get("situacao")).isEqualTo("FALHOU");
        assertThat(linha.get("codigo_erro")).isEqualTo("META_190");
        assertThat(linha.get("tentativas")).isEqualTo(1);
        assertThat(linha.get("id_externo")).isNull();
        assertThat(r.falhasPorCodigo()).containsEntry("META_190", 1);
        fila.rodar();
        assertThat(META.enviosDe(token)).as("erro definitivo não tenta de novo").hasSize(1);
    }

    @Test
    void modeloInexistenteNaMetaViraFalhouNaHora() throws Exception {
        META.modo(MetaFalsa.Modo.MODELO_INEXISTENTE);
        AlunoDeTeste aluno = alunoPronto("Igor");
        marcar(admin, aluno.id());

        fila.rodar();

        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("FALHOU");
        assertThat(envioDe(aluno.id()).get("codigo_erro")).isEqualTo("META_132001");
    }

    @Test
    void erroDoServidorContaTentativaENaTerceiraViraFalhou() throws Exception {
        META.modo(MetaFalsa.Modo.ERRO_500);
        AlunoDeTeste aluno = alunoPronto("Julia");
        marcar(admin, aluno.id());

        fila.rodar();
        Map<String, Object> primeira = envioDe(aluno.id());
        assertThat(primeira.get("situacao")).isEqualTo("PENDENTE");
        assertThat(primeira.get("tentativas")).isEqualTo(1);
        assertThat(primeira.get("codigo_erro")).isEqualTo("HTTP_500");

        fila.rodar();
        assertThat(META.enviosDe(token)).as("a espera entre tentativas vale").hasSize(1);

        tentarDeNovoJa(aluno.id());
        fila.rodar();
        assertThat(envioDe(aluno.id()).get("tentativas")).isEqualTo(2);
        tentarDeNovoJa(aluno.id());
        fila.rodar();
        Map<String, Object> ultima = envioDe(aluno.id());
        assertThat(ultima.get("situacao")).isEqualTo("FALHOU");
        assertThat(ultima.get("tentativas")).isEqualTo(3);
        assertThat(META.enviosDe(token)).hasSize(3);

        // Voltando ao normal, nada do que falhou é reenviado.
        META.modo(MetaFalsa.Modo.OK);
        fila.rodar();
        assertThat(META.enviosDe(token)).hasSize(3);
    }

    @Test
    void respostaSemIdELimiteDeTaxaEDemoraContamTentativaSemEnviarDeFato() throws Exception {
        AlunoDeTeste semId = alunoPronto("Karen");
        META.modo(MetaFalsa.Modo.SEM_ID);
        marcar(admin, semId.id());
        fila.rodar();
        assertThat(envioDe(semId.id()).get("situacao")).isEqualTo("PENDENTE");
        assertThat(envioDe(semId.id()).get("codigo_erro")).isEqualTo("RESPOSTA_INVALIDA");

        AlunoDeTeste limitado = alunoPronto("Lucas");
        META.modo(MetaFalsa.Modo.LIMITE_DE_TAXA);
        marcar(admin, limitado.id());
        fila.rodar();
        assertThat(envioDe(limitado.id()).get("situacao")).as("limite de taxa passa").isEqualTo("PENDENTE");
        assertThat(envioDe(limitado.id()).get("codigo_erro")).isEqualTo("META_80007");

        AlunoDeTeste lento = alunoPronto("Marta");
        META.modo(MetaFalsa.Modo.LENTO);
        marcar(admin, lento.id());
        fila.rodar();
        assertThat(envioDe(lento.id()).get("situacao")).as("tempo máximo de 1 s").isEqualTo("PENDENTE");
        assertThat(envioDe(lento.id()).get("codigo_erro")).isEqualTo("HttpTimeoutException");
    }

    @Test
    void outraConsultoriaNaoETocada() throws Exception {
        AlunoDeTeste meu = alunoPronto("Nina");
        JsonNode outro = novaConsultoria();
        String tokenDoOutro = tokenNovo();
        conectar(outro, tokenDoOutro);
        modelo(outro, "COMPROMISSO_NOVO", "compromisso_novo");
        AlunoDeTeste doOutro = alunoComTelefone(outro, "Otávio Fictício " + UUID.randomUUID());
        autorizar(doOutro, true, 200);
        marcar(admin, meu.id());
        marcar(outro, doOutro.id());

        // Desligar o meu e remover a minha conexão não toca no pendente do outro.
        autorizar(meu, false, 200);
        api.delete("/whatsapp/conexao", admin, 204);
        assertThat(envioDe(doOutro.id()).get("situacao")).isEqualTo("PENDENTE");

        fila.rodar();

        assertThat(envioDe(doOutro.id()).get("situacao")).isEqualTo("ENVIADO");
        assertThat(META.enviosDe(tokenDoOutro)).hasSize(1);
        assertThat(META.enviosDe(tokenDoOutro).get(0).para()).isEqualTo(doOutro.destino());
        assertThat(META.enviosDe(token)).as("a consultoria sem conexão não enviou nada").isEmpty();
        assertThat(META.paraDeTodos()).doesNotContain(meu.destino());
    }

    // ---- concorrência e transação ----

    @Test
    void duasReservasNaoPegamAMesmaLinha() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Paulo");
        for (int i = 0; i < 3; i++) {
            marcar(admin, aluno.id());
        }
        Set<UUID> minhas = new HashSet<>(jdbc.queryForList("select id from whatsapp_envio where aluno_id = ?", UUID.class,
                aluno.id()));
        assertThat(minhas).hasSize(3);
        TransactionTemplate transacao = new TransactionTemplate(transacoes);
        CountDownLatch aReservou = new CountDownLatch(1);
        CountDownLatch bTerminou = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // A reserva da A segue aberta (linhas travadas) enquanto a B reserva: a B pula o que está travado.
            Future<Set<UUID>> a = pool.submit(() -> transacao.execute(s -> {
                Set<UUID> pegas = idsDe(repositorio.reservar(UUID.randomUUID(), 50, 300), minhas);
                aReservou.countDown();
                aguardar(bTerminou);
                return pegas;
            }));
            Future<Set<UUID>> b = pool.submit(() -> {
                aguardar(aReservou);
                try {
                    return transacao.execute(s -> idsDe(repositorio.reservar(UUID.randomUUID(), 50, 300), minhas));
                } finally {
                    bTerminou.countDown();
                }
            });
            Set<UUID> daB = b.get(20, TimeUnit.SECONDS);
            Set<UUID> daA = a.get(20, TimeUnit.SECONDS);

            assertThat(daA).containsExactlyInAnyOrderElementsOf(minhas);
            assertThat(daB).as("a B não pega linha da A").isEmpty();
            // Depois do commit da A as linhas seguem arrendadas (lease): uma terceira reserva também não as pega.
            assertThat(idsDe(transacao.execute(s -> repositorio.reservar(UUID.randomUUID(), 50, 300)), minhas)).isEmpty();
        } finally {
            pool.shutdownNow();
            jdbc.update("update whatsapp_envio set reservado_por = null, reserva_ate = null where aluno_id = ?", aluno.id());
        }
    }

    private static Set<UUID> idsDe(List<WhatsAppRepositorio.Reservado> reservados, Set<UUID> meus) {
        Set<UUID> ids = new HashSet<>();
        reservados.forEach(r -> {
            if (meus.contains(r.id())) {
                ids.add(r.id());
            }
        });
        return ids;
    }

    private static void aguardar(CountDownLatch trava) {
        try {
            if (!trava.await(15, TimeUnit.SECONDS)) {
                throw new IllegalStateException("A outra reserva não andou.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    @Test
    void oEnvioHttpAcontecForaDeQualquerTransacao() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Quésia");
        marcar(admin, aluno.id());
        AtomicReference<String> durante = new AtomicReference<>();
        AtomicReference<Throwable> erro = new AtomicReference<>();
        META.aoEnviar(chamada -> {
            if (!("Bearer " + token).equals(chamada.autorizacao())) {
                return;
            }
            try {
                // De outra conexão: se o job segurasse a linha numa transação aberta, o nowait falharia.
                UUID id = jdbc.queryForObject("select id from whatsapp_envio where aluno_id = ? for update nowait", UUID.class,
                        aluno.id());
                assertThat(id).isNotNull();
                durante.set(jdbc.queryForObject("select situacao || ':' || (reservado_por is not null) from whatsapp_envio "
                        + "where aluno_id = ?", String.class, aluno.id()));
            } catch (Throwable e) {
                erro.set(e);
            }
        });

        fila.rodar();

        assertThat(erro.get()).as("a linha estava livre durante o HTTP").isNull();
        assertThat(durante.get()).as("e já reservada e visível a quem olha de fora").isEqualTo("PENDENTE:true");
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("ENVIADO");
    }

    // ---- webhook ----

    @Test
    void statusDaMetaAtualizaALinhaPeloIdExterno() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Rita");
        marcar(admin, aluno.id());
        fila.rodar();
        String id = idExterno(aluno);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("ENVIADO");

        assertThat(webhookAssinado(status(id, "sent", null))).isEqualTo(200);
        assertThat(envioDe(aluno.id()).get("situacao")).as("sent é o que a fila já sabe").isEqualTo("ENVIADO");
        assertThat(webhookAssinado(status(id, "delivered", null))).isEqualTo(200);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("ENTREGUE");
        assertThat(envioDe(aluno.id()).get("entregue_em")).isNotNull();
        assertThat(webhookAssinado(status(id, "read", null))).isEqualTo(200);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("LIDO");
        assertThat(envioDe(aluno.id()).get("lido_em")).isNotNull();
        // Fora de ordem não volta atrás; id desconhecido é ignorado.
        assertThat(webhookAssinado(status(id, "delivered", null))).isEqualTo(200);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("LIDO");
        assertThat(webhookAssinado(status("wamid.desconhecido" + UUID.randomUUID(), "read", null))).isEqualTo(200);
    }

    @Test
    void statusFalhouGuardaSoOCodigoDaMeta() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Sofia");
        marcar(admin, aluno.id());
        fila.rodar();

        assertThat(webhookAssinado(status(idExterno(aluno), "failed", 131026))).isEqualTo(200);

        Map<String, Object> linha = envioDe(aluno.id());
        assertThat(linha.get("situacao")).isEqualTo("FALHOU");
        assertThat(linha.get("codigo_erro")).isEqualTo("META_131026");
        assertThat(linha.toString()).doesNotContain("texto da Meta");
    }

    @Test
    void assinaturaInvalidaOuAusenteDa401SemGravarNada() throws Exception {
        AlunoDeTeste aluno = alunoPronto("Tiago");
        marcar(admin, aluno.id());
        fila.rodar();
        String corpo = status(idExterno(aluno), "read", null);
        byte[] bytes = corpo.getBytes(StandardCharsets.UTF_8);
        String certa = assinatura(bytes);

        assertThat(webhook(corpo, null)).isEqualTo(401);
        assertThat(webhook(corpo, certa.replace("sha256=", ""))).isEqualTo(401);
        assertThat(webhook(corpo, "sha256=" + "0".repeat(64))).isEqualTo(401);
        assertThat(webhook(corpo, "sha256=zz")).isEqualTo(401);
        assertThat(webhook(corpo + " ", certa)).as("corpo mexido depois de assinado").isEqualTo(401);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("ENVIADO");

        assertThat(webhook(corpo, certa)).isEqualTo(200);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("LIDO");
    }

    @Test
    void corpoGrandeDemaisDa413ELixoAssinadoDa400() throws Exception {
        String grande = "{\"x\":\"" + "a".repeat(70 * 1024) + "\"}";
        assertThat(webhookAssinado(grande)).isEqualTo(413);
        assertThat(webhookAssinado("isto não é json")).isEqualTo(400);
        assertThat(webhookAssinado("{\"entry\":\"nada\"}")).as("JSON sem status é só ignorado").isEqualTo(200);
    }

    @Test
    void desafioDeCadastroSoComOTokenCerto() throws Exception {
        var ok = mvc.perform(get("/publico/whatsapp/meta").param("hub.mode", "subscribe").param("hub.verify_token", VERIFY_TOKEN)
                .param("hub.challenge", "1158201444")).andReturn().getResponse();
        assertThat(ok.getStatus()).isEqualTo(200);
        assertThat(ok.getContentAsString()).isEqualTo("1158201444");
        assertThat(ok.getContentType()).startsWith("text/plain");
        assertThat(ok.getHeader("Cache-Control")).contains("no-store");

        assertThat(mvc.perform(get("/publico/whatsapp/meta").param("hub.mode", "subscribe").param("hub.verify_token", "errado")
                .param("hub.challenge", "1158201444")).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(get("/publico/whatsapp/meta").param("hub.mode", "unsubscribe").param("hub.verify_token", VERIFY_TOKEN)
                .param("hub.challenge", "1158201444")).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(get("/publico/whatsapp/meta").param("hub.mode", "subscribe")
                .param("hub.challenge", "1158201444")).andReturn().getResponse().getStatus()).isEqualTo(403);
        var lixo = mvc.perform(get("/publico/whatsapp/meta").param("hub.mode", "subscribe").param("hub.verify_token", VERIFY_TOKEN)
                .param("hub.challenge", "<script>alert(1)</script>")).andReturn().getResponse();
        assertThat(lixo.getStatus()).isEqualTo(400);
        assertThat(lixo.getContentAsString()).doesNotContain("<script>");
    }

    // ---- lembrete de cobrança ----

    private record Cobranca(UUID id, long versao, LocalDate vencimento) {
    }

    /** Plano mensal de R$ 120,00 e contratação de hoje do aluno; devolve a cobrança aberta (ou pula o teste se o vencimento não é hoje). */
    private Cobranca contratar(AlunoDeTeste aluno) throws Exception {
        JsonNode plano = api.post("/financeiro/planos", admin,
                Map.of("nome", "Plano WhatsApp " + UUID.randomUUID(), "valorCentavos", 12000, "periodicidade", "MENSAL"), 200);
        api.post("/alunos/" + aluno.id() + "/contratacoes", admin, Map.of("planoComercialId", plano.path("id").asString(),
                "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
        for (JsonNode c : api.get("/alunos/" + aluno.id() + "/cobrancas", admin, 200)) {
            if ("ABERTA".equals(c.path("situacao").asString())) {
                Cobranca cobranca = new Cobranca(UUID.fromString(c.path("id").asString()), c.path("versao").asLong(),
                        LocalDate.parse(c.path("vencimento").asString()));
                // O envio confere com o "hoje" de verdade: o cenário só vale com a cobrança vencendo hoje.
                assumeThat(cobranca.vencimento()).isEqualTo(hoje);
                return cobranca;
            }
        }
        throw new AssertionError("Sem cobrança aberta.");
    }

    private void ligarLembretes() throws Exception {
        api.put("/financeiro/lembretes", admin, Map.of("ligado", true, "diasAntes", 3, "noDia", true, "diasDepois", 3), 200);
    }

    @Test
    void lembreteNoDiaSaiComAsQuatroVariaveisMesmoComOEmailDesligado() throws Exception {
        modelo(admin, "NO_DIA", "lembrete_no_dia");
        AlunoDeTeste aluno = alunoPronto("Úrsula");
        Cobranca cobranca = contratar(aluno);
        ligarLembretes();

        // Sem e-mail (enviador nulo) o WhatsApp é planejado do mesmo jeito; rodar de novo não duplica.
        lembretes.rodar(hoje, null);
        lembretes.rodar(hoje, null);
        assertThat(enviosDe(aluno.id())).isEqualTo(1);
        Map<String, Object> pendente = envioDe(aluno.id());
        assertThat(pendente.get("tipo")).isEqualTo("NO_DIA");
        assertThat(pendente.get("situacao")).isEqualTo("PENDENTE");
        assertThat(jdbc.queryForObject("select referencia_id from whatsapp_envio where aluno_id = ?", UUID.class, aluno.id()))
                .isEqualTo(cobranca.id());

        fila.rodar();

        List<MetaFalsa.Chamada> envios = META.enviosDe(token);
        assertThat(envios).hasSize(1);
        assertThat(envios.get(0).corpo()).contains("\"name\":\"lembrete_no_dia\"").contains("\"text\":\"Úrsula\"")
                .contains("\"text\":\"" + nomeDaConsultoria() + "\"").contains("\"text\":\"R$ 120,00\"")
                .contains("\"text\":\"" + hoje.format(DateTimeFormatter.ofPattern("dd/MM", Locale.ROOT)) + "\"")
                .doesNotContain("Fictício");
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("ENVIADO");
        // Com o e-mail ligado também não nasce outro: a chave única vale.
        lembretes.rodar(hoje, enviador);
        assertThat(enviosDe(aluno.id())).isEqualTo(1);
    }

    @Test
    void cobrancaPagaEntreOPlanejamentoEOEnvioCancelaOAviso() throws Exception {
        modelo(admin, "NO_DIA", "lembrete_no_dia");
        AlunoDeTeste aluno = alunoPronto("Valéria");
        Cobranca cobranca = contratar(aluno);
        ligarLembretes();
        lembretes.rodar(hoje, enviador);
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("PENDENTE");

        api.post("/cobrancas/" + cobranca.id() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobranca.versao()), 200);
        fila.rodar();

        Map<String, Object> linha = envioDe(aluno.id());
        assertThat(linha.get("situacao")).isEqualTo("CANCELADO");
        assertThat(linha.get("motivo")).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(META.enviosDe(token)).isEmpty();
    }

    @Test
    void alunoQueDesligouOsLembretesNaoRecebeLembreteMasRecebeCompromisso() throws Exception {
        modelo(admin, "NO_DIA", "lembrete_no_dia");
        AlunoDeTeste aluno = alunoPronto("Wagner");
        contratar(aluno);
        ligarLembretes();
        api.put("/aluno/lembretes-de-cobranca", aluno.login(), Map.of("receber", false), 200);

        lembretes.rodar(hoje, null);
        assertThat(enviosDe(aluno.id())).as("lembrete desligado pelo aluno não é planejado").isZero();
        marcar(admin, aluno.id());
        assertThat(enviosDe(aluno.id())).as("o aviso de compromisso é outra escolha").isEqualTo(1);
    }

    @Test
    void alunoSemOptInNaoTemLembretePlanejado() throws Exception {
        AlunoDeTeste semOptIn = alunoComTelefone(admin, "Xavier Fictício " + UUID.randomUUID());
        contratar(semOptIn);
        ligarLembretes();
        modelo(admin, "NO_DIA", "lembrete_no_dia");

        lembretes.rodar(hoje, null);

        assertThat(enviosDe(semOptIn.id())).as("sem opt-in não nasce").isZero();
    }
}
