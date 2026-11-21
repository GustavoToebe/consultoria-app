package br.com.treinos.api.whatsapp;

/**
 * O que a consultoria avisa pelo WhatsApp, cada tipo com o seu modelo (template) da Meta. Os três primeiros são os de
 * {@code TipoDeLembrete} (lembrete de cobrança, mesmos nomes); os outros, o compromisso marcado, remarcado ou cancelado.
 */
public enum TipoDeAviso {
    ANTES, NO_DIA, DEPOIS, COMPROMISSO_NOVO, COMPROMISSO_REMARCADO, COMPROMISSO_CANCELADO;

    /** Aviso de cobrança (a referência é a cobrança); senão, de compromisso (a referência é o compromisso). */
    public boolean ehLembrete() {
        return this == ANTES || this == NO_DIA || this == DEPOIS;
    }
}
