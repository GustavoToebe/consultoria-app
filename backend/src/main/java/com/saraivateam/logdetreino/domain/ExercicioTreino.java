package com.saraivateam.logdetreino.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "exercicios_treino")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExercicioTreino {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dia_treino_id", nullable = false)
    private DiaTreino diaTreino;

    @Column(nullable = false)
    private String nome;

    private String categoria; // Costas, Peito, Quadriceps...

    @Column(name = "is_livre")
    private boolean isLivre; // true: 1 RIR, false: Falha

    @Column(name = "carga_working_set_calculada")
    private Double cargaWorkingSetCalculada;

    @Column(name = "ordem")
    private Integer ordem;
}
