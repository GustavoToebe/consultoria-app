package com.saraivateam.logdetreino.service;

import com.saraivateam.logdetreino.domain.LogExecucao;
import com.saraivateam.logdetreino.dto.FichaExercicioDto;
import com.saraivateam.logdetreino.dto.FichaExercicioDto.SerieCalculadaDto;
import com.saraivateam.logdetreino.repository.LogExecucaoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CalculoCargaService {

    private final LogExecucaoRepository logExecucaoRepository;

    /**
     * Arredonda o peso calculado para o incremento comum de anilhas/placas (múltiplo de 0.5kg)
     */
    public double arredondarCarga(double carga) {
        if (carga <= 0) return 0.0;
        return Math.round(carga * 2.0) / 2.0;
    }

    /**
     * Obtém a última carga validada do usuário ou utiliza um valor padrão.
     */
    public double obterUltimaCargaWorkingSet(String nomeExercicio, double fallback) {
        Optional<LogExecucao> ultimoLog = logExecucaoRepository.findUltimaCargaWorkingSet(nomeExercicio);
        return ultimoLog.map(LogExecucao::getCargaUtilizada).orElse(fallback);
    }

    /**
     * Monta a ficha do exercício calculando pesos para todas as séries do Saraiva Team
     * - Aquecimento: 0.3 (30%)
     * - Feeder 1: 0.5 (50%)
     * - Feeder 2: 0.7 (70%)
     * - Feeder 3: 0.85 (85%)
     * - Working Set: 1.0 (100%)
     * - Top Set: 1.1 (110%)
     * - Back Off: 0.85 ou 0.90
     */
    public FichaExercicioDto montarFichaComCargas(
            String nomeExercicio,
            String categoria,
            boolean isLivre,
            Double cargaInformadaWS,
            boolean temAquecimento,
            int quantidadeFeeders,
            int quantidadeWorkingSets,
            boolean temTopSet,
            boolean temBackOff,
            double multiplicadorBackOff
    ) {
        double cargaWS = (cargaInformadaWS != null && cargaInformadaWS > 0)
                ? cargaInformadaWS
                : obterUltimaCargaWorkingSet(nomeExercicio, 0.0);

        List<SerieCalculadaDto> series = new ArrayList<>();

        // 1. Aquecimento (30% do WS)
        if (temAquecimento && cargaWS > 0) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("WARMUP")
                    .nomeSerie("Aquecimento")
                    .multiplicador(0.3)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.3))
                    .repRange("10-15")
                    .rirAlvo(null)
                    .build());
        }

        // 2. Feeders Progressivos
        if (quantidadeFeeders == 3) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("FEEDER")
                    .nomeSerie("Feeder Set 1")
                    .multiplicador(0.5)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.5))
                    .repRange("3-5")
                    .rirAlvo(null)
                    .build());
            series.add(SerieCalculadaDto.builder()
                    .tipo("FEEDER")
                    .nomeSerie("Feeder Set 2")
                    .multiplicador(0.7)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.7))
                    .repRange("3-5")
                    .rirAlvo(null)
                    .build());
            series.add(SerieCalculadaDto.builder()
                    .tipo("FEEDER")
                    .nomeSerie("Feeder Set 3")
                    .multiplicador(0.85)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.85))
                    .repRange("3")
                    .rirAlvo(null)
                    .build());
        } else if (quantidadeFeeders == 2) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("FEEDER")
                    .nomeSerie("Feeder Set 1")
                    .multiplicador(0.7)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.7))
                    .repRange("3-5")
                    .rirAlvo(null)
                    .build());
            series.add(SerieCalculadaDto.builder()
                    .tipo("FEEDER")
                    .nomeSerie("Feeder Set 2")
                    .multiplicador(0.85)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.85))
                    .repRange("3-5")
                    .rirAlvo(null)
                    .build());
        } else if (quantidadeFeeders == 1) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("FEEDER")
                    .nomeSerie("Feeder Set 1")
                    .multiplicador(0.85)
                    .cargaCalculada(arredondarCarga(cargaWS * 0.85))
                    .repRange("3")
                    .rirAlvo(null)
                    .build());
        }

        // 3. Working Sets (1.0 = 100%)
        int rirAlvo = isLivre ? 1 : 0;
        for (int i = 1; i <= quantidadeWorkingSets; i++) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("WORKING_SET")
                    .nomeSerie(quantidadeWorkingSets > 1 ? "Working Set " + i : "Working Set")
                    .multiplicador(1.0)
                    .cargaCalculada(arredondarCarga(cargaWS))
                    .repRange("8")
                    .rirAlvo(rirAlvo)
                    .build());
        }

        // 4. Top Set (1.1 = 110%)
        if (temTopSet) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("TOP_SET")
                    .nomeSerie("Top Set")
                    .multiplicador(1.1)
                    .cargaCalculada(arredondarCarga(cargaWS * 1.1))
                    .repRange("6-8")
                    .rirAlvo(rirAlvo)
                    .build());
        }

        // 5. Back Off (0.85 ou 0.90)
        if (temBackOff) {
            series.add(SerieCalculadaDto.builder()
                    .tipo("BACKOFF")
                    .nomeSerie("Back Off")
                    .multiplicador(multiplicadorBackOff)
                    .cargaCalculada(arredondarCarga(cargaWS * multiplicadorBackOff))
                    .repRange("8-12")
                    .rirAlvo(rirAlvo)
                    .build());
        }

        return FichaExercicioDto.builder()
                .nomeExercicio(nomeExercicio)
                .categoria(categoria)
                .isLivre(isLivre)
                .cargaWorkingSet(cargaWS)
                .series(series)
                .build();
    }
}
