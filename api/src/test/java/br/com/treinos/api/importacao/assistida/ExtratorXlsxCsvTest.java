package br.com.treinos.api.importacao.assistida;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExtratorXlsxCsvTest {

    private static byte[] criarXlsxFicticio(boolean comLinhas) throws IOException {
        String rows = comLinhas
                ? """
                  <row r="1"><c r="A1" t="inlineStr"><is><t>Exercicio</t></is></c><c r="B1" t="inlineStr"><is><t>Series</t></is></c></row>
                  <row r="2"><c r="A2" t="inlineStr"><is><t>Supino Reto</t></is></c><c r="B2" t="inlineStr"><is><t>4x10</t></is></c></row>
                  """
                : """
                  <row r="1"><c r="A1" t="inlineStr"><is><t>   </t></is></c></row>
                  """;
        String sheetXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheetData>
                """ + rows + """
                  </sheetData>
                </worksheet>
                """;
        String workbookXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets><sheet name="Treino" sheetId="1" r:id="rId1"/></sheets>
                </workbook>
                """;
        String relsXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                </Relationships>
                """;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream zos = new ZipOutputStream(out)) {
            escreverEntrada(zos, "xl/workbook.xml", workbookXml);
            escreverEntrada(zos, "xl/_rels/workbook.xml.rels", relsXml);
            escreverEntrada(zos, "xl/worksheets/sheet1.xml", sheetXml);
            zos.finish();
            return out.toByteArray();
        }
    }

    private static void escreverEntrada(ZipOutputStream zos, String nome, String conteudo) throws IOException {
        zos.putNextEntry(new ZipEntry(nome));
        zos.write(conteudo.getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();
    }

    @Test
    void extraiCsvComCoberturaCompleta() {
        byte[] csv = "Nome,Email,Peso\nAluno Ficticio,aluno@exemplo.test,78.5\n".getBytes(StandardCharsets.UTF_8);

        ResultadoExtracao res = ExtratorXlsxCsv.extrair("alunos.csv", csv);

        assertThat(res.formato()).isEqualTo("PLANILHA");
        assertThat(res.textoCompleto()).contains("Aluno Ficticio", "aluno@exemplo.test", "78.5");
        assertThat(res.blocos()).hasSize(1);
        assertThat(res.metadados()).containsEntry("cobertura", "COMPLETA");
        assertThat(res.metadados()).containsEntry("abas", 1);
    }

    @Test
    void extraiXlsxComAbaESemLinhasVazias() throws IOException {
        byte[] xlsx = criarXlsxFicticio(true);

        ResultadoExtracao res = ExtratorXlsxCsv.extrair("ficha.xlsx", xlsx);

        assertThat(res.formato()).isEqualTo("PLANILHA");
        assertThat(res.textoCompleto()).contains("=== ABA: Treino ===", "Supino Reto | 4x10");
        assertThat(res.blocos()).hasSize(1);
        assertThat(res.metadados()).containsEntry("cobertura", "COMPLETA");
    }

    @Test
    void planilhaSemConteudoMarcaCoberturaSemTexto() throws IOException {
        byte[] xlsxVazio = criarXlsxFicticio(false);

        ResultadoExtracao res = ExtratorXlsxCsv.extrair("vazia.xlsx", xlsxVazio);

        assertThat(res.blocos()).isEmpty();
        assertThat(res.textoCompleto()).isEmpty();
        assertThat(res.metadados()).containsEntry("cobertura", "SEM_TEXTO");
        assertThat(res.metadados()).containsEntry("blocos", 0);
    }

    @Test
    void planilhaCorrompidaRecusaComCodigoEspecifico() {
        byte[] invalido = "nao e um xlsx valido".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> ExtratorXlsxCsv.extrair("quebrada.xlsx", invalido))
                .isInstanceOf(ExtracaoRecusadaException.class)
                .extracting(e -> ((ExtracaoRecusadaException) e).codigo())
                .isEqualTo("PLANILHA_CORROMPIDA");
    }

    @Test
    void textoParaOProvedorMarcaALinhaDeTitulosESoEle() throws IOException {
        ResultadoExtracao res = ExtratorXlsxCsv.extrair("treino.xlsx", criarXlsxFicticio(true));

        assertThat(res.textoCompleto()).contains("Colunas: Exercicio | Series").contains("Supino Reto | 4x10")
                .doesNotContain("Colunas: Supino");
        // Os blocos (que as regras locais leem) ficam sem a marca.
        assertThat(res.blocos().getFirst().conteudo()).doesNotContain("Colunas:");
    }
}
