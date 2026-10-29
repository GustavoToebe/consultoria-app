package br.com.treinos.api.agenda;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Uma ocorrência de uma série de eventos que foi cancelada ou alterada (D4). Campos nulos herdam do evento; texto vazio
 * ({@code ""}) em título, local ou descrição quer dizer "apagado só nesta ocorrência"; {@code diaInteiro} nulo herda.
 * {@code dataNova} move a ocorrência para outro dia. A chave natural é {@code (evento, dataOriginal)}.
 */
@Entity
@Table(name = "evento_agenda_excecao")
public class ExcecaoDeEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "evento_id", nullable = false, updatable = false)
    private UUID eventoId;

    @Column(name = "data_original", nullable = false, updatable = false)
    private LocalDate dataOriginal;

    @Column(nullable = false)
    private boolean cancelada;

    private String titulo;
    private String descricao;
    private String local;

    @Column(name = "dia_inteiro")
    private Boolean diaInteiro;

    @Column(name = "hora_inicio")
    private LocalTime horaInicio;

    @Column(name = "duracao_minutos")
    private Integer duracaoMinutos;

    @Column(name = "data_nova")
    private LocalDate dataNova;

    protected ExcecaoDeEvento() {
    }

    ExcecaoDeEvento(UUID eventoId, LocalDate dataOriginal) {
        this.eventoId = eventoId;
        this.dataOriginal = dataOriginal;
    }

    public UUID getId() { return id; }
    public UUID getEventoId() { return eventoId; }
    public LocalDate getDataOriginal() { return dataOriginal; }
    public boolean isCancelada() { return cancelada; }
    public String getTitulo() { return titulo; }
    public String getDescricao() { return descricao; }
    public String getLocal() { return local; }
    public Boolean getDiaInteiro() { return diaInteiro; }
    public LocalTime getHoraInicio() { return horaInicio; }
    public Integer getDuracaoMinutos() { return duracaoMinutos; }
    public LocalDate getDataNova() { return dataNova; }

    /** A ocorrência deixa de existir; os campos alterados não importam mais. */
    void cancelar() {
        this.cancelada = true;
        this.titulo = null;
        this.descricao = null;
        this.local = null;
        this.diaInteiro = null;
        this.horaInicio = null;
        this.duracaoMinutos = null;
        this.dataNova = null;
    }

    /** Substitui as alterações desta ocorrência (nulo = herda do evento). */
    void alterar(String titulo, String descricao, String local, Boolean diaInteiro, LocalTime horaInicio,
                 Integer duracaoMinutos, LocalDate dataNova) {
        this.cancelada = false;
        this.titulo = titulo;
        this.descricao = descricao;
        this.local = local;
        this.diaInteiro = diaInteiro;
        this.horaInicio = horaInicio;
        this.duracaoMinutos = duracaoMinutos;
        this.dataNova = dataNova;
    }

    /** Sem nenhuma diferença do evento, a exceção não serve para nada. */
    boolean vazia() {
        return !cancelada && titulo == null && descricao == null && local == null && diaInteiro == null
                && horaInicio == null && duracaoMinutos == null && dataNova == null;
    }
}
