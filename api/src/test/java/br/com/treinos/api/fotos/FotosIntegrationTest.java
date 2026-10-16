package br.com.treinos.api.fotos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.MinioDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.awt.Color;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Fotos da atualização contra um MinIO de teste. Só quadrados coloridos gerados na hora, nenhuma imagem de pessoa. */
@AutoConfigureMockMvc
class FotosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private FotosManutencao manutencao;
    @Autowired private FotoRemocaoRepositorio fila;
    @Autowired private FotosProperties propriedades;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode loginAluno;
    private UUID aluno;
    private String pasta;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Fotos");
        loginAluno = api.convidarEEntrar(treinador, aluno);
        pasta = publicarPasta(LocalDate.now(Fuso.BRASILIA));
    }

    // ---- apoio ----

    private String publicarPasta(LocalDate fim) throws Exception {
        String nova = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", nova), 200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return nova;
    }

    private MvcResult subirBruto(JsonNode login, String pastaId, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "qualquer-nome.jpg", "image/jpeg", bytes))
                        .param("pastaId", pastaId)
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private UUID subir(byte[] bytes) throws Exception {
        MvcResult r = subirBruto(loginAluno, pasta, bytes, 200);
        return UUID.fromString(api.ler(r).path("id").asString());
    }

    private UUID subirCor(Color cor) throws Exception {
        return subir(FotosDeTeste.jpeg(cor));
    }

    private MvcResult ver(String caminho, JsonNode login, int esperado) throws Exception {
        var req = get(caminho).header("X-Treinos-Cliente", "nativo");
        if (login != null) {
            req.header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        }
        return mvc.perform(req).andExpect(status().is(esperado)).andReturn();
    }

    private Map<String, Object> respostas(UUID... fotos) {
        Map<String, Object> r = new LinkedHashMap<>(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6));
        if (fotos.length > 0) {
            r.put("fotos", java.util.Arrays.stream(fotos).map(UUID::toString).toList());
        }
        return r;
    }

    private JsonNode enviar(Map<String, Object> respostas, int esperado) throws Exception {
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        return api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", atual.path("pastaId").asString(),
                "questionarioVersaoId", atual.path("questionarioVersaoId").asString(), "respostas", respostas), esperado);
    }

    private int naFila(UUID objeto) {
        return banco.queryForObject("select count(*) from foto_remocao where objeto = ?", Integer.class, objeto);
    }

    /** A fila é de todos os testes; deixa o objeto desta vez vencido e roda o job até ele sair (o lote é de 50). */
    private void esvaziarAte(UUID objeto) {
        banco.update("update foto_remocao set proxima_tentativa = now() - interval '1 second' where objeto = ?", objeto);
        for (int i = 0; i < 20 && naFila(objeto) > 0; i++) {
            manutencao.esvaziarFila();
        }
    }

    /** Consultoria da foto, como o banco a guarda (é daí que sai o prefixo do objeto no bucket). */
    private UUID consultoriaDe(UUID foto) {
        return banco.queryForObject("select consultoria_id from atualizacao_foto where id = ?", UUID.class, foto);
    }

    /** Chave esperada do objeto da foto no bucket. */
    private String chave(UUID foto) {
        return MinioDeTeste.chave(consultoriaDe(foto), foto);
    }

    private Map<String, Object> linha(UUID foto) {
        return banco.queryForMap("select * from atualizacao_foto where id = ?", foto);
    }

    // ---- fluxo completo ----

    @Test
    void sobeSemMetadadosLigaNoEnvioEOsDoisLadosVeemSoPorAPI() throws Exception {
        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.RED));
        UUID foto = subir(suja);

        // O que está no bucket foi reescrito: sem EXIF, GPS, comentário nem o nome do arquivo; o objeto se chama consultorias/<consultoria>/fotos/<foto>.jpg, só UUIDs.
        byte[] guardado = MinioDeTeste.ler(chave(foto));
        assertThat(FotosDeTeste.contem(guardado, "Exif")).isFalse();
        assertThat(FotosDeTeste.contem(guardado, FotosDeTeste.MARCA_EXIF)).isFalse();
        assertThat(FotosDeTeste.contem(guardado, "qualquer-nome")).isFalse();
        assertThat(JpegSemMetadados.temMetadados(guardado)).isFalse();
        assertThat(MinioDeTeste.chaves()).contains(chave(foto)).allSatisfy(chave -> assertThat(chave).matches(
                "consultorias/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/fotos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg"));
        assertThat(linha(foto).get("atualizacao_id")).as("pendente até o envio").isNull();

        // O aluno vê a própria foto, sem cache.
        MvcResult doAluno = ver("/aluno/fotos/" + foto, loginAluno, 200);
        assertThat(doAluno.getResponse().getContentType()).isEqualTo("image/jpeg");
        assertThat(doAluno.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(doAluno.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(doAluno.getResponse().getContentAsByteArray()).isEqualTo(guardado);

        // O envio liga a foto à resposta e à atualização, na mesma transação.
        JsonNode enviada = enviar(respostas(foto), 200);
        assertThat(enviada.path("respostas").path("fotos")).hasSize(1);
        assertThat(enviada.path("respostas").path("fotos").get(0).asString()).isEqualTo(foto.toString());
        Map<String, Object> ligada = linha(foto);
        assertThat(ligada.get("atualizacao_id").toString()).isEqualTo(enviada.path("id").asString());
        assertThat(ligada.get("pergunta_id")).isEqualTo("fotos");
        assertThat(ligada.get("ligada_em")).isNotNull();

        // O treinador vê pela atualização, nunca por link direto.
        String caminho = "/atualizacoes/" + enviada.path("id").asString() + "/fotos/" + foto;
        MvcResult doTreinador = ver(caminho, treinador, 200);
        assertThat(doTreinador.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(doTreinador.getResponse().getContentAsByteArray()).isEqualTo(guardado);
        ver(caminho, null, 401);
        // A foto só vale pela atualização a que pertence.
        ver("/atualizacoes/" + UUID.randomUUID() + "/fotos/" + foto, treinador, 404);
        // O aluno não apaga a foto de uma atualização já enviada.
        assertThat(api.delete("/aluno/fotos/" + foto, loginAluno, 409).path("codigo").asString()).isEqualTo("FOTO_JA_ENVIADA");
        assertThat(MinioDeTeste.existe(chave(foto))).isTrue();
    }

    @Test
    void reenvioDaAtualizacaoNaoLigaDeNovoNemMudaAFoto() throws Exception {
        UUID foto = subirCor(Color.BLUE);
        JsonNode primeira = enviar(respostas(foto), 200);
        Object ligadaEm = linha(foto).get("ligada_em");
        JsonNode repetida = enviar(respostas(foto), 200);
        assertThat(repetida.path("id").asString()).isEqualTo(primeira.path("id").asString());
        assertThat(linha(foto).get("ligada_em")).isEqualTo(ligadaEm);
    }

    @Test
    void treinadorSemAsDuasPermissoesNaoVeAFoto() throws Exception {
        UUID foto = subirCor(Color.GREEN);
        JsonNode enviada = enviar(respostas(foto), 200);
        String caminho = "/atualizacoes/" + enviada.path("id").asString() + "/fotos/" + foto;
        // ATUALIZACAO_LER já exige ALUNO_SENSIVEL_LER; quem tem só os dados do aluno não vê foto.
        for (Set<String> permissoes : List.of(Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER"), Set.of("ALUNO_LER"))) {
            ver(caminho, membro(permissoes), 403);
        }
        ver(caminho, membro(Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER")), 200);
        // O próprio aluno não usa a rota do treinador.
        ver(caminho, loginAluno, 403);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/" + convite.get("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    // ---- isolamento ----

    @Test
    void outraConsultoriaEOutroAlunoRecebem404() throws Exception {
        UUID foto = subirCor(Color.ORANGE);
        JsonNode enviada = enviar(respostas(foto), 200);
        String caminho = "/atualizacoes/" + enviada.path("id").asString() + "/fotos/" + foto;

        JsonNode outroTreinador = api.novoTreinador();
        ver(caminho, outroTreinador, 404);

        UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício");
        JsonNode loginOutro = api.convidarEEntrar(treinador, outro);
        ver("/aluno/fotos/" + foto, loginOutro, 404);
        api.delete("/aluno/fotos/" + foto, loginOutro, 404);

        // Nem subir para a pasta de outro aluno, nem ligar foto de outro aluno à própria atualização.
        subirBruto(loginOutro, pasta, FotosDeTeste.jpeg(Color.RED), 404);
        JsonNode atualOutro = api.get("/aluno/atualizacao", loginOutro, 200);
        assertThat(atualOutro.path("pastaId").isMissingNode() || atualOutro.path("pastaId").isNull()).isTrue();
    }

    @Test
    void naoLigaFotoDeOutroAlunoNemInexistenteNemRemovidaENadaFicaEnviado() throws Exception {
        UUID doOutro;
        {
            UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício 2");
            JsonNode loginOutro = api.convidarEEntrar(treinador, outro);
            String pastaOutro = api.post("/alunos/" + outro + "/pastas", treinador,
                    Map.of("titulo", "Pasta do outro", "inicio", LocalDate.now(Fuso.BRASILIA).minusDays(27), "fim",
                            LocalDate.now(Fuso.BRASILIA)), 200).path("id").asString();
            doOutro = UUID.fromString(api.ler(subirBruto(loginOutro, pastaOutro, FotosDeTeste.jpeg(Color.CYAN), 200)).path("id").asString());
        }
        JsonNode erro = enviar(respostas(doOutro), 422);
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("fotos");
        enviar(respostas(UUID.randomUUID()), 422);

        UUID removida = subirCor(Color.MAGENTA);
        api.delete("/aluno/fotos/" + removida, loginAluno, 204);
        enviar(respostas(removida), 422);

        // Nenhuma tentativa deixou a atualização como enviada.
        assertThat(api.get("/aluno/atualizacao", loginAluno, 200).path("fase").asString()).isNotEqualTo("ENVIADA");
        assertThat(linha(doOutro).get("atualizacao_id")).isNull();
    }

    @Test
    void respostaComFotosForaDoFormatoOuAcimaDoLimiteDa422() throws Exception {
        List<UUID> sete = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            sete.add(UUID.randomUUID());
        }
        Map<String, Object> r = respostas();
        r.put("fotos", sete.stream().map(UUID::toString).toList());
        enviar(r, 422);
        r.put("fotos", List.of("nao-e-uuid"));
        enviar(r, 422);
        r.put("fotos", "uma-string");
        enviar(r, 422);
        UUID repetida = UUID.randomUUID();
        r.put("fotos", List.of(repetida.toString(), repetida.toString().toUpperCase(java.util.Locale.ROOT)));
        enviar(r, 422);
    }

    // ---- o que sobe ----

    @Test
    void recusaOQueNaoEJpegEFotoMaiorQueOLimite() throws Exception {
        byte[] png = new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13};
        assertThat(api.ler(subirBruto(loginAluno, pasta, png, 422)).path("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        subirBruto(loginAluno, pasta, html, 422);
        subirBruto(loginAluno, pasta, new byte[0], 422);

        byte[] base = FotosDeTeste.jpeg(Color.RED);
        // Exatamente no limite: passa (e o multipart de 1 MiB comporta, sem 413).
        UUID noLimite = UUID.fromString(api.ler(subirBruto(loginAluno, pasta,
                FotosDeTeste.engordado(base, FotoService.BYTES_MAXIMO), 200)).path("id").asString());
        assertThat(MinioDeTeste.ler(chave(noLimite)).length).isLessThan(base.length + 100);
        // Um byte acima: 422 com o código próprio.
        assertThat(api.ler(subirBruto(loginAluno, pasta, FotosDeTeste.engordado(base, FotoService.BYTES_MAXIMO + 1), 422))
                .path("codigo").asString()).isEqualTo("FOTO_GRANDE_DEMAIS");
        // Nada ficou reservado para o que foi recusado.
        assertThat(banco.queryForObject("select count(*) from atualizacao_foto where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);
    }

    @Test
    void limiteDeFotosPorDiaContaAsRemovidasTambem() throws Exception {
        byte[] foto = FotosDeTeste.jpeg(Color.RED);
        List<UUID> subidas = new ArrayList<>();
        for (int i = 0; i < FotoService.POR_DIA; i++) {
            subidas.add(subir(foto));
        }
        assertThat(api.ler(subirBruto(loginAluno, pasta, foto, 422)).path("codigo").asString()).isEqualTo("FOTOS_LIMITE_DIARIO");
        // Apagar uma não abre vaga: senão dava para subir e apagar sem fim.
        api.delete("/aluno/fotos/" + subidas.get(0), loginAluno, 204);
        subirBruto(loginAluno, pasta, foto, 422);
        // Passadas 24 h, volta a aceitar.
        banco.update("update atualizacao_foto set criada_em = now() - interval '25 hours' where aluno_id = ?", aluno);
        subir(foto);
    }

    // ---- remoção ----

    @Test
    void removerPendenteEnfileiraEOWorkerApagaNoBucket() throws Exception {
        UUID foto = subirCor(Color.RED);
        assertThat(MinioDeTeste.existe(chave(foto))).isTrue();

        api.delete("/aluno/fotos/" + foto, loginAluno, 204);
        ver("/aluno/fotos/" + foto, loginAluno, 404);
        // Repetir é inofensivo.
        api.delete("/aluno/fotos/" + foto, loginAluno, 204);
        assertThat(naFila(foto)).isEqualTo(1);
        assertThat(MinioDeTeste.existe(chave(foto))).as("o HTTP de apagar roda fora da transação, no job").isTrue();

        esvaziarAte(foto);
        assertThat(MinioDeTeste.existe(chave(foto))).isFalse();
        assertThat(naFila(foto)).isZero();
    }

    @Test
    void cadaConsultoriaGuardaSobOSeuPrefixoEAFilaLevaAConsultoria() throws Exception {
        UUID minha = subirCor(Color.RED);

        // Outra consultoria, com o próprio aluno: a foto dela vai para outro prefixo e a minha continua só minha.
        JsonNode outroTreinador = api.novoTreinador();
        UUID outroAluno = api.criarAluno(outroTreinador, "Aluno Fictício Outra Consultoria");
        JsonNode loginOutro = api.convidarEEntrar(outroTreinador, outroAluno);
        String pastaOutra = api.post("/alunos/" + outroAluno + "/pastas", outroTreinador,
                Map.of("titulo", "Pasta da outra", "inicio", LocalDate.now(Fuso.BRASILIA).minusDays(27), "fim",
                        LocalDate.now(Fuso.BRASILIA)), 200).path("id").asString();
        UUID dela = UUID.fromString(api.ler(subirBruto(loginOutro, pastaOutra, FotosDeTeste.jpeg(Color.CYAN), 200)).path("id").asString());

        assertThat(consultoriaDe(minha)).isNotEqualTo(consultoriaDe(dela));
        assertThat(chave(minha)).startsWith("consultorias/" + consultoriaDe(minha) + "/fotos/").endsWith("/" + minha + ".jpg");
        assertThat(chave(dela)).startsWith("consultorias/" + consultoriaDe(dela) + "/fotos/").endsWith("/" + dela + ".jpg");
        assertThat(MinioDeTeste.chaves()).contains(chave(minha), chave(dela));
        // Ler pela API nunca atravessa o prefixo: a foto de uma consultoria não abre pela outra.
        ver("/aluno/fotos/" + dela, loginAluno, 404);
        ver("/aluno/fotos/" + minha, loginOutro, 404);

        // A fila guarda a consultoria do banco e apaga exatamente o objeto daquele prefixo.
        api.delete("/aluno/fotos/" + dela, loginOutro, 204);
        assertThat(banco.queryForObject("select consultoria_id from foto_remocao where objeto = ?", UUID.class, dela))
                .isEqualTo(consultoriaDe(dela));
        esvaziarAte(dela);
        assertThat(MinioDeTeste.existe(chave(dela))).isFalse();
        assertThat(MinioDeTeste.existe(chave(minha))).isTrue();
    }

    @Test
    void falhaAoApagarMantemNaFilaComEsperaCrescenteEDepoisConsegue() throws Exception {
        UUID foto = subirCor(Color.RED);
        api.delete("/aluno/fotos/" + foto, loginAluno, 204);
        banco.update("update foto_remocao set proxima_tentativa = now() - interval '1 second' where objeto = ?", foto);

        var fabrica = new DefaultListableBeanFactory();
        fabrica.registerSingleton("fora-do-ar", new ArmazenamentoDeFotos() {
            @Override public void gravar(String chave, byte[] jpeg) { throw new IllegalStateException("fora do ar"); }
            @Override public byte[] ler(String chave) { throw new IllegalStateException("fora do ar"); }
            @Override public void apagar(String chave) { throw new IllegalStateException("fora do ar"); }
        });
        var comFalha = new FotosManutencao(fila, fabrica.getBeanProvider(ArmazenamentoDeFotos.class), propriedades, transacoes);
        try {
            assertThat(comFalha.esvaziarFila()).isZero();
            Map<String, Object> pendente = banco.queryForMap("select tentativas, proxima_tentativa > now() as adiada from foto_remocao where objeto = ?", foto);
            assertThat(pendente.get("tentativas")).isEqualTo(1);
            assertThat(pendente.get("adiada")).isEqualTo(true);
            assertThat(MinioDeTeste.existe(chave(foto))).isTrue();
            // Ainda dentro da espera: nem tenta.
            assertThat(comFalha.esvaziarFila()).isZero();
            assertThat(banco.queryForObject("select tentativas from foto_remocao where objeto = ?", Integer.class, foto)).isEqualTo(1);
        } finally {
            // A tentativa com falha adiou também itens de outros testes; devolve todos ao presente.
            banco.update("update foto_remocao set proxima_tentativa = now() - interval '1 second'");
        }
        esvaziarAte(foto);
        assertThat(MinioDeTeste.existe(chave(foto))).isFalse();
    }

    @Test
    void pendenteQueNinguemLigouEApagadaDepoisDe24hEAsLigadasFicam() throws Exception {
        UUID velha = subirCor(Color.RED);
        UUID recente = subirCor(Color.BLUE);
        UUID ligada = subirCor(Color.GREEN);
        enviar(respostas(ligada), 200);
        banco.update("update atualizacao_foto set criada_em = now() - interval '25 hours' where id in (?, ?)", velha, ligada);

        manutencao.limparPendentesEAntigas();

        assertThat(linha(velha).get("removida_em")).isNotNull();
        assertThat(naFila(velha)).isEqualTo(1);
        assertThat(linha(recente).get("removida_em")).isNull();
        assertThat(linha(ligada).get("removida_em")).isNull();
        assertThat(naFila(ligada)).isZero();
        esvaziarAte(velha);
        assertThat(MinioDeTeste.existe(chave(velha))).isFalse();
        assertThat(MinioDeTeste.existe(chave(recente))).isTrue();
        assertThat(MinioDeTeste.existe(chave(ligada))).isTrue();
        // A foto removida deixa de ser servida.
        ver("/aluno/fotos/" + velha, loginAluno, 404);
    }

    @Test
    void linhasRemovidasHaDiasSaemDaTabelaMasAsRecentesFicamParaOLimiteDoDia() throws Exception {
        UUID antiga = subirCor(Color.RED);
        UUID recente = subirCor(Color.BLUE);
        api.delete("/aluno/fotos/" + antiga, loginAluno, 204);
        api.delete("/aluno/fotos/" + recente, loginAluno, 204);
        banco.update("update atualizacao_foto set criada_em = now() - interval '3 days', removida_em = now() - interval '3 days' where id = ?", antiga);

        manutencao.limparPendentesEAntigas();

        assertThat(banco.queryForObject("select count(*) from atualizacao_foto where id = ?", Integer.class, antiga)).isZero();
        assertThat(banco.queryForObject("select count(*) from atualizacao_foto where id = ?", Integer.class, recente)).isEqualTo(1);
    }

    // ---- LGPD ----

    @Test
    void exportacaoListaSoMetadadosEAnonimizarApagaAsFotosPelaFila() throws Exception {
        UUID enviada = subirCor(Color.RED);
        UUID pendente = subirCor(Color.BLUE);
        enviar(respostas(enviada), 200);

        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", treinador, 200);
        JsonNode fotos = dados.path("atualizacoes").path("itens").get(0).path("fotos");
        assertThat(fotos).hasSize(1);
        assertThat(fotos.get(0).path("perguntaId").asString()).isEqualTo("fotos");
        assertThat(fotos.get(0).path("enviadaEm").isNull()).isFalse();
        assertThat(List.copyOf(fotos.get(0).propertyNames())).containsExactlyInAnyOrder("perguntaId", "enviadaEm");
        // Nem bytes nem o nome do arquivo (o id da foto aparece só na resposta do próprio aluno).
        assertThat(dados.toString()).doesNotContain("qualquer-nome");

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício Fotos"), 200);

        // Esvaziar a fila leva as duas de uma vez (o lote é de 50): confere as duas antes de rodar o job.
        for (UUID foto : List.of(enviada, pendente)) {
            assertThat(linha(foto).get("removida_em")).isNotNull();
            assertThat(naFila(foto)).isEqualTo(1);
        }
        esvaziarAte(enviada);
        for (UUID foto : List.of(enviada, pendente)) {
            esvaziarAte(foto);
            assertThat(MinioDeTeste.existe(chave(foto))).isFalse();
        }
        String atualizacaoId = banco.queryForObject("select id::text from atualizacao where aluno_id = ?", String.class, aluno);
        ver("/atualizacoes/" + atualizacaoId + "/fotos/" + enviada, treinador, 404);
    }
}
