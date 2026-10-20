package br.com.treinos.api.pagamentos.provedor;

/**
 * Um jeito de receber: o treinador dando a baixa à mão ({@link ProvedorManual}) ou, na Fase 2, um provedor que gera link
 * e avisa por webhook. O núcleo só fala com esta interface e com os tipos normalizados daqui; nada do formato de um
 * provedor específico vaza para fora do adaptador dele. Operação que o provedor não faz lança
 * {@link OperacaoNaoSuportadaException}, e as {@link #capacidades()} dizem de antemão quais são.
 */
public interface ProvedorDePagamento {

    /** Código estável gravado em {@code cobranca_aluno.provedor}: maiúsculas, dígitos e sublinhado, até 30. */
    String codigo();

    CapacidadesDoProvedor capacidades();

    CobrancaGerada gerarCobranca(PedidoDeCobranca pedido);

    /** O estado de uma cobrança no provedor, perguntado a ele. É a fonte da baixa, nunca o corpo de um webhook. */
    ConsultaDeCobranca consultar(String idExterno);

    /**
     * Lê um aviso do provedor. O resultado é só um gatilho (qual cobrança conferir): a baixa vem de {@link #consultar}.
     * Aviso que não passa na conferência do adaptador lança {@link WebhookInvalidoException}.
     */
    EventoDeWebhook lerWebhook(RequisicaoDeWebhook requisicao);
}
