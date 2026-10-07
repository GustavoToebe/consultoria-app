package com.saraivateam.logdetreino.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "logs_execucao")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LogExecucao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plano_id")
    private Long planoId;

    @Column(name = "nome_exercicio", nullable = false)
    private String nomeExercicio;

    @Column(name = "divisao")
    private String divisao;

    @Column(name = "tipo_serie", nullable = false)
    private String tipoSerie; // WARMUP, FEEDER, WORKING_SET, TOP_SET, BACKOFF, REST_PAUSE

    @Column(name = "carga_utilizada", nullable = false)
    private Double cargaUtilizada;

    @Column(name = "reps_feitas", nullable = false)
    private Integer repsFeitas;

    @Column(name = "rir")
    private Integer rir;

    @Column(name = "data_hora_execucao", nullable = false)
    private LocalDateTime dataHoraExecucao;

    @Column(name = "observacoes", length = 500)
    private String observacoes;

    @Column(name = "is_validada")
    private boolean isValidada;
}
