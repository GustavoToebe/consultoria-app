package br.com.treinos.api.alunos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regra pura dos aniversariantes: virada de ano, 29/02 e ordem. Nomes fictícios. */
class AniversariantesRegraTest {

    private static NascimentoSemAno n(String nome, int mes, int dia) {
        return new NascimentoSemAno(UUID.randomUUID(), nome, mes, dia);
    }

    private static List<String> nomes(List<NascimentoSemAno> lista, int dias, LocalDate hoje) {
        return AniversariantesService.proximos(lista, dias, hoje).stream().map(AniversariantesService.Aniversariante::nome).toList();
    }

    @Test
    void viradaDeAnoContaOsDiasAteJaneiro() {
        LocalDate hoje = LocalDate.of(2026, 12, 29);
        List<NascimentoSemAno> lista = List.of(n("Janeiro 2", 1, 2), n("Hoje", 12, 29), n("Dezembro 31", 12, 31), n("Janeiro 20", 1, 20),
                n("Dezembro 28", 12, 28));
        // Dezembro 28 já passou neste ano: só volta daqui a 364 dias.
        assertThat(nomes(lista, 7, hoje)).containsExactly("Hoje", "Dezembro 31", "Janeiro 2");
        assertThat(nomes(lista, 0, hoje)).containsExactly("Hoje");
        assertThat(nomes(lista, 15, hoje)).containsExactly("Hoje", "Dezembro 31", "Janeiro 2");
        assertThat(AniversariantesService.diasAte(MonthDay.of(1, 2), hoje)).isEqualTo(4);
    }

    @Test
    void vinteENoveDeFevereiroComemoraEm28NoAnoNaoBissexto() {
        List<NascimentoSemAno> lista = List.of(n("Bissexto", 2, 29));
        assertThat(nomes(lista, 0, LocalDate.of(2027, 2, 28))).containsExactly("Bissexto");
        assertThat(nomes(lista, 3, LocalDate.of(2027, 2, 25))).containsExactly("Bissexto");
        assertThat(nomes(lista, 3, LocalDate.of(2027, 3, 1))).isEmpty();
        // Em ano bissexto é no 29 mesmo, e o 28 não conta.
        assertThat(nomes(lista, 0, LocalDate.of(2028, 2, 29))).containsExactly("Bissexto");
        assertThat(nomes(lista, 0, LocalDate.of(2028, 2, 28))).isEmpty();
        // Depois do 28/02 de ano não bissexto o próximo é o 29/02 do ano bissexto seguinte (2028).
        assertThat(AniversariantesService.diasAte(MonthDay.of(2, 29), LocalDate.of(2027, 3, 1))).isEqualTo(365);
    }

    @Test
    void ordenaPorProximidadeEDepoisPorNome() {
        LocalDate hoje = LocalDate.of(2026, 11, 17);
        List<NascimentoSemAno> lista = List.of(n("bia", 11, 18), n("Ana", 11, 18), n("Caio", 11, 17), n("Zé", 11, 25));
        assertThat(nomes(lista, 7, hoje)).containsExactly("Caio", "Ana", "bia");
    }
}
