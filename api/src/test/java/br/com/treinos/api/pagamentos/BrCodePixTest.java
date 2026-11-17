package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * BR Code Pix estático. Vetores: o exemplo do Manual de Padrões para Iniciação do Pix (Banco Central, sem valor, TXID ***, CRC
 * 1D3D; conferido por CRC independente em Python) e o vetor padrão do CRC16/CCITT-FALSE ("123456789" = 29B1). Os demais códigos
 * foram montados por um segundo programa independente (Python) com os mesmos campos, só dados fictícios.
 */
class BrCodePixTest {

    private static final String CHAVE_DO_MANUAL = "123e4567-e12b-12d1-a456-426655440000";

    @Test
    void crcDoVetorPadraoCcittFalse() {
        assertThat(BrCodePix.crc16("123456789")).isEqualTo("29B1");
    }

    @Test
    void exemploDoManualDoBancoCentral() {
        // O exemplo oficial (nome em caixa mista, como no manual): o CRC calculado aqui tem de ser o do manual.
        String semCrc = "00020126580014br.gov.bcb.pix0136" + CHAVE_DO_MANUAL
                + "5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
        assertThat(BrCodePix.crc16(semCrc)).isEqualTo("1D3D");
        // A montagem é a mesma estrutura; só o nome sai em maiúsculas (por isso o CRC é outro, calculado em Python).
        assertThat(BrCodePix.montar(CHAVE_DO_MANUAL, null, "Fulano de Tal", "Brasília", "***"))
                .isEqualTo(semCrc.replace("Fulano de Tal", "FULANO DE TAL") + "F012");
    }

    @Test
    void emailComCentavos() {
        assertThat(BrCodePix.montar("fulano@example.com", 1234L, "Jose da Silva", "Sao Paulo", "0123456789ABCDEF01234567"))
                .isEqualTo("00020126400014br.gov.bcb.pix0118fulano@example.com520400005303986540512.34"
                        + "5802BR5913JOSE DA SILVA6009SAO PAULO622805240123456789ABCDEF012345676304C561");
    }

    @Test
    void cpfSoDigitosEValorMenorQueUmReal() {
        assertThat(BrCodePix.montar("52998224725", 5L, "Maria", "Curitiba", "AAAAAAAAAAAAAAAAAAAAAAAAA"))
                .isEqualTo("00020126330014br.gov.bcb.pix01115299822472552040000530398654040.05"
                        + "5802BR5905MARIA6008CURITIBA62290525AAAAAAAAAAAAAAAAAAAAAAAAA6304AF73");
    }

    @Test
    void telefoneComMais55NosTamanhosMaximos() {
        assertThat(BrCodePix.montar("+5545999998888", 999_999_999_999L, "ABCDEFGHIJKLMNOPQRSTUVWXY", "ABCDEFGHIJKLMNO", "1"))
                .isEqualTo("00020126360014br.gov.bcb.pix0114+554599999888852040000530398654139999999999.99"
                        + "5802BR5925ABCDEFGHIJKLMNOPQRSTUVWXY6015ABCDEFGHIJKLMNO6205050116304A6E7");
    }

    @Test
    void cnpjSoDigitosEIdentificadorEmMinusculas() {
        assertThat(BrCodePix.montar("11222333000181", 1000L, "Loja", "Foz", "abc123"))
                .isEqualTo("00020126360014br.gov.bcb.pix011411222333000181520400005303986540510.00"
                        + "5802BR5904LOJA6003FOZ62100506abc12363049DBB");
    }

    @Test
    void nomeECidadeSaemEmMaiusculasSemAcentoECortadosNoMaximo() {
        assertThat(BrCodePix.texto("José da Silva Ñandú Peixoto Júnior", BrCodePix.NOME_MAXIMO))
                .isEqualTo("JOSE DA SILVA NANDU PEIXO");
        assertThat(BrCodePix.texto("São José dos Pinhais", BrCodePix.CIDADE_MAXIMO)).isEqualTo("SAO JOSE DOS PI");
        assertThat(BrCodePix.texto("  Ação   & Cia  ", 25)).isEqualTo("ACAO & CIA");
        assertThat(BrCodePix.texto("日本", 25)).isEmpty();
        assertThat(BrCodePix.texto(null, 25)).isEmpty();
    }

    @Test
    void campoNomeETamanhoSaoSempreOsDoTextoNormalizado() {
        String codigo = BrCodePix.montar("fulano@example.com", 100L, "José da Silva Ñandú Peixoto Júnior",
                "São José dos Pinhais", "X1");
        assertThat(codigo).contains("5925JOSE DA SILVA NANDU PEIXO").contains("6015SAO JOSE DOS PI");
        assertThat(codigo).endsWith(BrCodePix.crc16(codigo.substring(0, codigo.length() - 4)));
    }

    @Test
    void recusaDadoForaDoPadraoSemRepetirAChave() {
        String chave = "segredo@example.com";
        assertThatThrownBy(() -> BrCodePix.montar(chave, 0L, "A", "B", "X"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageNotContaining("segredo");
        assertThatThrownBy(() -> BrCodePix.montar(chave, 1_000_000_000_000L, "A", "B", "X"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BrCodePix.montar(chave, 100L, "A", "B", "com espaco"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BrCodePix.montar(chave, 100L, "A", "B", "A".repeat(26)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BrCodePix.montar(chave, 100L, "日本", "B", "X"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BrCodePix.montar("x".repeat(ChavePix.MAXIMO + 1), 100L, "A", "B", "X"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageNotContaining("xxx");
        assertThatThrownBy(() -> BrCodePix.montar("", 100L, "A", "B", "X")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void chaveNoTamanhoMaximoAindaCabeNoCampo26() {
        String chave = "a".repeat(ChavePix.MAXIMO);
        String codigo = BrCodePix.montar(chave, 100L, "A", "B", "X");
        assertThat(codigo).contains("0177" + chave).startsWith("000201" + "2699" + "0014br.gov.bcb.pix");
    }
}
