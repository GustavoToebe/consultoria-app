package br.com.treinos.api.web;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Erro inesperado vai para o log sem a mensagem: erro de banco carrega valores da linha (e-mail, peso). */
class LogSemDadosTest {

    @Test
    void resumoTemAsClassesENaoAMensagem() {
        IllegalStateException causa = new IllegalStateException("Failing row contains (82.4, aluno@exemplo.com)");
        RuntimeException erro = new RuntimeException("Key (email)=(aluno@exemplo.com) already exists", causa);

        String resumo = GlobalExceptionHandler.semDados(erro);

        assertThat(resumo).contains("java.lang.RuntimeException <- java.lang.IllegalStateException");
        assertThat(resumo).doesNotContain("aluno@exemplo.com").doesNotContain("82.4");
    }
}
