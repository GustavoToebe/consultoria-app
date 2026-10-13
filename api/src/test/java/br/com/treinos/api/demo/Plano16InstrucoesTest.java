package br.com.treinos.api.demo;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O importador roda num container que não lê a constante Java, então o texto das instruções do Plano 16 existe nos dois
 * lugares. Este teste impede que um mude sem o outro.
 */
class Plano16InstrucoesTest {

    @Test
    void textoDoImportadorEIgualAoDoSeed() throws Exception {
        Path arquivo = Path.of("..", "scripts", "importacao", "dados", "instrucoes-plano16.txt");
        assertThat(Files.readString(arquivo)).isEqualTo(Plano16.INSTRUCOES);
    }
}
