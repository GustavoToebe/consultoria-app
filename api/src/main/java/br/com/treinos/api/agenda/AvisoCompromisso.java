package br.com.treinos.api.agenda;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Aviso dentro do app para o aluno quando um compromisso é marcado, remarcado ou cancelado (D12, V042). Guarda uma cópia
 * do momento (início e nome do responsável); nunca a observação, o local nem o nome de outro aluno. A geração, as rotas do
 * aluno e a limpeza são do passo 3 do plano; por enquanto a entidade só existe para a limpeza do aluno que sai
 * ({@link AgendaService#apagarDoAluno}).
 */
@Entity
@Table(name = "aviso_compromisso")
public class AvisoCompromisso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(name = "compromisso_id", nullable = false, updatable = false)
    private UUID compromissoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private TipoAvisoCompromisso tipo;

    @Column(nullable = false, updatable = false)
    private Instant inicio;

    @Column(name = "responsavel_nome", updatable = false)
    private String responsavelNome;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "visto_em")
    private Instant vistoEm;

    protected AvisoCompromisso() {
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getCompromissoId() { return compromissoId; }
    public TipoAvisoCompromisso getTipo() { return tipo; }
    public Instant getInicio() { return inicio; }
    public String getResponsavelNome() { return responsavelNome; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getVistoEm() { return vistoEm; }
}
