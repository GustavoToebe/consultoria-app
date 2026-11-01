package br.com.treinos.api.inscricoes;

import br.com.treinos.api.alunos.Sexo;
import br.com.treinos.api.inscricoes.Crm.Interesse;
import br.com.treinos.api.inscricoes.Crm.Modalidade;
import br.com.treinos.api.inscricoes.Crm.ModalidadeDesejada;
import br.com.treinos.api.inscricoes.Crm.MotivoEncerramento;
import br.com.treinos.api.inscricoes.Crm.Origem;
import br.com.treinos.api.inscricoes.Crm.OrigemInformada;
import br.com.treinos.api.inscricoes.Crm.Periodicidade;
import br.com.treinos.api.inscricoes.Crm.PrevisaoInicio;
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

    @Column(name = "aceita_em")
    private Instant aceitaEm;

    /** Reabrir começa um ciclo novo; o anterior fica nos eventos. */
    @Column(nullable = false)
    private int ciclo = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "motivo_encerramento")
    private MotivoEncerramento motivoEncerramento;

    @Column(name = "motivo_detalhe")
    private String motivoDetalhe;

    @Column(name = "encerrada_por")
    private UUID encerradaPor;

    @Column(name = "encerrada_em")
    private Instant encerradaEm;

    @Column(name = "proposta_plano_id")
    private UUID propostaPlanoId;

    @Column(name = "proposta_plano_nome")
    private String propostaPlanoNome;

    @Enumerated(EnumType.STRING)
    @Column(name = "proposta_modalidade")
    private Modalidade propostaModalidade;

    @Enumerated(EnumType.STRING)
    @Column(name = "proposta_periodicidade")
    private Periodicidade propostaPeriodicidade;

    @Column(name = "proposta_valor_referencia_centavos")
    private Long propostaValorReferenciaCentavos;

    @Column(name = "proposta_valor_centavos")
    private Long propostaValorCentavos;

    @Column(name = "proposta_condicoes")
    private String propostaCondicoes;

    @Column(name = "proposta_atualizada_em")
    private Instant propostaAtualizadaEm;

    @Column(name = "proposta_atualizada_por")
    private UUID propostaAtualizadaPor;

    @Enumerated(EnumType.STRING)
    @Column(updatable = false)
    private Interesse interesse;

    @Enumerated(EnumType.STRING)
    @Column(name = "modalidade_desejada", updatable = false)
    private ModalidadeDesejada modalidadeDesejada;

    @Enumerated(EnumType.STRING)
    @Column(name = "previsao_inicio", updatable = false)
    private PrevisaoInicio previsaoInicio;

    @Enumerated(EnumType.STRING)
    @Column(name = "origem_informada", updatable = false)
    private OrigemInformada origemInformada;

    @Column(name = "origem_link", updatable = false)
    private String origemLink;

    @Enumerated(EnumType.STRING)
    private Origem origem;

    @Column(name = "relacionada_a")
    private UUID relacionadaA;

    /**
     * Versão do questionário de inscrição respondida no envio (D9) e as respostas já validadas por ela, sempre juntas.
     * Nulas quando a consultoria não tinha padrão de inscrição publicado. Dado pessoal: nunca em log nem na auditoria.
     */
    @Column(name = "questionario_versao_id", updatable = false)
    private UUID questionarioVersaoId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", updatable = false)
    private String respostas;

    /** Coluna gerada no banco (nome sem acento, em minúsculas), lida pela busca. */
    @Column(name = "nome_busca", insertable = false, updatable = false)
    private String nomeBusca;

    /** Coluna gerada no banco (só dígitos do WhatsApp), lida pela busca. */
    @Column(name = "whatsapp_digitos", insertable = false, updatable = false)
    private String whatsappDigitos;

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
    public Instant getAceitaEm() { return aceitaEm; }
    public int getCiclo() { return ciclo; }
    public MotivoEncerramento getMotivoEncerramento() { return motivoEncerramento; }
    public String getMotivoDetalhe() { return motivoDetalhe; }
    public UUID getEncerradaPor() { return encerradaPor; }
    public Instant getEncerradaEm() { return encerradaEm; }
    public UUID getPropostaPlanoId() { return propostaPlanoId; }
    public String getPropostaPlanoNome() { return propostaPlanoNome; }
    public Modalidade getPropostaModalidade() { return propostaModalidade; }
    public Periodicidade getPropostaPeriodicidade() { return propostaPeriodicidade; }
    public Long getPropostaValorReferenciaCentavos() { return propostaValorReferenciaCentavos; }
    public Long getPropostaValorCentavos() { return propostaValorCentavos; }
    public String getPropostaCondicoes() { return propostaCondicoes; }
    public Instant getPropostaAtualizadaEm() { return propostaAtualizadaEm; }
    public UUID getPropostaAtualizadaPor() { return propostaAtualizadaPor; }
    public Interesse getInteresse() { return interesse; }
    public ModalidadeDesejada getModalidadeDesejada() { return modalidadeDesejada; }
    public PrevisaoInicio getPrevisaoInicio() { return previsaoInicio; }
    public OrigemInformada getOrigemInformada() { return origemInformada; }
    public String getOrigemLink() { return origemLink; }
    public Origem getOrigem() { return origem; }
    public UUID getRelacionadaA() { return relacionadaA; }
    public UUID getQuestionarioVersaoId() { return questionarioVersaoId; }
    public String getRespostas() { return respostas; }

    /** Só na criação (as colunas não mudam depois): a versão respondida e as respostas, em JSON, já validadas. */
    void responder(UUID questionarioVersaoId, String respostas) {
        this.questionarioVersaoId = questionarioVersaoId;
        this.respostas = respostas;
    }

    /** Qualificação e origem do formulário público (só na criação). A origem da equipe começa por elas. */
    void qualificar(Interesse interesse, ModalidadeDesejada modalidade, PrevisaoInicio previsao,
                    OrigemInformada informada, String link) {
        this.interesse = interesse;
        this.modalidadeDesejada = modalidade;
        this.previsaoInicio = previsao;
        this.origemInformada = informada;
        this.origemLink = link;
        this.origem = informada != null ? Origem.valueOf(informada.name()) : Crm.origemDoLink(link);
    }

    void encerrar(SituacaoInscricao situacao, MotivoEncerramento motivo, String detalhe, UUID quem) {
        this.motivoEncerramento = motivo;
        this.motivoDetalhe = detalhe;
        this.encerradaPor = quem;
        alterarSituacao(situacao);
        this.encerradaEm = atualizadaEm;
    }

    /** Novo ciclo em atendimento: o encerramento anterior fica só nos eventos. */
    void reabrir(UUID responsavel) {
        this.ciclo++;
        this.motivoEncerramento = null;
        this.motivoDetalhe = null;
        this.encerradaPor = null;
        this.encerradaEm = null;
        if (this.responsavelId == null) this.responsavelId = responsavel;
        alterarSituacao(SituacaoInscricao.EM_CONTATO);
    }

    void definirProposta(UUID planoId, String planoNome, Modalidade modalidade, Periodicidade periodicidade,
                         Long referencia, Long valor, String condicoes, UUID quem) {
        this.propostaPlanoId = planoId;
        this.propostaPlanoNome = planoNome;
        this.propostaModalidade = modalidade;
        this.propostaPeriodicidade = periodicidade;
        this.propostaValorReferenciaCentavos = referencia;
        this.propostaValorCentavos = valor;
        this.propostaCondicoes = condicoes;
        tocar();
        this.propostaAtualizadaEm = atualizadaEm;
        this.propostaAtualizadaPor = quem;
    }

    boolean temProposta() {
        return propostaPlanoNome != null || propostaModalidade != null || propostaPeriodicidade != null
                || propostaValorReferenciaCentavos != null || propostaValorCentavos != null || propostaCondicoes != null;
    }

    void alterarOrigem(Origem origem) {
        this.origem = origem;
        tocar();
    }

    void relacionar(UUID outra) {
        this.relacionadaA = outra;
        tocar();
    }

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
        this.aceitaEm = atualizadaEm;
    }
}
