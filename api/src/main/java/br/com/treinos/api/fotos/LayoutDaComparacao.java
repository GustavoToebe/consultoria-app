package br.com.treinos.api.fotos;

import java.util.ArrayList;
import java.util.List;

/**
 * Onde cada foto e a logo entram na imagem de comparação. Função pura: não lê arquivo nem desenha.
 * A imagem final tem 1080 px de largura, fundo preto e cada foto em recorte 4:5. Duas e três ficam
 * em linha; quatro, em grade 2×2. A logo, quando entra, fica centralizada embaixo, com 30% da largura.
 */
public final class LayoutDaComparacao {

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
     * @param quantidade de 2 a 4
     * @param comLogo    se a logo deve ser posicionada
     * @param logoLargura largura natural da logo, em px (ignorada sem logo)
     * @param logoAltura  altura natural da logo, em px
     */
    public static Layout montar(int quantidade, boolean comLogo, int logoLargura, int logoAltura) {
        if (quantidade < 2 || quantidade > 4) {
            throw new IllegalArgumentException("A comparação usa de 2 a 4 fotos.");
        }
        int colunas = quantidade == 4 ? 2 : quantidade;
        int linhas = quantidade == 4 ? 2 : 1;
        int tileLargura = (LARGURA - (colunas - 1) * ESPACO) / colunas;
        int tileAltura = tileLargura * 5 / 4;
        int usado = colunas * tileLargura + (colunas - 1) * ESPACO;
        int origemX = (LARGURA - usado) / 2;
        int altura = linhas * tileAltura + (linhas - 1) * ESPACO;
        List<Retangulo> fotos = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            int coluna = quantidade == 4 ? i % 2 : i;
            int linha = quantidade == 4 ? i / 2 : 0;
            fotos.add(new Retangulo(
                    origemX + coluna * (tileLargura + ESPACO),
                    linha * (tileAltura + ESPACO),
                    tileLargura,
                    tileAltura));
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
