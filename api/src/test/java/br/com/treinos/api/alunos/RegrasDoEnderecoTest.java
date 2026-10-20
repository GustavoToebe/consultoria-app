package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.RegrasDoEndereco.Erro;
import br.com.treinos.api.alunos.RegrasDoEndereco.Resultado;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** A regra única do endereço (sem Docker). Dados fictícios. */
class RegrasDoEnderecoTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private static Endereco completo() {
        return new Endereco("85800-000", "Rua das Flores", "100", "Apto 2", "Centro", "Cidade Exemplo", "PR");
    }

    private static List<String> campos(Resultado r) {
        return r.erros().stream().map(Erro::campo).toList();
    }

    @Test
    void semEnderecoOuTudoEmBrancoEValidoESaiNulo() {
        assertThat(RegrasDoEndereco.normalizar(null)).isEqualTo(new Resultado(null, List.of()));
        Resultado branco = RegrasDoEndereco.normalizar(new Endereco(null, "", "  ", "\t", " ", null, ""));
        assertThat(branco.valido()).isTrue();
        assertThat(branco.endereco()).isNull();
    }

    @Test
    void normalizaStripCepEUf() {
        Resultado r = RegrasDoEndereco.normalizar(new Endereco(" 85800000 ", " Rua das Flores ", " s/n ", "  ", " Centro ",
                " Cidade Exemplo ", " pr "));
        assertThat(r.valido()).isTrue();
        assertThat(r.endereco()).isEqualTo(new Endereco("85800-000", "Rua das Flores", "s/n", null, "Centro", "Cidade Exemplo", "PR"));
    }

    @Test
    void complementoEBairroSaoOpcionais() {
        Resultado r = RegrasDoEndereco.normalizar(new Endereco("85800-000", "Rua A", "1", null, null, "Cidade", "SP"));
        assertThat(r.valido()).isTrue();
        assertThat(r.endereco().complemento()).isNull();
        assertThat(r.endereco().bairro()).isNull();
    }

    @Test
    void numeroAceitaQualquerTextoNaoVazio() {
        for (String numero : new String[] {"s/n", "SN", "KM 12", "0", "abc"}) {
            assertThat(RegrasDoEndereco.normalizar(new Endereco("85800-000", "Rua A", numero, null, null, "Cidade", "SP")).valido())
                    .as(numero).isTrue();
        }
    }

    @Test
    void faltaDeCampoObrigatorioMarcaCadaUmComMensagemFixa() {
        Resultado soCidade = RegrasDoEndereco.normalizar(new Endereco(null, null, null, null, null, "Cidade Exemplo", null));
        assertThat(soCidade.endereco()).isNull();
        assertThat(soCidade.erros()).containsExactly(
                new Erro("cep", "Informe o CEP."),
                new Erro("logradouro", "Informe a rua, avenida ou logradouro."),
                new Erro("numero", "Informe o número (ou s/n)."),
                new Erro("uf", "Informe a UF."));

        Resultado semCidade = RegrasDoEndereco.normalizar(new Endereco("85800-000", "Rua A", "1", "Casa", "Centro", " ", "PR"));
        assertThat(semCidade.erros()).containsExactly(new Erro("cidade", "Informe a cidade."));
    }

    @Test
    void cepEUfMalformadosTemAMensagemDeFormato() {
        Resultado r = RegrasDoEndereco.normalizar(new Endereco("123", "Rua A", "1", null, null, "Cidade", "XX"));
        assertThat(r.erros()).containsExactly(new Erro("cep", "CEP inválido."), new Erro("uf", "UF inválida."));
        // Acima do limite do campo também: a mensagem é a de formato (o limite do CEP é 9, o da UF é 2).
        Resultado longos = RegrasDoEndereco.normalizar(new Endereco("85800-0000", "Rua A", "1", null, null, "Cidade", "SPS"));
        assertThat(longos.erros()).containsExactly(new Erro("cep", "CEP inválido."), new Erro("uf", "UF inválida."));
    }

    @Test
    void limiteContaDepoisDoStripEExcessoTemMensagemFixaSemOValor() {
        String x200 = "x".repeat(200);
        assertThat(RegrasDoEndereco.normalizar(new Endereco("85800-000", " " + x200 + " ", "1", null, null, "Cidade", "PR")).endereco()
                .logradouro()).isEqualTo(x200);

        String x201 = "x".repeat(201);
        Resultado longo = RegrasDoEndereco.normalizar(new Endereco("85800-000", " " + x201 + " ", "1".repeat(21), "c".repeat(101),
                "b".repeat(101), "d".repeat(101), "PR"));
        assertThat(longo.erros()).containsExactly(
                new Erro("logradouro", "Use no máximo 200 caracteres."),
                new Erro("numero", "Use no máximo 20 caracteres."),
                new Erro("complemento", "Use no máximo 100 caracteres."),
                new Erro("bairro", "Use no máximo 100 caracteres."),
                new Erro("cidade", "Use no máximo 100 caracteres."));
        assertThat(longo.erros().toString()).doesNotContain("xxx");
    }

    @Test
    void daRespostaUsaAMesmaRegraEExigeFormaCerta() throws Exception {
        assertThat(RegrasDoEndereco.daResposta(json.readTree("{\"cep\":\"85800000\",\"logradouro\":\" Rua A \",\"numero\":\"s/n\","
                + "\"cidade\":\"Cidade\",\"uf\":\"pr\"}")).endereco())
                .isEqualTo(new Endereco("85800-000", "Rua A", "s/n", null, null, "Cidade", "PR"));
        assertThat(RegrasDoEndereco.daResposta(json.readTree("{}")).endereco()).isNull();
        assertThat(RegrasDoEndereco.daResposta(json.readTree("{\"cep\":\"\",\"cidade\":\" \"}")).valido()).isTrue();
        assertThat(campos(RegrasDoEndereco.daResposta(json.readTree("{\"cidade\":\"Cidade\"}")))).containsExactly("cep", "logradouro", "numero", "uf");

        for (String forma : new String[] {"{\"rua\":\"x\"}", "{\"numero\":10}", "{\"numero\":null}", "\"Rua A, 1\"", "[\"Rua\"]", "null"}) {
            JsonNode no = json.readTree(forma);
            Resultado r = RegrasDoEndereco.daResposta(no);
            assertThat(r.valido()).as(forma).isFalse();
            assertThat(r.erros()).as(forma).containsExactly(new Erro(null, "Endereço inválido."));
        }
    }

    @Test
    void ficha_e_resposta_dao_o_mesmo_resultado() throws Exception {
        Resultado daFicha = RegrasDoEndereco.normalizar(new Endereco(" 85800000", " Rua A ", " 1", "", "Centro ", "Cidade", " sp"));
        Resultado daResposta = RegrasDoEndereco.daResposta(json.readTree("{\"cep\":\" 85800000\",\"logradouro\":\" Rua A \",\"numero\":\" 1\","
                + "\"complemento\":\"\",\"bairro\":\"Centro \",\"cidade\":\"Cidade\",\"uf\":\" sp\"}"));
        assertThat(daResposta).isEqualTo(daFicha);
        assertThat(daFicha.endereco()).isEqualTo(new Endereco("85800-000", "Rua A", "1", null, "Centro", "Cidade", "SP"));
        assertThat(completo().toString()).doesNotContain("Flores"); // o toString do record não mostra o dado
    }
}
