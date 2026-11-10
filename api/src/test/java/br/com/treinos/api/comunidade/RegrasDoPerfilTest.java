package br.com.treinos.api.comunidade;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras puras do perfil (sem Spring nem banco). Só datas fictícias. */
class RegrasDoPerfilTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 10);

    @Test
    void nivelComecaEmUmESobeACadaDezTreinos() {
        assertThat(RegrasDoPerfil.nivel(0)).isEqualTo(1);
        assertThat(RegrasDoPerfil.nivel(9)).isEqualTo(1);
        assertThat(RegrasDoPerfil.nivel(10)).isEqualTo(2);
        assertThat(RegrasDoPerfil.nivel(99)).isEqualTo(10);
        assertThat(RegrasDoPerfil.nivel(100)).isEqualTo(11);
        assertThat(RegrasDoPerfil.nivel(-5)).isEqualTo(1);
    }

    @Test
    void maiorDeIdadeSoComDezoitoAnosCompletos() {
        assertThat(RegrasDoPerfil.maiorDeIdade(LocalDate.of(2008, 11, 10), HOJE)).isTrue();   // faz 18 hoje
        assertThat(RegrasDoPerfil.maiorDeIdade(LocalDate.of(2008, 11, 11), HOJE)).isFalse();  // falta um dia
        assertThat(RegrasDoPerfil.maiorDeIdade(LocalDate.of(1990, 1, 1), HOJE)).isTrue();
        assertThat(RegrasDoPerfil.maiorDeIdade(LocalDate.of(2015, 6, 1), HOJE)).isFalse();
        assertThat(RegrasDoPerfil.maiorDeIdade(null, HOJE)).isFalse();
        assertThat(RegrasDoPerfil.maiorDeIdade(HOJE.plusDays(1), HOJE)).isFalse();             // data futura
    }

    @Test
    void quemNasceuEm29DeFevereiroCompletaEm1DeMarcoNosAnosComuns() {
        LocalDate nasceu = LocalDate.of(2008, 2, 29);
        assertThat(RegrasDoPerfil.maiorDeIdade(nasceu, LocalDate.of(2026, 2, 28))).isFalse();
        assertThat(RegrasDoPerfil.maiorDeIdade(nasceu, LocalDate.of(2026, 3, 1))).isTrue();
    }

    @Test
    void atividadeRecenteSao30DiasContandoHoje() {
        assertThat(RegrasDoPerfil.inicioDaAtividade(LocalDate.of(2026, 11, 10))).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(RegrasDoPerfil.inicioDaAtividade(LocalDate.of(2026, 3, 1))).isEqualTo(LocalDate.of(2026, 1, 31));
    }

    @Test
    void soODonoVeOPerfilReservado() {
        assertThat(RegrasDoPerfil.mostraTudo(true, true)).isTrue();
        assertThat(RegrasDoPerfil.mostraTudo(true, false)).isTrue();
        assertThat(RegrasDoPerfil.mostraTudo(false, false)).isTrue();
        assertThat(RegrasDoPerfil.mostraTudo(false, true)).isFalse();
    }

    @Test
    void destaquesVisiveisSaoSoOsGanhosNaOrdemEscolhidaAteQuatro() {
        Set<String> ganhos = Set.of("A", "B", "C", "D", "E");
        assertThat(RegrasDoPerfil.destaquesVisiveis(List.of("C", "A", "Z", "A", "B", "D", "E"), ganhos)).containsExactly("C", "A", "B", "D");
        assertThat(RegrasDoPerfil.destaquesVisiveis(List.of("Z"), ganhos)).isEmpty();
        assertThat(RegrasDoPerfil.destaquesVisiveis(List.of(), ganhos)).isEmpty();
    }

    @Test
    void reservadoEfetivoUsaAEscolhaEDepoisARegraDaIdade() {
        LocalDate adulto = LocalDate.of(1990, 1, 1);
        LocalDate menor = LocalDate.of(2015, 1, 1);
        // Escolha explícita vale sempre, qualquer que seja a idade.
        assertThat(RegrasDoPerfil.reservadoEfetivo(true, adulto, HOJE)).isTrue();
        assertThat(RegrasDoPerfil.reservadoEfetivo(false, adulto, HOJE)).isFalse();
        assertThat(RegrasDoPerfil.reservadoEfetivo(false, menor, HOJE)).isFalse();
        assertThat(RegrasDoPerfil.reservadoEfetivo(false, null, HOJE)).isFalse();
        // Sem escolha: adulto visível; menor ou sem data, reservado.
        assertThat(RegrasDoPerfil.reservadoEfetivo(null, adulto, HOJE)).isFalse();
        assertThat(RegrasDoPerfil.reservadoEfetivo(null, menor, HOJE)).isTrue();
        assertThat(RegrasDoPerfil.reservadoEfetivo(null, null, HOJE)).isTrue();
    }
}
