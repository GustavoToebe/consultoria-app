package br.com.treinos.api.importacao.assistida;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PistaDeIdentidadeTest {

    @Test
    void extraiNomeDeArquivosComPadroesComunsDeTreinador() {
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("Treino - Maria Santos.pdf"))
                .isEqualTo("Maria Santos");
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("Dieta João da Silva 2026.docx"))
                .isEqualTo("João da Silva");
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("Ficha_Lucas_Eduardo_Santos_v2.xlsx"))
                .isEqualTo("Lucas Eduardo Santos");
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("plano-carlos-oliveira.csv"))
                .isEqualTo("Carlos Oliveira");
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("Copia de Treino - Ana Clara.pdf"))
                .isEqualTo("Ana Clara");
    }

    @Test
    void extraiNomeDoCabecalhoDoDocumento() {
        String doc = """
                CONSULTORIA ESPORTIVA
                Aluno: Gabriel Henrique de Souza
                Objetivo: Hipertrofia
                Início: 10/01/2026
                """;
        assertThat(PistaDeIdentidade.extrairDoCabecalho(doc))
                .isEqualTo("Gabriel Henrique de Souza");
    }

    @Test
    void arquivoGenericoNaoGeraNomeInvalido() {
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("treino.pdf")).isEmpty();
        assertThat(PistaDeIdentidade.extrairDoNomeDoArquivo("dieta_2026.docx")).isEmpty();
    }
}
