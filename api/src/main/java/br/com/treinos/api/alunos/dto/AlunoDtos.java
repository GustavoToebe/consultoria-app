package br.com.treinos.api.alunos.dto;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagResumo;
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
     * A meta do peso como o cliente a manda na ficha: as três da consultoria mais {@code PADRAO_DA_CONSULTORIA} (grava
     * nulo). Enum só do request, para esse valor nunca chegar ao enum da consultoria nem à coluna.
     */
    public enum MetaDoPesoPedida {
        REDUZIR(br.com.treinos.api.consultoria.MetaDoPeso.REDUZIR),
        AUMENTAR(br.com.treinos.api.consultoria.MetaDoPeso.AUMENTAR),
        SEM_META(br.com.treinos.api.consultoria.MetaDoPeso.SEM_META),
        PADRAO_DA_CONSULTORIA(null);

        private final br.com.treinos.api.consultoria.MetaDoPeso meta;

        MetaDoPesoPedida(br.com.treinos.api.consultoria.MetaDoPeso meta) {
            this.meta = meta;
        }

        /** O que vai para a coluna; nulo = padrão da consultoria. */
        public br.com.treinos.api.consultoria.MetaDoPeso paraMeta() {
            return meta;
        }
    }

    /**
     * {@code versao} só no PUT (lock otimista); no POST vai nulo. {@code telefone}, {@code cpf} e {@code endereco} são
     * dados pessoais; {@code cpf} e {@code endereco} exigem {@code ALUNO_SENSIVEL_ALTERAR} (sem ela são ignorados e o que
     * está gravado fica). {@code telefone}: nulo = não mexe; em branco = apaga; sem acesso, fica no cadastro do
     * aluno até o acesso existir (V048). {@code metaDoPeso} é dado sensível e, como CPF e endereço, sem
     * {@code ALUNO_SENSIVEL_ALTERAR} é ignorado (o gravado fica). Com ela, como o {@code sexo}: ausente ou nulo no
     * {@code PUT} não mexe no gravado; {@code PADRAO_DA_CONSULTORIA} volta ao padrão (grava nulo). No {@code POST},
     * ausente, nulo e {@code PADRAO_DA_CONSULTORIA} dão nulo. {@code dataNascimento} ({@code AAAA-MM-DD}, faixa de registro:
     * 1900 até hoje; dado pessoal, nunca em log nem em mensagem de erro; exige {@code ALUNO_ALTERAR}): no {@code PUT}, nulo ou
     * ausente não mexe no gravado e texto em branco apaga (como o telefone e o sexo); no {@code POST}, nulo e em branco
     * dão nulo; data inválida ou fora da faixa = 422 {@code ALUNO_INVALIDO} no campo {@code dataNascimento}.
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
            @Size(max = 10) String sexo,
            MetaDoPesoPedida metaDoPeso,
            @Size(max = 10) String dataNascimento,
            /** Instagram e TikTok: nulo (ausente) não mexe; em branco apaga; {@code @usuario}, usuário ou link do perfil (grava só o usuário). Dado pessoal. */
            @Size(max = 200) String instagram, @Size(max = 200) String tiktok,
            /** YouTube, Facebook, LinkedIn e Telegram (V103): mesma regra (nulo mantém, em branco apaga); texto livre, grava o link https normalizado. Dado pessoal. */
            @Size(max = 200) String youtube, @Size(max = 200) String facebook, @Size(max = 200) String linkedin,
            @Size(max = 200) String telegram) {

        /** Dado pessoal e de saúde: o texto padrão do record os mostraria. */
        @Override
        public String toString() {
            return "AlunoRequest[...]";
        }

        public AlunoRequest(String nome,String email,String objetivo,String observacoes,Long versao,Integer diasAtualizacao,UUID responsavelId) {
            this(nome,email,null,objetivo,observacoes,null,null,versao,diasAtualizacao,responsavelId,null,null,null,null,null,null,null,null,null);
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
                              LocalDate ultimoRegistro,UUID responsavelId, SituacaoAtualizacao atualizacao,
                              /** Tags do aluno (V093), em ordem de nome; sempre presente (lista vazia sem tag). Só a equipe as recebe. */
                              List<TagResumo> tags) {
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
                               String sexo,
                               /** Meta própria do aluno; omitida sem {@code ALUNO_SENSIVEL_LER} e quando vale a da consultoria (nulo). */
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                               br.com.treinos.api.consultoria.MetaDoPeso metaDoPeso,
                               /** Data de nascimento; com {@code ALUNO_LER}, como o sexo. Só a equipe a recebe. */
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                               LocalDate dataNascimento,
                               /** Grupo (pod) atual; os dois saem nulos (presentes) sem {@code COMUNIDADE_MODERAR} ou sem grupo. */
                               UUID podId, String podNome,
                               /** Cabeçalho da ficha: última alteração do cadastro ({@code aluno.atualizado_em}); sempre presente no JSON. */
                               Instant cadastroAlteradoEm,
                               /** Último acesso conhecido; nulo sem usuário (ainda sem acesso), sem {@code ALUNO_LER} ou sem login. */
                               UltimoAcesso ultimoAcesso,
                               /** Última versão publicada de treino, dieta ou mobilidade que quem pede pode ler; nulo se nenhuma. */
                               UltimoPlanoPublicado ultimoPlanoPublicado,
                               /** O que o plano comercial da contratação ATIVA inclui; nulo sem {@code ALUNO_LER}, sem contratação ativa, anonimizado ou com o financeiro desligado. */
                               PlanosAtivos planosAtivos,
                               /** Tags do aluno (V093), em ordem de nome, com {@code ALUNO_LER}; sempre presente (vazia sem tag, sem permissão ou anonimizado). */
                               List<TagResumo> tags,
                               /** Acesso desativado pela equipe (V100); os dois nulos com o acesso ativo. Só com {@code ALUNO_LER}. */
                               Instant acessoDesativadoEm, String acessoDesativadoMotivo,
                               /** Instagram e TikTok (só o usuário, sem @); com {@code ALUNO_LER}, como o telefone. Dado pessoal. */
                               String instagram, String tiktok,
                               /** Links https normalizados (V103), ou nulos; com {@code ALUNO_LER}. Dado pessoal. */
                               String youtube, String facebook, String linkedin, String telegram) {
        /**
         * {@code usuario} é o do aluno (o chamador o busca pelo {@code usuarioId}); nulo se ele ainda não tem acesso. Dele
         * saem o telefone e o e-mail de login (com {@code ALUNO_LER}) e se a senha provisória do treinador ainda não foi trocada.
         */
        public static AlunoDetalhe de(Aluno a, br.com.treinos.api.auth.Usuario usuario,
                                      br.com.treinos.api.comunidade.ComunidadePod pod, UltimoPlanoPublicado ultimoPlano,
                                      PlanosAtivos planosAtivos, List<TagResumo> tags) {
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
                    ler && a.getSexo() != null ? a.getSexo().name() : null,
                    sensivel ? a.getMetaDoPeso() : null,
                    ler ? a.getDataNascimento() : null,
                    pod == null ? null : pod.getId(), pod == null ? null : pod.getNome(),
                    a.getAtualizadoEm(), ler ? UltimoAcesso.de(a, usuario) : null,
                    // Anonimizado: o autor e a data da publicação não são mais mostrados (como o último acesso e os planos ativos).
                    a.isAnonimizado() ? null : ultimoPlano,
                    ler && !a.isAnonimizado() ? planosAtivos : null,
                    ler && !a.isAnonimizado() && tags != null ? tags : List.of(),
                    ler ? a.getAcessoDesativadoEm() : null,
                    ler && a.getAcessoDesativadoMotivo() != null ? a.getAcessoDesativadoMotivo().name() : null,
                    ler ? a.getInstagram() : null, ler ? a.getTiktok() : null,
                    ler ? a.getYoutube() : null, ler ? a.getFacebook() : null, ler ? a.getLinkedin() : null, ler ? a.getTelegram() : null);
        }
    }

    /**
     * {@code tipo} é {@code LOGIN} (último login com senha, {@code usuario.ultimo_login_em}): o módulo de sessão do plataforma
     * 1.10.0 não expõe o último uso do refresh, então {@code ACESSO} não é emitido (nunca se chama de acesso o que é só login).
     */
    public record UltimoAcesso(String tipo, Instant em) {
        static UltimoAcesso de(Aluno a, br.com.treinos.api.auth.Usuario usuario) {
            if (usuario == null || a.isAnonimizado() || usuario.getUltimoLoginEm() == null) return null;
            return new UltimoAcesso("LOGIN", usuario.getUltimoLoginEm());
        }
    }

    /** Só os dois booleanos do plano comercial (nunca valor nem nome do plano). */
    public record PlanosAtivos(boolean incluiTreino, boolean incluiDieta) {
    }

    /** {@code porNome} é o nome do membro da equipe que publicou; nulo se ele não existe mais ou é de outra consultoria. */
    public record UltimoPlanoPublicado(Instant em, String porNome) {
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

    /** Troca só o e-mail de login (a senha não muda). Formato como em {@link DefinirAcessoRequest}. */
    public record AlterarEmailDeAcessoRequest(@NotBlank @Email @Size(max = 254) String email) {
        @Override
        public String toString() {
            return "AlterarEmailDeAcessoRequest[email=***]";
        }
    }

    /**
     * Resposta da troca do e-mail de acesso. {@code emailEnviado} = o aviso ao e-mail NOVO foi entregue ao provedor; é
     * {@code false} com o envio desligado, falha do provedor e quando o e-mail é o mesmo (nada gravado). O aviso ao endereço
     * anterior não conta.
     */
    public record EmailDeAcessoAlteradoResponse(AlunoDetalhe aluno, boolean emailEnviado) {
    }

    /** {@code motivo} ausente = {@code MANUAL}, o único valor de hoje; outro valor = 400. */
    public record DesativarAcessoRequest(@jakarta.validation.constraints.Pattern(regexp = "MANUAL") String motivo) {
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
