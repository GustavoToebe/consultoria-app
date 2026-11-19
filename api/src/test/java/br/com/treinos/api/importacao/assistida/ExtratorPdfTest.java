package br.com.treinos.api.importacao.assistida;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExtratorPdfTest {

    private static byte[] pdfComPaginas(List<String> textosPorPagina) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDType1Font fonte = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            for (String texto : textosPorPagina) {
                PDPage page = new PDPage();
                doc.addPage(page);
                if (texto != null && !texto.isBlank()) {
                    try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                        cs.beginText();
                        cs.setFont(fonte, 12);
                        cs.newLineAtOffset(50, 700);
                        for (String linha : texto.split("\\R")) {
                            cs.showText(linha);
                            cs.newLineAtOffset(0, -16);
                        }
                        cs.endText();
                    }
                }
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    private static byte[] pdfProtegido(String texto, String senha) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText(texto);
                cs.endText();
            }
            StandardProtectionPolicy policy = new StandardProtectionPolicy(senha, senha, new AccessPermission());
            policy.setEncryptionKeyLength(128);
            doc.protect(policy);
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void extraiPdfComprimidoMultipaginaComCoberturaCompleta() throws IOException {
        byte[] pdf = pdfComPaginas(List.of(
                "Aluno: Lucas Almeida\nTreino A - Peito\nSupino Reto 4x10",
                "Treino B - Costas\nPuxada Frontal 4x12"
        ));

        ResultadoExtracao res = ExtratorPdf.extrair("ficha-lucas.pdf", pdf);

        assertThat(res.formato()).isEqualTo("PDF");
        assertThat(res.textoCompleto()).contains("Lucas Almeida", "Supino Reto 4x10", "Puxada Frontal 4x12");
        assertThat(res.blocos()).hasSize(2);
        assertThat(res.blocos().get(0).titulo()).isEqualTo("Página 1");
        assertThat(res.blocos().get(1).titulo()).isEqualTo("Página 2");
        assertThat(res.metadados()).containsEntry("cobertura", "COMPLETA");
        assertThat(res.metadados()).containsEntry("paginasTotal", 2);
        assertThat(res.metadados()).containsEntry("paginasLidas", 2);
        assertThat(res.metadados()).containsEntry("paginasSemTexto", 0);
    }

    @Test
    void pdfMistoComPaginaSemTextoRetornaDiagnosticoExplicito() throws IOException {
        byte[] pdf = pdfComPaginas(List.of(
                "Aluno: Marina Costa\nPeso: 62 kg em 10/11/2026",
                "" // Página sem texto selecionável (ex.: imagem/digitalizada)
        ));

        ResultadoExtracao res = ExtratorPdf.extrair("misto.pdf", pdf);

        assertThat(res.blocos()).hasSize(1);
        assertThat(res.metadados()).containsEntry("cobertura", "PARCIAL");
        assertThat(res.metadados()).containsEntry("paginasTotal", 2);
        assertThat(res.metadados()).containsEntry("paginasLidas", 1);
        assertThat(res.metadados()).containsEntry("paginasSemTexto", 1);
    }

    @Test
    void pdfSemTextoSelecionavelMarcaCoberturaSemTexto() throws IOException {
        byte[] pdf = pdfComPaginas(List.of("", ""));

        ResultadoExtracao res = ExtratorPdf.extrair("digitalizado.pdf", pdf);

        assertThat(res.blocos()).isEmpty();
        assertThat(res.textoCompleto()).isEmpty();
        assertThat(res.metadados()).containsEntry("cobertura", "SEM_TEXTO");
        assertThat(res.metadados()).containsEntry("paginasTotal", 2);
        assertThat(res.metadados()).containsEntry("paginasLidas", 0);
        assertThat(res.metadados()).containsEntry("paginasSemTexto", 2);
    }

    @Test
    void pdfProtegidoPorSenhaRecusaComCodigoEspecifico() throws IOException {
        byte[] pdf = pdfProtegido("Aluno: Teste Senha", "segredo-123");

        assertThatThrownBy(() -> ExtratorPdf.extrair("protegido.pdf", pdf))
                .isInstanceOf(ExtracaoRecusadaException.class)
                .extracting(e -> ((ExtracaoRecusadaException) e).codigo())
                .isEqualTo("PDF_PROTEGIDO_POR_SENHA");
    }

    @Test
    void pdfCorrompidoRecusaComCodigoEspecifico() {
        byte[] invalido = "%PDF-1.7\ncorrompido".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> ExtratorPdf.extrair("quebrado.pdf", invalido))
                .isInstanceOf(ExtracaoRecusadaException.class)
                .extracting(e -> ((ExtracaoRecusadaException) e).codigo())
                .isEqualTo("PDF_CORROMPIDO");
    }
}
