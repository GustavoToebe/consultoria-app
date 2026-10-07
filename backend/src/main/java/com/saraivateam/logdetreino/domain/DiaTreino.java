package com.saraivateam.logdetreino.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "dias_treino")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiaTreino {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plano_id", nullable = false)
    private PlanoTreino planoTreino;

    @Column(name = "data_agendada", nullable = false)
    private LocalDate dataAgendada;

    @Column(name = "dia_semana")
    private String diaSemana; // Segunda, Terca, Quarta...

    private String divisao; // A1, B1, A2, B2, A3, B3, Costas, Peito+Ombros...

    @Column(name = "is_off")
    private boolean isOff;

    private Integer cardioMin;

    @Builder.Default
    @OneToMany(mappedBy = "diaTreino", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExercicioTreino> exercicios = new ArrayList<>();
}
