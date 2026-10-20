package br.com.treinos.api.pagamentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Uma cobrança por competência da contratação. {@code VENCIDA} não existe como situação: é ABERTA com vencimento anterior a
 * hoje (Brasília), calculada por {@link #vencida(LocalDate)}. O valor é sempre o da contratação, nunca do cliente.
 * {@code observacao} e {@code motivo} são texto do treinador: nunca em log, e a anonimização os apaga.
 */
@Entity
@Table(name = "cobranca_aluno")
public class CobrancaAluno {

    public enum Situacao { ABERTA, PAGA, CANCELADA, ESTORNADA, CONTESTADA }

    /** Provedor da baixa manual do treinador. */
    public static final String MANUAL = "MANUAL";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "contratacao_id", nullable = false, updatable = false)
    private UUID contratacaoId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(nullable = false, updatable = false)
    private LocalDate competencia;
    @Column(name = "valor_centavos", nullable = false)
    private long valorCentavos;
    @Column(nullable = false)
    private LocalDate vencimento;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    @Enumerated(EnumType.STRING)
    private FormaDePagamento forma;
    @Column(nullable = false)
    private String provedor;
    @Column(name = "id_externo")
    private String idExterno;
    @Column(name = "pago_em")
    private LocalDate pagoEm;
    @Column(name = "baixa_por")
    private UUID baixaPor;
    private String observacao;
    private String motivo;
    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
    @Version
    private Long versao;

    protected CobrancaAluno() {
    }

    CobrancaAluno(ContratacaoAluno contratacao, LocalDate competencia, LocalDate vencimento) {
        this.contratacaoId = contratacao.getId();
        this.alunoId = contratacao.getAlunoId();
        this.competencia = competencia;
        this.valorCentavos = contratacao.getValorCentavos();
        this.vencimento = vencimento;
        this.situacao = Situacao.ABERTA;
        this.provedor = MANUAL;
    }

    /** Valor e vencimento novos de uma aberta ainda não vencida (alteração da contratação). */
    void reajustar(long valorCentavos, LocalDate vencimento) {
        this.valorCentavos = valorCentavos;
        this.vencimento = vencimento;
    }

    void pagar(String provedor, FormaDePagamento forma, LocalDate pagoEm, UUID baixaPor, String observacao) {
        this.situacao = Situacao.PAGA;
        this.provedor = provedor;
        this.forma = forma;
        this.pagoEm = pagoEm;
        this.baixaPor = baixaPor;
        this.observacao = observacao;
    }

    /** Volta a baixa manual: a cobrança fica aberta de novo e o motivo do desfazer é guardado. */
    void reabrir(String motivo) {
        this.situacao = Situacao.ABERTA;
        this.forma = null;
        this.pagoEm = null;
        this.baixaPor = null;
        this.observacao = null;
        this.motivo = motivo;
    }

    void cancelar(String motivo) {
        this.situacao = Situacao.CANCELADA;
        this.motivo = motivo;
    }

    void estornar(String motivo) {
        this.situacao = Situacao.ESTORNADA;
        this.motivo = motivo;
    }

    void contestar(String motivo) {
        this.situacao = Situacao.CONTESTADA;
        this.motivo = motivo;
    }

    /** Anonimização do aluno: observação e motivos (texto do treinador) saem; valor, datas e situação ficam. */
    void limparDadosPessoais() {
        this.observacao = null;
        this.motivo = null;
    }

    public boolean vencida(LocalDate hoje) {
        return situacao == Situacao.ABERTA && vencimento.isBefore(hoje);
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getContratacaoId() { return contratacaoId; }
    public UUID getAlunoId() { return alunoId; }
    public LocalDate getCompetencia() { return competencia; }
    public long getValorCentavos() { return valorCentavos; }
    public LocalDate getVencimento() { return vencimento; }
    public Situacao getSituacao() { return situacao; }
    public FormaDePagamento getForma() { return forma; }
    public String getProvedor() { return provedor; }
    public String getIdExterno() { return idExterno; }
    public LocalDate getPagoEm() { return pagoEm; }
    public UUID getBaixaPor() { return baixaPor; }
    public String getObservacao() { return observacao; }
    public String getMotivo() { return motivo; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "CobrancaAluno[" + id + "]";
    }
}
