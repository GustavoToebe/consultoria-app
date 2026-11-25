package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.vitrine.VitrineDtos.ItemRequest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras do item da vitrine sem banco. Mensagem nunca repete o valor digitado. */
class ValidacaoDoItemTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 16);

    private static ItemRequest base() {
        return new ItemRequest("Camiseta fictícia", "Descrição fictícia", "FISICO", 10_000L, null, null, null, null, true, null, null, null, null);
    }

    private static ItemRequest com(String nome, String descricao, String tipo, Long preco, Long especial, LocalDate ate,
                                   String cupom, String link, Boolean ativo) {
        return new ItemRequest(nome, descricao, tipo, preco, especial, ate, cupom, link, ativo, null, null, null, null);
    }

    @Test
    void soItemDigitalPodeIrParaAPaginaPublica() {
        ItemRequest fisico = new ItemRequest("Item", null, "FISICO", null, null, null, null, null, true, true, null, null, null);
        ItemRequest digital = new ItemRequest("Item", null, "DIGITAL", null, null, null, null, null, true, true, null, null, null);
        ItemRequest semTipo = new ItemRequest("Item", null, null, null, null, null, null, null, true, true, null, null, null);
        assertThat(campos(fisico)).containsExactly("naPaginaPublica");
        assertThat(campos(semTipo)).containsExactly("tipo", "naPaginaPublica");
        assertThat(campos(digital)).isEmpty();
        assertThat(ValidacaoDoItem.normalizar(digital).naPaginaPublica()).isTrue();
        assertThat(ValidacaoDoItem.normalizar(base()).naPaginaPublica()).isFalse();
    }

    @Test
    void soItemDigitalPodeIrAoMarketplace() {
        ItemRequest fisico = new ItemRequest("Item", null, "FISICO", null, null, null, null, null, true, false, true, null, null);
        ItemRequest digital = new ItemRequest("Item", null, "DIGITAL", null, null, null, null, null, true, false, true, null, null);
        assertThat(campos(fisico)).containsExactly("noMarketplace");
        assertThat(campos(digital)).isEmpty();
        assertThat(ValidacaoDoItem.normalizar(digital).noMarketplace()).isTrue();
        assertThat(ValidacaoDoItem.normalizar(base()).noMarketplace()).isFalse();
    }

    private static List<String> campos(ItemRequest r) {
        return ValidacaoDoItem.problemas(r, HOJE).stream().map(ApiError.FieldError::field).toList();
    }

    @Test
    void itemMinimoEValido() {
        assertThat(campos(com("Item", null, "DIGITAL", null, null, null, null, null, false))).isEmpty();
        assertThat(campos(base())).isEmpty();
    }

    @Test
    void nomeObrigatorioEAte100ContadoDepoisDoStrip() {
        assertThat(campos(com("   ", null, "FISICO", null, null, null, null, null, true))).containsExactly("nome");
        assertThat(campos(com(null, null, "FISICO", null, null, null, null, null, true))).containsExactly("nome");
        assertThat(campos(com("a".repeat(100), null, "FISICO", null, null, null, null, null, true))).isEmpty();
        assertThat(campos(com("  " + "a".repeat(100) + "  ", null, "FISICO", null, null, null, null, null, true))).isEmpty();
        assertThat(campos(com("a".repeat(101), null, "FISICO", null, null, null, null, null, true))).containsExactly("nome");
    }

    @Test
    void descricaoAte300() {
        assertThat(campos(com("Item", "d".repeat(300), "FISICO", null, null, null, null, null, true))).isEmpty();
        assertThat(campos(com("Item", "d".repeat(301), "FISICO", null, null, null, null, null, true))).containsExactly("descricao");
    }

    @Test
    void tipoEAtivoObrigatorios() {
        assertThat(campos(com("Item", null, null, null, null, null, null, null, true))).containsExactly("tipo");
        assertThat(campos(com("Item", null, "OUTRO", null, null, null, null, null, true))).containsExactly("tipo");
        assertThat(campos(com("Item", null, "digital", null, null, null, null, null, true))).containsExactly("tipo");
        assertThat(campos(com("Item", null, "DIGITAL", null, null, null, null, null, null))).containsExactly("ativo");
    }

    @Test
    void precoDe1CentavoAteUmBilhaoDeCentavos() {
        assertThat(campos(com("Item", null, "FISICO", 1L, null, null, null, null, true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", 1_000_000_000L, null, null, null, null, true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", 0L, null, null, null, null, true))).containsExactly("precoCentavos");
        assertThat(campos(com("Item", null, "FISICO", -5L, null, null, null, null, true))).containsExactly("precoCentavos");
        assertThat(campos(com("Item", null, "FISICO", 1_000_000_001L, null, null, null, null, true))).containsExactly("precoCentavos");
    }

    @Test
    void especialPrecisaSerMenorQueONormalEDeUmNormal() {
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 9_999L, null, null, null, true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 10_000L, null, null, null, true)))
                .containsExactly("precoEspecialCentavos");
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 12_000L, null, null, null, true)))
                .containsExactly("precoEspecialCentavos");
        assertThat(campos(com("Item", null, "FISICO", null, 500L, null, null, null, true))).containsExactly("precoEspecialCentavos");
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 0L, null, null, null, true))).containsExactly("precoEspecialCentavos");
    }

    @Test
    void validadeSoComEspecialEDentroDaFaixa() {
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 8_000L, HOJE, null, null, true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 8_000L, HOJE.plusDays(30), null, null, true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", 10_000L, null, HOJE, null, null, true))).containsExactly("especialAte");
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 8_000L, LocalDate.of(1999, 12, 31), null, null, true)))
                .containsExactly("especialAte");
        assertThat(campos(com("Item", null, "FISICO", 10_000L, 8_000L, LocalDate.of(HOJE.getYear() + 6, 1, 1), null, null, true)))
                .containsExactly("especialAte");
    }

    @Test
    void cupomAte40DepoisDoStripEEmBrancoViraNulo() {
        assertThat(campos(com("Item", null, "FISICO", null, null, null, "c".repeat(40), null, true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", null, null, null, "c".repeat(41), null, true))).containsExactly("cupom");
        assertThat(ValidacaoDoItem.normalizar(com("Item", null, "FISICO", null, null, null, "   ", null, true)).cupom()).isNull();
        assertThat(ValidacaoDoItem.normalizar(com("Item", null, "FISICO", null, null, null, "  BEMVINDO10 ", null, true)).cupom())
                .isEqualTo("BEMVINDO10");
    }

    @Test
    void linkSoHttpsEEmBrancoViraNulo() {
        assertThat(campos(com("Item", null, "FISICO", null, null, null, null, "https://loja.exemplo.com.br/item", true))).isEmpty();
        assertThat(campos(com("Item", null, "FISICO", null, null, null, null, "http://loja.exemplo.com.br/item", true)))
                .containsExactly("linkUrl");
        assertThat(campos(com("Item", null, "FISICO", null, null, null, null, "javascript:alert(1)", true))).containsExactly("linkUrl");
        assertThat(campos(com("Item", null, "FISICO", null, null, null, null, "loja.exemplo.com.br", true))).containsExactly("linkUrl");
        assertThat(campos(com("Item", null, "FISICO", null, null, null, null, "   ", true))).isEmpty();
        assertThat(ValidacaoDoItem.normalizar(com("Item", "  ", "FISICO", null, null, null, null, "   ", true)).linkUrl()).isNull();
        assertThat(ValidacaoDoItem.normalizar(com("Item", "  ", "FISICO", null, null, null, null, "   ", true)).descricao()).isNull();
    }

    @Test
    void mensagemNuncaRepeteOValorDigitado() {
        ItemRequest r = com("a".repeat(101), "d".repeat(301), "XPTO", 123_456_789_000L, null, null, "cupom-" + "c".repeat(60),
                "http://segredo.exemplo.com/x", true);
        String todas = ValidacaoDoItem.problemas(r, HOJE).toString();
        assertThat(todas).doesNotContain("XPTO").doesNotContain("123456789000").doesNotContain("segredo.exemplo")
                .doesNotContain("cupom-");
    }
}
