package com.saraivateam.logdetreino.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "planos_treino")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlanoTreino {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome; // Ex: "Plano 16"

    @Column(name = "data_inicio", nullable = false)
    private LocalDate dataInicio; // Ex: 2026-10-05

    @Column(name = "data_fim", nullable = false)
    private LocalDate dataFim; // Ex: 2026-10-20

    private String observacao;

    @Builder.Default
    @OneToMany(mappedBy = "planoTreino", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DiaTreino> diasTreino = new ArrayList<>();
}
