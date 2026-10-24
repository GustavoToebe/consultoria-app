package br.com.treinos.api.fotos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Geometria da imagem de comparação, sem desenhar e sem arquivo. */
class LayoutDaComparacaoTest {

    @Test
    void fileiraNoStoriesENoFeed() {
        var duas = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.STORIES, 2, false, 0, 0);
        assertThat(duas.largura()).isEqualTo(1080);
        assertThat(duas.altura()).isEqualTo(1920);
        assertThat(duas.fotos()).hasSize(2);
        assertThat(duas.fotos()).allMatch(f -> f.y() == 0 && f.altura() == 1920);
        assertThat(duas.fotos().get(1).x()).isGreaterThan(duas.fotos().get(0).x());
        assertThat(duas.logo()).isNull();

        var quatro = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.FEED, 4, true, 100, 40);
        assertThat(quatro.altura()).isEqualTo(1350);
        assertThat(quatro.fotos()).hasSize(4);
        assertThat(quatro.fotos()).allMatch(f -> f.y() == 0 && f.altura() == 1350);
        assertThat(quatro.fotos().get(3).x()).isGreaterThan(quatro.fotos().get(2).x());
        assertThat(quatro.logo().largura()).isEqualTo(324);
        assertThat(quatro.logo().altura()).isEqualTo(129);
        assertThat(quatro.logo().x()).isEqualTo((1080 - 324) / 2);
        assertThat(quatro.logo().y()).isEqualTo(1350 - 24 - 129);
    }

    @Test
    void umaFotoCobreOQuadro() {
        var uma = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.STORIES, 1, false, 0, 0);
        assertThat(uma.fotos()).containsExactly(new LayoutDaComparacao.Retangulo(0, 0, 1080, 1920));
    }

    @Test
    void foraDeUmaAQuatroRecusa() {
        assertThatThrownBy(() -> LayoutDaComparacao.montar(LayoutDaComparacao.Formato.FEED, 0, false, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> LayoutDaComparacao.montar(LayoutDaComparacao.Formato.FEED, 5, false, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
