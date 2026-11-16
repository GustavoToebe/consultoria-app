package br.com.treinos.api.vitrine;

import java.time.LocalDate;

/**
 * Preço que vale hoje (D4): função pura, sem banco nem relógio ({@code hoje} é o dia de Brasília, quem chama decide). O preço
 * especial vale do momento em que foi salvo até o fim de {@code especialAte}, inclusive; sem data, não tem fim. Sem preço
 * normal não há preço (nulo, nunca zero). O app só formata o que a API devolve.
 */
public final class PrecoDaVitrine {

    private PrecoDaVitrine() { }

    public static boolean especialVigente(Long precoEspecialCentavos, LocalDate especialAte, LocalDate hoje) {
        return precoEspecialCentavos != null && (especialAte == null || !hoje.isAfter(especialAte));
    }

    /** Em centavos; {@code null} = item sem preço (o app mostra "—"). */
    public static Long vigente(VitrineItem item, LocalDate hoje) {
        return vigente(item.getPrecoCentavos(), item.getPrecoEspecialCentavos(), item.getEspecialAte(), hoje);
    }

    static Long vigente(Long precoCentavos, Long precoEspecialCentavos, LocalDate especialAte, LocalDate hoje) {
        return especialVigente(precoEspecialCentavos, especialAte, hoje) ? precoEspecialCentavos : precoCentavos;
    }
}
