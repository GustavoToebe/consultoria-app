package br.com.treinos.api.web;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.Documentos;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Formatos do cadastro. CPFs são fictícios: gerados por cálculo do dígito verificador ({@link Documentos}). */
class FormatosTest {

    @Test
    void cpfValidoSaiFormatadoComOuSemPontuacao() {
        // 529.982.247-25 é o CPF de teste conhecido (nove dígitos de exemplo mais os verificadores).
        assertThat(Documentos.comVerificadores("529982247")).isEqualTo("529.982.247-25");
        assertThat(Formatos.cpf("529.982.247-25")).isEqualTo("529.982.247-25");
        assertThat(Formatos.cpf("52998224725")).isEqualTo("529.982.247-25");
        assertThat(Formatos.cpf("  529 982 247 25 ")).isEqualTo("529.982.247-25");
        for (int i = 0; i < 50; i++) {
            String gerado = Documentos.cpf();
            assertThat(Formatos.cpf(Documentos.semPontuacao(gerado))).isEqualTo(gerado);
        }
    }

    @Test
    void cpfVazioViraNulo() {
        assertThat(Formatos.cpf(null)).isNull();
        assertThat(Formatos.cpf("")).isNull();
        assertThat(Formatos.cpf("   ")).isNull();
    }

    @Test
    void cpfInvalidoNaoRepeteOValorNaMensagem() {
        for (String ruim : new String[] {"529.982.247-26", "111.111.111-11", "000.000.000-00", "529.982.247", "529.982.247-255", "abc"}) {
            assertThatThrownBy(() -> Formatos.cpf(ruim)).isInstanceOf(BadRequestException.class)
                    .hasMessage("CPF inválido.");
        }
    }

    @Test
    void cepSaiFormatado() {
        assertThat(Formatos.cep("85800000")).isEqualTo("85800-000");
        assertThat(Formatos.cep("85800-000")).isEqualTo("85800-000");
        assertThat(Formatos.cep(" ")).isNull();
        assertThatThrownBy(() -> Formatos.cep("8580-000")).isInstanceOf(BadRequestException.class).hasMessage("CEP inválido.");
    }

    @Test
    void ufEmMaiusculasEDas27Siglas() {
        assertThat(Formatos.UFS).hasSize(27);
        assertThat(Formatos.uf(" pr ")).isEqualTo("PR");
        assertThat(Formatos.uf("")).isNull();
        assertThatThrownBy(() -> Formatos.uf("XX")).isInstanceOf(BadRequestException.class).hasMessage("UF inválida.");
    }

    @Test
    void telefoneContinuaComOMesmoFormato() {
        assertThat(Formatos.telefone("45999998888")).isEqualTo("(45) 99999-8888");
        assertThat(Formatos.telefone("+55 (45) 3333-4444")).isEqualTo("(45) 3333-4444");
        assertThat(Formatos.telefone(" ")).isNull();
        assertThatThrownBy(() -> Formatos.telefone("(45) 9999-8888")).isInstanceOf(BadRequestException.class);
    }
}
