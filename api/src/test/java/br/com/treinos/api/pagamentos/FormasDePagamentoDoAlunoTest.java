package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.FormasDePagamentoDoAluno.Forma;
import br.com.treinos.api.pagamentos.FormasDePagamentoDoAluno.Ligadas;
import br.com.treinos.api.pagamentos.FormasDePagamentoDoAluno.PixConfigurado;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Quais formas o aluno vê numa cobrança e o código Pix dela, sem banco: só regra e montagem. Dados fictícios. */
class FormasDePagamentoDoAlunoTest {

    private static final PixConfigurado PIX =
            new PixConfigurado(ChavePix.Tipo.EMAIL, "fulano@example.com", "Academia Teste", "Curitiba");
    private static final UUID COBRANCA = UUID.fromString("123e4567-e12b-12d1-a456-426655440000");

    @Test
    void semLinhaGravadaValeOComportamentoDeHoje() {
        assertThat(FormasDePagamentoDoAluno.decidir(Ligadas.PADRAO, true, true, true))
                .containsExactly(Forma.INFINITEPAY, Forma.MANUAL);
        assertThat(FormasDePagamentoDoAluno.decidir(Ligadas.PADRAO, false, false, true)).containsExactly(Forma.MANUAL);
    }

    @Test
    void infinitePayPrecisaEstarLigadaECredenciadaELinkPrecisaDoLinkNoPlano() {
        Ligadas l = new Ligadas(false, true, null);
        assertThat(FormasDePagamentoDoAluno.decidir(l, true, true, true)).containsExactly(Forma.LINK_PROPRIO, Forma.MANUAL);
        assertThat(FormasDePagamentoDoAluno.decidir(l, true, false, true)).containsExactly(Forma.MANUAL);
        assertThat(FormasDePagamentoDoAluno.decidir(new Ligadas(true, false, null), false, true, true))
                .containsExactly(Forma.MANUAL);
    }

    @Test
    void pixSoComConfiguracaoECobrancaAberta() {
        Ligadas l = new Ligadas(false, false, PIX);
        assertThat(FormasDePagamentoDoAluno.decidir(l, false, false, true)).containsExactly(Forma.PIX, Forma.MANUAL);
        assertThat(FormasDePagamentoDoAluno.decidir(l, false, false, false)).containsExactly(Forma.MANUAL);
        assertThat(FormasDePagamentoDoAluno.decidir(new Ligadas(false, false, null), false, false, true))
                .containsExactly(Forma.MANUAL);
    }

    @Test
    void todasLigadasNaOrdemDoAluno() {
        assertThat(FormasDePagamentoDoAluno.decidir(new Ligadas(true, true, PIX), true, true, true))
                .containsExactly(Forma.INFINITEPAY, Forma.LINK_PROPRIO, Forma.PIX, Forma.MANUAL);
    }

    @Test
    void codigoPixUsaOValorDaCobrancaEUmIdentificadorSemDadoPessoal() {
        String codigo = FormasDePagamentoDoAluno.codigoPix(new Ligadas(false, false, PIX), COBRANCA, 15050L, true)
                .orElseThrow();
        assertThat(codigo).contains("5406150.50").contains("5914ACADEMIA TESTE")
                .contains("6008CURITIBA").contains("0525123e4567e12b12d1a45642665");
        assertThat(codigo).endsWith(BrCodePix.crc16(codigo.substring(0, codigo.length() - 4)));
    }

    @Test
    void codigoPixVazioSemPixOuSemCobrancaAberta() {
        assertThat(FormasDePagamentoDoAluno.codigoPix(new Ligadas(true, true, null), COBRANCA, 100L, true)).isEmpty();
        assertThat(FormasDePagamentoDoAluno.codigoPix(new Ligadas(false, false, PIX), COBRANCA, 100L, false)).isEmpty();
    }

    @Test
    void toStringDoPixNaoTrazAChave() {
        assertThat(PIX.toString()).doesNotContain("fulano").doesNotContain("Academia");
        assertThat(new Ligadas(false, false, PIX).toString()).doesNotContain("fulano");
    }
}
