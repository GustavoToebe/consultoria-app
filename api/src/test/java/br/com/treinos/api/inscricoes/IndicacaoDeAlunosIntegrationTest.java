package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Indicação de alunos (plano {@code indicacao-de-alunos}, passo 1): o código do aluno no pedido da inscrição pública é conferido
 * em silêncio dentro da consultoria do link (qualquer falha grava sem indicador, com a mesma resposta), o detalhe recorta o nome
 * por {@code ALUNO_LER}, {@code GET /aluno/indicacao} devolve só o link do próprio aluno, e anonimizar ou excluir a conta zera o
 * vínculo e troca o código. Só dados fictícios; cada teste tem consultoria própria e nomes únicos.
 */
@AutoConfigureMockMvc
class IndicacaoDeAlunosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private IndicacaoDoAlunoService servico;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.path("usuario").path("id").asString());
    }

    // ---- auxiliares ----

    /** Liga o link de inscrição do padrão da consultoria e devolve a configuração (com {@code codigo} e {@code link}). */
    private JsonNode abrirLink(JsonNode login) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200);
    }

    private UUID alunoNovo(JsonNode treinador, String prefixo) throws Exception {
        return api.criarAluno(treinador, prefixo + " " + UUID.randomUUID());
    }

    private UUID codigoDe(UUID alunoId) {
        return banco.queryForObject("select codigo_indicacao from aluno where id = ?", UUID.class, alunoId);
    }

    private String nomeDe(UUID alunoId) {
        return banco.queryForObject("select nome from aluno where id = ?", String.class, alunoId);
    }

    /** Envia a inscrição pública; {@code codigoIndicacao} nulo = pedido sem o campo. Devolve o corpo da resposta (202). */
    private JsonNode inscrever(String link, String nomeDoLead, Object codigoIndicacao) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nomeDoLead);
        corpo.put("whatsapp", "11987654321");
        corpo.put("objetivo", "Objetivo fictício");
        if (codigoIndicacao != null) {
            corpo.put("codigoIndicacao", codigoIndicacao.toString());
        }
        return api.post("/publico/inscricoes/" + link, null, corpo, 202);
    }

    private String nomeDeLead() {
        return "Interessada Fictícia " + UUID.randomUUID();
    }

    private String idDaInscricao(String nomeDoLead) {
        return banco.queryForObject("select id::text from inscricao where consultoria_id = ? and nome = ?", String.class,
                consultoria, nomeDoLead);
    }

    private UUID indicadorGravado(String nomeDoLead) {
        return banco.queryForObject("select indicado_por_aluno_id from inscricao where consultoria_id = ? and nome = ?",
                UUID.class, consultoria, nomeDoLead);
    }

    private void inativar(JsonNode treinador, UUID alunoId) throws Exception {
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
    }

    private void anonimizar(JsonNode treinador, UUID alunoId) throws Exception {
        inativar(treinador, alunoId);
        api.post("/alunos/" + alunoId + "/anonimizar", treinador, Map.of("nomeConfirmado", nomeDe(alunoId)), 200);
    }

    /** Membro da equipe só com {@code INSCRICAO_LER} (sem {@code ALUNO_LER}). */
    private JsonNode membroSoDeInscricoes() throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(),
                "permissoes", Set.of("INSCRICAO_LER")), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Atendente Fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- inscrição pública ----

    @Test
    void codigoValidoGravaOVinculoEODetalheMostraONomeParaQuemTemAlunoLer() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        String lead = nomeDeLead();

        JsonNode resposta = inscrever(link, lead, codigoDe(aluno));

        assertThat(indicadorGravado(lead)).isEqualTo(aluno);
        // O corpo é o neutro de sempre: nada sobre a indicação.
        assertThat(resposta.propertyNames()).containsExactlyInAnyOrder("mensagem", "proximoQuestionarioCodigo");
        JsonNode detalhe = api.get("/inscricoes/" + idDaInscricao(lead), admin, 200);
        assertThat(detalhe.path("indicadoPorAluno").asString()).isEqualTo(nomeDe(aluno));
        // O texto livre antigo continua separado e vazio.
        assertThat(detalhe.path("indicadoPor").isNull()).isTrue();
        // O resumo da lista não muda: nada de indicador ali.
        JsonNode item = api.get("/inscricoes", admin, 200).path("itens").get(0);
        assertThat(item.has("indicadoPorAluno")).isFalse();
        // Sem o campo, a inscrição segue sem indicador.
        String semCodigo = nomeDeLead();
        inscrever(link, semCodigo, null);
        assertThat(indicadorGravado(semCodigo)).isNull();
        assertThat(api.get("/inscricoes/" + idDaInscricao(semCodigo), admin, 200).path("indicadoPorAluno").isNull()).isTrue();
    }

    @Test
    void codigoQueNaoValeNaoRecusaNemMudaOStatusNemOCorpo() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID indicador = alunoNovo(admin, "Aluna Indicadora");
        JsonNode baseline = inscrever(link, nomeDeLead(), codigoDe(indicador));

        // Outra consultoria, com um aluno e código próprios: o do link nunca o enxerga.
        JsonNode outro = api.novoTreinador();
        UUID alunoDeOutra = alunoNovo(outro, "Aluno Outra");
        UUID inativo = alunoNovo(admin, "Aluna Inativa");
        UUID codigoDoInativo = codigoDe(inativo);
        inativar(admin, inativo);
        UUID anonimizado = alunoNovo(admin, "Aluna Anonimizada");
        UUID codigoAntigoDoAnonimizado = codigoDe(anonimizado);
        anonimizar(admin, anonimizado);

        Map<String, String> casos = new java.util.LinkedHashMap<>();
        casos.put("inexistente", UUID.randomUUID().toString());
        casos.put("malformado", "isto-nao-e-um-uuid");
        casos.put("em branco", "   ");
        casos.put("de outra consultoria", codigoDe(alunoDeOutra).toString());
        casos.put("de aluno inativo", codigoDoInativo.toString());
        casos.put("de anonimizado (código antigo)", codigoAntigoDoAnonimizado.toString());
        casos.put("de anonimizado (código novo)", codigoDe(anonimizado).toString());
        for (var caso : casos.entrySet()) {
            String lead = nomeDeLead();
            JsonNode resposta = inscrever(link, lead, caso.getValue());
            assertThat(resposta).as(caso.getKey()).isEqualTo(baseline);
            assertThat(indicadorGravado(lead)).as(caso.getKey()).isNull();
        }
        // A consultoria dona do aluno não ganhou nenhuma inscrição.
        Integer deOutra = banco.queryForObject("select count(*) from inscricao where consultoria_id = (select consultoria_id from usuario where id = ?::uuid)",
                Integer.class, outro.path("usuario").path("id").asString());
        assertThat(deOutra).isZero();
    }

    @Test
    void detalheDaInscricaoRecortaONomeDeQuemIndicouSemAlunoLer() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        String lead = nomeDeLead();
        inscrever(link, lead, codigoDe(aluno));
        String id = idDaInscricao(lead);

        JsonNode atendente = membroSoDeInscricoes();
        JsonNode recortado = api.get("/inscricoes/" + id, atendente, 200);
        assertThat(recortado.path("indicadoPorAluno").asString()).isEqualTo("Um aluno");
        // Nem o nome, nem o id, nem o código do aluno vão ao detalhe de quem não vê alunos.
        assertThat(recortado.toString()).doesNotContain(nomeDe(aluno)).doesNotContain(aluno.toString())
                .doesNotContain(codigoDe(aluno).toString());
        // Com ALUNO_LER (o administrador), o nome.
        assertThat(api.get("/inscricoes/" + id, admin, 200).path("indicadoPorAluno").asString()).isEqualTo(nomeDe(aluno));
    }

    @Test
    void inscricaoDeOutraConsultoriaDa404() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        String lead = nomeDeLead();
        inscrever(link, lead, codigoDe(aluno));
        JsonNode outro = api.novoTreinador();
        api.get("/inscricoes/" + idDaInscricao(lead), outro, 404);
    }

    // ---- GET /aluno/indicacao ----

    @Test
    void indicacaoDevolveSoOLinkDoProprioAlunoEOMesmoAlunoNuncaVeOutro() throws Exception {
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        JsonNode login = api.convidarEEntrar(admin, aluno);
        // Sem link de inscrição aberto: 404.
        api.get("/aluno/indicacao", login, 404);

        JsonNode config = abrirLink(admin);
        JsonNode resposta = api.get("/aluno/indicacao", login, 200);
        assertThat(resposta.propertyNames()).containsExactly("link");
        assertThat(resposta.path("link").asString())
                .isEqualTo(config.path("link").asString() + "?origem=indicacao#indicacao=" + codigoDe(aluno));

        // Mesmo depois de alguém se inscrever pelo link, a resposta não muda de forma nem traz contagem.
        inscrever(config.path("codigo").asString(), nomeDeLead(), codigoDe(aluno));
        assertThat(api.get("/aluno/indicacao", login, 200)).isEqualTo(resposta);

        // Outro aluno recebe o link com o código dele, nunca o do primeiro.
        UUID outroAluno = alunoNovo(admin, "Aluno Dois");
        JsonNode loginDois = api.convidarEEntrar(admin, outroAluno);
        assertThat(api.get("/aluno/indicacao", loginDois, 200).path("link").asString())
                .endsWith("#indicacao=" + codigoDe(outroAluno)).doesNotContain(codigoDe(aluno).toString());

        // Link fechado: 404 de novo.
        api.put("/inscricoes/configuracao", admin,
                Map.of("aberta", false, "versao", api.get("/inscricoes/configuracao", admin, 200).path("versao").asLong()), 200);
        api.get("/aluno/indicacao", login, 404);
    }

    @Test
    void indicacaoSoParaAlunoAutenticado() throws Exception {
        abrirLink(admin);
        api.get("/aluno/indicacao", admin, 403);
        api.get("/aluno/indicacao", null, 401);
    }

    @Test
    void alunoAnonimizadoRecebe409NoServico() throws Exception {
        abrirLink(admin);
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        anonimizar(admin, aluno);
        // Pela rota a sessão já caiu (401); o 409 é a defesa do serviço contra uma sessão ainda em andamento.
        var eu = new UsuarioAutenticado(UUID.randomUUID(), consultoria, "ALUNO", aluno);
        assertThatThrownBy(() -> TenantContext.executarComo(consultoria, () -> servico.link(eu)))
                .isInstanceOf(ConflictException.class);
    }

    /**
     * Ordem das travas (achado de segurança): o envio grava a inscrição (KEY SHARE na consultoria pela FK) antes de travar o aluno
     * ({@code for share}); a anonimização e o inativar travam consultoria e depois aluno. Com a ordem aluno, consultoria o par fecharia
     * um círculo (40P01) assim que a trava da consultoria fosse {@code for update} de verdade (o Hibernate 7 emite {@code for no key
     * update}, que não bate com KEY SHARE; aqui o pior caso, {@code for update}, prova que a ordem não depende disso).
     */
    @Test
    void envioComIndicacaoEmParaleloComTravaDaConsultoriaEDoAlunoNaoDaImpasse() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        UUID codigo = codigoDe(aluno);
        String lead = nomeDeLead();
        ExecutorService pool = Executors.newSingleThreadExecutor();
        List<Future<JsonNode>> envios = new ArrayList<>();
        try {
            new TransactionTemplate(transacoes).executeWithoutResult(tx -> {
                banco.queryForObject("select id from consultoria where id = ? for update", UUID.class, consultoria);
                envios.add(pool.submit(() -> inscrever(link, lead, codigo)));
                try {
                    assertThat(sessoesEsperandoTrava()).as("o envio espera a consultoria").isTrue();
                    // Com a ordem antiga o envio já segurava o aluno em for share e esta linha esperaria por ele (impasse).
                    banco.queryForObject("select id from aluno where id = ? for update", UUID.class, aluno);
                    assertThat(envios.get(0).isDone()).isFalse();
                } catch (InterruptedException e) {
                    throw new IllegalStateException(e);
                }
            });
            assertThat(envios.get(0).get(30, TimeUnit.SECONDS).path("mensagem").asString()).isNotBlank();
        } finally {
            pool.shutdownNow();
        }
        assertThat(indicadorGravado(lead)).isEqualTo(aluno);
        // O evento CRIADA do histórico e o detalhe seguem com a indicação.
        assertThat(api.get("/inscricoes/" + idDaInscricao(lead), admin, 200).path("indicadoPorAluno").asString())
                .isEqualTo(nomeDe(aluno));
    }

    private boolean sessoesEsperandoTrava() throws InterruptedException {
        long limite = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        while (System.nanoTime() < limite) {
            Integer esperando = banco.queryForObject("select count(*) from pg_stat_activity where datname = current_database() "
                    + "and wait_event_type = 'Lock'", Integer.class);
            if (esperando != null && esperando >= 1) {
                return true;
            }
            Thread.sleep(100);
        }
        return false;
    }

    // ---- LGPD ----

    @Test
    void anonimizarZeraOVinculoDasInscricoesIndicadasETrocaOCodigo() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        UUID codigoAntigo = codigoDe(aluno);
        String lead = nomeDeLead();
        inscrever(link, lead, codigoAntigo);
        assertThat(indicadorGravado(lead)).isEqualTo(aluno);

        anonimizar(admin, aluno);

        assertThat(indicadorGravado(lead)).isNull();
        assertThat(codigoDe(aluno)).isNotNull().isNotEqualTo(codigoAntigo);
        assertThat(api.get("/inscricoes/" + idDaInscricao(lead), admin, 200).path("indicadoPorAluno").isNull()).isTrue();
        // O link antigo morreu: a inscrição nova com o código antigo fica sem indicador.
        String depois = nomeDeLead();
        inscrever(link, depois, codigoAntigo);
        assertThat(indicadorGravado(depois)).isNull();
    }

    @Test
    void excluirMinhaContaFazOMesmo() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        JsonNode login = api.convidarEEntrar(admin, aluno);
        UUID codigoAntigo = codigoDe(aluno);
        String lead = nomeDeLead();
        inscrever(link, lead, codigoAntigo);
        assertThat(indicadorGravado(lead)).isEqualTo(aluno);

        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        assertThat(indicadorGravado(lead)).isNull();
        assertThat(codigoDe(aluno)).isNotEqualTo(codigoAntigo);
    }

    @Test
    void exportacaoDoAlunoLevaSoOProprioCodigoSemListaDeIndicados() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        String lead = nomeDeLead();
        inscrever(link, lead, codigoDe(aluno));

        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        assertThat(dados.path("indicacao").propertyNames()).containsExactly("codigoIndicacao");
        assertThat(dados.path("indicacao").path("codigoIndicacao").asString()).isEqualTo(codigoDe(aluno).toString());
        // Quem ele indicou é dado de terceiros: nem o nome, nem a inscrição vão no arquivo.
        assertThat(dados.toString()).doesNotContain(lead);
        // A ficha comum da equipe não traz o código.
        assertThat(api.get("/alunos/" + aluno, admin, 200).toString()).doesNotContain(codigoDe(aluno).toString());
    }

    @Test
    void exportacaoDoAlunoQueVeioDaInscricaoIndicadaNaoTrazONomeDoIndicador() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID indicador = alunoNovo(admin, "Aluna Indicadora");
        String lead = nomeDeLead();
        inscrever(link, lead, codigoDe(indicador));
        String id = idDaInscricao(lead);
        UUID novoAluno = UUID.fromString(api.post("/inscricoes/" + id + "/aceitar", admin,
                Map.of("convidar", false, "versao", api.get("/inscricoes/" + id, admin, 200).path("versao").asLong(),
                        "semCobranca", true), 200)
                .path("alunoId").asString());

        String dados = api.get("/alunos/" + novoAluno + "/exportacao", admin, 200).toString();

        // A inscrição dele vai no arquivo (é dado dele), mas quem indicou é dado de terceiro.
        assertThat(dados).contains(lead).doesNotContain(nomeDe(indicador)).doesNotContain(indicador.toString())
                .doesNotContain(codigoDe(indicador).toString());
    }

    @Test
    void exportacaoDeAlunoAnonimizadoOmiteASecaoDeIndicacao() throws Exception {
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        anonimizar(admin, aluno);

        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", admin, 200);

        assertThat(dados.path("indicacao").isNull() || dados.path("indicacao").isMissingNode()).isTrue();
        assertThat(dados.path("secoesOmitidas").toString()).contains("indicacao");
        assertThat(dados.toString()).doesNotContain(codigoDe(aluno).toString());
    }

    @Test
    void excluirOAlunoDeVerdadeAnulaSoAColunaDoIndicador() throws Exception {
        String link = abrirLink(admin).path("codigo").asString();
        UUID aluno = alunoNovo(admin, "Aluna Indicadora");
        String lead = nomeDeLead();
        inscrever(link, lead, codigoDe(aluno));

        banco.update("delete from aluno where id = ?", aluno);

        // O SET NULL é só de indicado_por_aluno_id: a inscrição continua na consultoria dela.
        List<Map<String, Object>> linhas = banco.queryForList(
                "select consultoria_id, indicado_por_aluno_id from inscricao where nome = ?", lead);
        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("consultoria_id")).isEqualTo(consultoria);
        assertThat(linhas.get(0).get("indicado_por_aluno_id")).isNull();
    }
}
