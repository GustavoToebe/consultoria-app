package br.com.treinos.api.termos;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Textos vigentes do termo de uso e do aviso de privacidade (em {@code resources/termos/}) e a versão deles.
 * Mudou qualquer texto? Mude {@link #VERSAO}: todo mundo precisa aceitar de novo. Os textos são rascunho até o advogado
 * revisar; ao revisar, troque {@link #RASCUNHO} para {@code false} e a versão. O aviso de rascunho não mora no texto (só
 * o app da equipe mostra o selo pelo {@link #RASCUNHO}); tirá-lo do texto e pôr o marcador do contato (28/11) foi
 * deliberado e sem nova versão.
 */
public final class Termos {

    public static final String VERSAO = "2026-10-26";
    public static final boolean RASCUNHO = true;

    public record Documento(String id, String titulo, String texto) { }

    /** Nota de trabalho para a revisão do advogado: só a equipe a vê (fora do texto do aluno, do público e do PDF). */
    public record NotaInterna(String documentoId, String documentoTitulo, String texto) { }

    /**
     * Nota interna no {@code .md}: {@code [REVISAR COM ADVOGADO: ...]}. Sai do texto servido (com o espaço antes dela) e
     * vira {@link NotaInterna}; o texto jurídico em volta fica como está.
     */
    private static final Pattern NOTA_INTERNA = Pattern.compile("[ \\t]*\\[REVISAR COM ADVOGADO:\\s*([^\\]]+?)\\s*\\]");

    private static final List<Documento> DOCUMENTOS = List.of(
            ler("TERMO_USO", "termo-de-uso.md"),
            ler("AVISO_PRIVACIDADE", "aviso-de-privacidade.md"));

    private Termos() { }

    /**
     * Os textos com a seção "Contato" já montada ({@link ContatoDosTermos}). O contato é dado da consultoria, não texto
     * do termo: trocá-lo (ou trocar o marcador) não muda {@link #VERSAO} nem pede novo aceite, que só olha a versão.
     */
    public static List<Documento> documentos(String contato) {
        return DOCUMENTOS.stream()
                .map(d -> new Documento(d.id(), d.titulo(),
                        NOTA_INTERNA.matcher(d.texto()).replaceAll("").replace(ContatoDosTermos.MARCADOR, contato)))
                .toList();
    }

    /** As notas internas dos dois documentos, na ordem do texto. Só para a equipe ({@code TermosService}). */
    public static List<NotaInterna> notasInternas() {
        return DOCUMENTOS.stream()
                .flatMap(d -> NOTA_INTERNA.matcher(d.texto()).results()
                        .map(m -> new NotaInterna(d.id(), d.titulo(), m.group(1).strip())))
                .toList();
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
