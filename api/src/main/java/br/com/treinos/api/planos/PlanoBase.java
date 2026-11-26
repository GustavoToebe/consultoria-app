package br.com.treinos.api.planos;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Colunas comuns de {@code plano_treino} e {@code plano_dieta}. O rascunho é o único lugar editável; publicar copia
 * para uma versão nova e imutável. {@code ativo} marca o plano vigente do aluno (um por aluno,
 * índice parcial no banco).
 */
@MappedSuperclass
public abstract class PlanoBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", updatable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private String titulo;
    @Column(nullable = false) private boolean arquivado;
    public boolean isArquivado() { return arquivado; }
    /** Arquivado nunca é liberado: o agendamento morre com ele. */
    public void arquivar() { this.arquivado = true; this.ativo = false; this.liberarEm = null; }


    private LocalDate inicio;

    private LocalDate fim;

    /**
     * Importação da planilha completa que criou a linha (V049); nulo = criada à mão. O "Desfazer" da importação só olha
     * as linhas com este id. Gravado só na criação.
     */
    @Column(name = "importacao_id", updatable = false)
    private UUID importacaoId;

    public UUID getImportacaoId() {
        return importacaoId;
    }

    /** Antes de gravar a linha nova: liga à importação que a cria. */
    public void marcarImportacao(UUID importacao) {
        this.importacaoId = importacao;
    }

    @Column(name = "pasta_id")
    private UUID pastaId;

    @Column(nullable = false)
    private boolean ativo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String rascunho;

    @Column(name = "rascunho_alterado_em", nullable = false)
    private Instant rascunhoAlteradoEm;

    @Column(name = "versao_publicada", nullable = false)
    private int versaoPublicada;

    @Column(name = "publicado_em")
    private Instant publicadoEm;

    /** Versão que o ALUNO vê (0 = nenhuma ainda); nunca passa de {@code versaoPublicada} (CHECK da V106). */
    @Column(name = "versao_liberada", nullable = false)
    private int versaoLiberada;

    /** Dia (Brasília) em que a versão publicada passa a valer para o aluno; nulo = nada agendado. */
    @Column(name = "liberar_em")
    private LocalDate liberarEm;

    /** A escolha "Avisar o aluno" da publicação, para a rotina que libera. */
    @Column(name = "avisar_na_liberacao", nullable = false)
    private boolean avisarNaLiberacao = true;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Version
    private Long versao;

    protected PlanoBase() {
    }

    protected PlanoBase(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        this.alunoId = alunoId;
        this.titulo = titulo;
        this.inicio = inicio;
        this.fim = fim;
        this.rascunho = rascunho;
        this.rascunhoAlteradoEm = Instant.now();
    }

    public void salvarRascunho(String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        this.titulo = titulo;
        this.inicio = inicio;
        this.fim = fim;
        this.rascunho = rascunho;
        this.rascunhoAlteradoEm = Instant.now();
    }

    /** Título final gravado na publicação ({@link TituloDoPlanoPublicado}); não conta como edição do rascunho. */
    public void definirTituloAoPublicar(String titulo) {
        this.titulo = titulo;
    }

    /** Liga o plano a uma pasta (quem chama já conferiu que a pasta é do mesmo aluno). */
    public void definirPasta(UUID pastaId) {
        this.pastaId = pastaId;
    }

    /** Período vindo da pasta; conta como alteração do rascunho (o publicado não muda até publicar de novo). */
    public void definirPeriodo(LocalDate inicio, LocalDate fim) {
        this.inicio = inicio;
        this.fim = fim;
        this.rascunhoAlteradoEm = Instant.now();
    }

    /** Publicou a versão {@code numero} sem data: este passa a ser o plano vigente do aluno, na hora. */
    public void publicar(int numero, Instant quando) {
        this.versaoPublicada = numero;
        this.publicadoEm = quando;
        this.versaoLiberada = numero;
        this.liberarEm = null;
        this.ativo = true;
    }

    /**
     * Publicou a versão {@code numero} com data: ela existe, mas o aluno segue na versão (ou no plano) anterior até
     * {@link #liberarVersaoPublicada}. {@code ativo} e {@code versaoLiberada} não mudam. Substitui um agendamento anterior.
     */
    public void agendar(int numero, Instant quando, LocalDate liberarEm, boolean avisar) {
        this.versaoPublicada = numero;
        this.publicadoEm = quando;
        this.liberarEm = liberarEm;
        this.avisarNaLiberacao = avisar;
    }

    /** Muda o dia de um agendamento existente (quem chama já conferiu que há um). */
    public void alterarLiberarEm(LocalDate liberarEm) {
        this.liberarEm = liberarEm;
    }

    /** O aluno passa a ver a última versão publicada e este plano passa a ser o vigente (quem chama desativa os outros antes). */
    public void liberarVersaoPublicada() {
        this.versaoLiberada = this.versaoPublicada;
        this.liberarEm = null;
        this.ativo = true;
    }

    /** Há versão publicada esperando a data de liberação. */
    public boolean isAgendado() {
        return liberarEm != null;
    }

    /** Rascunho mudou depois da última publicação (o app mostra "Alterado desde a publicação"). */
    public boolean rascunhoAlteradoDepoisDePublicar() {
        return publicadoEm != null && rascunhoAlteradoEm.isAfter(publicadoEm);
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    public String getTitulo() {
        return titulo;
    }

    public LocalDate getInicio() {
        return inicio;
    }

    public LocalDate getFim() {
        return fim;
    }

    public UUID getPastaId() {
        return pastaId;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public String getRascunho() {
        return rascunho;
    }

    public Instant getRascunhoAlteradoEm() {
        return rascunhoAlteradoEm;
    }

    public int getVersaoPublicada() {
        return versaoPublicada;
    }

    public Instant getPublicadoEm() {
        return publicadoEm;
    }

    public int getVersaoLiberada() {
        return versaoLiberada;
    }

    public LocalDate getLiberarEm() {
        return liberarEm;
    }

    public boolean isAvisarNaLiberacao() {
        return avisarNaLiberacao;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Long getVersao() {
        return versao;
    }
}
