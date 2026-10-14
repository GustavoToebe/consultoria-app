package br.com.treinos.api.termos;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Textos vigentes do termo de uso e do aviso de privacidade (em {@code resources/termos/}) e a versão deles.
 * Mudou qualquer texto? Mude {@link #VERSAO}: todo mundo precisa aceitar de novo. Os textos são rascunho até o advogado
 * revisar; ao revisar, troque {@link #RASCUNHO} para {@code false} e a versão.
 */
public final class Termos {

    public static final String VERSAO = "2026-10-13";
    public static final boolean RASCUNHO = true;

    public record Documento(String id, String titulo, String texto) { }

    private static final List<Documento> DOCUMENTOS = List.of(
            ler("TERMO_USO", "termo-de-uso.md"),
            ler("AVISO_PRIVACIDADE", "aviso-de-privacidade.md"));

    private Termos() { }

    public static List<Documento> documentos() {
        return DOCUMENTOS;
    }

    /** A primeira linha do arquivo ({@code # Título}) é o título; o resto é o texto. */
    private static Documento ler(String id, String arquivo) {
        try (var entrada = Termos.class.getResourceAsStream("/termos/" + arquivo)) {
            if (entrada == null) {
                throw new IllegalStateException("Texto não encontrado: " + arquivo);
            }
            String bruto = new String(entrada.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n").strip();
            int quebra = bruto.indexOf('\n');
            String titulo = (quebra < 0 ? bruto : bruto.substring(0, quebra)).replaceFirst("^#+\\s*", "").strip();
            String texto = quebra < 0 ? "" : bruto.substring(quebra + 1).strip();
            return new Documento(id, titulo, texto);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
