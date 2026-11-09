package br.com.treinos.api.questionarios.dto;

import br.com.treinos.api.questionarios.ConteudoQuestionario;
import br.com.treinos.api.questionarios.Finalidade;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos de {@code /questionarios} (atualização e anamnese). Nome e conteúdo do questionário nunca vão para log nem auditoria. */
public final class QuestionarioDtos {

    private QuestionarioDtos() { }

    public enum Origem { VAZIO, FABRICA }

    /** Quantos alunos e pastas o escolheram e quantos envios (atualizações enviadas ou anamneses atribuídas) usaram alguma versão dele. */
    public record Uso(long alunos, long pastas, long envios) { }

    public record QuestionarioResumo(UUID id, String nome, String descricao, Finalidade finalidade, boolean padrao, boolean arquivado,
                                     int versaoPublicada, Instant publicadoEm, boolean alteradoDesdePublicacao,
                                     Instant rascunhoAlteradoEm, Uso uso,
                                     String codigoPublico, boolean publicoAberto, UUID responsavelPadraoId, UUID proximoQuestionarioId) {
        public QuestionarioResumo(UUID id, String nome, String descricao, Finalidade finalidade, boolean padrao, boolean arquivado,
                                  int versaoPublicada, Instant publicadoEm, boolean alteradoDesdePublicacao,
                                  Instant rascunhoAlteradoEm, Uso uso) {
            this(id, nome, descricao, finalidade, padrao, arquivado, versaoPublicada, publicadoEm, alteradoDesdePublicacao,
                    rascunhoAlteradoEm, uso, null, false, null, null);
        }
    }

    public record VersaoResumo(int numero, Instant publicadoEm) { }

    public record QuestionarioDetalhe(UUID id, String nome, String descricao, Finalidade finalidade, boolean padrao, boolean arquivado,
                                      int versaoPublicada, Instant publicadoEm, boolean alteradoDesdePublicacao,
                                      Instant rascunhoAlteradoEm, Long versao, Uso uso,
                                      ConteudoQuestionario rascunho, List<VersaoResumo> versoes,
                                      String codigoPublico, boolean publicoAberto, UUID responsavelPadraoId, UUID proximoQuestionarioId) {
        public QuestionarioDetalhe(UUID id, String nome, String descricao, Finalidade finalidade, boolean padrao, boolean arquivado,
                                   int versaoPublicada, Instant publicadoEm, boolean alteradoDesdePublicacao,
                                   Instant rascunhoAlteradoEm, Long versao, Uso uso,
                                   ConteudoQuestionario rascunho, List<VersaoResumo> versoes) {
            this(id, nome, descricao, finalidade, padrao, arquivado, versaoPublicada, publicadoEm, alteradoDesdePublicacao,
                    rascunhoAlteradoEm, versao, uso, rascunho, versoes, null, false, null, null);
        }
    }

    /** Opção de escolha no aluno e na pasta: só questionários publicados e não arquivados. */
    public record OpcaoQuestionario(UUID id, String nome, boolean padrao) { }

    /** {@code finalidade} nula = ATUALIZACAO. Anamnese só começa em branco (não há modelo da plataforma). */
    public record CriarRequest(@NotBlank @Size(max = 120) String nome, @Size(max = 400) String descricao,
                               @NotNull Origem origem, Finalidade finalidade) {
        public CriarRequest(String nome, String descricao, Origem origem) {
            this(nome, descricao, origem, null);
        }
    }

    public record SalvarRequest(@NotBlank @Size(max = 120) String nome, @Size(max = 400) String descricao,
                                @NotNull @Valid ConteudoQuestionario conteudo, @NotNull Long versao,
                                String codigoPublico, Boolean publicoAberto, UUID responsavelPadraoId, UUID proximoQuestionarioId) {
        public SalvarRequest(String nome, String descricao, ConteudoQuestionario conteudo, Long versao) {
            this(nome, descricao, conteudo, versao, null, null, null, null);
        }
    }

    public record PublicarRequest(@NotNull Long versao, boolean confirmarAvisos) { }

    /** {@code questionarioId} nulo = volta a valer o do aluno (na pasta) ou o padrão (no aluno). */
    public record EscolhaRequest(UUID questionarioId) { }
}
