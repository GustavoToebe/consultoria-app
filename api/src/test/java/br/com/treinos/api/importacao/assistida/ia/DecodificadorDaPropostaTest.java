package br.com.treinos.api.importacao.assistida.ia;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Termo de dúvida sem letra nem dígito ("", "**", "-", "—") não vira dúvida; a regra é aplicada em `ImportacaoAssistidaService`. */
class DecodificadorDaPropostaTest {

    @Test
    void semConteudoReconheceLetraEDigito() {
        assertThat(TermoDeDuvida.semConteudo(null)).isTrue();
        assertThat(TermoDeDuvida.semConteudo("")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("   ")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("**")).isTrue();
        assertThat(TermoDeDuvida.semConteudo(" — * ")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("(…)")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("21")).isFalse();
        assertThat(TermoDeDuvida.semConteudo("Remada")).isFalse();
    }
}
