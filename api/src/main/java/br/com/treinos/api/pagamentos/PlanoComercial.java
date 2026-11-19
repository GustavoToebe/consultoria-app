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
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.TenantId;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.UUID;

/**
 * O que o treinador vende (não é o plano de treino nem o plano da Central). Editar o plano não muda quem já contratou: a
 * contratação guarda o próprio valor e a própria periodicidade. Nome único entre os não arquivados.
 */
@Entity
@Table(name = "plano_comercial")
public class PlanoComercial {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false)
    private String nome;
    @Column(name = "valor_centavos", nullable = false)
    private long valorCentavos;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PeriodoDoPlano periodicidade;
    /** Só plano mensal; nulo = sem mínimo. */
    @Column(name = "tempo_minimo_meses")
    private Short tempoMinimoMeses;
    /** Lembrete do contrato mostrado ao encerrar; texto do treinador: nunca em log, auditoria nem resposta do aluno. */
    @Column(name = "regra_de_saida")
    private String regraDeSaida;
    /** Link de pagamento próprio do treinador (https por {@code LinksExternos}); nulo = sem link. O app o abre fora, sem token. */
    @Column(name = "link_de_pagamento", length = 500)
    private String linkDePagamento;
    /** O que o plano vende (V091): ao menos um dos dois (CHECK no banco e 422 no serviço). */
    @Column(name = "inclui_treino", nullable = false)
    private boolean incluiTreino = true;
    @Column(name = "inclui_dieta", nullable = false)
    private boolean incluiDieta = true;
    /** Assinatura cobrada pela Kiwify (V095): só plano mensal; o produto dela só existe com a assinatura ligada. */
    @Column(name = "kiwify_assinatura", nullable = false)
    private boolean kiwifyAssinatura;
    @Column(name = "kiwify_produto_id", length = 100)
    private String kiwifyProdutoId;
    @Column(name = "arquivado_em")
    private Instant arquivadoEm;
    /** Do {@code default now()} da coluna; o Hibernate lê de volta no insert, para a resposta de criação já trazer. */
    @Generated(event = EventType.INSERT)
    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
    @Version
    private Long versao;

    protected PlanoComercial() {
    }

    PlanoComercial(String nome, long valorCentavos, PeriodoDoPlano periodicidade, Short tempoMinimoMeses,
                   String regraDeSaida) {
        this(nome, valorCentavos, periodicidade, tempoMinimoMeses, regraDeSaida, null, true, true);
    }

    PlanoComercial(String nome, long valorCentavos, PeriodoDoPlano periodicidade, Short tempoMinimoMeses,
                   String regraDeSaida, String linkDePagamento, boolean incluiTreino, boolean incluiDieta) {
        alterar(nome, valorCentavos, periodicidade, tempoMinimoMeses, regraDeSaida, linkDePagamento, incluiTreino, incluiDieta);
    }

    void alterar(String nome, long valorCentavos, PeriodoDoPlano periodicidade, Short tempoMinimoMeses,
                 String regraDeSaida, String linkDePagamento, boolean incluiTreino, boolean incluiDieta) {
        this.incluiTreino = incluiTreino;
        this.incluiDieta = incluiDieta;
        this.linkDePagamento = linkDePagamento;
        this.nome = nome;
        this.valorCentavos = valorCentavos;
        this.periodicidade = periodicidade;
        this.tempoMinimoMeses = tempoMinimoMeses;
        this.regraDeSaida = regraDeSaida;
    }

    void definirKiwify(boolean assinatura, String produtoId) {
        this.kiwifyAssinatura = assinatura;
        this.kiwifyProdutoId = assinatura ? produtoId : null;
    }

    void arquivar(Instant quando) {
        this.arquivadoEm = quando;
    }

    public boolean isArquivado() {
        return arquivadoEm != null;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public long getValorCentavos() { return valorCentavos; }
    public PeriodoDoPlano getPeriodicidade() { return periodicidade; }
    public Short getTempoMinimoMeses() { return tempoMinimoMeses; }
    public String getRegraDeSaida() { return regraDeSaida; }
    public String getLinkDePagamento() { return linkDePagamento; }
    public boolean isIncluiTreino() { return incluiTreino; }
    public boolean isIncluiDieta() { return incluiDieta; }
    public boolean isKiwifyAssinatura() { return kiwifyAssinatura; }
    public String getKiwifyProdutoId() { return kiwifyProdutoId; }
    public Instant getArquivadoEm() { return arquivadoEm; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "PlanoComercial[" + id + "]";
    }
}
