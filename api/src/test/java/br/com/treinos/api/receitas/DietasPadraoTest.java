package br.com.treinos.api.receitas;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ValidadorDieta;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.planos.ResultadoValidacao.Problema;
import br.com.treinos.api.receitas.DietasPadrao.Nutrientes;
import br.com.treinos.api.web.Buscas;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Validação de publicação das 11 dietas depois de preencher o item com a conta do alimento. */
class DietasPadraoTest {

    private static final Set<String> MANUAIS = Set.of(
            "Pão de forma branco",
            "Semente de chia",
            "Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi)",
            "Legumes (brócolis, abobrinha, chuchu, beterraba, vagem ou tomate)");
    private static final String FRANGO = "Frango, peito, sem pele, grelhado";
    private static final String OVO = "Ovo, de galinha, inteiro, cozido/10minutos";

    @Test
    void arquivoNaoTrazKcalNemFrangoDoBatel() {
        assertThat(DietasPadrao.modelos()).hasSize(11);
        for (DietasPadrao.Modelo modelo : DietasPadrao.modelos()) {
            DietasPadrao.cadaItem(modelo.conteudo(), item -> {
                assertThat(item.nome()).isNotEqualTo("Peito de frango grelhado");
                assertThat(item.kcal()).isNull();
                if (FRANGO.equals(item.nome())) {
                    assertThat(item.manual()).isFalse();
                }
            });
        }
    }

    @Test
    void contaDoItemSegueORecalcularDoApp() {
        Nutrientes pao = new Nutrientes(UUID.randomUUID(), new BigDecimal("100"), "g", new BigDecimal("266"),
                new BigDecimal("8.4"), new BigDecimal("49.6"), new BigDecimal("3.2"), new BigDecimal("25"));
        Item meio = item("Pão", new BigDecimal("50"), "g", false);
        assertThat(DietasPadrao.valorNaQuantidade(pao.kcal(), pao, meio)).isEqualByComparingTo("133");
        assertThat(DietasPadrao.valorNaQuantidade(pao.proteina(), pao, meio)).isEqualByComparingTo("4.2");
        assertThat(DietasPadrao.valorNaQuantidade(pao.carboidrato(), pao, meio)).isEqualByComparingTo("24.8");
        assertThat(DietasPadrao.valorNaQuantidade(pao.gordura(), pao, meio)).isEqualByComparingTo("1.6");
        Item duasUn = item("Pão", new BigDecimal("2"), "un", false);
        assertThat(DietasPadrao.valorNaQuantidade(pao.kcal(), pao, duasUn)).isEqualByComparingTo("133");
        Nutrientes semMacro = new Nutrientes(pao.id(), pao.baseQuantidade(), pao.baseUnidade(), pao.kcal(),
                null, null, null, pao.gramasPorUnidade());
        assertThat(DietasPadrao.valorNaQuantidade(semMacro.proteina(), semMacro, meio)).isNull();
        Nutrientes semGramas = new Nutrientes(pao.id(), pao.baseQuantidade(), pao.baseUnidade(), pao.kcal(),
                pao.proteina(), pao.carboidrato(), pao.gordura(), null);
        assertThat(DietasPadrao.valorNaQuantidade(semGramas.kcal(), semGramas, duasUn)).isNull();
        Item manual = item("Outro", new BigDecimal("10"), "g", true);
        assertThat(DietasPadrao.comAlimentoIds(soEsse(manual), Map.of(Buscas.semAcento("Outro"), pao))
                .refeicoes().get(0).opcoes().get(0).itens().get(0).kcal()).isEqualByComparingTo("99");
    }

    @Test
    void publicacaoDaDietaResolvidaSoErraNoItemManual() {
        Map<String, Nutrientes> alimentos = alimentosDeTeste();
        DietasPadrao.Modelo modelo = DietasPadrao.modelos().get(0);
        ConteudoDieta resolvido = DietasPadrao.comAlimentoIds(modelo.conteudo(), alimentos);
        ResultadoValidacao resultado = new ValidadorDieta().validar(resolvido, null, null);
        assertThat(resultado.erros())
                .as("%s erros %s avisos %s", modelo.nome(), resultado.erros(), resultado.avisos())
                .isNotEmpty()
                .allSatisfy(erro -> {
                    assertThat(erro.mensagem()).isEqualTo("Item manual sem kcal.");
                    assertThat(nomeNo(resolvido, erro.caminho())).isIn(MANUAIS);
                });
        assertThat(resultado.avisos()).isEmpty();
        DietasPadrao.cadaItem(resolvido, item -> {
            if (DietasPadrao.manual(item) || OVO.equals(item.nome())) {
                assertThat(item.kcal()).as(item.nome()).isNull();
            } else {
                assertThat(item.kcal()).as(item.nome()).isNotNull();
            }
        });
    }

    /** Alimento de teste por 100 g, sem gramas por unidade: ovo em {@code un} não converte. */
    private static Map<String, Nutrientes> alimentosDeTeste() {
        Map<String, Nutrientes> alimentos = new HashMap<>();
        for (String busca : DietasPadrao.buscasParaResolver()) {
            alimentos.put(busca, new Nutrientes(UUID.randomUUID(), new BigDecimal("100"), "g",
                    new BigDecimal("200"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("5"), null));
        }
        return alimentos;
    }

    private static Item item(String nome, BigDecimal quantidade, String unidade, boolean manual) {
        return new Item(UUID.randomUUID(), null, nome, quantidade, unidade, manual ? new BigDecimal("99") : null,
                null, null, null, manual);
    }

    private static ConteudoDieta soEsse(Item item) {
        return new ConteudoDieta(null, null, null, java.util.List.of(new ConteudoDieta.Refeicao(UUID.randomUUID(),
                "Café", null, null, java.util.List.of(new ConteudoDieta.Opcao(UUID.randomUUID(), "A",
                java.util.List.of(item))), null)), null, null, null);
    }

    private static String nomeNo(ConteudoDieta conteudo, String caminho) {
        int refeicao = indice(caminho, "refeicoes");
        int opcao = indice(caminho, "opcoes");
        int item = indice(caminho, "itens");
        Item achado = conteudo.refeicoes().get(refeicao).opcoes().get(opcao).itens().get(item);
        return achado.nome();
    }

    private static int indice(String caminho, String campo) {
        int em = caminho.indexOf(campo + "[");
        int abre = caminho.indexOf('[', em);
        int fecha = caminho.indexOf(']', abre);
        return Integer.parseInt(caminho.substring(abre + 1, fecha));
    }
}
