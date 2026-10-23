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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fator de correção e de cocção (lista de compras do aluno, reunião de 17/10): ficam na biblioteca da consultoria,
 * opcionais e conferidos no servidor; a publicação da dieta copia os valores do momento para a versão imutável, sem
 * mexer no rascunho. Alimentos e valores fictícios.
 */
@AutoConfigureMockMvc
class FatoresDosAlimentosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void fatoresSaoOpcionaisEConferidosNaBiblioteca() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();

        JsonNode sem = api.post("/alimentos", treinador, alimento("Alimento sem fator", null, null), 200);
        assertThat(sem.get("fatorCorrecao").isNull()).isTrue();
        assertThat(sem.get("fatorCoccao").isNull()).isTrue();

        JsonNode com = api.post("/alimentos", treinador, alimento("Alimento com fator", "1.75", "2.5"), 200);
        assertThat(com.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.75");
        assertThat(com.get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.5");

        // Faixas da V011: FC de 1 a 20, FCc de 0,1 a 10, até duas casas. Fora disso, 422 com o campo.
        for (String[] ruim : List.of(new String[] {"0.99", null, "fatorCorrecao"}, new String[] {"20.01", null, "fatorCorrecao"},
                new String[] {"1.234", null, "fatorCorrecao"}, new String[] {null, "0.09", "fatorCoccao"},
                new String[] {null, "10.5", "fatorCoccao"})) {
            JsonNode erro = api.post("/alimentos", treinador, alimento("Alimento recusado", ruim[0], ruim[1]), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("ALIMENTO_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo(ruim[2]);
        }

        // Alterar pode tirar o fator (nulo = não informado, nunca 1).
        JsonNode alterado = api.put("/alimentos/" + com.get("id").asString(), treinador,
                alimento("Alimento com fator", null, "0.7"), 200);
        assertThat(alterado.get("fatorCorrecao").isNull()).isTrue();
        assertThat(alterado.get("fatorCoccao").decimalValue()).isEqualByComparingTo("0.7");
    }

    @Test
    void publicarCopiaOsFatoresDaBibliotecaParaAVersaoSemMexerNoRascunho() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        JsonNode outro = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);

        UUID comFatores = UUID.fromString(api.post("/alimentos", treinador,
                alimento("Cereal fictício cozido", "1.10", "2.50"), 200).get("id").asString());
        UUID semFatores = UUID.fromString(api.post("/alimentos", treinador,
                alimento("Fruta fictícia", null, null), 200).get("id").asString());
        UUID deOutraConsultoria = UUID.fromString(api.post("/alimentos", outro,
                alimento("Alimento de outra consultoria", "3.00", "3.00"), 200).get("id").asString());

        // O cliente manda fatores no item: não valem (a publicação regrava os dois).
        BigDecimal inventado = new BigDecimal("9.99");
        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço",
                "12:00", null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(
                        item(comFatores, "Cereal fictício cozido", null, null),
                        item(semFatores, "Fruta fictícia", inventado, inventado),
                        item(deOutraConsultoria, "Alimento de outra consultoria", null, null),
                        item(null, "Item manual fictício", inventado, inventado)))))),
                List.of(), null, List.of());

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", conteudo, plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode itens = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo").get("refeicoes").get(0)
                .get("opcoes").get(0).get("itens");
        assertThat(itens.get(0).get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.10");
        assertThat(itens.get(0).get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.50");
        for (int i = 1; i < 4; i++) {
            assertThat(itens.get(i).get("fatorCorrecao").isNull()).as("item %d", i).isTrue();
            assertThat(itens.get(i).get("fatorCoccao").isNull()).as("item %d", i).isTrue();
        }

        // O rascunho fica como o treinador gravou.
        JsonNode rascunho = api.get("/planos-dieta/" + id, treinador, 200).get("rascunho").get("refeicoes").get(0)
                .get("opcoes").get(0).get("itens");
        assertThat(rascunho.get(0).get("fatorCorrecao").isNull()).isTrue();
        assertThat(rascunho.get(1).get("fatorCorrecao").decimalValue()).isEqualByComparingTo(inventado);

        // Mudar o fator na biblioteca não mexe na versão já publicada (imutável).
        api.put("/alimentos/" + comFatores, treinador, alimento("Cereal fictício cozido", "1.20", null), 200);
        JsonNode v1 = api.get("/planos-dieta/" + id + "/versoes/1", treinador, 200).get("conteudo").get("refeicoes")
                .get(0).get("opcoes").get(0).get("itens").get(0);
        assertThat(v1.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.10");
        assertThat(v1.get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.50");
    }

    @Test
    void fatoresAtuaisParaAPreviaDoEditorSoDaPropriaConsultoria() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        JsonNode outro = api.novoTreinador();
        String comFatores = api.post("/alimentos", treinador, alimento("Grão fictício cozido", "1.10", "2.50"), 200)
                .get("id").asString();
        String semFatores = api.post("/alimentos", treinador, alimento("Folha fictícia", null, null), 200)
                .get("id").asString();
        String inativo = api.post("/alimentos", treinador, alimento("Alimento fictício antigo", "1.30", null), 200)
                .get("id").asString();
        api.delete("/alimentos/" + inativo, treinador, 204);
        String deOutra = api.post("/alimentos", outro, alimento("Alimento fictício de outra", "3.00", "3.00"), 200)
                .get("id").asString();
        String inexistente = UUID.randomUUID().toString();

        JsonNode fatores = api.get("/alimentos/fatores?ids=" + String.join(",", comFatores, semFatores, inativo,
                deOutra, inexistente, comFatores), treinador, 200);
        Map<String, JsonNode> porId = new HashMap<>();
        fatores.forEach(f -> porId.put(f.get("alimentoId").asString(), f));
        // Inativo entra (a publicação também o copia); outra consultoria e id inexistente somem; repetido vem uma vez.
        assertThat(porId.keySet()).containsExactlyInAnyOrder(comFatores, semFatores, inativo);
        assertThat(fatores).hasSize(3);
        assertThat(porId.get(comFatores).get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.10");
        assertThat(porId.get(comFatores).get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.50");
        assertThat(porId.get(semFatores).get("fatorCorrecao").isNull()).isTrue();
        assertThat(porId.get(semFatores).get("fatorCoccao").isNull()).isTrue();
        assertThat(porId.get(inativo).get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.30");

        // É sempre o valor atual da biblioteca.
        api.put("/alimentos/" + comFatores, treinador, alimento("Grão fictício cozido", "1.20", null), 200);
        JsonNode atual = api.get("/alimentos/fatores?ids=" + comFatores, treinador, 200).get(0);
        assertThat(atual.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.20");
        assertThat(atual.get("fatorCoccao").isNull()).isTrue();

        // Sem ids, lista vazia; acima de 200 ids distintos, 400.
        assertThat(api.get("/alimentos/fatores", treinador, 200)).isEmpty();
        List<String> muitos = new ArrayList<>();
        for (int i = 0; i < 201; i++) muitos.add(UUID.randomUUID().toString());
        api.get("/alimentos/fatores?ids=" + String.join(",", muitos), treinador, 400);

        // Quem só lê a dieta (sem biblioteca nem modelos) também vê; sem nenhuma das três, 403.
        String usuario = treinador.path("usuario").path("id").asString();
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = 'Assistente'", usuario);
        jdbc.update("delete from perfil_permissao pp using usuario u where u.id = ?::uuid and pp.perfil_id = u.perfil_id "
                + "and pp.codigo in ('BIBLIOTECA_LER', 'MODELO_LER')", usuario);
        assertThat(api.get("/alimentos/fatores?ids=" + semFatores, treinador, 200)).hasSize(1);
        jdbc.update("delete from perfil_permissao pp using usuario u where u.id = ?::uuid and pp.perfil_id = u.perfil_id "
                + "and pp.codigo = 'DIETA_LER'", usuario);
        api.get("/alimentos/fatores?ids=" + semFatores, treinador, 403);
    }

    @Test
    void catalogoMostraFatorImportacaoCopiaEMigrationNaoApagaOQueOTreinadorDigitou() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        String email = treinador.get("usuario").get("email").asString();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where email = ?", UUID.class, email);

        JsonNode abobrinha = api.get("/catalogo/alimentos?busca=Abobrinha&limite=50", treinador, 200);
        JsonNode item = abobrinha.get("itens").valueStream()
                .filter(a -> a.get("nome").asString().equals("Abobrinha, italiana, crua"))
                .findFirst().orElseThrow();
        assertThat(item.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.27");
        assertThat(item.get("fatorCoccao").isNull()).isTrue();
        assertThat(item.get("fonteFatores").asString()).contains("Oliveira");

        JsonNode abacaxi = api.get("/catalogo/alimentos?busca=Abacaxi&limite=50", treinador, 200);
        JsonNode cru = abacaxi.get("itens").valueStream()
                .filter(a -> a.get("nome").asString().equals("Abacaxi, cru"))
                .findFirst().orElseThrow();
        assertThat(cru.get("fatorCorrecao").isNull()).isTrue();

        api.post("/alimentos/importar-catalogo", treinador, Map.of("ids", List.of(item.get("id").asString())), 200);
        JsonNode copiado = api.get("/alimentos", treinador, 200).get(0);
        assertThat(copiado.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.27");
        assertThat(jdbc.queryForObject("select fatores_do_catalogo from alimento where id = ?::uuid", Boolean.class,
                copiado.get("id").asString())).isNull();

        UUID digitado = UUID.randomUUID();
        jdbc.update("insert into alimento (id, consultoria_id, nome, kcal, proteina, carboidrato, gordura, origem, fator_correcao)"
                + " values (?::uuid, ?::uuid, 'Arroz, tipo 1, cozido', 128, 2.5, 28.1, 0.2, 'CATALOGO', 3.00)",
                digitado, consultoria);
        UUID manual = UUID.randomUUID();
        jdbc.update("insert into alimento (id, consultoria_id, nome, kcal, proteina, carboidrato, gordura, origem)"
                + " values (?::uuid, ?::uuid, 'Morango, cru', 30, 0.9, 6.8, 0.3, 'MANUAL')", manual, consultoria);
        jdbc.update("""
                update alimento as a
                set fator_correcao = case when a.fator_correcao is null then c.fator_correcao else a.fator_correcao end,
                    fator_coccao = case when a.fator_coccao is null then c.fator_coccao else a.fator_coccao end,
                    fatores_do_catalogo = true
                from catalogo_alimento as c
                where a.consultoria_id is not null
                  and a.origem = 'CATALOGO'
                  and lower(a.nome) = lower(c.nome)
                  and ((a.fator_correcao is null and c.fator_correcao is not null)
                    or (a.fator_coccao is null and c.fator_coccao is not null))
                  and a.id = ?::uuid
                """, digitado);
        assertThat(jdbc.queryForObject("select fator_correcao from alimento where id = ?::uuid", BigDecimal.class, digitado))
                .isEqualByComparingTo("3.00");
        assertThat(jdbc.queryForObject("select fator_coccao from alimento where id = ?::uuid", BigDecimal.class, digitado))
                .isEqualByComparingTo("2.86");
        assertThat(jdbc.queryForObject("select fatores_do_catalogo from alimento where id = ?::uuid", Boolean.class, digitado))
                .isTrue();
        assertThat(jdbc.queryForObject("select fator_correcao from alimento where id = ?::uuid", BigDecimal.class, manual)).isNull();
        assertThat(jdbc.queryForObject("select fatores_do_catalogo from alimento where id = ?::uuid", Boolean.class, manual)).isNull();
    }

    private static AlimentoRequest alimento(String nome, String fatorCorrecao, String fatorCoccao) {
        return new AlimentoRequest(nome, new BigDecimal("100"), "g", new BigDecimal("100"), BigDecimal.ONE,
                BigDecimal.TEN, BigDecimal.ZERO, null, null, decimal(fatorCorrecao), decimal(fatorCoccao));
    }

    private static BigDecimal decimal(String texto) {
        return texto == null ? null : new BigDecimal(texto);
    }

    private static Item item(UUID alimentoId, String nome, BigDecimal fatorCorrecao, BigDecimal fatorCoccao) {
        return new Item(UUID.randomUUID(), alimentoId, nome, new BigDecimal("100"), "g", new BigDecimal("100"),
                BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, alimentoId == null, fatorCorrecao, fatorCoccao);
    }
}
