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
 * O plano comercial contratado por um aluno. Uma vigente (ATIVA ou PAUSADA) por aluno, garantida pelo banco. O valor é o
 * da contratação (o do plano, ou outro com {@code motivoValor}); toda cobrança nasce com ele. {@code motivoValor} é texto
 * do treinador: nunca em log, e a anonimização o apaga.
 */
@Entity
@Table(name = "contratacao_aluno")
public class ContratacaoAluno {

    public enum Situacao { ATIVA, PAUSADA, ENCERRADA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(name = "plano_comercial_id", nullable = false, updatable = false)
    private UUID planoComercialId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private PeriodoDoPlano periodicidade;
    @Column(name = "valor_centavos", nullable = false)
    private long valorCentavos;
    @Column(name = "motivo_valor")
    private String motivoValor;
    @Column(nullable = false, updatable = false)
    private LocalDate inicio;
    /** De onde as competências são contadas; a retomada de uma pausa a recoloca. */
    @Column(nullable = false)
    private LocalDate ancora;
    @Column(name = "dia_vencimento", nullable = false)
    private int diaVencimento;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    @Column(name = "encerrada_em")
    private Instant encerradaEm;
    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
    @Version
    private Long versao;

    protected ContratacaoAluno() {
    }

    ContratacaoAluno(UUID alunoId, PlanoComercial plano, long valorCentavos, String motivoValor, LocalDate inicio,
                     int diaVencimento) {
        this.alunoId = alunoId;
        this.planoComercialId = plano.getId();
        this.periodicidade = plano.getPeriodicidade();
        this.valorCentavos = valorCentavos;
        this.motivoValor = motivoValor;
        this.inicio = inicio;
        this.ancora = inicio;
        this.diaVencimento = diaVencimento;
        this.situacao = Situacao.ATIVA;
    }

    void alterar(long valorCentavos, String motivoValor, int diaVencimento) {
        this.valorCentavos = valorCentavos;
        this.motivoValor = motivoValor;
        this.diaVencimento = diaVencimento;
    }

    void pausar() {
        this.situacao = Situacao.PAUSADA;
    }

    /** Recomeça na data da retomada: o período pausado não é cobrado. */
    void retomar(LocalDate hoje) {
        this.situacao = Situacao.ATIVA;
        this.ancora = hoje;
    }

    void encerrar(Instant quando) {
        this.situacao = Situacao.ENCERRADA;
        this.encerradaEm = quando;
    }

    /** Anonimização do aluno: o texto livre do treinador sobre o valor sai; valores, datas e situação ficam. */
    void limparDadosPessoais() {
        this.motivoValor = null;
    }

    public boolean isVigente() {
        return situacao != Situacao.ENCERRADA;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getPlanoComercialId() { return planoComercialId; }
    public PeriodoDoPlano getPeriodicidade() { return periodicidade; }
    public long getValorCentavos() { return valorCentavos; }
    public String getMotivoValor() { return motivoValor; }
    public LocalDate getInicio() { return inicio; }
    public LocalDate getAncora() { return ancora; }
    public int getDiaVencimento() { return diaVencimento; }
    public Situacao getSituacao() { return situacao; }
    public Instant getEncerradaEm() { return encerradaEm; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "ContratacaoAluno[" + id + "]";
    }
}
