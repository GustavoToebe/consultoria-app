package br.com.treinos.api.inscricoes;

import br.com.treinos.api.alunos.Sexo;
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
import java.util.UUID;

/**
 * Inscrição de um interessado pelo link público da consultoria. Dado pessoal (nome, WhatsApp, e-mail e o que a pessoa
 * escreveu): nunca em log nem na auditoria. A consultoria sai do código do link, nunca do corpo. Situação comercial e
 * pagamento são independentes; o aceite liga o aluno criado (no máximo um).
 */
@Entity
@Table(name = "inscricao")
public class Inscricao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "responsavel_id")
    private UUID responsavelId;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String whatsapp;

    private String email;

    private String objetivo;

    private String observacao;

    @Enumerated(EnumType.STRING)
    private Sexo sexo;

    @Column(name = "ciencia_em")
    private Instant cienciaEm;

    @Column(name = "ciencia_texto")
    private String cienciaTexto;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SituacaoInscricao situacao = SituacaoInscricao.NOVA;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PagamentoInscricao pagamento = PagamentoInscricao.NAO_CONTROLADO;

    @Column(name = "pagamento_confirmado_por")
    private UUID pagamentoConfirmadoPor;

    @Column(name = "pagamento_confirmado_em")
    private Instant pagamentoConfirmadoEm;

    @Column(name = "aluno_id")
    private UUID alunoId;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm = Instant.now();

    @Column(name = "atualizada_em", nullable = false)
    private Instant atualizadaEm = criadaEm;

    /**
     * Última atividade da equipe ou da pessoa (andamento, nota, retorno...): é dela que contam os 180 dias da retenção.
     * Atividade que não muda a inscrição (nota) grava só esta coluna, por UPDATE, sem subir a versão.
     */
    @Column(name = "ultima_atividade_em", nullable = false)
    private Instant ultimaAtividadeEm = criadaEm;

    @Version
    private Long versao;

    protected Inscricao() {
    }

    /** {@code textoCiencia} nulo = a consultoria não tinha texto (sem ciência a registrar). */
    Inscricao(String nome, String whatsapp, String email, String objetivo, String observacao, String textoCiencia,
              UUID responsavelId, Sexo sexo) {
        this.nome = nome;
        this.whatsapp = whatsapp;
        this.email = email;
        this.objetivo = objetivo;
        this.observacao = observacao;
        this.responsavelId = responsavelId;
        this.sexo = sexo;
        if (textoCiencia != null) {
            this.cienciaTexto = textoCiencia;
            this.cienciaEm = criadaEm;
        }
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getResponsavelId() { return responsavelId; }
    public String getNome() { return nome; }
    public String getWhatsapp() { return whatsapp; }
    public String getEmail() { return email; }
    public String getObjetivo() { return objetivo; }
    public String getObservacao() { return observacao; }
    public Sexo getSexo() { return sexo; }
    public Instant getCienciaEm() { return cienciaEm; }
    public String getCienciaTexto() { return cienciaTexto; }
    public SituacaoInscricao getSituacao() { return situacao; }
    public PagamentoInscricao getPagamento() { return pagamento; }
    public UUID getPagamentoConfirmadoPor() { return pagamentoConfirmadoPor; }
    public Instant getPagamentoConfirmadoEm() { return pagamentoConfirmadoEm; }
    public UUID getAlunoId() { return alunoId; }
    public Instant getCriadaEm() { return criadaEm; }
    public Instant getAtualizadaEm() { return atualizadaEm; }
    public Instant getUltimaAtividadeEm() { return ultimaAtividadeEm; }
    public Long getVersao() { return versao; }

    void alterarSituacao(SituacaoInscricao nova) {
        this.situacao = nova;
        tocar();
    }

    void alterarResponsavel(UUID responsavelId) {
        this.responsavelId = responsavelId;
        tocar();
    }

    /** Alteração da linha: conta também como atividade. */
    void tocar() {
        this.atualizadaEm = Instant.now();
        this.ultimaAtividadeEm = atualizadaEm;
    }

    /** Confirmar guarda quem e quando; sair do "confirmado" apaga os dois (a auditoria guarda o histórico). */
    void alterarPagamento(PagamentoInscricao novo, UUID quem) {
        if (novo == pagamento) return;
        this.pagamento = novo;
        boolean confirmado = novo == PagamentoInscricao.CONFIRMADO_MANUAL;
        this.pagamentoConfirmadoPor = confirmado ? quem : null;
        this.pagamentoConfirmadoEm = confirmado ? Instant.now() : null;
        tocar();
    }

    void aceitar(UUID alunoId) {
        this.alunoId = alunoId;
        alterarSituacao(SituacaoInscricao.ACEITA);
    }
}
