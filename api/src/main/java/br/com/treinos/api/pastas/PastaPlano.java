package br.com.treinos.api.pastas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Pasta de um aluno (ex.: "Plano 16"): agrupa treinos e dietas e guarda o período que vale para todos eles. Mudar o
 * período aqui altera o rascunho dos planos da pasta (o publicado continua imutável até publicar de novo).
 */
@Entity
@Table(name = "pasta_plano")
public class PastaPlano {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private String titulo;
    @Column(nullable = false) private boolean arquivado;
    public boolean isArquivado() { return arquivado; }
    public void arquivar() { this.arquivado = true;  }

    @Column(name = "concluida_em")
    private Instant concluidaEm;
    public Instant getConcluidaEm() { return concluidaEm; }
    public void concluir(Instant quando) { this.concluidaEm = quando; }
    public void reabrir() { this.concluidaEm = null; }

    /** Questionário de atualização só deste período; nulo = o do aluno. */
    @Column(name = "questionario_id")
    private java.util.UUID questionarioId;
    public java.util.UUID getQuestionarioId() { return questionarioId; }
    public void alterarQuestionario(java.util.UUID id) { this.questionarioId = id; }


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

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    protected PastaPlano() {
    }

    public PastaPlano(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim) {
        this.alunoId = alunoId;
        this.titulo = titulo;
        this.inicio = inicio;
        this.fim = fim;
    }

    public void atualizar(String titulo, LocalDate inicio, LocalDate fim) {
        this.titulo = titulo;
        this.inicio = inicio;
        this.fim = fim;
    }

    public UUID getId() {
        return id;
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

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
