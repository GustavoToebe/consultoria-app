package br.com.treinos.api.atualizacoes;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Datas explícitas tornam as regras iguais no servidor e no aparelho, sem interpretar respostas. */
public final class RegrasAtualizacao {
    private RegrasAtualizacao() { }
    public record Situacao(String fase, long diasParaData, long diasDeAtraso) { }
    public static final int DIAS_MAXIMOS_DE_ATRASO = 15;

    /** O formulário abre pela data original; o aviso de atraso só adia o "atrasada" até max(data, atrasoAte). */
    public static Situacao calcular(LocalDate hoje, LocalDate data, LocalDate atrasoAte, String estado) {
        if (data == null) return new Situacao("NENHUMA", 0, 0);
        LocalDate prazo = prazo(data, atrasoAte);
        long diasParaData = ChronoUnit.DAYS.between(hoje, data);
        long diasParaPrazo = ChronoUnit.DAYS.between(hoje, prazo);
        String fase = "ENVIADA".equals(estado) || "REVISADA".equals(estado) ? estado
                : diasParaPrazo < 0 ? "ATRASADA" : diasParaData <= 1 ? "ABERTA" : diasParaData <= 3 ? "AVISO" : "NENHUMA";
        return new Situacao(fase, diasParaPrazo, Math.max(0, -diasParaPrazo));
    }

    public static LocalDate prazo(LocalDate data, LocalDate atrasoAte) {
        return atrasoAte != null && atrasoAte.isAfter(data) ? atrasoAte : data;
    }

    /** Nova data do "vou atrasar": entre a data original (ou hoje, se já passou) e quinze dias depois dela. */
    public static boolean novaDataValida(LocalDate hoje, LocalDate data, LocalDate novaData) {
        LocalDate minimo = hoje.isAfter(data) ? hoje : data;
        return !novaData.isBefore(minimo) && !novaData.isAfter(data.plusDays(DIAS_MAXIMOS_DE_ATRASO));
    }
}
