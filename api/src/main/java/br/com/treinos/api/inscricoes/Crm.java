package br.com.treinos.api.inscricoes;

/**
 * Listas fechadas do CRM de interessados (V045). Os nomes são os códigos gravados no banco e trocados com o app
 * ({@code app/src/api/inscricoesTipos.ts}); os rótulos ficam no app.
 */
public final class Crm {

    private Crm() { }

    /** Motivo de perda ou desistência. Nulo nas inscrições antigas ("Não informado"). */
    public enum MotivoEncerramento { PRECO, SEM_RETORNO, MOMENTO, OUTRO_SERVICO, SERVICO_INCOMPATIVEL, OUTRO }

    /** Modalidade negociada na proposta. */
    public enum Modalidade { ONLINE, PRESENCIAL, HIBRIDO }

    /** Periodicidade da proposta (os mesmos códigos do plano comercial do Financeiro). */
    public enum Periodicidade { MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL, PARCELA_UNICA }

    /** O que a pessoa procura (formulário público). */
    public enum Interesse { TREINO, DIETA, TREINO_E_DIETA, NAO_SEI }

    /** Como a pessoa prefere o acompanhamento (formulário público). */
    public enum ModalidadeDesejada { ONLINE, PRESENCIAL, HIBRIDO, NAO_SEI }

    /** Quando a pessoa quer começar (formulário público). */
    public enum PrevisaoInicio { AGORA, ESTE_MES, PROXIMO_MES, NAO_SEI }

    /** "Como conheceu a consultoria", respondido no formulário. */
    public enum OrigemInformada { INDICACAO, INSTAGRAM, GOOGLE, OUTRA }

    /** Origem da equipe: começa pela respondida (ou pelo link) e pode ser corrigida. */
    public enum Origem { INDICACAO, INSTAGRAM, GOOGLE, CAMPANHA, OUTRA }

    /** Tipos de evento do histórico. */
    public enum TipoEvento {
        CRIADA, ETAPA, RESPONSAVEL, PAGAMENTO, ENCERRADA, REABERTA, ACEITA, PROPOSTA, MENSAGEM_PREPARADA,
        RETORNO_MARCADO, RETORNO_ALTERADO, RETORNO_CONCLUIDO, RELACIONADA, RELACAO_DESFEITA, ORIGEM
    }

    /** O que se fez com a mensagem preparada. Nunca "enviada": o app não sabe. */
    public enum AcaoDaMensagem { COPIADA, WHATSAPP_ABERTO }

    /** Origem a partir do parâmetro do link (já validado): os nomes conhecidos; qualquer outro é campanha. */
    static Origem origemDoLink(String link) {
        if (link == null) return null;
        return switch (link) {
            case "instagram", "ig" -> Origem.INSTAGRAM;
            case "google" -> Origem.GOOGLE;
            case "indicacao" -> Origem.INDICACAO;
            default -> Origem.CAMPANHA;
        };
    }

    /** O parâmetro {@code ?origem=} do link só vale com até 40 de {@code [a-z0-9_-]}; outro valor é ignorado. */
    static String origemLinkValida(String valor) {
        if (valor == null) return null;
        String limpo = valor.trim().toLowerCase(java.util.Locale.ROOT);
        return limpo.matches("[a-z0-9_-]{1,40}") ? limpo : null;
    }

    /** {@code R$ 1.234,56} (texto do histórico da proposta). */
    static String reais(long centavos) {
        long abs = Math.abs(centavos);
        String inteiros = String.format(java.util.Locale.ROOT, "%,d", abs / 100).replace(',', '.');
        return (centavos < 0 ? "-" : "") + "R$ " + inteiros + "," + String.format(java.util.Locale.ROOT, "%02d", abs % 100);
    }
}
