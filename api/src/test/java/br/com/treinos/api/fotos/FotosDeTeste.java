package br.com.treinos.api.fotos;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Fotos de mentira para os testes: quadrados coloridos gerados na hora. Nenhuma imagem de pessoa. */
public final class FotosDeTeste {

    public static final String MARCA_EXIF = "GPS-FICTICIO-23.55S-46.63W-MODELO-DO-APARELHO";

    private FotosDeTeste() {
    }

    public static byte[] jpeg(Color cor, int lado, boolean progressivo) {
        BufferedImage imagem = new BufferedImage(lado, lado, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = imagem.createGraphics();
        g.setColor(cor);
        g.fillRect(0, 0, lado, lado);
        g.setColor(Color.WHITE);
        g.fillRect(lado / 4, lado / 4, lado / 2, lado / 2);
        g.dispose();
        try {
            ImageWriter escritor = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam parametros = escritor.getDefaultWriteParam();
            parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parametros.setCompressionQuality(0.9f);
            if (progressivo) {
                parametros.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
            }
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            try (MemoryCacheImageOutputStream fluxo = new MemoryCacheImageOutputStream(saida)) {
                escritor.setOutput(fluxo);
                escritor.write(null, new IIOImage(imagem, null, null), parametros);
            }
            escritor.dispose();
            return saida.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static byte[] jpeg(Color cor) {
        return jpeg(cor, 64, false);
    }

    /** Põe depois do SOI um APP1 "Exif" (com um texto que lembra GPS e modelo), um comentário e um APP13. */
    public static byte[] comMetadados(byte[] jpeg) {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        saida.write(jpeg, 0, 2);
        segmento(saida, 0xE1, ("Exif\0\0" + MARCA_EXIF).getBytes(StandardCharsets.ISO_8859_1));
        segmento(saida, 0xFE, ("comentario " + MARCA_EXIF).getBytes(StandardCharsets.ISO_8859_1));
        segmento(saida, 0xED, ("Photoshop 3.0\0" + MARCA_EXIF).getBytes(StandardCharsets.ISO_8859_1));
        saida.write(jpeg, 2, jpeg.length - 2);
        return saida.toByteArray();
    }

    /** Enche o arquivo de comentários (que o servidor joga fora) até ter exatamente {@code total} bytes. */
    static byte[] engordado(byte[] jpeg, int total) {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        saida.write(jpeg, 0, 2);
        int falta = total - jpeg.length;
        while (falta > 0) {
            int carga = Math.min(60_000, Math.max(0, falta - 4));
            segmento(saida, 0xFE, new byte[carga]);
            falta -= carga + 4;
        }
        saida.write(jpeg, 2, jpeg.length - 2);
        byte[] resultado = saida.toByteArray();
        if (resultado.length != total) {
            throw new IllegalStateException("tamanho diferente do pedido: " + resultado.length);
        }
        return resultado;
    }

    static void segmento(ByteArrayOutputStream saida, int marcador, byte[] carga) {
        saida.write(0xFF);
        saida.write(marcador);
        int tamanho = carga.length + 2;
        saida.write(tamanho >> 8);
        saida.write(tamanho & 0xFF);
        saida.write(carga, 0, carga.length);
    }

    public static boolean contem(byte[] bytes, String texto) {
        return new String(bytes, StandardCharsets.ISO_8859_1).contains(texto);
    }

    static Color corDoPixelCentral(byte[] jpeg) {
        try {
            BufferedImage imagem = ImageIO.read(new java.io.ByteArrayInputStream(jpeg));
            return new Color(imagem.getRGB(2, 2));
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
