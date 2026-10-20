package br.com.treinos.api.pagamentos.provedor;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** O provedor manual cumpre o contrato: não gera, não consulta e não recebe aviso. */
class ProvedorManualContratoTest extends ProvedorContratoTest {

    @Override
    protected ProvedorDePagamento provedor() {
        return new ProvedorManual();
    }

    @Test
    void ehOProvedorManualSemNenhumaCapacidade() {
        assertThat(provedor().codigo()).isEqualTo("MANUAL");
        assertThat(provedor().capacidades())
                .isEqualTo(new CapacidadesDoProvedor(false, false, false, 1, false, false, false, false, false));
    }

    @Test
    void registroConheceOManualEDuplicidadeDerrubaASubida() {
        var registro = new ProvedoresDePagamento(List.of(new ProvedorManual()));
        assertThat(registro.conhece("MANUAL")).isTrue();
        assertThat(registro.conhece("OUTRO")).isFalse();
        assertThat(registro.buscar("MANUAL")).isPresent();
        assertThatThrownBy(() -> new ProvedoresDePagamento(List.of(new ProvedorManual(), new ProvedorManual())))
                .isInstanceOf(IllegalStateException.class);
    }
}
