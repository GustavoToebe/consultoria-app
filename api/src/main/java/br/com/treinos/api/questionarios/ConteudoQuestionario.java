package br.com.treinos.api.questionarios;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Conteúdo (formato 2) de um questionário de atualização: é o rascunho e o que cada versão publicada guarda. Como nos
 * demais planos, o rascunho aceita conteúdo incompleto: só forma e tamanho são conferidos aqui; as regras de publicação
 * ficam no {@link ValidadorQuestionario}. Chave desconhecida é descartada ao regravar.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record ConteudoQuestionario(
        Integer formato,
        @Size(max = LimitesQuestionario.INSTRUCOES) List<@NotNull @Size(max = LimitesQuestionario.INSTRUCAO_TAMANHO) String> instrucoes,
        @NotNull @Size(max = LimitesQuestionario.SECOES) List<@NotNull @Valid Secao> secoes) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Secao(
            @Pattern(regexp = LimitesQuestionario.ID_PADRAO) String uid,
            @Size(max = LimitesQuestionario.TITULO_TAMANHO) String titulo,
            @NotNull @Size(max = LimitesQuestionario.PERGUNTAS_POR_SECAO) List<@NotNull @Valid Pergunta> perguntas) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Pergunta(
            @Pattern(regexp = LimitesQuestionario.ID_PADRAO) String id,
            @NotNull TipoPergunta tipo,
            @Size(max = LimitesQuestionario.ROTULO_TAMANHO) String rotulo,
            Boolean obrigatoria,
            @Size(max = LimitesQuestionario.AJUDA_TAMANHO) String ajuda,
            Boolean destaque,
            @Size(max = LimitesQuestionario.ROTULO_CURTO_TAMANHO) String rotuloCurto,
            AjudaAutomatica ajudaAutomatica,
            @Size(max = LimitesQuestionario.DIAS_MAXIMO) List<Integer> dias,
            @Size(max = LimitesQuestionario.OPCOES_MAXIMO) List<@NotNull @Valid Opcao> opcoes,
            @Size(max = LimitesQuestionario.UNIDADE_TAMANHO) String unidade,
            BigDecimal min,
            BigDecimal max,
            @Min(0) @Max(LimitesQuestionario.CASAS_MAXIMO) Integer casas) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Opcao(
            @Pattern(regexp = LimitesQuestionario.ID_PADRAO) String id,
            @Size(max = LimitesQuestionario.OPCAO_TAMANHO) String rotulo) { }
}
