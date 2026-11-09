package br.com.treinos.api.importacao.assistida;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExtratorTextoLivreTest {

    @Test
    void quebraTextoColadoEmBlocosPorSecoes() {
        String texto = """
                Treino A - Peito
                1. Supino Reto 4x10
                2. Supino Inclinado 3x12
                
                Treino B - Costas
                1. Puxada Frontal 4x10
                2. Remada Curvada 3x10
                """;

        ResultadoExtracao res = ExtratorTextoLivre.extrair("WhatsApp Treinador", texto);

        assertThat(res.formato()).isEqualTo("TEXTO_LIVRE");
        assertThat(res.blocos()).hasSize(2);
        assertThat(res.blocos().get(0).titulo()).contains("Treino A");
        assertThat(res.blocos().get(1).titulo()).contains("Treino B");
    }
}
