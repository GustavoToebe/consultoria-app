package br.com.treinos.api.push;

/**
 * O tipo de um envio da fila {@code push_envio} (V106; V112 acrescenta {@link #ATUALIZACAO_ATENCAO}, o único que vai a um membro). O texto de cada um é fixo aqui, sem dado pessoal, e o {@code data} leva só
 * o código para o app saber para onde ir.
 */
public enum TipoDePush {

    COMPROMISSO("Compromisso atualizado", "Abra o app para ver o que mudou.", "compromisso"),
    PLANO_LIBERADO("Plano liberado", "Seu novo plano está disponível. Abra o app para ver.", "plano"),
    /**
     * Ao responsável do aluno (membro da equipe), quando a atualização enviada teve pontos de atenção (V112, R7): sem nome, sem
     * quantos pontos nem valor, porque o texto passa pelo Expo/APNs/FCM e aparece na tela bloqueada.
     */
    ATUALIZACAO_ATENCAO("Atualização com pontos de atenção", "Abra o app para ver.", "atencao");

    private final String titulo;
    private final String corpo;
    private final String codigoNoApp;

    TipoDePush(String titulo, String corpo, String codigoNoApp) {
        this.titulo = titulo;
        this.corpo = corpo;
        this.codigoNoApp = codigoNoApp;
    }

    String titulo() {
        return titulo;
    }

    String corpo() {
        return corpo;
    }

    String codigoNoApp() {
        return codigoNoApp;
    }
}
