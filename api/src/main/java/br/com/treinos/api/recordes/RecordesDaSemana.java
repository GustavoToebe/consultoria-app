package br.com.treinos.api.recordes;

import br.com.treinos.api.recordes.RecordesPessoais.Marca;
import br.com.treinos.api.recordes.RecordesPessoais.Melhores;
import br.com.treinos.api.recordes.RecordesPessoais.Recorde;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Recordes da semana para o treinador (Engajamento 0.5, P3): a mesma regra de {@link RecordesPessoais} aplicada aos dias
 * do período, um aluno e um exercício por vez. Regra pura, sem banco: quem chama já separou as séries simples.
 */
public final class RecordesDaSemana {

    private RecordesDaSemana() {
    }

    /**
     * Uma série feita no período. {@code marca} nula = não conta (técnica, etapas, sem carga ou repetições): não é
     * recorde nem muda a base. {@code ordem} = posição no plano (decide a ordem das séries do dia).
     */
    public record SerieDoPeriodo<T>(LocalDate data, int ordem, Marca marca, T origem) {
    }

    /** Uma série que bateu recorde, com a origem que veio de quem chama. */
    public record ComRecorde<T>(LocalDate data, T origem, List<Recorde> recordes) {
    }

    /**
     * As séries do período que bateram recorde. {@code base} = os melhores de antes do período (nulo = nenhum histórico:
     * o primeiro dia não conta, os seguintes comparam com ele). Dia a dia, na ordem do plano.
     */
    public static <T> List<ComRecorde<T>> doPeriodo(Melhores base, List<SerieDoPeriodo<T>> series) {
        Map<LocalDate, List<SerieDoPeriodo<T>>> porDia = new TreeMap<>();
        for (SerieDoPeriodo<T> s : series) {
            porDia.computeIfAbsent(s.data(), d -> new ArrayList<>()).add(s);
        }
        List<ComRecorde<T>> resultado = new ArrayList<>();
        Melhores atual = base;
        for (List<SerieDoPeriodo<T>> doDia : porDia.values()) {
            doDia.sort(Comparator.comparingInt(SerieDoPeriodo::ordem));
            List<Marca> marcas = doDia.stream().map(SerieDoPeriodo::marca).toList();
            List<List<Recorde>> recordes = RecordesPessoais.doDia(atual, marcas);
            for (int i = 0; i < doDia.size(); i++) {
                if (!recordes.get(i).isEmpty()) {
                    resultado.add(new ComRecorde<>(doDia.get(i).data(), doDia.get(i).origem(), recordes.get(i)));
                }
            }
            for (Marca m : marcas) {
                if (m != null) {
                    atual = RecordesPessoais.acumular(atual, m);
                }
            }
        }
        return resultado;
    }
}
