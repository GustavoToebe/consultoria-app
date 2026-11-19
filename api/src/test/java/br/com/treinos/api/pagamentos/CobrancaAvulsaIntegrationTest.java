package br.com.treinos.api.pagamentos;

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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code POST /financeiro/cobrancas-avulsas} (V087): um e vários alunos, parcelas mensais (dia 31 e ano bissexto), tudo ou nada,
 * recusas (422 por campo sem repetir o valor, 404, 409), permissão, isolamento por consultoria e auditoria de resumo fixo. A baixa
 * e o cancelamento de avulsa estão em {@link CobrancaAvulsaBaixaECancelamentoIntegrationTest}. Dados fictícios.
 */
@AutoConfigureMockMvc
class CobrancaAvulsaIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/cobrancas-avulsas";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private Map<String, Object> corpo(List<UUID> alunos, String descricao, long valor, LocalDate primeiro, int parcelas) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pedidoId", UUID.randomUUID().toString());
        m.put("alunoIds", alunos.stream().map(UUID::toString).toList());
        m.put("descricao", descricao);
        m.put("valorCentavos", valor);
        m.put("primeiroVencimento", primeiro.toString());
        m.put("parcelas", parcelas);
        return m;
    }

    private UUID aluno(JsonNode quem) throws Exception {
        return api.criarAluno(quem, "Aluno Fictício " + UUID.randomUUID());
    }

    private int cobrancasDoAluno(JsonNode quem, UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/cobrancas", quem, 200).size();
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new java.util.TreeSet<>();
        erro.get("fieldErrors").forEach(f -> nomes.add(f.get("field").asString()));
        return nomes;
    }

    @Test
    void umAlunoUmaParcelaViraUmaCobrancaAvulsaAbertaSemContratacao() throws Exception {
        UUID aluno = aluno(admin);
        LocalDate vencimento = hoje.plusDays(10);

        JsonNode r = api.post(ROTA, admin, corpo(List.of(aluno), "  Camiseta do time  ", 8_990, vencimento, 1), 201);

        assertThat(r.get("alunos").asInt()).isEqualTo(1);
        assertThat(r.get("cobrancas").asInt()).isEqualTo(1);
        JsonNode lista = api.get("/alunos/" + aluno + "/cobrancas", admin, 200);
        assertThat(lista).hasSize(1);
        JsonNode c = lista.get(0);
        assertThat(c.get("tipo").asString()).isEqualTo("AVULSA");
        assertThat(c.get("descricao").asString()).isEqualTo("Camiseta do time");
        assertThat(c.get("valorCentavos").asLong()).isEqualTo(8_990);
        assertThat(c.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(c.get("vencimento").asString()).isEqualTo(vencimento.toString());
        assertThat(c.get("contratacaoId").isNull()).isTrue();
        assertThat(c.get("planoNome").isNull()).isTrue();
        assertThat(c.get("competencia").isNull()).isTrue();
        assertThat(c.get("provedor").asString()).isEqualTo("MANUAL");
        // Também aparece na lista geral (join sem contratação) e nos números do filtro.
        JsonNode geral = api.get("/financeiro/cobrancas", admin, 200);
        assertThat(geral.get("total").asLong()).isEqualTo(1);
        assertThat(geral.get("itens").get(0).get("id").asString()).isEqualTo(c.get("id").asString());
    }

    @Test
    void variosAlunosEParcelasMensaisComODia31LimitadoAoFimDoMes() throws Exception {
        List<UUID> alunos = List.of(aluno(admin), aluno(admin), aluno(admin));
        // Janeiro de um ano bissexto até 2100: o dia 31 vira 29/02 e volta a 31/03 (cada parcela parte do primeiro vencimento).
        int ano = 2028;
        JsonNode r = api.post(ROTA, admin, corpo(alunos, "Avaliação", 15_000, LocalDate.of(ano, 1, 31), 3), 201);

        assertThat(r.get("alunos").asInt()).isEqualTo(3);
        assertThat(r.get("cobrancas").asInt()).isEqualTo(9);
        for (UUID aluno : alunos) {
            JsonNode lista = api.get("/alunos/" + aluno + "/cobrancas", admin, 200);
            assertThat(lista).hasSize(3);
            Map<String, String> porDescricao = new LinkedHashMap<>();
            lista.forEach(c -> porDescricao.put(c.get("descricao").asString(), c.get("vencimento").asString()));
            assertThat(porDescricao).containsEntry("Avaliação (Parcela 1/3)", "2028-01-31")
                    .containsEntry("Avaliação (Parcela 2/3)", "2028-02-29")
                    .containsEntry("Avaliação (Parcela 3/3)", "2028-03-31");
            lista.forEach(c -> assertThat(c.get("valorCentavos").asLong()).isEqualTo(15_000));
        }
        // Fevereiro de ano comum.
        UUID outro = aluno(admin);
        api.post(ROTA, admin, corpo(List.of(outro), "Taxa", 1_000, LocalDate.of(2027, 1, 30), 2), 201);
        List<String> vencimentos = new ArrayList<>();
        api.get("/alunos/" + outro + "/cobrancas", admin, 200).forEach(c -> vencimentos.add(c.get("vencimento").asString()));
        assertThat(vencimentos).containsExactlyInAnyOrder("2027-01-30", "2027-02-28");
    }

    @Test
    void tudoOuNadaUmAlunoInativoDerrubaOLoteInteiro() throws Exception {
        UUID bom = aluno(admin);
        UUID inativo = aluno(admin);
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);

        JsonNode erro = api.post(ROTA, admin, corpo(List.of(bom, inativo), "Camiseta", 5_000, hoje.plusDays(3), 2), 409);

        assertThat(erro.get("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        assertThat(cobrancasDoAluno(admin, bom)).isZero();
        assertThat(cobrancasDoAluno(admin, inativo)).isZero();
    }

    @Test
    void anonimizadoDa409EOutroDoOutroTreinadorEInexistenteDao404SemGravarNada() throws Exception {
        UUID bom = aluno(admin);
        String nome = "Aluno Anonimizável " + UUID.randomUUID();
        UUID anonimizado = api.criarAluno(admin, nome);
        api.patch("/alunos/" + anonimizado + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + anonimizado + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        JsonNode outro = api.novoTreinador();
        UUID deOutra = aluno(outro);

        assertThat(api.post(ROTA, admin, corpo(List.of(bom, anonimizado), "X", 100, hoje, 1), 409).get("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
        api.post(ROTA, admin, corpo(List.of(bom, deOutra), "X", 100, hoje, 1), 404);
        api.post(ROTA, admin, corpo(List.of(bom, UUID.randomUUID()), "X", 100, hoje, 1), 404);

        assertThat(cobrancasDoAluno(admin, bom)).isZero();
        // A consultoria da outra nada recebeu: o aluno dela segue sem cobrança.
        assertThat(cobrancasDoAluno(outro, deOutra)).isZero();
    }

    @Test
    void recusasDeValidacaoSaemPorCampoSemRepetirOValor() throws Exception {
        UUID a = aluno(admin);
        String longa = "descricao-longa-".repeat(10);
        Map<String, Object> ruim = corpo(List.of(a, a), longa, 0, LocalDate.of(1999, 12, 31), 13);
        JsonNode erro = api.post(ROTA, admin, ruim, 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("COBRANCA_AVULSA_INVALIDA");
        assertThat(campos(erro)).containsExactlyInAnyOrder("alunoIds[1]", "descricao", "valorCentavos", "primeiroVencimento", "parcelas");
        assertThat(erro.toString()).doesNotContain(longa).doesNotContain("1999").doesNotContain("descricao-longa");

        // Cada limite sozinho.
        assertThat(campos(api.post(ROTA, admin, corpo(List.of(), "X", 100, hoje, 1), 422))).containsExactly("alunoIds");
        List<UUID> cento = new ArrayList<>();
        for (int i = 0; i < 101; i++) cento.add(UUID.randomUUID());
        assertThat(campos(api.post(ROTA, admin, corpo(cento, "X", 100, hoje, 1), 422))).containsExactly("alunoIds");
        assertThat(campos(api.post(ROTA, admin, corpo(List.of(a), "   ", 100, hoje, 1), 422))).containsExactly("descricao");
        assertThat(campos(api.post(ROTA, admin, corpo(List.of(a), "X", 1_000_000_001L, hoje, 1), 422))).containsExactly("valorCentavos");
        assertThat(campos(api.post(ROTA, admin, corpo(List.of(a), "X", 100, hoje, 0), 422))).containsExactly("parcelas");
        assertThat(campos(api.post(ROTA, admin, corpo(List.of(a), "X", 100, LocalDate.of(hoje.getYear() + 6, 1, 1), 1), 422)))
                .containsExactly("primeiroVencimento");
        Map<String, Object> vazio = new LinkedHashMap<>();
        assertThat(campos(api.post(ROTA, admin, vazio, 422)))
                .containsExactlyInAnyOrder("pedidoId", "alunoIds", "descricao", "valorCentavos", "primeiroVencimento", "parcelas");
        // Os limites de dentro passam: 120 caracteres, R$ 10.000.000,00, 12 parcelas.
        api.post(ROTA, admin, corpo(List.of(a), "d".repeat(120), 1_000_000_000L, hoje, 12), 201);
        assertThat(cobrancasDoAluno(admin, a)).isEqualTo(12);
    }

    @Test
    void permissaoIsolamentoEAuditoriaComResumoFixo() throws Exception {
        UUID a = aluno(admin);
        Map<String, Object> corpo = corpo(List.of(a), "Descrição Secreta do Treinador", 7_777, hoje, 1);

        api.post(ROTA, null, corpo, 401);
        api.post(ROTA, membro("Sem financeiro", Set.of("ALUNO_LER")), corpo, 403);
        api.post(ROTA, membro("Leitor", Set.of("FINANCEIRO_LER", "ALUNO_LER")), corpo, 403);
        api.post(ROTA, api.convidarEEntrar(admin, a), corpo, 403);
        assertThat(cobrancasDoAluno(admin, a)).isZero();

        JsonNode gestor = membro("Gestor", Set.of("FINANCEIRO_ALTERAR", "FINANCEIRO_LER", "ALUNO_LER"));
        api.post(ROTA, gestor, corpo, 201);

        // Outra consultoria não vê a cobrança, o aluno nem a lista.
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + a + "/cobrancas", outro, 404);
        assertThat(api.get("/financeiro/cobrancas", outro, 200).get("total").asLong()).isZero();

        // Auditoria: uma linha por aluno, resumo fixo, sem valor, nome nem descrição.
        List<Map<String, Object>> linhas = jdbc.queryForList("select resumo, entidade_id from auditoria "
                + "where acao = 'COBRANCAS_AVULSAS_GERADAS' "
                + "and consultoria_id = (select consultoria_id from usuario where id = ?::uuid)", admin.get("usuario").get("id").asString());
        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("resumo").toString()).isEqualTo("Gerou cobranças avulsas para o aluno.");
        assertThat(linhas.get(0).get("entidade_id").toString()).isEqualTo(a.toString());
    }

    @Test
    void tresAlunosGeramTresEventosDeAuditoriaSemDadoPessoal() throws Exception {
        List<UUID> alunos = List.of(aluno(admin), aluno(admin), aluno(admin));

        api.post(ROTA, admin, corpo(alunos, "Descrição Secreta 4455", 4_455, hoje, 2), 201);

        List<Map<String, Object>> linhas = jdbc.queryForList("select resumo, entidade, entidade_id from auditoria "
                + "where acao = 'COBRANCAS_AVULSAS_GERADAS' and entidade_id in (?::uuid, ?::uuid, ?::uuid)",
                alunos.get(0).toString(), alunos.get(1).toString(), alunos.get(2).toString());
        assertThat(linhas).hasSize(3);
        assertThat(linhas).extracting(l -> l.get("entidade_id").toString())
                .containsExactlyInAnyOrderElementsOf(alunos.stream().map(UUID::toString).toList());
        for (Map<String, Object> l : linhas) {
            assertThat(l.get("entidade")).isEqualTo("ALUNO");
            assertThat(l.get("resumo").toString()).isEqualTo("Gerou cobranças avulsas para o aluno.")
                    .doesNotContain("Secreta").doesNotContain("4455").doesNotContain("44,55");
        }
    }

    @Test
    void exportacaoDoAlunoLevaAAvulsaEAnonimizacaoCancelaETiraADescricao() throws Exception {
        String nome = "Aluno Exportável " + UUID.randomUUID();
        UUID a = api.criarAluno(admin, nome);
        api.post(ROTA, admin, corpo(List.of(a), "Camiseta de " + nome, 9_900, hoje.plusDays(1), 2), 201);

        // A exportação LGPD ordena por competência: a avulsa não tem e não pode derrubar a rota.
        JsonNode cobrancas = api.get("/alunos/" + a + "/exportacao", admin, 200).get("financeiro").get("cobrancas");
        assertThat(cobrancas).hasSize(2);
        assertThat(cobrancas.get(0).get("tipo").asString()).isEqualTo("AVULSA");
        assertThat(cobrancas.get(0).get("competencia").isNull()).isTrue();
        assertThat(cobrancas.get(0).get("contratacaoId").isNull()).isTrue();
        assertThat(cobrancas.get(0).get("descricao").asString()).startsWith("Camiseta de ");

        api.patch("/alunos/" + a + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + a + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        // Anonimizar cancela as abertas e troca a descrição (o treinador pode ter escrito o nome do aluno nela).
        for (Map<String, Object> linha : jdbc.queryForList("select situacao, descricao from cobranca_aluno where aluno_id = ?::uuid",
                a.toString())) {
            assertThat(linha.get("situacao")).isEqualTo("CANCELADA");
            assertThat(linha.get("descricao")).isEqualTo("Cobrança avulsa");
        }
    }

    @Test
    void oBancoSoAceitaAvulsaSemContratacaoECompetenciaEComDescricao() throws Exception {
        UUID a = aluno(admin);
        api.post(ROTA, admin, corpo(List.of(a), "Base", 100, hoje, 1), 201);
        Map<String, Object> base = jdbc.queryForMap("select consultoria_id, aluno_id from cobranca_aluno where aluno_id = ?::uuid",
                a.toString());
        String insert = "insert into cobranca_aluno (id, consultoria_id, aluno_id, valor_centavos, vencimento, situacao, tipo, "
                + "descricao, contratacao_id, competencia) values (gen_random_uuid(), ?, ?, 100, current_date, 'ABERTA', ?, ?, ?, ?)";
        Object consultoria = base.get("consultoria_id");
        Object aluno = base.get("aluno_id");
        // Avulsa sem descrição, avulsa com competência e mensalidade sem contratação: recusadas pelos CHECKs.
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(insert, consultoria, aluno, "AVULSA", null, null, null))
                .hasMessageContaining("ck_cobranca_descricao_so_avulsa");
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> jdbc.update(insert, consultoria, aluno, "AVULSA", "ok", null, java.sql.Date.valueOf(hoje)))
                .hasMessageContaining("ck_cobranca_contratacao_so_avulsa");
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> jdbc.update(insert, consultoria, aluno, "MENSALIDADE", null, null, java.sql.Date.valueOf(hoje)))
                .hasMessageContaining("ck_cobranca_contratacao_so_avulsa");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(insert, consultoria, aluno, "OUTRA", "ok", null, null))
                .hasMessageContaining("violates check constraint");
        // Aluno de outra consultoria: a FK composta (consultoria, aluno) recusa mesmo sem contratação.
        JsonNode outro = api.novoTreinador();
        Object consultoriaDeOutro = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", Object.class,
                outro.get("usuario").get("id").asString());
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> jdbc.update(insert, consultoriaDeOutro, aluno, "AVULSA", "ok", null, null))
                .hasMessageContaining("fk_cobranca_aluno");
    }

    @Test
    void formasDeRecebimentoELinkDoPlanoExistemComOsChecksDoContrato() throws Exception {
        assertThat(jdbc.queryForObject("select count(*) from information_schema.columns where table_name = 'plano_comercial' "
                + "and column_name = 'link_de_pagamento' and character_maximum_length = 500", Integer.class)).isEqualTo(1);
        Object consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", Object.class,
                admin.get("usuario").get("id").asString());
        // Padrão da linha: InfinitePay ligada, o resto desligado; pix ligado exige os quatro campos.
        jdbc.update("insert into forma_de_recebimento (consultoria_id) values (?)", consultoria);
        Map<String, Object> linha = jdbc.queryForMap("select infinite_pay, link_proprio, pix, versao from forma_de_recebimento "
                + "where consultoria_id = ?", consultoria);
        assertThat(linha).containsEntry("infinite_pay", true).containsEntry("link_proprio", false).containsEntry("pix", false)
                .containsEntry("versao", 0L);
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> jdbc.update("update forma_de_recebimento set pix = true where consultoria_id = ?", consultoria))
                .hasMessageContaining("ck_forma_pix_completo");
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> jdbc.update("update forma_de_recebimento set pix_tipo_chave = 'RG' where consultoria_id = ?", consultoria))
                .hasMessageContaining("ck_forma_pix_tipo_chave");
        assertThat(jdbc.update("update forma_de_recebimento set pix = true, pix_tipo_chave = 'ALEATORIA', pix_chave = 'chave-fake', "
                + "pix_nome_recebedor = 'Treinador Ficticio', pix_cidade = 'Cascavel' where consultoria_id = ?", consultoria)).isEqualTo(1);
    }

    @Test
    void oAlunoVeAAvulsaComADescricao() throws Exception {
        UUID a = aluno(admin);
        api.post(ROTA, admin, corpo(List.of(a), "Camiseta oficial", 4_500, hoje.plusDays(2), 1), 201);
        JsonNode login = api.convidarEEntrar(admin, a);

        JsonNode financeiro = api.get("/aluno/financeiro", login, 200);

        JsonNode aberta = financeiro.get("abertas").get(0);
        assertThat(aberta.get("tipo").asString()).isEqualTo("AVULSA");
        assertThat(aberta.get("descricao").asString()).isEqualTo("Camiseta oficial");
        assertThat(aberta.get("competencia").isNull()).isTrue();
        assertThat(aberta.get("valorCentavos").asLong()).isEqualTo(4_500);
        assertThat(financeiro.get("plano").isNull()).isTrue();
        // O que o aluno vê não leva observação, motivo nem quem deu a baixa.
        assertThat(aberta.has("observacao")).isFalse();
        assertThat(aberta.has("motivo")).isFalse();
    }
}
