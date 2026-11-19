package br.com.treinos.api.pagamentos.provedor;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** O provedor da Kiwify cumpre o contrato: só existe para a baixa conhecer o código; gera, consulta e recebe aviso por outro caminho. */
class KiwifyProvedorContratoTest extends ProvedorContratoTest {

    @Override
    protected ProvedorDePagamento provedor() {
        return new ProvedorKiwify();
    }

    @Test
    void ehOProvedorKiwifySemNenhumaCapacidadeERegistroOConhece() {
        assertThat(provedor().codigo()).isEqualTo("KIWIFY");
        assertThat(provedor().capacidades())
                .isEqualTo(new CapacidadesDoProvedor(false, false, false, 1, false, false, false, false, false));
        var registro = new ProvedoresDePagamento(List.of(new ProvedorManual(), new ProvedorKiwify()));
        assertThat(registro.conhece("KIWIFY")).isTrue();
    }
}
