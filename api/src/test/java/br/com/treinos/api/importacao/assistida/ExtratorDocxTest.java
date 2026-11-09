package br.com.treinos.api.importacao.assistida;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class ExtratorDocxTest {

    private byte[] criarDocxFicticio(String xmlDocumento) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            zos.putNextEntry(new ZipEntry("word/document.xml"));
            zos.write(xmlDocumento.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        return baos.toByteArray();
    }

    @Test
    void extraiParagrafosETabelasDoDocxNativamente() throws IOException {
        String xml = """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                    <w:body>
                        <w:p><w:r><w:t>Aluno: Rafael Moreira</w:t></w:r></w:p>
                        <w:p><w:r><w:t>Treino A - Peito e Tríceps</w:t></w:r></w:p>
                        <w:tbl>
                            <w:tr>
                                <w:tc><w:p><w:r><w:t>Supino Reto</w:t></w:r></w:p></w:tc>
                                <w:tc><w:p><w:r><w:t>4x8-10</w:t></w:r></w:p></w:tc>
                            </w:tr>
                        </w:tbl>
                    </w:body>
                </w:document>
                """;

        byte[] bytes = criarDocxFicticio(xml);
        ResultadoExtracao res = ExtratorDocx.extrair("documento.docx", bytes);

        assertThat(res.formato()).isEqualTo("DOCX");
        assertThat(res.textoCompleto()).contains("Aluno: Rafael Moreira");
        assertThat(res.textoCompleto()).contains("Treino A - Peito e Tríceps");
        assertThat(res.textoCompleto()).contains("Supino Reto | 4x8-10");
        assertThat(res.blocos()).hasSize(3);
    }
}
