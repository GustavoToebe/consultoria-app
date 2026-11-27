package br.com.treinos.api.contratos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * O contrato digital de um aluno (V105). Texto, CPF, IP e nome do assinante são dado pessoal: nunca em log, auditoria, mensagem de
 * erro nem {@code toString}. O assinado é imutável (D15); só o pendente se cancela ou se prorroga.
 */
@Entity
@Table(name = "contrato_aluno")
public class ContratoAluno {

    public enum Origem { MODELO, PDF }

    public enum Signatario { ALUNO, RESPONSAVEL }

    public enum Situacao { PENDENTE, ASSINADO, CANCELADO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(name = "contratacao_id", updatable = false)
    private UUID contratacaoId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Origem origem;
    @Column(name = "modelo_id", updatable = false)
    private UUID modeloId;
    @Column(nullable = false, updatable = false, length = 120)
    private String titulo;
    @Column(updatable = false, columnDefinition = "text")
    private String texto;
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, updatable = false, length = 64)
    private String sha256;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Signatario signatario;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao = Situacao.PENDENTE;
    @Column(name = "prazo_ate")
    private Instant prazoAte;
    @Column(name = "gerado_por", updatable = false)
    private UUID geradoPor;
    @Column(name = "gerado_em", nullable = false, updatable = false)
    private Instant geradoEm;
    @Column(name = "cancelado_em")
    private Instant canceladoEm;
    @Column(name = "motivo_cancelamento", length = 300)
    private String motivoCancelamento;
    @Column(name = "pedido_id", nullable = false, updatable = false)
    private UUID pedidoId;
    @Column(name = "assinado_em")
    private Instant assinadoEm;
    @Column(name = "assinado_por_usuario_id")
    private UUID assinadoPorUsuarioId;
    @Column(name = "assinante_nome", length = 200)
    private String assinanteNome;
    @Column(name = "assinante_cpf", length = 14)
    private String assinanteCpf;
    @Column(name = "assinante_ip", length = 45)
    private String assinanteIp;
    @Column(name = "assinante_agente", length = 300)
    private String assinanteAgente;
    /** Só no responsável assinado pelo link (D28): quem assinou declarou ser o responsável legal. */
    @Column(name = "assinante_declarou_responsavel")
    private Boolean assinanteDeclarouResponsavel;
    /** Par aluno + responsável (16 a 17 anos): os dois contratos do mesmo texto levam o mesmo grupo. Nulo no contrato avulso. */
    @Column(name = "grupo_id", updatable = false)
    private UUID grupoId;
    /** Guarda do assinado (D16): preenchido pela rotina que apaga texto e evidências; nunca por esta classe. */
    @Column(name = "apagado_em")
    private Instant apagadoEm;
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "link_hash", length = 64)
    private String linkHash;
    @Column(name = "link_expira_em")
    private Instant linkExpiraEm;
    @Version
    private Long versao;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected ContratoAluno() {
    }

    /** Contrato novo, pendente. {@code texto} e {@code modeloId} só no MODELO; {@code agora} é o início do prazo (D23). */
    ContratoAluno(UUID alunoId, UUID contratacaoId, Origem origem, UUID modeloId, String titulo, String texto, String sha256,
                  Signatario signatario, Instant prazoAte, UUID geradoPor, UUID pedidoId, UUID grupoId, String linkHash, Instant linkExpiraEm,
                  Instant agora) {
        this.alunoId = alunoId;
        this.contratacaoId = contratacaoId;
        this.origem = origem;
        this.modeloId = modeloId;
        this.titulo = titulo;
        this.texto = texto;
        this.sha256 = sha256;
        this.signatario = signatario;
        this.prazoAte = prazoAte;
        this.geradoPor = geradoPor;
        this.pedidoId = pedidoId;
        this.grupoId = grupoId;
        this.linkHash = linkHash;
        this.linkExpiraEm = linkExpiraEm;
        this.geradoEm = agora;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** O aluno assina logado (D2): o aceite com as evidências. O servidor já conferiu hash, nome e aceite. */
    void assinarComoAluno(UUID usuarioId, String nome, String ip, String agente, Instant agora) {
        this.situacao = Situacao.ASSINADO;
        this.assinadoEm = agora;
        this.assinadoPorUsuarioId = usuarioId;
        this.assinanteNome = nome;
        this.assinanteIp = ip;
        this.assinanteAgente = agente;
        this.atualizadoEm = agora;
    }

    /**
     * O responsável assina pelo link (D11, D28): o servidor já conferiu código, CPF, hash, aceite e a declaração. O CPF gravado é o do
     * cadastro, formatado; o link é de uso único e sai do contrato (hash e validade juntos, como o CHECK pede).
     */
    void assinarComoResponsavel(String nome, String cpf, String ip, String agente, Instant agora) {
        this.situacao = Situacao.ASSINADO;
        this.assinadoEm = agora;
        this.assinadoPorUsuarioId = null;
        this.assinanteNome = nome;
        this.assinanteCpf = cpf;
        this.assinanteIp = ip;
        this.assinanteAgente = agente;
        this.assinanteDeclarouResponsavel = true;
        this.linkHash = null;
        this.linkExpiraEm = null;
        this.atualizadoEm = agora;
    }

    /** Troca o código do link (renovar): o anterior deixa de valer na hora. Só no responsável pendente. */
    void trocarLink(String hash, Instant expiraEm, Instant agora) {
        this.linkHash = hash;
        this.linkExpiraEm = expiraEm;
        this.atualizadoEm = agora;
    }

    /** Prorrogar move a validade do link junto com o prazo, sem encurtá-la. Sem link, não faz nada. */
    void estenderLink(Instant ate, Instant agora) {
        if (linkHash != null && (linkExpiraEm == null || ate.isAfter(linkExpiraEm))) {
            this.linkExpiraEm = ate;
            this.atualizadoEm = agora;
        }
    }

    /** O link vale: o contrato é pendente, tem link e ele ainda não venceu. */
    public boolean linkValido(Instant agora) {
        return situacao == Situacao.PENDENTE && linkHash != null && linkExpiraEm != null && linkExpiraEm.isAfter(agora);
    }

    void cancelar(String motivo, Instant agora) {
        this.situacao = Situacao.CANCELADO;
        this.canceladoEm = agora;
        this.motivoCancelamento = motivo;
        this.atualizadoEm = agora;
    }

    void prorrogar(Instant novoPrazo, Instant agora) {
        this.prazoAte = novoPrazo;
        this.atualizadoEm = agora;
    }

    /** Pendente com o prazo já vencido: é o que trava o acesso (D5). Prazo nulo nunca vence. */
    public boolean vencido(Instant agora) {
        return situacao == Situacao.PENDENTE && prazoAte != null && prazoAte.isBefore(agora);
    }

    public UUID getId() { return id; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getContratacaoId() { return contratacaoId; }
    public Origem getOrigem() { return origem; }
    public UUID getModeloId() { return modeloId; }
    public String getTitulo() { return titulo; }
    public String getTexto() { return texto; }
    public String getSha256() { return sha256; }
    public Signatario getSignatario() { return signatario; }
    public Situacao getSituacao() { return situacao; }
    public Instant getPrazoAte() { return prazoAte; }
    public UUID getGeradoPor() { return geradoPor; }
    public Instant getGeradoEm() { return geradoEm; }
    public Instant getCanceladoEm() { return canceladoEm; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
    public UUID getPedidoId() { return pedidoId; }
    public Instant getAssinadoEm() { return assinadoEm; }
    public String getAssinanteNome() { return assinanteNome; }
    public String getAssinanteCpf() { return assinanteCpf; }
    public String getAssinanteIp() { return assinanteIp; }
    public String getAssinanteAgente() { return assinanteAgente; }
    public Boolean getAssinanteDeclarouResponsavel() { return assinanteDeclarouResponsavel; }
    public UUID getGrupoId() { return grupoId; }
    public Instant getApagadoEm() { return apagadoEm; }
    public Instant getLinkExpiraEm() { return linkExpiraEm; }
    /** Só para saber se há link; o hash em si não sai da entidade. */
    public boolean temLink() { return linkHash != null; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "ContratoAluno[" + id + "]";
    }
}
