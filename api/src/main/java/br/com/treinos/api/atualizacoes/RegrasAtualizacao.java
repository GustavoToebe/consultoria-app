package br.com.treinos.api.atualizacoes;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Datas explícitas tornam as regras iguais no servidor e no aparelho, sem interpretar respostas. */
public final class RegrasAtualizacao {
    private RegrasAtualizacao() { }
    public record Situacao(String fase, long diasParaData, long diasDeAtraso) { }
    public static Situacao calcular(LocalDate hoje, LocalDate data, LocalDate atrasoAte, String estado) {
        if (data == null) return new Situacao("NENHUMA", 0, 0);
        LocalDate prazo = atrasoAte == null ? data : atrasoAte;
        long dias = ChronoUnit.DAYS.between(hoje, prazo);
        String fase = "ENVIADA".equals(estado) || "REVISADA".equals(estado) ? estado
                : dias < 0 ? "ATRASADA" : dias <= 1 ? "ABERTA" : dias <= 3 ? "AVISO" : "NENHUMA";
        return new Situacao(fase, dias, Math.max(0, -dias));
    }
}
