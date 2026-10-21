package br.com.treinos.api.biblioteca;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;

/** Catálogo público, igual para todos e só leitura: sem {@code @TenantId}. O treinador importa o que quiser. */
@Entity
@Table(name = "catalogo_exercicio")
public class CatalogoExercicio {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "grupo_muscular")
    private String grupoMuscular;

    private String equipamento;

    @Column(nullable = false)
    private String modalidade;

    private String instrucoes;

    private String fonte;

    @Column(name = "nome_busca", nullable = false)
    private String nomeBusca;

    /** Caminhos relativos das fotos (V020), ex.: {@code Air_Bike/0.jpg}; quem as serve é o proxy da web, nunca a API. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "imagens", nullable = false)
    private List<String> imagens;

    protected CatalogoExercicio() {
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getGrupoMuscular() {
        return grupoMuscular;
    }

    public String getEquipamento() {
        return equipamento;
    }

    public String getModalidade() {
        return modalidade;
    }

    public String getInstrucoes() {
        return instrucoes;
    }

    public String getFonte() {
        return fonte;
    }

    public String getNomeBusca() {
        return nomeBusca;
    }

    public List<String> getImagens() {
        return imagens == null ? List.of() : List.copyOf(imagens);
    }
}
