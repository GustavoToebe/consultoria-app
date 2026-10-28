package br.com.treinos.api.dieta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Grupo do alimento (lista de compras agrupada, pedido do Gustavo em 28/10): texto livre opcional na biblioteca da
 * consultoria, copiado do catálogo ao importar e, como os fatores, copiado do alimento atual para o item da versão
 * publicada da dieta (o que o cliente manda não vale). Alimentos e valores fictícios.
 */
@AutoConfigureMockMvc
class GrupoDoAlimentoIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void grupoEOpcionalNormalizadoEConferidoNaBiblioteca() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();

        JsonNode com = api.post("/alimentos", treinador, alimento("Carne fictícia", "  Carnes   e ovos "), 200);
        assertThat(com.get("grupo").asString()).isEqualTo("Carnes e ovos");
        JsonNode emBranco = api.post("/alimentos", treinador, alimento("Folha fictícia", "   "), 200);
        assertThat(emBranco.get("grupo").isNull()).isTrue();
        JsonNode sem = api.post("/alimentos", treinador, alimento("Grão fictício", null), 200);
        assertThat(sem.get("grupo").isNull()).isTrue();

        // Acima de 60 caracteres (depois de tirar os espaços sobrando): 422 com o campo.
        api.post("/alimentos", treinador, alimento("Sessenta fictício", " " + "g".repeat(60) + " "), 200);
        JsonNode erro = api.post("/alimentos", treinador, alimento("Longo fictício", "g".repeat(61)), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("ALIMENTO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("grupo");

        // Alterar troca e tira o grupo.
        String id = com.get("id").asString();
        assertThat(api.put("/alimentos/" + id, treinador, alimento("Carne fictícia", "Proteínas"), 200).get("grupo")
                .asString()).isEqualTo("Proteínas");
        assertThat(api.put("/alimentos/" + id, treinador, alimento("Carne fictícia", null), 200).get("grupo").isNull())
                .isTrue();
    }

    @Test
    void publicarCopiaOGrupoDoAlimentoAtualEOClienteNaoInjeta() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        JsonNode outro = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);

        UUID comGrupo = id(api.post("/alimentos", treinador, alimento("Cereal fictício", "Cereais e derivados"), 200));
        UUID semGrupo = id(api.post("/alimentos", treinador, alimento("Fruta fictícia", null), 200));
        UUID deOutraConsultoria = id(api.post("/alimentos", outro, alimento("Alimento de outra", "Grupo de outra"), 200));

        // O cliente manda grupo no item: não vale (a publicação regrava com o do alimento, ou nulo).
        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço",
                "12:00", null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(
                        item(comGrupo, "Cereal fictício", "Inventado"),
                        item(semGrupo, "Fruta fictícia", "Inventado"),
                        item(deOutraConsultoria, "Alimento de outra", null),
                        item(null, "Item manual fictício", "Inventado")))))),
                List.of(), null, List.of());

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", conteudo, plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode itens = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo").get("refeicoes").get(0)
                .get("opcoes").get(0).get("itens");
        assertThat(itens.get(0).get("grupo").asString()).isEqualTo("Cereais e derivados");
        for (int i = 1; i < 4; i++) {
            assertThat(itens.get(i).get("grupo").isNull()).as("item %d", i).isTrue();
        }

        // O rascunho fica como o treinador gravou; mudar o grupo depois não mexe na versão publicada.
        JsonNode rascunho = api.get("/planos-dieta/" + id, treinador, 200).get("rascunho").get("refeicoes").get(0)
                .get("opcoes").get(0).get("itens");
        assertThat(rascunho.get(0).get("grupo").asString()).isEqualTo("Inventado");
        api.put("/alimentos/" + comGrupo, treinador, alimento("Cereal fictício", "Outro grupo"), 200);
        JsonNode v1 = api.get("/planos-dieta/" + id + "/versoes/1", treinador, 200).get("conteudo").get("refeicoes")
                .get(0).get("opcoes").get(0).get("itens").get(0);
        assertThat(v1.get("grupo").asString()).isEqualTo("Cereais e derivados");
    }

    @Test
    void previaDoEditorRecebeOGrupoAtualSoDaPropriaConsultoria() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        JsonNode outro = api.novoTreinador();
        String comGrupo = id(api.post("/alimentos", treinador, alimento("Ovo fictício", "Ovos e derivados"), 200)).toString();
        String semGrupo = id(api.post("/alimentos", treinador, alimento("Sal fictício", null), 200)).toString();
        String deOutra = id(api.post("/alimentos", outro, alimento("Ovo de outra", "Grupo de outra"), 200)).toString();

        JsonNode fatores = api.get("/alimentos/fatores?ids=" + String.join(",", comGrupo, semGrupo, deOutra), treinador, 200);
        Map<String, JsonNode> porId = new HashMap<>();
        fatores.forEach(f -> porId.put(f.get("alimentoId").asString(), f));
        assertThat(porId.keySet()).containsExactlyInAnyOrder(comGrupo, semGrupo);
        assertThat(porId.get(comGrupo).get("grupo").asString()).isEqualTo("Ovos e derivados");
        assertThat(porId.get(semGrupo).get("grupo").isNull()).isTrue();
    }

    @Test
    void importarDoCatalogoCopiaOGrupoEAMigrationSoPreencheOQueVeioDoCatalogo() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        String email = treinador.get("usuario").get("email").asString();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where email = ?", UUID.class, email);

        JsonNode item = api.get("/catalogo/alimentos?busca=Abobrinha&limite=50", treinador, 200).get("itens")
                .valueStream().filter(a -> a.get("nome").asString().equals("Abobrinha, italiana, crua"))
                .findFirst().orElseThrow();
        String grupoDoCatalogo = item.get("grupo").asString();
        assertThat(grupoDoCatalogo).isNotBlank();
        api.post("/alimentos/importar-catalogo", treinador, Map.of("ids", List.of(item.get("id").asString())), 200);
        assertThat(api.get("/alimentos", treinador, 200).get(0).get("grupo").asString()).isEqualTo(grupoDoCatalogo);

        // A regra da V038, rodada só nas linhas deste teste (o banco é compartilhado).
        String grupoDoArroz = jdbc.queryForObject("select grupo from catalogo_alimento where nome = 'Arroz, tipo 1, cozido'",
                String.class);
        UUID doCatalogo = inserir(consultoria, "arroz, tipo 1, cozido ", "CATALOGO", null);
        UUID jaTinha = inserir(consultoria, "Morango, cru", "CATALOGO", "Meu grupo");
        UUID manual = inserir(consultoria, "Banana, prata, crua", "MANUAL", null);
        UUID renomeado = inserir(consultoria, "Meu arroz fictício", "CATALOGO", null);
        jdbc.update("""
                update alimento as a
                set grupo = left(btrim(c.grupo), 60)
                from catalogo_alimento as c
                where a.origem = 'CATALOGO'
                  and a.grupo is null
                  and lower(btrim(a.nome)) = lower(btrim(c.nome))
                  and nullif(btrim(c.grupo), '') is not null
                  and (select count(*) from catalogo_alimento as c2 where lower(btrim(c2.nome)) = lower(btrim(a.nome))) = 1
                  and a.consultoria_id = ?::uuid
                """, consultoria);
        assertThat(grupoDe(doCatalogo)).isEqualTo(grupoDoArroz).isNotBlank();
        assertThat(grupoDe(jaTinha)).isEqualTo("Meu grupo");
        assertThat(grupoDe(manual)).isNull();
        assertThat(grupoDe(renomeado)).isNull();
    }

    private UUID inserir(UUID consultoria, String nome, String origem, String grupo) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into alimento (id, consultoria_id, nome, kcal, proteina, carboidrato, gordura, origem, grupo)"
                + " values (?::uuid, ?::uuid, ?, 100, 1, 1, 1, ?, ?)", id, consultoria, nome, origem, grupo);
        return id;
    }

    private String grupoDe(UUID id) {
        return jdbc.queryForObject("select grupo from alimento where id = ?::uuid", String.class, id);
    }

    private static UUID id(JsonNode alimento) {
        return UUID.fromString(alimento.get("id").asString());
    }

    private static AlimentoRequest alimento(String nome, String grupo) {
        return new AlimentoRequest(nome, new BigDecimal("100"), "g", new BigDecimal("100"), BigDecimal.ONE,
                BigDecimal.TEN, BigDecimal.ZERO, null, null, null, null, grupo);
    }

    private static Item item(UUID alimentoId, String nome, String grupo) {
        return new Item(UUID.randomUUID(), alimentoId, nome, new BigDecimal("100"), "g", new BigDecimal("100"),
                BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, alimentoId == null, null, null, grupo);
    }
}
