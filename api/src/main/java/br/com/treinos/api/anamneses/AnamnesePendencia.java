package br.com.treinos.api.anamneses;

import br.com.treinos.api.questionarios.DestinoNoPerfil;
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
 * Alteração do cadastro proposta por uma anamnese enviada (fase C, 19/10): PENDENTE quando o campo já tinha outro
 * valor; já APLICADA e {@code automatica} quando o campo estava vazio e o envio o preencheu (fica como origem). A
 * resposta original continua na anamnese; aqui fica só o valor proposto ({@code {"texto": ...}} no objetivo, no CPF e
 * no telefone; {@code {"pesoKg": ..., "data": ...}} no peso; {@code {"endereco": {cep, logradouro, numero, complemento,
 * bairro, cidade, uf}}} no endereço), dado sensível (LGPD): nunca em log, exceção nem {@code toString}.
 * A equipe aplica ou descarta; uma por campo em cada anamnese.
 */
@Entity
@Table(name = "anamnese_pendencia")
public class AnamnesePendencia {

    public enum Situacao { PENDENTE, APLICADA, DESCARTADA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "anamnese_id", nullable = false, updatable = false)
    private UUID anamneseId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private DestinoNoPerfil destino;
    @Column(name = "pergunta_id", nullable = false, updatable = false)
    private String perguntaId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false, updatable = false)
    private String valor;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    /** Preenchida no envio porque o campo estava vazio (sem ninguém da equipe): é o registro da origem do dado. */
    @Column(nullable = false, updatable = false)
    private boolean automatica;
    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm;
    @Column(name = "resolvida_em")
    private Instant resolvidaEm;
    @Column(name = "resolvida_por")
    private UUID resolvidaPor;
    @Version
    private Long versao;

    protected AnamnesePendencia() {
    }

    AnamnesePendencia(UUID anamneseId, UUID alunoId, DestinoNoPerfil destino, String perguntaId, String valor, Instant agora) {
        this.anamneseId = anamneseId;
        this.alunoId = alunoId;
        this.destino = destino;
        this.perguntaId = perguntaId;
        this.valor = valor;
        this.criadaEm = agora;
        this.situacao = Situacao.PENDENTE;
    }

    /** Campo vazio preenchido no envio: já nasce aplicada, sem autor da equipe. */
    static AnamnesePendencia automatica(UUID anamneseId, UUID alunoId, DestinoNoPerfil destino, String perguntaId,
                                        String valor, Instant agora) {
        AnamnesePendencia p = new AnamnesePendencia(anamneseId, alunoId, destino, perguntaId, valor, agora);
        p.automatica = true;
        p.resolver(Situacao.APLICADA, null, agora);
        return p;
    }

    void resolver(Situacao situacao, UUID usuarioId, Instant quando) {
        this.situacao = situacao;
        this.resolvidaPor = usuarioId;
        this.resolvidaEm = quando;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAnamneseId() { return anamneseId; }
    public UUID getAlunoId() { return alunoId; }
    public DestinoNoPerfil getDestino() { return destino; }
    public String getPerguntaId() { return perguntaId; }
    public String getValor() { return valor; }
    public Situacao getSituacao() { return situacao; }
    public boolean isAutomatica() { return automatica; }
    public Instant getCriadaEm() { return criadaEm; }
    public Instant getResolvidaEm() { return resolvidaEm; }
    public UUID getResolvidaPor() { return resolvidaPor; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "AnamnesePendencia[" + id + "]";
    }
}
