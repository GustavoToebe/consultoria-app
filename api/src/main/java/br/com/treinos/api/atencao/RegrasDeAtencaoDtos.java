package br.com.treinos.api.atencao;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Contrato de {@code GET|PUT /regras-de-atencao} (C1 e C2 de {@code docs/planos/regras-de-atencao.md}). */
public final class RegrasDeAtencaoDtos {

    private RegrasDeAtencaoDtos() {
    }

    /**
     * A lista inteira da consultoria. {@code versao} identifica o estado da lista (muda quando uma regra entra, sai ou muda) e volta
     * no PUT; {@code teto} é o máximo de regras; {@code perguntas} são as que as regras de pergunta podem escolher.
     */
    public record RegrasDeAtencao(long versao, int teto, List<PerguntaDisponivel> perguntas, List<Regra> regras) { }

    /** {@code alunosComExcecao}: só a contagem (etapa 2; até lá, 0). */
    public record Regra(UUID id, String tipo, String perguntaId, BigDecimal limite, boolean ativa, long alunosComExcecao) { }

    /**
     * Pergunta NOTA, SIM_NAO ou ITENS_DO_PLANO de algum questionário de atualização publicado e ativo. {@code escala} só na NOTA
     * (com o mesmo id em questionários de escalas diferentes, a união delas).
     */
    public record PerguntaDisponivel(String perguntaId, String tipo, String rotulo, Escala escala,
            List<QuestionarioDaPergunta> questionarios) { }

    public record Escala(int min, int max) { }

    public record QuestionarioDaPergunta(UUID id, String nome) { }

    /** Salvar em lote atômico: o corpo é a lista inteira; a regra que sai dele é apagada. */
    public record SalvarRequest(Long versao, @NotNull List<RegraRequest> regras) { }

    /** Sem {@code id} = regra nova. {@code ativa} ausente = ligada. Campo que o modelo não usa é ignorado. */
    public record RegraRequest(UUID id, String tipo, String perguntaId, BigDecimal limite, Boolean ativa) { }
}
