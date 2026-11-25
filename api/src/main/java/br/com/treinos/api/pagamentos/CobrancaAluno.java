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
import org.hibernate.annotations.OptimisticLock;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Uma cobrança por competência da contratação. {@code VENCIDA} não existe como situação: é ABERTA com vencimento anterior a
 * hoje (Brasília), calculada por {@link #vencida(LocalDate)}. O valor é sempre o da contratação, nunca do cliente.
 * {@code observacao} e {@code motivo} são texto do treinador: nunca em log, e a anonimização os apaga.
 */
@Entity
@Table(name = "cobranca_aluno")
public class CobrancaAluno {

    /**
     * RENEGOCIADA (V094) é a original que virou parcelas de um acordo: o dinheiro segue devido nas parcelas, então ela fica fora de
     * totais, vencido e lembretes, mas continua cobrindo a competência (a mensalidade renegociada não é gerada de novo).
     */
    public enum Situacao { ABERTA, PAGA, CANCELADA, ESTORNADA, CONTESTADA, RENEGOCIADA }

    /**
     * MENSALIDADE é a cobrança do período; SAIDA é a cobrança de saída antes do tempo mínimo (V074), uma viva por contratação;
     * AVULSA (V087) é a que o treinador lança direto ao aluno, sem contratação nem competência, com descrição e valor do corpo.
     * RENEGOCIACAO (V094) é a parcela de um acordo: como a avulsa (sem contratação nem competência), mas com descrição fixa do servidor.
     */
    public enum Tipo { MENSALIDADE, SAIDA, AVULSA, RENEGOCIACAO }

    /**
     * O dinheiro não ficou: cancelada e estornada não cobrem período (a contestada cobre, até o banco decidir). A RENEGOCIADA também
     * cobre: o valor foi para as parcelas do acordo, e a competência não nasce de novo.
     */
    public static final Set<Situacao> NAO_COBREM_PERIODO = Set.of(Situacao.CANCELADA, Situacao.ESTORNADA);

    /** As cobranças que um contrato fechado (V098) liga à contratação: a entrada, as parcelas e os pagamentos do saldo (a multa de saída fica de fora). */
    public static final Set<Tipo> DO_CONTRATO = Set.of(Tipo.AVULSA, Tipo.RENEGOCIACAO);

    /** Provedor da baixa manual do treinador. */
    public static final String MANUAL = "MANUAL";

    /** No lugar da descrição da avulsa depois da anonimização do aluno (o treinador pode ter escrito o nome dele nela). */
    static final String DESCRICAO_ANONIMIZADA = "Cobrança avulsa";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    /** Nulo na AVULSA e na RENEGOCIACAO comuns; o contrato fechado (V098) liga as suas à contratação. */
    @Column(name = "contratacao_id", updatable = false)
    private UUID contratacaoId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    /** Nula só na AVULSA (CHECK da V087). */
    @Column(updatable = false)
    private LocalDate competencia;
    /** Texto do treinador, só da AVULSA (nulo nas outras): nunca em log nem auditoria; a anonimização o troca por texto fixo. */
    private String descricao;
    /** O acordo (V094): nas originais RENEGOCIADA e nas parcelas RENEGOCIACAO; nulo nas demais e nas originais reabertas ao desfazer. */
    @Column(name = "acordo_id")
    private UUID acordoId;
    /** Só da AVULSA gerada pelo app (V090): o UUID do pedido (idempotência da geração) e a posição da parcela, 1 a 12. Não é dado pessoal. */
    @Column(name = "pedido_id", updatable = false)
    private UUID pedidoId;
    @Column(updatable = false)
    private Short parcela;
    @Column(name = "valor_centavos", nullable = false)
    private long valorCentavos;
    @Column(nullable = false)
    private LocalDate vencimento;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Tipo tipo;
    @Enumerated(EnumType.STRING)
    private FormaDePagamento forma;
    @Column(nullable = false)
    private String provedor;
    @Column(name = "id_externo")
    private String idExterno;
    @OptimisticLock(excluded = true)
    @Column(name = "asaas_cobranca_id", length = 60)
    private String asaasCobrancaId;
    @Column(name = "valor_liquido_centavos")
    private Long valorLiquidoCentavos;
    @Column(name = "pago_em")
    private LocalDate pagoEm;
    @Column(name = "baixa_por")
    private UUID baixaPor;
    private String observacao;
    private String motivo;
    // O link é metadado do provedor, não edição do treinador: gerá-lo não sobe a versão (senão a folha aberta da cobrança tomaria 409).
    @OptimisticLock(excluded = true)
    @Column(name = "link_url")
    private String linkUrl;
    @OptimisticLock(excluded = true)
    @Column(name = "link_slug")
    private String linkSlug;
    @OptimisticLock(excluded = true)
    @Column(name = "link_valor_centavos")
    private Long linkValorCentavos;
    @OptimisticLock(excluded = true)
    @Column(name = "link_gerado_em")
    private Instant linkGeradoEm;
    /** Quando o link vence no provedor; nulo = não vence (o link sem API Key). */
    @OptimisticLock(excluded = true)
    @Column(name = "link_valido_ate")
    private Instant linkValidoAte;
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
        this.tipo = Tipo.MENSALIDADE;
        this.provedor = MANUAL;
    }

    /** Cobrança de saída: o valor é o confirmado no encerramento (não o da contratação) e a competência é a data dele. */
    static CobrancaAluno saida(ContratacaoAluno contratacao, LocalDate competencia, LocalDate vencimento,
                               long valorCentavos) {
        CobrancaAluno c = new CobrancaAluno(contratacao, competencia, vencimento);
        c.tipo = Tipo.SAIDA;
        c.valorCentavos = valorCentavos;
        return c;
    }

    /** Cobrança avulsa: sem contratação nem competência; valor e descrição vêm do treinador (D5, exceção à regra do valor do servidor). */
    static CobrancaAluno avulsa(UUID pedidoId, UUID alunoId, int parcela, String descricao, long valorCentavos,
                                LocalDate vencimento) {
        CobrancaAluno c = new CobrancaAluno();
        c.pedidoId = pedidoId;
        c.parcela = (short) parcela;
        c.alunoId = alunoId;
        c.descricao = descricao;
        c.valorCentavos = valorCentavos;
        c.vencimento = vencimento;
        c.situacao = Situacao.ABERTA;
        c.tipo = Tipo.AVULSA;
        c.provedor = MANUAL;
        return c;
    }

    /** Parcela de um acordo: sem contratação nem competência; a descrição é fixa do servidor e valor e vencimento vêm da conta dele (D14). */
    static CobrancaAluno renegociacao(UUID acordoId, UUID alunoId, String descricao, long valorCentavos, LocalDate vencimento) {
        CobrancaAluno c = new CobrancaAluno();
        c.acordoId = acordoId;
        c.alunoId = alunoId;
        c.descricao = descricao;
        c.valorCentavos = valorCentavos;
        c.vencimento = vencimento;
        c.situacao = Situacao.ABERTA;
        c.tipo = Tipo.RENEGOCIACAO;
        c.provedor = MANUAL;
        return c;
    }

    /**
     * Liga a cobrança AVULSA ou RENEGOCIACAO recém-criada a um contrato fechado (V098). Só antes de gravar (a coluna não é atualizável);
     * a FK composta do banco garante que a contratação é do mesmo aluno e da mesma consultoria.
     */
    CobrancaAluno ligadaAoContrato(UUID contratacaoId) {
        this.contratacaoId = contratacaoId;
        return this;
    }

    /** A entrada do contrato: AVULSA sem pedido nem parcela (não é lote do app), com descrição fixa do servidor. */
    static CobrancaAluno entradaDoContrato(UUID alunoId, String descricao, long valorCentavos, LocalDate vencimento) {
        CobrancaAluno c = avulsa(null, alunoId, 1, descricao, valorCentavos, vencimento);
        c.pedidoId = null;
        c.parcela = null;
        return c;
    }

    /** Valor e vencimento novos de uma aberta ainda não vencida (alteração da contratação). */
    void reajustar(long valorCentavos, LocalDate vencimento) {
        this.valorCentavos = valorCentavos;
        this.vencimento = vencimento;
    }

    /** {@code idExterno} é a transação no provedor (única por consultoria e provedor); nulo na baixa manual. */
    void pagar(String provedor, FormaDePagamento forma, LocalDate pagoEm, UUID baixaPor, String observacao,
               String idExterno) {
        this.situacao = Situacao.PAGA;
        this.provedor = provedor;
        this.forma = forma;
        this.pagoEm = pagoEm;
        this.baixaPor = baixaPor;
        this.observacao = observacao;
        this.idExterno = idExterno;
    }

    /**
     * O link de pagamento do provedor, o valor com que foi gerado (conferido na baixa) e até quando vale ({@code validoAte}
     * nulo = não vence); um link novo substitui o antigo.
     */
    void registrarLink(String url, String slug, long valorCentavos, Instant quando, Instant validoAte) {
        this.linkUrl = url;
        this.linkSlug = slug;
        this.linkValorCentavos = valorCentavos;
        this.linkGeradoEm = quando;
        this.linkValidoAte = validoAte;
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

    /** ABERTA vira RENEGOCIADA; o motivo é texto do treinador (só a equipe vê, nunca o aluno nem o provedor). */
    void renegociar(UUID acordoId, String motivo) {
        this.situacao = Situacao.RENEGOCIADA;
        this.acordoId = acordoId;
        this.motivo = motivo;
    }

    /** O acordo foi desfeito: a original volta a ABERTA, sem acordo e sem o motivo da renegociação. */
    void reabrirDoAcordo() {
        this.situacao = Situacao.ABERTA;
        this.acordoId = null;
        this.motivo = null;
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

    /** Contestação resolvida a favor do treinador: volta a PAGA com a mesma baixa; só o motivo muda. */
    void manterPaga(String motivo) {
        this.situacao = Situacao.PAGA;
        this.motivo = motivo;
    }

    /** Anonimização do aluno: observação, motivos e o link do pagador saem; valor, datas e situação ficam. */
    void limparDadosPessoais() {
        this.observacao = null;
        this.motivo = null;
        this.linkUrl = null;
        this.linkSlug = null;
        this.linkValidoAte = null;
        if (tipo == Tipo.AVULSA) {
            this.descricao = DESCRICAO_ANONIMIZADA;
        }
    }

    void registrarAsaasCobranca(String asaasCobrancaId) {
        this.asaasCobrancaId = asaasCobrancaId;
    }

    void registrarValorLiquido(Long valorLiquidoCentavos) {
        if (valorLiquidoCentavos != null && valorLiquidoCentavos >= 0) {
            this.valorLiquidoCentavos = valorLiquidoCentavos;
        }
    }

    public boolean vencida(LocalDate hoje) {
        return situacao == Situacao.ABERTA && vencimento.isBefore(hoje);
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getContratacaoId() { return contratacaoId; }
    public UUID getAlunoId() { return alunoId; }
    public LocalDate getCompetencia() { return competencia; }
    public String getDescricao() { return descricao; }
    public UUID getAcordoId() { return acordoId; }
    public long getValorCentavos() { return valorCentavos; }
    public LocalDate getVencimento() { return vencimento; }
    public Situacao getSituacao() { return situacao; }
    public Tipo getTipo() { return tipo; }
    public FormaDePagamento getForma() { return forma; }
    public String getProvedor() { return provedor; }
    public String getIdExterno() { return idExterno; }
    public String getAsaasCobrancaId() { return asaasCobrancaId; }
    public Long getValorLiquidoCentavos() { return valorLiquidoCentavos; }
    public LocalDate getPagoEm() { return pagoEm; }
    public UUID getBaixaPor() { return baixaPor; }
    public String getObservacao() { return observacao; }
    public String getMotivo() { return motivo; }
    public String getLinkUrl() { return linkUrl; }
    public String getLinkSlug() { return linkSlug; }
    public Long getLinkValorCentavos() { return linkValorCentavos; }
    public Instant getLinkGeradoEm() { return linkGeradoEm; }
    public Instant getLinkValidoAte() { return linkValidoAte; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "CobrancaAluno[" + id + "]";
    }
}
