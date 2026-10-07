package com.saraivateam.logdetreino.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FichaExercicioDto {
    private String nomeExercicio;
    private String categoria;
    private boolean isLivre;
    private double cargaWorkingSet;
    private List<SerieCalculadaDto> series;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SerieCalculadaDto {
        private String tipo;        // WARMUP, FEEDER, WORKING_SET, TOP_SET, BACKOFF, REST_PAUSE
        private String nomeSerie;   // Aquecimento, Feeder Set 1, Working Set 1, Back Off...
        private double multiplicador; // 0.3, 0.5, 0.7, 0.85, 1.0, 1.1, 0.9
        private double cargaCalculada; // Peso exato sugerido para a barra
        private String repRange;    // "10-15", "3-5", "8", "6-8"
        private Integer rirAlvo;    // 1 para livre, 0 para maquina
    }
}
