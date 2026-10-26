package br.com.treinos.api.biblioteca;

import br.com.plataforma.comum.web.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Leitor de CSV com estado: aspas podem conter quebra de linha, separador e aspas duplicadas. Só dados fictícios. */
class LeitorCsvTest {

    @Test
    void celulaEntreAspasComQuebraDeLinhaContinuaNoMesmoRegistro() {
        var linhas = LeitorCsv.lerLivre("nome;obs\nAna;\"linha 1\nlinha 2\"\nBia;x\n", 100);
        assertThat(linhas).hasSize(3);
        assertThat(linhas.get(1).campos()).containsExactly("Ana", "linha 1\nlinha 2");
        assertThat(linhas.get(2).campos()).containsExactly("Bia", "x");
        // O número é a linha onde o registro começa no arquivo.
        assertThat(linhas).extracting(LeitorCsv.Linha::numero).containsExactly(1, 2, 4);
    }

    @Test
    void quebraCrLfDentroDasAspasEntraComoQuebraDeLinha() {
        var linhas = LeitorCsv.lerLivre("nome;obs\r\nAna;\"a\r\nb\"\r\nBia;x\r\n", 100);
        assertThat(linhas).hasSize(3);
        assertThat(linhas.get(1).campos().get(1)).isEqualTo("a\nb");
    }

    @Test
    void separadorEAspasDuplicadasDentroDasAspas() {
        var linhas = LeitorCsv.lerLivre("a;b\n\"x;y\";\"diz \"\"oi\"\"\"\n", 100);
        assertThat(linhas.get(1).campos()).containsExactly("x;y", "diz \"oi\"");
    }

    @Test
    void separadorVemDaPrimeiraLinhaIgnorandoOQueEstaEntreAspas() {
        var linhas = LeitorCsv.lerLivre("\"nome;completo;x\",email\n\"Ana;Silva\",ana@exemplo.com\n", 100);
        assertThat(linhas.get(0).campos()).containsExactly("nome;completo;x", "email");
        assertThat(linhas.get(1).campos()).containsExactly("Ana;Silva", "ana@exemplo.com");
        // Cabeçalho com quebra de linha entre aspas: a primeira linha só termina fora das aspas.
        var quebrado = LeitorCsv.lerLivre("\"nome\ncompleto\";email;tel\nAna;a@e.com;1\n", 100);
        assertThat(quebrado.get(0).campos()).containsExactly("nome\ncompleto", "email", "tel");
        assertThat(quebrado.get(1).campos()).containsExactly("Ana", "a@e.com", "1");
    }

    @Test
    void aspaNoMeioDoCampoEhLiteralComoNoExcel() {
        var linhas = LeitorCsv.lerLivre("nome;alt\nAna;5'10\"\nO\"Brien;x\nBia;y\n", 100);
        assertThat(linhas).hasSize(4);
        assertThat(linhas.get(1).campos()).containsExactly("Ana", "5'10\"");
        assertThat(linhas.get(2).campos()).containsExactly("O\"Brien", "x");
        assertThat(linhas.get(3).campos()).containsExactly("Bia", "y");
        // No meio do cabeçalho também não conta como aspas ao decidir o separador.
        assertThat(LeitorCsv.lerLivre("a\"b;c;d,e\n1;2;3\n", 100).get(0).campos()).containsExactly("a\"b", "c", "d,e");
    }

    @Test
    void espacoAntesDasAspasQueAbremOCampoContinuaValendo() {
        var linhas = LeitorCsv.lerLivre("a;b\nAna; \"x;y\nz\"\n", 100);
        assertThat(linhas).hasSize(2);
        assertThat(linhas.get(1).campos()).containsExactly("Ana", "x;y\nz");
    }

    @Test
    void aspasSemFecharNoFimDoArquivoSaoErroSemEcoDoConteudo() {
        assertThatThrownBy(() -> LeitorCsv.lerLivre("nome;obs\nAna;\"segredo sem fechar\nBia;x\n", 100))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("O CSV tem aspas sem fechar.")
                .hasMessageNotContaining("segredo");
    }

    @Test
    void mantemBomLinhasVaziasEEspacosDeSempre() {
        var linhas = LeitorCsv.lerLivre("﻿nome;email\r\n\r\n   \r\nAna ; a@e.com \r\n\r\n", 100);
        assertThat(linhas).hasSize(2);
        assertThat(linhas.get(1).campos()).containsExactly("Ana", "a@e.com");
        assertThat(linhas.get(1).numero()).isEqualTo(4);
    }

    @Test
    void recusaArquivoVazioEMaisLinhasQueOMaximo() {
        assertThatThrownBy(() -> LeitorCsv.lerLivre("  \n ", 10))
                .isInstanceOf(BadRequestException.class).hasMessage("O arquivo está vazio.");
        assertThatThrownBy(() -> LeitorCsv.lerLivre("a\nb\nc\n", 2))
                .isInstanceOf(BadRequestException.class).hasMessage("O arquivo passa de 5.000 linhas.");
    }

    @Test
    void lerComCabecalhoTambemRespeitaAspas() {
        var tabela = LeitorCsv.ler("nome;obs\nAna;\"a\nb\"\nBia;x\n", List.of("nome", "obs"));
        assertThat(tabela.separador()).isEqualTo(';');
        assertThat(tabela.linhas()).hasSize(2);
        assertThat(tabela.linhas().get(0).campos()).containsExactly("Ana", "a\nb");
        assertThat(tabela.linhas().get(1).numero()).isEqualTo(4);
    }
}
