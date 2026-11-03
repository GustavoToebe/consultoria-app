package br.com.treinos.api.consultoria;

/**
 * Direção do peso que o treinador quer para o aluno. O app só usa para pintar a variação; o sistema não opina sobre
 * saúde. A do aluno é dado sensível (nunca em log nem em auditoria).
 */
public enum MetaDoPeso {
    REDUZIR,
    AUMENTAR,
    SEM_META;

    /** A do aluno, senão a da consultoria. */
    public static MetaDoPeso efetiva(MetaDoPeso doAluno, MetaDoPeso daConsultoria) {
        return doAluno != null ? doAluno : daConsultoria;
    }
}
