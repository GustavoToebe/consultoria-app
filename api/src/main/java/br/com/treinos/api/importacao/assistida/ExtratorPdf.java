package br.com.treinos.api.importacao.assistida;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Extrator textual de PDFs usando Apache PDFBox ({@link Loader#loadPDF(byte[])} + {@link PDFTextStripper} página a
 * página), com limites defensivos e diagnóstico explícito de páginas lidas vs. sem texto selecionável.
 */
public final class ExtratorPdf {

    static final int PAGINAS_MAXIMAS = 200;
    static final int CARACTERES_MAXIMOS = 500_000;

    private ExtratorPdf() {
    }

    public static ResultadoExtracao extrair(String nomeArquivo, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new ExtracaoRecusadaException("PDF_CORROMPIDO");
        }

        try (PDDocument documento = Loader.loadPDF(bytes)) {
            int paginasTotal = documento.getNumberOfPages();
            if (paginasTotal <= 0) {
                throw new ExtracaoRecusadaException("PDF_SEM_PAGINAS");
            }
            if (paginasTotal > PAGINAS_MAXIMAS) {
                throw new ExtracaoRecusadaException("PDF_PAGINAS_DEMAIS");
            }

            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);

            StringBuilder textoCompleto = new StringBuilder();
            List<BlocoTexto> blocos = new ArrayList<>();
            int paginasLidas = 0;
            int paginasSemTexto = 0;
            boolean truncado = false;

            for (int pagina = 1; pagina <= paginasTotal; pagina++) {
                stripper.setStartPage(pagina);
                stripper.setEndPage(pagina);
                String textoPagina = stripper.getText(documento);
                String limpo = textoPagina == null ? "" : textoPagina.strip();
                if (limpo.isEmpty()) {
                    paginasSemTexto++;
                    continue;
                }

                int restante = CARACTERES_MAXIMOS - textoCompleto.length();
                if (restante <= 0) {
                    truncado = true;
                    break;
                }
                if (limpo.length() > restante) {
                    limpo = limpo.substring(0, restante).strip();
                    truncado = true;
                }
                if (limpo.isEmpty()) {
                    paginasSemTexto++;
                    continue;
                }

                paginasLidas++;
                blocos.add(new BlocoTexto("Página " + pagina, limpo, nomeArquivo, pagina));
                if (textoCompleto.length() > 0) {
                    textoCompleto.append("\n\n");
                }
                textoCompleto.append("=== PÁGINA ").append(pagina).append(" ===\n").append(limpo);
                if (truncado) {
                    break;
                }
            }

            String cobertura = paginasLidas == 0
                    ? "SEM_TEXTO"
                    : paginasSemTexto > 0 || truncado ? "PARCIAL" : "COMPLETA";

            Map<String, Object> metadados = new LinkedHashMap<>();
            metadados.put("cobertura", cobertura);
            metadados.put("paginasTotal", paginasTotal);
            metadados.put("paginasLidas", paginasLidas);
            metadados.put("paginasSemTexto", paginasSemTexto);
            metadados.put("blocos", blocos.size());
            if (truncado) {
                metadados.put("truncado", true);
            }

            return new ResultadoExtracao("PDF", textoCompleto.toString(), List.copyOf(blocos), Map.copyOf(metadados));
        } catch (ExtracaoRecusadaException e) {
            throw e;
        } catch (InvalidPasswordException e) {
            throw new ExtracaoRecusadaException("PDF_PROTEGIDO_POR_SENHA");
        } catch (IOException | RuntimeException e) {
            throw new ExtracaoRecusadaException("PDF_CORROMPIDO");
        }
    }
}
