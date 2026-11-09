package br.com.treinos.api.importacao.assistida;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RedatorLgpdImportacaoTest {

    @Test
    void redigeCpfEmailTelefoneECepSemVazarDadosReais() {
        String texto = """
                Ficha do Aluno
                Nome: João Silva
                CPF: 123.456.789-00
                Email: joao.silva@exemplo.com.br
                WhatsApp: (11) 98765-4321
                Endereço: Rua Fictícia, CEP: 01310-100
                Treino: Supino 4x10
                """;

        RedatorLgpdImportacao.RedacaoResultado r = RedatorLgpdImportacao.redigir(texto);

        assertThat(r.textoRedigido()).doesNotContain("123.456.789-00");
        assertThat(r.textoRedigido()).doesNotContain("joao.silva@exemplo.com.br");
        assertThat(r.textoRedigido()).doesNotContain("98765-4321");
        assertThat(r.textoRedigido()).doesNotContain("01310-100");

        assertThat(r.textoRedigido()).contains("[CPF_EXTRAIDO]");
        assertThat(r.textoRedigido()).contains("[EMAIL_EXTRAIDO]");
        assertThat(r.textoRedigido()).contains("[TELEFONE_EXTRAIDO]");
        assertThat(r.textoRedigido()).contains("[CEP_EXTRAIDO]");

        assertThat(r.primeiroCpf()).isEqualTo("123.456.789-00");
        assertThat(r.primeiroEmail()).isEqualTo("joao.silva@exemplo.com.br");
        assertThat(r.primeiroTelefone()).contains("98765-4321");
        assertThat(r.ceps()).contains("01310-100");

        // Preserva o treino
        assertThat(r.textoRedigido()).contains("Supino 4x10");
    }

    @Test
    void textoSemDadosPessoaisPermaneceInalterado() {
        String treino = "Treino A - Peito\n1. Supino Reto 4x8-10 60s";
        RedatorLgpdImportacao.RedacaoResultado r = RedatorLgpdImportacao.redigir(treino);
        assertThat(r.textoRedigido().strip()).isEqualTo(treino);
        assertThat(r.cpfs()).isEmpty();
        assertThat(r.emails()).isEmpty();
        assertThat(r.telefones()).isEmpty();
    }
}
