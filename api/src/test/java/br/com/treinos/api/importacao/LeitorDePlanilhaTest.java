package br.com.treinos.api.importacao;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Leitor de xlsx (zip + StAX) e csv. A mensagem de erro não repete conteúdo da célula. */
class LeitorDePlanilhaTest {

    @Test
    void leTextoNumeroFormulaEmCacheEDataSerial() {
        byte[] arquivo = xlsx(Map.of(
                "xl/sharedStrings.xml", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Ana</t></si></sst>
                        """,
                "xl/worksheets/sheet1.xml", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
                        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>70.5</v></c><c r="C1"><f>1+1</f><v>42</v></c><c r="D1"><v>61</v></c></row>
                        </sheetData></worksheet>
                        """));
        var planilha = LeitorDePlanilha.ler("pessoas.xlsx", arquivo, 0);
        var linha = planilha.linhas().get(0);
        assertThat(linha.celulas().get(0).texto()).isEqualTo("Ana");
        assertThat(linha.celulas().get(1).numero()).isTrue();
        assertThat(linha.celulas().get(1).texto()).isEqualTo("70.5");
        assertThat(linha.celulas().get(2).texto()).isEqualTo("42");
        assertThat(LeitorDePlanilha.dataSerial(new BigDecimal(linha.celulas().get(3).texto()), false))
                .isEqualTo(LocalDate.of(1900, 3, 1));
    }

    @Test
    void celulaDeErroNaoDevolveOTexto() {
        byte[] arquivo = xlsx(Map.of(
                "xl/worksheets/sheet1.xml", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
                        <row r="1"><c r="A1" t="e"><v>#REF!</v></c></row>
                        </sheetData></worksheet>
                        """));
        var celula = LeitorDePlanilha.ler("erro.xlsx", arquivo, 0).linhas().get(0).celulas().get(0);
        assertThat(celula.erro()).isTrue();
        assertThat(celula.texto()).doesNotContain("REF");
    }

    @Test
    void recusaZipBombXxeEXls() {
        byte[] bomba = zipCom(21 * 1024 * 1024);
        assertThatThrownBy(() -> LeitorDePlanilha.ler("bomba.xlsx", bomba, 0))
                .hasMessage("O arquivo da planilha é grande demais.");
        byte[] xxe = xlsx(Map.of("xl/workbook.xml", """
                <?xml version="1.0"?>
                <!DOCTYPE foo [<!ENTITY segredo "SEGREDO">]>
                <workbook><sheet name="Dados" sheetId="1" r:id="rId1"/></workbook>
                """));
        assertThatThrownBy(() -> LeitorDePlanilha.ler("xxe.xlsx", xxe, 0))
                .hasMessage("Não foi possível ler a planilha.")
                .hasMessageNotContaining("SEGREDO");
        byte[] xls = new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, 0, 0};
        assertThatThrownBy(() -> LeitorDePlanilha.ler("antigo.xls", xls, 0))
                .hasMessage("Salve a planilha como .xlsx ou .csv e envie de novo.");
    }

    @Test
    void csvComPontoEVirgulaEBom() {
        byte[] csv = "\uFEFFnome;email\nAna;ana@exemplo.com\n".getBytes(StandardCharsets.UTF_8);
        var planilha = LeitorDePlanilha.ler("alunos.csv", csv, 0);
        assertThat(planilha.linhas()).hasSize(2);
        assertThat(planilha.linhas().get(1).celulas().get(1).texto()).isEqualTo("ana@exemplo.com");
    }

    private static byte[] xlsx(Map<String, String> extras) {
        String tipos = """
                <?xml version="1.0" encoding="UTF-8"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                <Default Extension="xml" ContentType="application/xml"/>
                </Types>
                """;
        String rels = """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """;
        String workbook = extras.getOrDefault("xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>
                """);
        String workbookRels = """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                </Relationships>
                """;
        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(saida)) {
                gravar(zip, "[Content_Types].xml", tipos);
                gravar(zip, "_rels/.rels", rels);
                gravar(zip, "xl/workbook.xml", workbook);
                gravar(zip, "xl/_rels/workbook.xml.rels", workbookRels);
                for (var entrada : extras.entrySet()) {
                    if (!entrada.getKey().equals("xl/workbook.xml")) {
                        gravar(zip, entrada.getKey(), entrada.getValue());
                    }
                }
            }
            return saida.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] zipCom(int tamanho) {
        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(saida)) {
                zip.putNextEntry(new ZipEntry("grande.bin"));
                zip.write(new byte[tamanho]);
            }
            return saida.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static void gravar(ZipOutputStream zip, String nome, String xml) throws Exception {
        zip.putNextEntry(new ZipEntry(nome));
        zip.write(xml.getBytes(StandardCharsets.UTF_8));
    }
}
