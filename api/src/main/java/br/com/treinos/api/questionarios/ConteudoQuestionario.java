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
 * Conteúdo (formato 2) de um questionário de atualização ou de anamnese: é o rascunho e o que cada versão publicada
 * guarda. Como nos demais planos, o rascunho aceita conteúdo incompleto: só forma e tamanho são conferidos aqui; as
 * regras de publicação ficam no {@link ValidadorQuestionario}. Chave desconhecida é descartada ao regravar.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record ConteudoQuestionario(
        Integer formato,
        @Size(max = LimitesQuestionario.INSTRUCOES) List<@NotNull @Size(max = LimitesQuestionario.INSTRUCAO_TAMANHO) String> instrucoes,
        @NotNull @Size(max = LimitesQuestionario.SECOES) List<@NotNull @Valid Secao> secoes) {

    /**
     * {@code descricao} (opcional) é o texto embaixo do título, no formato simples do INFORMATIVO ({@code **negrito**},
     * {@code __sublinhado__}, quebras de linha); {@code mostrarSe} nulo = seção sempre visível.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Secao(
            @Pattern(regexp = LimitesQuestionario.ID_PADRAO) String uid,
            @Size(max = LimitesQuestionario.TITULO_TAMANHO) String titulo,
            @Size(max = LimitesQuestionario.DESCRICAO_SECAO_TAMANHO) String descricao,
            @NotNull @Size(max = LimitesQuestionario.PERGUNTAS_POR_SECAO) List<@NotNull @Valid Pergunta> perguntas,
            @Valid Condicao mostrarSe) {

        public Secao(String uid, String titulo, List<Pergunta> perguntas) {
            this(uid, titulo, null, perguntas, null);
        }
    }

    /**
     * Campos que só valem para alguns tipos: {@code dias} (NOTAS_POR_DIA), {@code opcoes} (escolhas), {@code unidade} e
     * {@code casas} (NUMERO), {@code min} e {@code max} (NUMERO: faixa; NOTA: pontas da escala, 0 ou 1 e de 2 a 10; FOTOS:
     * só {@code max}, fotos aceitas de 1 a 6), {@code rotuloMin} e {@code rotuloMax} (NOTA), {@code somentePassado} (DATA), {@code linhas} e {@code colunas}
     * (GRADE), {@code texto} (ACEITE e INFORMATIVO) e {@code declaracao} (ACEITE). {@code imagemId} e {@code mostrarSe}
     * valem para todos. Só na anamnese: {@code destino} (campo do cadastro que a resposta alimenta) e, no PESO com destino,
     * {@code destinoData} (id da pergunta DATA com a data da pesagem; sem ela, vale a data do envio).
     */
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
            @Min(0) @Max(LimitesQuestionario.CASAS_MAXIMO) Integer casas,
            @Size(max = LimitesQuestionario.ID_TAMANHO) String imagemId,
            Boolean somentePassado,
            @Size(max = LimitesQuestionario.LINHAS_MAXIMO) List<@NotNull @Valid Opcao> linhas,
            @Size(max = LimitesQuestionario.COLUNAS_MAXIMO) List<@NotNull @Valid Opcao> colunas,
            @Size(max = LimitesQuestionario.TEXTO_INFORMATIVO_TAMANHO) String texto,
            @Size(max = LimitesQuestionario.DECLARACAO_TAMANHO) String declaracao,
            @Valid Condicao mostrarSe,
            DestinoNoPerfil destino,
            @Size(max = LimitesQuestionario.ID_TAMANHO) String destinoData,
            @Size(max = LimitesQuestionario.ROTULO_PONTA_TAMANHO) String rotuloMin,
            @Size(max = LimitesQuestionario.ROTULO_PONTA_TAMANHO) String rotuloMax) {

        /** Pergunta sem destino no perfil. */
        public Pergunta(String id, TipoPergunta tipo, String rotulo, Boolean obrigatoria, String ajuda, Boolean destaque,
                        String rotuloCurto, AjudaAutomatica ajudaAutomatica, List<Integer> dias, List<Opcao> opcoes,
                        String unidade, BigDecimal min, BigDecimal max, Integer casas, String imagemId,
                        Boolean somentePassado, List<Opcao> linhas, List<Opcao> colunas, String texto, String declaracao,
                        Condicao mostrarSe) {
            this(id, tipo, rotulo, obrigatoria, ajuda, destaque, rotuloCurto, ajudaAutomatica, dias, opcoes, unidade, min,
                    max, casas, imagemId, somentePassado, linhas, colunas, texto, declaracao, mostrarSe, null, null, null, null);
        }

        /** Pergunta sem os campos da anamnese (imagem, data, grade, aceite, condição, destino). */
        public Pergunta(String id, TipoPergunta tipo, String rotulo, Boolean obrigatoria, String ajuda, Boolean destaque,
                        String rotuloCurto, AjudaAutomatica ajudaAutomatica, List<Integer> dias, List<Opcao> opcoes,
                        String unidade, BigDecimal min, BigDecimal max, Integer casas) {
            this(id, tipo, rotulo, obrigatoria, ajuda, destaque, rotuloCurto, ajudaAutomatica, dias, opcoes, unidade, min,
                    max, casas, null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    /** Opção de escolha, linha ou coluna da GRADE. {@code imagemId} só nas opções de escolha. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Opcao(
            @Pattern(regexp = LimitesQuestionario.ID_PADRAO) String id,
            @Size(max = LimitesQuestionario.OPCAO_TAMANHO) String rotulo,
            @Size(max = LimitesQuestionario.ID_TAMANHO) String imagemId) {

        public Opcao(String id, String rotulo) {
            this(id, rotulo, null);
        }
    }

    /**
     * Condição simples: a pergunta (ou seção) só aparece se a resposta da pergunta {@code perguntaId}, anterior e de
     * escolha (ESCOLHA_UNICA, MULTIPLA_ESCOLHA ou SIM_NAO), for um dos {@code valores} (ids de opção; "sim"/"nao" no
     * SIM_NAO). Oculta não é obrigatória e a resposta dela é descartada no envio.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Condicao(
            @Size(max = LimitesQuestionario.ID_TAMANHO) String perguntaId,
            @Size(max = LimitesQuestionario.OPCOES_MAXIMO) List<@NotNull @Size(max = LimitesQuestionario.ID_TAMANHO) String> valores) { }
}
