package br.com.treinos.api.anteriores;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.EtapaRegistrada;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Coluna "Anterior" do treino ao vivo (frente Engajamento, passo 0.3): para cada exercício da biblioteca, as séries
 * feitas na última vez em que ele foi treinado. Regra pura (sem banco nem relógio), espelhada em
 * {@code app/src/dominio/seriesAnteriores.ts} (mudou uma, mude a outra):
 * <ul>
 * <li>"última vez" = a data mais recente com série feita do exercício; nela, se o exercício apareceu em mais de uma linha
 *     do plano (duas sessões ou duas versões), vale a primeira na ordem do plano;</li>
 * <li>cada série vai com o código do tipo e a ordem dentro do tipo ({@code WORKING} 2 = a segunda WS do exercício), que é
 *     como o app acha "a mesma série" mesmo depois de o plano mudar de versão ou de pasta;</li>
 * <li>nada é estimado: carga e repetições são as registradas; série com etapas leva as etapas.</li>
 * </ul>
 */
public final class SeriesAnteriores {

    private SeriesAnteriores() {
    }

    /** Uma série da última vez: o que foi registrado e onde ela fica no exercício. */
    public record SerieAnterior(String tipo, int ordem, BigDecimal carga, Integer repeticoes, List<EtapaRegistrada> etapas) {
    }

    /** A última vez de um exercício: a data e as séries feitas, na ordem do plano. */
    public record AnteriorDoExercicio(LocalDate data, List<SerieAnterior> series) {
    }

    /**
     * Uma série feita, já localizada na versão executada.
     *
     * @param ordemNoPlano posição da série na versão (decide a linha do exercício e a ordem das séries)
     */
    public record Feita(UUID exercicioId, LocalDate data, UUID exercicioUid, int ordemNoPlano, String tipo, int ordemNoTipo,
                        BigDecimal carga, Integer repeticoes, List<EtapaRegistrada> etapas) {
    }

    /** A última vez de cada exercício; série sem tipo (cardio) não entra. */
    public static Map<UUID, AnteriorDoExercicio> escolher(Collection<Feita> feitas) {
        Map<UUID, List<Feita>> porExercicio = new HashMap<>();
        for (Feita f : feitas) {
            if (f.exercicioId() != null && f.tipo() != null && f.ordemNoTipo() > 0) {
                porExercicio.computeIfAbsent(f.exercicioId(), x -> new ArrayList<>()).add(f);
            }
        }
        Map<UUID, AnteriorDoExercicio> resultado = new HashMap<>();
        porExercicio.forEach((exercicioId, lista) -> {
            LocalDate ultima = lista.stream().map(Feita::data).max(Comparator.naturalOrder()).orElseThrow();
            List<Feita> doDia = lista.stream().filter(f -> f.data().equals(ultima))
                    .sorted(Comparator.comparingInt(Feita::ordemNoPlano)).toList();
            UUID linha = doDia.get(0).exercicioUid();
            List<SerieAnterior> series = doDia.stream().filter(f -> f.exercicioUid().equals(linha))
                    .map(f -> new SerieAnterior(f.tipo(), f.ordemNoTipo(), f.carga(), f.repeticoes(), f.etapas())).toList();
            resultado.put(exercicioId, new AnteriorDoExercicio(ultima, series));
        });
        return resultado;
    }
}
