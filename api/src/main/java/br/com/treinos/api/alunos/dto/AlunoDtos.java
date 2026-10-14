package br.com.treinos.api.alunos.dto;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.consultoria.MarcaPublica;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Contratos HTTP de alunos e convite. */
public final class AlunoDtos {

    private AlunoDtos() { }

    /** {@code versao} só no PUT (lock otimista); no POST vai nulo. */
    public record AlunoRequest(
            @NotBlank @Size(max = 120) String nome,
            @Email @Size(max = 254) String email,
            @Size(max = 200) String objetivo,
            @Size(max = 4000) String observacoes,
            Long versao,
            @Min(1) @Max(365) Integer diasAtualizacao, UUID responsavelId) {

        public AlunoRequest(String nome,String email,String objetivo,String observacoes,Long versao,Integer diasAtualizacao) {
            this(nome,email,objetivo,observacoes,versao,diasAtualizacao,null);
        }

        public AlunoRequest(String nome, String email, String objetivo, String observacoes, Long versao) {
            this(nome, email, objetivo, observacoes, versao, null);
        }
    }

    public record PlanoAtivoResumo(UUID id, String titulo) {
    }

    public record AlunoResumo(UUID id, String nome, boolean ativo, boolean temAcesso, PlanoAtivoResumo planoAtivo,
                              LocalDate ultimoRegistro,UUID responsavelId) {
    }

    public record PaginaAlunos(List<AlunoResumo> itens, long total) {
    }

    public record AlunoDetalhe(UUID id, String nome, String email,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String objetivo,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String observacoes, boolean ativo,
                               boolean temAcesso, Instant conviteExpiraEm, Long versao,
                               Integer diasAtualizacao,UUID responsavelId,UUID questionarioId,boolean anonimizado) {
        public static AlunoDetalhe de(Aluno a) {
            boolean conviteValido = a.getConviteExpiraEm() != null && a.getConviteExpiraEm().isAfter(Instant.now());
            return new AlunoDetalhe(a.getId(), a.getNome(), a.getEmail(), br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER") ? a.getObjetivo() : null,
                    br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER") ? a.getObservacoes() : null,
                    a.isAtivo(), a.getUsuarioId() != null, conviteValido ? a.getConviteExpiraEm() : null,
                    a.getVersao(), a.getDiasAtualizacao(),a.getResponsavelId(),a.getQuestionarioId(),a.isAnonimizado());
        }
    }

    public record SituacaoRequest(@NotNull Boolean ativo) {
    }

    /** O código só aparece nesta resposta; o banco guarda o SHA-256. */
    public record ConviteResponse(String codigo, String link, Instant expiraEm) {
    }

    public record ConvitePublico(MarcaPublica consultoria, String primeiroNomeAluno) {
    }

    public record AceitarConviteRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 200) String senha) {
    }
}
