package br.com.treinos.api.push;

/**
 * O tipo de um envio da fila {@code push_envio} (V106; V112 acrescenta {@link #ATUALIZACAO_ATENCAO}, o único que vai a um membro).
 * O título e o corpo de cada um são fixos aqui, sem dado pessoal, menos o corpo do {@link #ATUALIZACAO_ATENCAO}, que leva só o
 * primeiro nome do aluno ({@link #corpoDaAtencao}). O {@code data} leva só o código para o app saber para onde ir.
 */
public enum TipoDePush {

    COMPROMISSO("Compromisso atualizado", "Abra o app para ver o que mudou.", "compromisso"),
    PLANO_LIBERADO("Plano liberado", "Seu novo plano está disponível. Abra o app para ver.", "plano"),
    /**
     * Ao responsável do aluno (membro da equipe), quando a atualização enviada teve pontos de atenção (V112, R7). O corpo leva só o
     * primeiro nome do aluno (decisão do Gustavo, 27/11), nunca peso, nota, motivo, quantos pontos nem outro dado de saúde, porque
     * o texto passa pelo Expo/APNs/FCM e aparece na tela bloqueada. Sem um aluno só a nomear, o corpo daqui, sem nome.
     */
    ATUALIZACAO_ATENCAO("Atualização com pontos de atenção", "Novo ponto de atenção. Abra o app para ver.", "atencao");

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

    /**
     * O corpo do {@link #ATUALIZACAO_ATENCAO}: "Novo ponto de atenção: Ana. Abra o app para ver." com o primeiro nome (a primeira
     * palavra do nome; minimização). Nome nulo ou em branco: o corpo sem nome.
     */
    static String corpoDaAtencao(String nomeDoAluno) {
        String primeiro = nomeDoAluno == null || nomeDoAluno.isBlank() ? null : nomeDoAluno.strip().split("\\s+", 2)[0];
        return primeiro == null ? ATUALIZACAO_ATENCAO.corpo : "Novo ponto de atenção: " + primeiro + ". Abra o app para ver.";
    }
}
