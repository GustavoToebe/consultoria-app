package br.com.treinos.api.fotos;

import java.util.ArrayList;
import java.util.List;

/**
 * Onde cada foto e a logo entram na imagem de comparação. Função pura: não lê arquivo nem desenha.
 * O quadro tem 1080 px de largura: Stories 1920 (9:16) ou Feed retrato 1350 (4:5). De 1 a 4 fotos
 * ficam numa fileira só, cobrindo a altura; uma foto ocupa o quadro inteiro. A logo, quando entra,
 * fica centralizada embaixo, com 30% da largura.
 */
public final class LayoutDaComparacao {

    public enum Formato {
        STORIES(1920),
        FEED(1350);

        private final int altura;

        Formato(int altura) {
            this.altura = altura;
        }

        public int altura() {
            return altura;
        }
    }

    public static final int LARGURA = 1080;
    public static final int ESPACO = 8;
    public static final int MARGEM_LOGO = 24;

    private LayoutDaComparacao() {
    }

    public record Retangulo(int x, int y, int largura, int altura) {
    }

    /** {@code logo} é nulo quando a imagem sai sem logo. */
    public record Layout(int largura, int altura, List<Retangulo> fotos, Retangulo logo) {
    }

    /**
     * @param formato     Stories ou Feed
     * @param quantidade  de 1 a 4; 1 ocupa o quadro, 2 a 4 dividem a largura
     * @param comLogo     se a logo deve ser posicionada
     * @param logoLargura largura natural da logo, em px (ignorada sem logo)
     * @param logoAltura  altura natural da logo, em px
     */
    public static Layout montar(Formato formato, int quantidade, boolean comLogo, int logoLargura, int logoAltura) {
        if (quantidade < 1 || quantidade > 4) {
            throw new IllegalArgumentException("A imagem usa de 1 a 4 fotos.");
        }
        int altura = formato.altura();
        int tileLargura = (LARGURA - (quantidade - 1) * ESPACO) / quantidade;
        int usado = quantidade * tileLargura + (quantidade - 1) * ESPACO;
        int origemX = (LARGURA - usado) / 2;
        List<Retangulo> fotos = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            fotos.add(new Retangulo(origemX + i * (tileLargura + ESPACO), 0, tileLargura, altura));
        }
        Retangulo logo = null;
        if (comLogo && logoLargura > 0 && logoAltura > 0) {
            int larguraLogo = LARGURA * 30 / 100;
            int alturaLogo = Math.max(1, (int) ((long) logoAltura * larguraLogo / logoLargura));
            logo = new Retangulo((LARGURA - larguraLogo) / 2, Math.max(0, altura - MARGEM_LOGO - alturaLogo),
                    larguraLogo, alturaLogo);
        }
        return new Layout(LARGURA, altura, List.copyOf(fotos), logo);
    }
}
