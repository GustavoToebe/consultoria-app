package br.com.treinos.api.alunos.dto;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.questionarios.LimitesQuestionario;
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
import java.util.stream.Stream;

/** Contratos HTTP de alunos e convite. */
public final class AlunoDtos {

    private AlunoDtos() { }

    /**
     * Endereço do aluno: sete campos de texto. Sem validação no record: a regra única (strip, limites depois do strip,
     * obrigatórios quando há endereço, CEP e UF) é {@code alunos/RegrasDoEndereco}, a mesma da resposta ENDERECO da
     * anamnese; limites em {@link LimitesQuestionario}. Dado pessoal: nunca em log nem em mensagem de erro.
     */
    public record Endereco(String cep, String logradouro, String numero, String complemento, String bairro, String cidade,
                           String uf) {

        /** Os sete campos em branco ou nulos. */
        public boolean vazio() {
            return Stream.of(cep, logradouro, numero, complemento, bairro, cidade, uf).allMatch(t -> t == null || t.isBlank());
        }

        @Override
        public String toString() {
            return "Endereco[...]";
        }
    }

    /**
     * {@code versao} só no PUT (lock otimista); no POST vai nulo. {@code telefone}, {@code cpf} e {@code endereco} são
     * dados pessoais; {@code cpf} e {@code endereco} exigem {@code ALUNO_SENSIVEL_ALTERAR} (sem ela são ignorados e o que
     * está gravado fica). {@code telefone}: nulo = não mexe; em branco = apaga; sem acesso, fica no cadastro do
     * aluno até o acesso existir (V048).
     */
    public record AlunoRequest(
            @NotBlank @Size(max = 120) String nome,
            @Email @Size(max = 254) String email,
            @Size(max = 25) String telefone,
            @Size(max = 200) String objetivo,
            @Size(max = 4000) String observacoes,
            @Size(max = 20) String cpf,
            Endereco endereco,
            Long versao,
            @Min(1) @Max(365) Integer diasAtualizacao, UUID responsavelId,
            @Size(max = 10) String sexo) {

        /** Dado pessoal e de saúde: o texto padrão do record os mostraria. */
        @Override
        public String toString() {
            return "AlunoRequest[...]";
        }

        public AlunoRequest(String nome,String email,String objetivo,String observacoes,Long versao,Integer diasAtualizacao,UUID responsavelId) {
            this(nome,email,null,objetivo,observacoes,null,null,versao,diasAtualizacao,responsavelId,null);
        }

        public AlunoRequest(String nome,String email,String objetivo,String observacoes,Long versao,Integer diasAtualizacao) {
            this(nome,email,objetivo,observacoes,versao,diasAtualizacao,null);
        }

        public AlunoRequest(String nome, String email, String objetivo, String observacoes, Long versao) {
            this(nome, email, objetivo, observacoes, versao, null);
        }
    }

    public record PlanoAtivoResumo(UUID id, String titulo) {
    }

    /** Situação da atualização da pasta vigente; os campos são os de {@code RegrasAtualizacao.Situacao} mais a data. */
    public record SituacaoAtualizacao(UUID id, String fase, LocalDate data, long diasParaData, long diasDeAtraso,
                                      LocalDate atrasoAte) {
    }

    /** {@code atualizacao} sai nula sem permissão de ler atualizações ou quando o aluno não tem pasta com período. */
    public record AlunoResumo(UUID id, String nome, boolean ativo, boolean temAcesso, PlanoAtivoResumo planoAtivo,
                              LocalDate ultimoRegistro,UUID responsavelId, SituacaoAtualizacao atualizacao) {
    }

    public record PaginaAlunos(List<AlunoResumo> itens, long total) {
    }

    /**
     * Ficha do aluno. {@code telefone} (do usuário do aluno ou, sem acesso, o guardado no cadastro) e
     * {@code emailDeAcesso} (nulo sem acesso) saem com {@code ALUNO_LER}; {@code aguardandoPrimeiroAcesso} = a senha provisória do treinador ainda não foi trocada. Objetivo, observações, {@code cpf} e {@code endereco} são omitidos do JSON sem
     * {@code ALUNO_SENSIVEL_LER} (e quando não há valor); {@code endereco} traz os sete campos (nulos os vazios).
     */
    public record AlunoDetalhe(UUID id, String nome, String email, String telefone,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String cpf,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) Endereco endereco,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String objetivo,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String observacoes, boolean ativo,
                               boolean temAcesso, Instant conviteExpiraEm, Long versao,
                               Integer diasAtualizacao,UUID responsavelId,UUID questionarioId,boolean anonimizado,
                               String emailDeAcesso, boolean aguardandoPrimeiroAcesso,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                               Instant usoDeImagemAutorizadoEm,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                               String sexo) {
        /**
         * {@code usuario} é o do aluno (o chamador o busca pelo {@code usuarioId}); nulo se ele ainda não tem acesso. Dele
         * saem o telefone e o e-mail de login (com {@code ALUNO_LER}) e se a senha provisória do treinador ainda não foi trocada.
         */
        public static AlunoDetalhe de(Aluno a, br.com.treinos.api.auth.Usuario usuario) {
            boolean conviteValido = a.getConviteExpiraEm() != null && a.getConviteExpiraEm().isAfter(Instant.now());
            boolean sensivel = br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER");
            boolean ler = br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_LER");
            return new AlunoDetalhe(a.getId(), a.getNome(), a.getEmail(),
                    ler ? (usuario != null ? usuario.getTelefone() : a.getTelefoneSemAcesso()) : null,
                    sensivel ? a.getCpf() : null, sensivel ? a.endereco() : null,
                    sensivel ? a.getObjetivo() : null, sensivel ? a.getObservacoes() : null,
                    a.isAtivo(), a.getUsuarioId() != null, conviteValido ? a.getConviteExpiraEm() : null,
                    a.getVersao(), a.getDiasAtualizacao(),a.getResponsavelId(),a.getQuestionarioId(),a.isAnonimizado(),
                    // Anonimizado: o e-mail do usuário é só o marcador da anonimização.
                    ler && usuario != null && !a.isAnonimizado() ? usuario.getEmail() : null, usuario != null && usuario.isTrocarSenha(),
                    sensivel ? a.getUsoDeImagemAutorizadoEm() : null,
                    ler && a.getSexo() != null ? a.getSexo().name() : null);
        }
    }

    public record SituacaoRequest(@NotNull Boolean ativo) {
    }

    /** Acesso definido pelo treinador: e-mail de login e senha provisória (os 72 bytes são conferidos pela {@code RegrasSenha}). */
    public record DefinirAcessoRequest(@NotBlank @Email @Size(max = 254) String email,
                                       @NotBlank @Size(max = 200) String senha) {
        @Override
        public String toString() {
            return "DefinirAcessoRequest[email=***, senha=***]";
        }
    }

    /** O código só aparece nesta resposta; o banco guarda o SHA-256. */
    public record ConviteResponse(String codigo, String link, Instant expiraEm) {
    }

    public record ConvitePublico(MarcaPublica consultoria, String primeiroNomeAluno) {
    }

    /** O código vai no corpo, nunca no caminho: assim não fica em log de acesso, histórico nem prévia de link. */
    public record ConsultarConviteRequest(@NotBlank @Size(max = 64) String codigo) {
    }

    public record AceitarConviteRequest(
            @NotBlank @Size(max = 64) String codigo,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 200) String senha) {
    }
}
