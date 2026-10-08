package br.com.treinos.api.receitas;
import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import java.util.UUID;

@Entity
@Table(name = "pasta_modelo")
public class PastaModelo {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @TenantId @Column(name = "consultoria_id", nullable = false, updatable = false) private UUID consultoriaId;
    @Column(nullable = false) private String nome;
    @Version private Long versao;
    protected PastaModelo() { }
    public PastaModelo(String nome) { this.nome = nome; }
    public UUID getId() { return id; }
    public String getNome() { return nome; }
    public Long getVersao() { return versao; }
    public void renomear(String nome) { this.nome = nome; }
}
