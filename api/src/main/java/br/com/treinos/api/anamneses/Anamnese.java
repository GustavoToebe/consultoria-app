package br.com.treinos.api.anamneses;

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
 * Anamnese atribuída a um aluno. A versão do questionário é a publicada no momento da atribuição e nunca muda depois.
 * Respostas são dado sensível (LGPD): nunca em log, exceção nem {@code toString}.
 */
@Entity
@Table(name = "anamnese")
public class Anamnese {

    public enum Situacao { PENDENTE, ENVIADA, REVISADA, DISPENSADA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(name = "questionario_versao_id", nullable = false, updatable = false)
    private UUID questionarioVersaoId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String respostas;
    @Column(name = "atribuida_por", updatable = false)
    private UUID atribuidaPor;
    @Column(name = "atribuida_em", nullable = false, updatable = false)
    private Instant atribuidaEm;
    @Column(name = "enviada_em")
    private Instant enviadaEm;
    @Column(name = "revisada_em")
    private Instant revisadaEm;
    @Column(name = "revisada_por")
    private UUID revisadaPor;
    @Column(name = "dispensada_em")
    private Instant dispensadaEm;
    @Column(name = "dispensada_por")
    private UUID dispensadaPor;
    @Column(name = "dispensa_motivo")
    private String dispensaMotivo;
    @Version
    private Long versao;

    protected Anamnese() {
    }

    Anamnese(UUID alunoId, UUID questionarioVersaoId, UUID atribuidaPor, Instant agora) {
        this.alunoId = alunoId;
        this.questionarioVersaoId = questionarioVersaoId;
        this.atribuidaPor = atribuidaPor;
        this.atribuidaEm = agora;
        this.situacao = Situacao.PENDENTE;
        this.respostas = "{}";
    }

    void enviar(String respostas, Instant quando) {
        this.respostas = respostas;
        this.enviadaEm = quando;
        this.situacao = Situacao.ENVIADA;
    }

    void revisar(UUID usuarioId, Instant quando) {
        this.revisadaPor = usuarioId;
        this.revisadaEm = quando;
        this.situacao = Situacao.REVISADA;
    }

    void dispensar(UUID usuarioId, String motivo, Instant quando) {
        this.dispensadaPor = usuarioId;
        this.dispensaMotivo = motivo;
        this.dispensadaEm = quando;
        this.situacao = Situacao.DISPENSADA;
    }

    /** Anonimização do aluno: apaga o que ele respondeu e o motivo escrito pela equipe; situação e datas ficam para as contagens. */
    public void limparDadosPessoais() {
        this.respostas = "{}";
        this.dispensaMotivo = null;
    }

    public boolean isEnviada() {
        return situacao == Situacao.ENVIADA || situacao == Situacao.REVISADA;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getQuestionarioVersaoId() { return questionarioVersaoId; }
    public Situacao getSituacao() { return situacao; }
    public String getRespostas() { return respostas; }
    public UUID getAtribuidaPor() { return atribuidaPor; }
    public Instant getAtribuidaEm() { return atribuidaEm; }
    public Instant getEnviadaEm() { return enviadaEm; }
    public Instant getRevisadaEm() { return revisadaEm; }
    public UUID getRevisadaPor() { return revisadaPor; }
    public Instant getDispensadaEm() { return dispensadaEm; }
    public UUID getDispensadaPor() { return dispensadaPor; }
    public String getDispensaMotivo() { return dispensaMotivo; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "Anamnese[" + id + "]";
    }
}
