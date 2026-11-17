package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.ChavePix.Tipo;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Normalização, conferência e máscara da chave Pix por tipo. Só dados fictícios (documentos de exemplo públicos). */
class ChavePixTest {

    @Test
    void cpfSoComOsDigitosEComDigitoVerificador() {
        assertThat(ChavePix.normalizar(Tipo.CPF, "529.982.247-25")).isEqualTo("52998224725");
        assertThat(ChavePix.normalizar(Tipo.CPF, " 52998224725 ")).isEqualTo("52998224725");
        assertThat(ChavePix.normalizar(Tipo.CPF, "529.982.247-24")).isNull();
        assertThat(ChavePix.normalizar(Tipo.CPF, "111.111.111-11")).isNull();
        assertThat(ChavePix.normalizar(Tipo.CPF, "5299822472")).isNull();
        assertThat(ChavePix.normalizar(Tipo.CPF, "529.982.247-2a")).isNull();
    }

    @Test
    void cnpjSoComOsCaracteresEComDigitoVerificador() {
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "11.222.333/0001-81")).isEqualTo("11222333000181");
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "11222333000182")).isNull();
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "00000000000000")).isNull();
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "1122233300018")).isNull();
    }

    @Test
    void cnpjAlfanumericoDoExemploOficial() {
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "12.ABC.345/01DE-35")).isEqualTo("12ABC34501DE35");
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "12abc34501de35")).isEqualTo("12ABC34501DE35");
        assertThat(ChavePix.normalizar(Tipo.CNPJ, "12.ABC.345/01DE-36")).isNull();
    }

    @Test
    void telefoneBrasileiroSaiComMais55() {
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "(45) 99999-8888")).isEqualTo("+5545999998888");
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "+55 45 99999-8888")).isEqualTo("+5545999998888");
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "5545999998888")).isEqualTo("+5545999998888");
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "4533334444")).isEqualTo("+554533334444");
        // DDD 55 com onze dígitos não perde o DDD.
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "55999998888")).isEqualTo("+5555999998888");
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "99999-8888")).isNull();
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "(45) 99999-88ab")).isNull();
        assertThat(ChavePix.normalizar(Tipo.TELEFONE, "(05) 99999-8888")).isNull();
    }

    @Test
    void emailEmMinusculasEComFormaValida() {
        assertThat(ChavePix.normalizar(Tipo.EMAIL, "  Fulano.Tal@Example.COM ")).isEqualTo("fulano.tal@example.com");
        assertThat(ChavePix.normalizar(Tipo.EMAIL, "sem-arroba.example.com")).isNull();
        assertThat(ChavePix.normalizar(Tipo.EMAIL, "a@b")).isNull();
        assertThat(ChavePix.normalizar(Tipo.EMAIL, "a b@example.com")).isNull();
        assertThat(ChavePix.normalizar(Tipo.EMAIL, "a".repeat(70) + "@example.com")).isNull();
    }

    @Test
    void chaveAleatoriaEUuidEmMinusculas() {
        assertThat(ChavePix.normalizar(Tipo.ALEATORIA, "123E4567-E12B-12D1-A456-426655440000"))
                .isEqualTo("123e4567-e12b-12d1-a456-426655440000");
        assertThat(ChavePix.normalizar(Tipo.ALEATORIA, "123e4567e12b12d1a456426655440000")).isNull();
        assertThat(ChavePix.normalizar(Tipo.ALEATORIA, "123e4567-e12b-12d1-a456-42665544000g")).isNull();
    }

    @Test
    void entradaAusenteOuAbsurdaNaoLanca() {
        assertThat(ChavePix.normalizar(null, "x")).isNull();
        assertThat(ChavePix.normalizar(Tipo.CPF, null)).isNull();
        assertThat(ChavePix.normalizar(Tipo.EMAIL, "a".repeat(5000))).isNull();
        assertThat(ChavePix.normalizar(Tipo.CPF, "")).isNull();
    }

    @Test
    void mascaraMostraSoOFimENuncaAChaveInteira() {
        assertThat(ChavePix.mascarar(Tipo.CPF, "52998224725")).isEqualTo("***.***.***-25");
        assertThat(ChavePix.mascarar(Tipo.CNPJ, "11222333000181")).isEqualTo("**.***.***/****-81");
        assertThat(ChavePix.mascarar(Tipo.TELEFONE, "+5545999998888")).isEqualTo("+55 ** *****-8888");
        assertThat(ChavePix.mascarar(Tipo.EMAIL, "fulano@example.com")).isEqualTo("f***@example.com");
        assertThat(ChavePix.mascarar(Tipo.ALEATORIA, "123e4567-e12b-12d1-a456-426655440000")).isEqualTo("****-0000");
        assertThat(ChavePix.mascarar(Tipo.CPF, null)).isNull();
        assertThat(ChavePix.mascarar(null, "x")).isNull();
    }
}
