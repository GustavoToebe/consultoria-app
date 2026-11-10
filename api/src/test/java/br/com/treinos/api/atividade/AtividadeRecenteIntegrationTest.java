package br.com.treinos.api.atividade;

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

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Atividade recente da ficha ({@code GET /alunos/{id}/atividade-recente}). Dados fictícios; os fatos entram direto no banco
 * com instantes conhecidos (a ordem e o corte não dependem do relógio) e cada teste filtra pelo aluno que criou.
 */
@AutoConfigureMockMvc
class AtividadeRecenteIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private UUID consultoria;
    private UUID usuarioAdmin;
    /** Um dia atrás: todos os fatos do teste ficam antes de "agora" e em minutos conhecidos. */
    private final Instant base = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

    @BeforeEach void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício Atividade " + UUID.randomUUID());
        consultoria = banco.queryForObject("select consultoria_id from aluno where id=?", UUID.class, aluno);
        usuarioAdmin = UUID.fromString(admin.path("usuario").path("id").asString());
    }

    private Instant aos(int minutos) { return base.plus(minutos, ChronoUnit.MINUTES); }
    private String caminho() { return "/alunos/" + aluno + "/atividade-recente"; }

    private JsonNode membroSoCom(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private UUID pasta(LocalDate fim) {
        UUID id = UUID.randomUUID();
        banco.update("insert into pasta_plano(id,consultoria_id,aluno_id,titulo,inicio,fim) values (?,?,?,'Período fictício',?,?)",
                id, consultoria, aluno, fim.minusDays(27), fim);
        return id;
    }

    /** Versão do questionário que toda atualização enviada do teste aponta (o banco exige no envio). */
    private UUID versaoDoQuestionario() {
        List<UUID> existente = banco.queryForList("select id from questionario_versao where consultoria_id = ?", UUID.class, consultoria);
        if (!existente.isEmpty()) return existente.get(0);
        UUID questionario = UUID.randomUUID(), versao = UUID.randomUUID();
        banco.update("insert into questionario(id,consultoria_id,nome,rascunho,versao_publicada,publicado_em) values (?,?,?,'{}'::jsonb,1,now())",
                questionario, consultoria, "Questionário fictício " + questionario);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) values (?,?,?,1,'{\"formato\":2,\"instrucoes\":[],\"secoes\":[]}'::jsonb)",
                versao, consultoria, questionario);
        return versao;
    }

    /** Atualização enviada num instante conhecido, uma pasta para ela (a atualização é única por pasta). */
    private UUID atualizacao(LocalDate data, Instant enviadaEm, String estado) {
        UUID pasta = pasta(data), id = UUID.randomUUID();
        banco.update("insert into atualizacao(id,consultoria_id,aluno_id,pasta_id,data_atualizacao,estado,respostas,enviada_em,questionario_versao_id) "
                + "values (?,?,?,?,?,?,'{\"texto\":\"Resposta fictícia\"}'::jsonb,?,?)",
                id, consultoria, aluno, pasta, data, estado, enviadaEm == null ? null : Timestamp.from(enviadaEm),
                enviadaEm == null ? null : versaoDoQuestionario());
        return id;
    }

    /** Versão publicada (tabela do plano + da versão) do aluno, opcionalmente numa pasta, publicada no instante dado. */
    private UUID planoPublicado(String tabelaDoPlano, UUID pasta, Instant publicadoEm) {
        UUID plano = UUID.randomUUID(), versao = UUID.randomUUID();
        banco.update("insert into " + tabelaDoPlano + "(id,consultoria_id,aluno_id,titulo,rascunho,pasta_id,publicado_em,versao_publicada) "
                + "values (?,?,?,'Título fictício','{}'::jsonb,?,?,1)", plano, consultoria, aluno, pasta, Timestamp.from(publicadoEm));
        banco.update("insert into " + tabelaDoPlano + "_versao(id,consultoria_id,plano_id,numero,titulo,conteudo,publicado_em,publicado_por) "
                + "values (?,?,?,1,'Título fictício','{}'::jsonb,?,?)", versao, consultoria, plano, Timestamp.from(publicadoEm), usuarioAdmin);
        return versao;
    }

    private UUID treinoConcluido(UUID versaoDoTreino, boolean concluida, String situacao, Instant gravadaEm) {
        UUID id = UUID.randomUUID();
        banco.update("insert into sessao_concluida(id,consultoria_id,aluno_id,plano_versao_id,sessao_uid,data,concluida,resultado,"
                + "situacao,alterado_no_aparelho_em,atualizado_em) values (?,?,?,?,?,?,?,?,?,?,?)",
                id, consultoria, aluno, versaoDoTreino, UUID.randomUUID(), LocalDate.of(2026, 6, 1), concluida, concluida ? "COMPLETA" : null,
                situacao, Timestamp.from(gravadaEm), Timestamp.from(gravadaEm));
        return id;
    }

    private void peso(LocalDate data, String quantosKg, UUID registradoPor, Instant criadoEm, UUID importacao) {
        banco.update("insert into registro_peso(id,consultoria_id,aluno_id,data,peso_kg,registrado_por,criado_em,importacao_id) values (?,?,?,?,?::numeric,?,?,?)",
                UUID.randomUUID(), consultoria, aluno, data, quantosKg, registradoPor, Timestamp.from(criadoEm), importacao);
    }

    private static List<String> tipos(JsonNode resposta) {
        return resposta.path("itens").valueStream().map(i -> i.path("tipo").asString()).toList();
    }

    @Test void semNadaDevolveListaVazia() throws Exception {
        JsonNode r = api.get(caminho(), admin, 200);
        assertThat(r.path("itens").isArray()).isTrue();
        assertThat(r.path("itens")).isEmpty();
    }

    @Test void trazOsQuatroTiposDoMaisNovoAoMaisAntigoComTituloFixoEDestino() throws Exception {
        UUID pasta = pasta(LocalDate.of(2026, 6, 1));
        UUID atualizacao = atualizacao(LocalDate.of(2026, 3, 1), aos(10), "ENVIADA");
        UUID versaoDoTreino = planoPublicado("plano_treino", pasta, aos(30));
        treinoConcluido(versaoDoTreino, true, "ACEITO", aos(20));
        planoPublicado("plano_dieta", null, aos(40));
        planoPublicado("plano_mobilidade", pasta, aos(25));
        peso(LocalDate.of(2026, 3, 2), "81.40", usuarioAdmin, aos(50), null);

        JsonNode itens = api.get(caminho() + "?limite=20", admin, 200).path("itens");
        assertThat(tipos(api.get(caminho() + "?limite=20", admin, 200)))
                .containsExactly("PESO_REGISTRADO", "PLANO_PUBLICADO", "PLANO_PUBLICADO", "PLANO_PUBLICADO", "TREINO_CONCLUIDO", "ATUALIZACAO_ENVIADA");
        assertThat(itens.valueStream().map(i -> i.path("titulo").asString()).toList()).containsExactly(
                "Peso registrado", "Dieta publicada", "Treino publicado", "Mobilidade publicada", "Treino concluído", "Atualização enviada");
        assertThat(itens.valueStream().map(i -> Instant.parse(i.path("quando").asString())).toList())
                .containsExactly(aos(50), aos(40), aos(30), aos(25), aos(20), aos(10));
        // Destino só quando existe tela de detalhe: a atualização e a pasta; dieta sem pasta, treino concluído e peso não têm.
        assertThat(itens.get(0).path("destino").isNull()).isTrue();
        assertThat(itens.get(1).path("destino").isNull()).isTrue();
        assertThat(itens.get(2).path("destino").path("tipo").asString()).isEqualTo("PASTA");
        assertThat(itens.get(2).path("destino").path("id").asString()).isEqualTo(pasta.toString());
        assertThat(itens.get(4).path("destino").isNull()).isTrue();
        assertThat(itens.get(5).path("destino").path("tipo").asString()).isEqualTo("ATUALIZACAO");
        assertThat(itens.get(5).path("destino").path("id").asString()).isEqualTo(atualizacao.toString());
        // O feed só carrega o fato: nada de peso, resposta ou conteúdo.
        assertThat(itens.toString()).doesNotContain("81.4").doesNotContain("Resposta fictícia").doesNotContain("Título fictício");
    }

    @Test void limitePadraoCincoMaximoVinteECorteNoServidor() throws Exception {
        for (int i = 0; i < 25; i++) planoPublicado("plano_treino", null, aos(i));
        assertThat(api.get(caminho(), admin, 200).path("itens")).hasSize(5);
        assertThat(api.get(caminho() + "?limite=3", admin, 200).path("itens")).hasSize(3);
        assertThat(api.get(caminho() + "?limite=20", admin, 200).path("itens")).hasSize(20);
        assertThat(api.get(caminho() + "?limite=500", admin, 200).path("itens")).hasSize(20);
        assertThat(api.get(caminho() + "?limite=0", admin, 200).path("itens")).hasSize(1);
        assertThat(api.get(caminho() + "?limite=-7", admin, 200).path("itens")).hasSize(1);
        // Os mais novos primeiro: o corte nunca tira o mais recente.
        assertThat(Instant.parse(api.get(caminho() + "?limite=1", admin, 200).path("itens").get(0).path("quando").asString()))
                .isEqualTo(aos(24));
        // Limite que não é número: erro do cliente, nunca 500.
        api.get(caminho() + "?limite=abc", admin, 400);
    }

    @Test void atualizacaoComPesoEFotoDoMesmoEnvioViraUmItemSo() throws Exception {
        JsonNode login = api.convidarEEntrar(admin, aluno);
        UUID usuarioDoAluno = UUID.fromString(login.path("usuario").path("id").asString());
        LocalDate data = LocalDate.of(2026, 4, 10);
        UUID atualizacao = atualizacao(data, aos(10), "REVISADA");
        UUID pasta = banco.queryForObject("select pasta_id from atualizacao where id = ?", UUID.class, atualizacao);
        // O peso e a foto que vieram no envio (peso gravado pelo usuário do aluno, na data da atualização).
        peso(data, "80.00", usuarioDoAluno, aos(10), null);
        banco.update("insert into atualizacao_foto(id,consultoria_id,aluno_id,pasta_id,atualizacao_id,pergunta_id,tamanho) values (?,?,?,?,?,'fotos',1000)",
                UUID.randomUUID(), consultoria, aluno, pasta, atualizacao);
        // Peso que o aluno gravou na anamnese: sem atualização na data, mas também é do aluno.
        peso(LocalDate.of(2026, 4, 1), "79.00", usuarioDoAluno, aos(5), null);

        JsonNode r = api.get(caminho() + "?limite=20", admin, 200);
        assertThat(tipos(r)).containsExactly("ATUALIZACAO_ENVIADA");
        assertThat(r.path("itens").get(0).path("destino").path("id").asString()).isEqualTo(atualizacao.toString());
    }

    @Test void atualizacaoAbertaNaoEntra() throws Exception {
        atualizacao(LocalDate.of(2026, 5, 1), null, "ABERTA");
        assertThat(api.get(caminho(), admin, 200).path("itens")).isEmpty();
    }

    @Test void pesoLancadoPeloTreinadorApareceSozinhoEOImportadoOuDeDiaDeAtualizacaoNao() throws Exception {
        // Pelo caminho real: o treinador lança o peso e a linha ganha o instante da criação.
        api.post("/alunos/" + aluno + "/pesos", admin, Map.of("data", LocalDate.of(2026, 2, 1).toString(), "pesoKg", 82.5), 200);
        JsonNode r = api.get(caminho(), admin, 200);
        assertThat(tipos(r)).containsExactly("PESO_REGISTRADO");
        assertThat(r.path("itens").get(0).path("titulo").asString()).isEqualTo("Peso registrado");
        assertThat(r.toString()).doesNotContain("82.5");
        // Importado da planilha (todos nascem no instante da importação) não vira evento...
        UUID importacao = UUID.randomUUID();
        banco.update("insert into importacao(id,consultoria_id,destino,nome_arquivo,usuario_id,linhas,novos,atualizados,ignorados,com_erro,situacao,configuracao,erros) "
                + "values (?,?,'PESOS','arquivo-ficticio.xlsx',?,1,1,0,0,0,'CONCLUIDA','{}'::jsonb,'[]'::jsonb)", importacao, consultoria, usuarioAdmin);
        peso(LocalDate.of(2026, 1, 1), "90.00", usuarioAdmin, aos(1), importacao);
        // ...nem o peso de uma data em que há atualização enviada: pertence ao item dela.
        LocalDate dataDaAtualizacao = LocalDate.of(2026, 1, 15);
        atualizacao(dataDaAtualizacao, aos(2), "ENVIADA");
        peso(dataDaAtualizacao, "88.00", usuarioAdmin, aos(2), null);
        assertThat(tipos(api.get(caminho() + "?limite=20", admin, 200))).containsExactly("PESO_REGISTRADO", "ATUALIZACAO_ENVIADA");
    }

    @Test void treinoReabertoOuRecusadoNaoEntra() throws Exception {
        UUID versao = planoPublicado("plano_treino", null, aos(1));
        treinoConcluido(versao, false, "ACEITO", aos(5));
        treinoConcluido(versao, false, "RECUSADO", aos(6));
        assertThat(tipos(api.get(caminho() + "?limite=20", admin, 200))).containsExactly("PLANO_PUBLICADO");
        treinoConcluido(versao, true, "ACEITO", aos(7));
        assertThat(tipos(api.get(caminho() + "?limite=20", admin, 200))).containsExactly("TREINO_CONCLUIDO", "PLANO_PUBLICADO");
    }

    @Test void publicarUmTreinoPeloApiGeraOEventoComAPasta() throws Exception {
        api.publicarTreino(admin, aluno, ApiDeTeste.treino().conteudo());
        JsonNode r = api.get(caminho(), admin, 200);
        assertThat(tipos(r)).containsExactly("PLANO_PUBLICADO");
        assertThat(r.path("itens").get(0).path("titulo").asString()).isEqualTo("Treino publicado");
        assertThat(Instant.parse(r.path("itens").get(0).path("quando").asString())).isAfter(base);
    }

    @Test void cadaTipoSoEntraComAPermissaoQueJaOMostraNaFicha() throws Exception {
        UUID pasta = pasta(LocalDate.of(2026, 6, 1));
        atualizacao(LocalDate.of(2026, 3, 1), aos(10), "ENVIADA");
        UUID versaoDoTreino = planoPublicado("plano_treino", pasta, aos(30));
        treinoConcluido(versaoDoTreino, true, "ACEITO", aos(20));
        planoPublicado("plano_dieta", null, aos(40));
        planoPublicado("plano_mobilidade", pasta, aos(25));
        peso(LocalDate.of(2026, 3, 2), "81.40", usuarioAdmin, aos(50), null);

        // Só ALUNO_LER: a rota abre, mas nenhum tipo aparece.
        JsonNode soAluno = membroSoCom(Set.of("ALUNO_LER"));
        assertThat(api.get(caminho() + "?limite=20", soAluno, 200).path("itens")).isEmpty();
        // Sem ALUNO_LER a rota nem abre.
        api.get(caminho(), membroSoCom(Set.of("TREINO_LER")), 403);

        // Atualização exige ATUALIZACAO_LER (que já pede ALUNO_SENSIVEL_LER); o peso, só a sensível: sem ATUALIZACAO_LER, só o peso.
        assertThat(tipos(api.get(caminho() + "?limite=20", membroSoCom(Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER")), 200)))
                .containsExactly("PESO_REGISTRADO");
        assertThat(tipos(api.get(caminho() + "?limite=20", membroSoCom(Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ATUALIZACAO_LER")), 200)))
                .containsExactly("PESO_REGISTRADO", "ATUALIZACAO_ENVIADA");
        // Treino e mobilidade pedem TREINO_LER; dieta, DIETA_LER; treino concluído, REGISTRO_LER.
        assertThat(tipos(api.get(caminho() + "?limite=20", membroSoCom(Set.of("ALUNO_LER", "TREINO_LER")), 200)))
                .containsExactly("PLANO_PUBLICADO", "PLANO_PUBLICADO");
        JsonNode soDieta = api.get(caminho() + "?limite=20", membroSoCom(Set.of("ALUNO_LER", "DIETA_LER")), 200);
        assertThat(tipos(soDieta)).containsExactly("PLANO_PUBLICADO");
        assertThat(soDieta.path("itens").get(0).path("titulo").asString()).isEqualTo("Dieta publicada");
        assertThat(tipos(api.get(caminho() + "?limite=20", membroSoCom(Set.of("ALUNO_LER", "REGISTRO_LER")), 200)))
                .containsExactly("TREINO_CONCLUIDO");
    }

    @Test void outraConsultoriaDa404() throws Exception {
        planoPublicado("plano_treino", null, aos(1));
        JsonNode outra = api.novoTreinador();
        api.get(caminho(), outra, 404);
        api.get("/alunos/" + UUID.randomUUID() + "/atividade-recente", admin, 404);
        // E o feed de um aluno nunca traz fato de outro aluno da mesma consultoria.
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício " + UUID.randomUUID());
        assertThat(api.get("/alunos/" + outroAluno + "/atividade-recente", admin, 200).path("itens")).isEmpty();
    }

    @Test void alunoAnonimizadoSegueAsOutrasLeiturasDaFicha() throws Exception {
        peso(LocalDate.of(2026, 3, 2), "81.40", usuarioAdmin, aos(50), null);
        planoPublicado("plano_treino", null, aos(30));
        assertThat(tipos(api.get(caminho(), admin, 200))).containsExactly("PESO_REGISTRADO", "PLANO_PUBLICADO");
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", banco.queryForObject("select nome from aluno where id = ?", String.class, aluno)), 200);
        // A leitura continua respondendo 200; o peso foi apagado pela anonimização e sai do feed, o fato do plano fica (sem título nem conteúdo).
        JsonNode r = api.get(caminho(), admin, 200);
        assertThat(tipos(r)).containsExactly("PLANO_PUBLICADO");
        assertThat(r.toString()).doesNotContain("81.4");
    }
}
