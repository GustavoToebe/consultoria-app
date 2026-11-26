package br.com.treinos.api.contratos;

import br.com.treinos.api.contratos.CamposDoContrato.Campo;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Campos do modelo (D9) e hash do texto (D22), sem banco. Só dados fictícios. */
class CamposETextoDoContratoTest {

    @Test
    void acharOsCamposUsadosContarOsDesconhecidosEPreencherSoOQueTemValor() {
        String texto = "{aluno_nome} contrata de {vigencia_inicio} a {vigencia_fim}. {campo_inventado} e {aluno_nome} de novo.";

        assertThat(CamposDoContrato.usados(texto)).containsExactlyInAnyOrder(Campo.ALUNO_NOME, Campo.VIGENCIA_INICIO, Campo.VIGENCIA_FIM);
        assertThat(CamposDoContrato.desconhecidos(texto)).isEqualTo(1);
        // Sem valor, o campo e o que não é campo ficam como estão; o valor com "$" e "\" entra literal.
        assertThat(CamposDoContrato.preencher(texto, Map.of(Campo.ALUNO_NOME, "Ana $1 \\ Teste", Campo.VIGENCIA_INICIO, "01/01/2030")))
                .isEqualTo("Ana $1 \\ Teste contrata de 01/01/2030 a {vigencia_fim}. {campo_inventado} e Ana $1 \\ Teste de novo.");
    }

    @Test
    void aListaDeCodigosEOExemploCobremTodosOsCampos() {
        assertThat(CamposDoContrato.codigos()).hasSize(Campo.values().length).contains("aluno_cpf", "valor_total", "data");
        assertThat(CamposDoContrato.exemplo()).containsKeys(Campo.values());
    }

    @Test
    void oHashNormalizaQuebrasENfcEEHexMinusculoDe64() {
        // "é" decomposto e com CRLF dá o mesmo hash que "é" composto e com LF.
        String composto = TextoDoContrato.normalizar("Olá\né");
        String decomposto = TextoDoContrato.normalizar("Olá\r\né");

        assertThat(decomposto).isEqualTo(composto);
        assertThat(TextoDoContrato.sha256(decomposto)).isEqualTo(TextoDoContrato.sha256(composto)).matches("[0-9a-f]{64}");
        assertThat(TextoDoContrato.sha256("a")).isEqualTo("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
    }
}
