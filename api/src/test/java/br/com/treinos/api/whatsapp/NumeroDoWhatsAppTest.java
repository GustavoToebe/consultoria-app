package br.com.treinos.api.whatsapp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** O número como a Cloud API o quer: só dígitos com 55; o que não parece número brasileiro completo não vira destino. */
class NumeroDoWhatsAppTest {

    @Test
    void numeroBrasileiroVira55ComDdd() {
        assertThat(NumeroDoWhatsApp.de("(45) 99999-8888")).contains("5545999998888");
        assertThat(NumeroDoWhatsApp.de("45 3333-4444")).contains("554533334444");
        assertThat(NumeroDoWhatsApp.de("+55 (11) 98888-7777")).contains("5511988887777");
        assertThat(NumeroDoWhatsApp.de("554533334444")).contains("554533334444");
    }

    @Test
    void oQueNaoServeNaoViraDestino() {
        assertThat(NumeroDoWhatsApp.de(null)).isEmpty();
        assertThat(NumeroDoWhatsApp.de("")).isEmpty();
        assertThat(NumeroDoWhatsApp.de("99999-8888")).as("sem DDD").isEmpty();
        assertThat(NumeroDoWhatsApp.de("+44 20 7946 0958")).as("12 dígitos que não começam com 55").isEmpty();
        assertThat(NumeroDoWhatsApp.de("abc")).isEmpty();
        assertThat(NumeroDoWhatsApp.de("1".repeat(20))).isEmpty();
    }
}
