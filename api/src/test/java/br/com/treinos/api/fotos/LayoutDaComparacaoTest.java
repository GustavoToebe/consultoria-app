package br.com.treinos.api.fotos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Geometria da imagem de comparação, sem desenhar e sem arquivo. */
class LayoutDaComparacaoTest {

    @Test
    void duasEmLinhaTresEmLinhaEQuatroEmGrade() {
        var duas = LayoutDaComparacao.montar(2, false, 0, 0);
        assertThat(duas.largura()).isEqualTo(1080);
        assertThat(duas.fotos()).hasSize(2);
        assertThat(duas.fotos().get(0).y()).isEqualTo(duas.fotos().get(1).y());
        assertThat(duas.fotos().get(1).x()).isGreaterThan(duas.fotos().get(0).x());
        assertThat(duas.fotos().get(0).altura() * 4).isEqualTo(duas.fotos().get(0).largura() * 5);
        assertThat(duas.logo()).isNull();

        var tres = LayoutDaComparacao.montar(3, false, 0, 0);
        assertThat(tres.fotos()).hasSize(3);
        assertThat(tres.fotos()).allMatch(f -> f.y() == 0);

        var quatro = LayoutDaComparacao.montar(4, true, 100, 40);
        assertThat(quatro.fotos()).hasSize(4);
        assertThat(quatro.fotos().get(2).y()).isGreaterThan(quatro.fotos().get(0).y());
        assertThat(quatro.fotos().get(3).x()).isGreaterThan(quatro.fotos().get(2).x());
        assertThat(quatro.logo().largura()).isEqualTo(324);
        assertThat(quatro.logo().altura()).isEqualTo(129);
        assertThat(quatro.logo().x()).isEqualTo((1080 - 324) / 2);
        assertThat(quatro.logo().y()).isEqualTo(quatro.altura() - 24 - 129);
    }

    @Test
    void foraDeDuasAQuatroRecusa() {
        assertThatThrownBy(() -> LayoutDaComparacao.montar(1, false, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> LayoutDaComparacao.montar(5, false, 0, 0)).isInstanceOf(IllegalArgumentException.class);
    }
}
