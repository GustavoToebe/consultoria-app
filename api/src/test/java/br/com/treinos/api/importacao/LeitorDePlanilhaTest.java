package br.com.treinos.api.importacao;

import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

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
    void dataComHoraIgnoraAHora() {
        // 45230 = 31/10/2023; 0,75 = 18:00.
        assertThat(LeitorDePlanilha.dataSerial(new BigDecimal("45230.75"), false)).isEqualTo(LocalDate.of(2023, 10, 31));
        assertThat(LeitorDePlanilha.dataSerial(new BigDecimal("45230.0"), false)).isEqualTo(LocalDate.of(2023, 10, 31));
        assertThat(LeitorDePlanilha.dataSerial(new BigDecimal("60.5"), false)).isNull();
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

    @Test
    void recusaColunaAcimaDe256SemCriarCelulasVazias() {
        // IV = coluna 256 (limite); IW = 257. ZZZZZZ e acima estouravam a memória (e o int) ao preencher vazias.
        assertThat(LeitorDePlanilha.ler("ok.xlsx", folha("<row r=\"1\"><c r=\"IV1\"><v>1</v></c></row>"), 0)
                .linhas().get(0).celulas()).hasSize(256);
        for (String referencia : new String[] {"IW1", "XFD1", "ZZ1"}) {
            exigeColunasDemais(referencia);
        }
    }

    @Test
    void celulasSemReferenciaTambemRespeitamAsColunasMaximas() {
        assertThat(LeitorDePlanilha.ler("ok.xlsx", folhaDensa(1, 256), 0).linhas().get(0).celulas()).hasSize(256);
        byte[] demais = folhaDensa(1, 257);
        assertThatThrownBy(() -> LeitorDePlanilha.ler("demais.xlsx", demais, 0))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(e.getMessage()).isEqualTo("A planilha passa de 256 colunas."));
    }

    @Test
    void celulaDentroDeOutraNaoGravaNoIndiceErrado() {
        byte[] aninhada = folha("<row r=\"1\"><c r=\"A1\"><c r=\"C1\"><v>1</v></c><v>2</v></c></row>");
        assertThatThrownBy(() -> LeitorDePlanilha.ler("aninhada.xlsx", aninhada, 0))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(e.getCodigo()).isEqualTo("ARQUIVO_INVALIDO"));
    }

    @Test
    void colunaAbsurdaNaoEstouraMemoriaNemOInt() {
        // Hoje cria centenas de milhões de células (OutOfMemoryError); com 12 letras o int ainda estoura.
        for (String referencia : new String[] {"ZZZZZZ1", "ZZZZZZZZZZZZ1"}) {
            exigeColunasDemais(referencia);
        }
    }

    private static void exigeColunasDemais(String referencia) {
        byte[] arquivo = folha("<row r=\"1\"><c r=\"" + referencia + "\"><v>1</v></c></row>");
        assertTimeoutPreemptively(Duration.ofSeconds(5), () -> assertThatThrownBy(
                () -> LeitorDePlanilha.ler("colunas.xlsx", arquivo, 0))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                    assertThat(e.getCodigo()).isEqualTo("ARQUIVO_INVALIDO");
                    assertThat(e.getMessage()).isEqualTo("A planilha passa de 256 colunas.");
                }));
    }

    @Test
    void celulasSemReferenciaSeguemEmOrdem() {
        var celulas = LeitorDePlanilha.ler("sem-ref.xlsx",
                folha("<row r=\"1\"><c><v>1</v></c><c><v>2</v></c><c r=\"D1\"><v>4</v></c></row>"), 0)
                .linhas().get(0).celulas();
        assertThat(celulas).extracting(LeitorDePlanilha.Celula::texto).containsExactly("1", "2", "", "4");
    }

    @Test
    void recusaCelulaForaDeOrdemOuRepetida() {
        for (String linha : new String[] {
                "<c r=\"C1\"><v>1</v></c><c r=\"A1\"><v>2</v></c>",
                "<c r=\"A1\"><v>1</v></c><c r=\"A1\"><v>2</v></c>"}) {
            byte[] arquivo = folha("<row r=\"1\">" + linha + "</row>");
            assertThatThrownBy(() -> LeitorDePlanilha.ler("ordem.xlsx", arquivo, 0))
                    .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                        assertThat(e.getCodigo()).isEqualTo("ARQUIVO_INVALIDO");
                        assertThat(e.getMessage()).isEqualTo("A planilha tem células repetidas ou fora de ordem.");
                    });
        }
    }

    @Test
    void recusaTotalDeCelulasAcimaDoTetoAntesDeGuardar() {
        // 5.000 linhas x 101 = 505.000 células, acima de 500.000; com 100 por linha ainda cabe.
        assertThat(LeitorDePlanilha.ler("cabe.xlsx", folhaDensa(5000, 100), 0).linhas()).hasSize(5000);
        byte[] demais = folhaDensa(5000, 101);
        assertThatThrownBy(() -> LeitorDePlanilha.ler("demais.xlsx", demais, 0))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                    assertThat(e.getCodigo()).isEqualTo("ARQUIVO_INVALIDO");
                    assertThat(e.getMessage()).isEqualTo("A planilha tem células demais.");
                });
    }

    @Test
    void celulaVaziaSoComEstiloAlemDaColunaIVEIgnorada() {
        // O Excel grava borda ou estilo assim; antes recusava a planilha inteira.
        var celulas = LeitorDePlanilha.ler("estilo.xlsx",
                folha("<row r=\"1\"><c r=\"A1\"><v>1</v></c><c r=\"XFD1\" s=\"3\"/></row>"), 0).linhas().get(0).celulas();
        assertThat(celulas).extracting(LeitorDePlanilha.Celula::texto).containsExactly("1");
        exigeColunasDemais("XFD1");
    }

    @Test
    void vaziasDoFimDaLinhaNaoContamNoTetoDeCelulas() {
        // 5.000 linhas com valor em A e borda até a coluna IV: antes contava 256 por linha e passava de 500.000.
        StringBuilder xml = new StringBuilder();
        for (int i = 1; i <= 5000; i++) {
            xml.append("<row r=\"").append(i).append("\"><c r=\"A").append(i).append("\"><v>1</v></c><c r=\"IV")
                    .append(i).append("\" s=\"2\"/></row>");
        }
        var linhas = LeitorDePlanilha.ler("bordas.xlsx", folha(xml.toString()), 0).linhas();
        assertThat(linhas).hasSize(5000);
        assertThat(linhas.get(0).celulas()).hasSize(1);
    }

    @Test
    void textoAcimaDe4000ViraCelulaComErroEnaoETruncado() {
        String justo = "a".repeat(4000);
        String longo = "b".repeat(4001);
        byte[] arquivo = xlsx(Map.of(
                "xl/sharedStrings.xml", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                        <si><t>%s</t></si><si><t>%s</t></si><si><r><t>%s</t></r><r><t>%s</t></r></si></sst>
                        """.formatted(justo, longo, "c".repeat(2500), "d".repeat(2500)),
                "xl/worksheets/sheet1.xml", planilhaXml("""
                        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c>
                        <c r="D1" t="inlineStr"><is><t>%s</t></is></c><c r="E1" t="inlineStr"><is><t>%s</t></is></c>
                        <c r="F1" t="str"><v>%s</v></c><c r="G1"><v>%s</v></c></row>
                        """.formatted(justo, longo, longo, "9".repeat(4001)))));
        var celulas = LeitorDePlanilha.ler("longo.xlsx", arquivo, 0).linhas().get(0).celulas();
        assertThat(celulas.get(0).erro()).isFalse();
        assertThat(celulas.get(0).texto()).hasSize(4000);
        assertThat(celulas.get(1).erro()).isTrue();
        assertThat(celulas.get(1).texto()).isEmpty();
        assertThat(celulas.get(2).erro()).isTrue();
        assertThat(celulas.get(3).erro()).isFalse();
        assertThat(celulas.get(4).erro()).isTrue();
        assertThat(celulas.get(4).texto()).isEmpty();
        assertThat(celulas.get(5).erro()).isTrue();
        assertThat(celulas.get(6).erro()).isTrue();
        assertThat(celulas.get(6).numero()).isFalse();
    }

    @Test
    void date1904AceitaUmETrueSemDiferencaDeCaixa() {
        for (String valor : new String[] {"1", "true", "TRUE", "True"}) {
            assertThat(LeitorDePlanilha.ler("d.xlsx", comWorkbookPr("date1904=\"" + valor + "\""), 0).data1904())
                    .as(valor).isTrue();
        }
        for (String atributos : new String[] {"date1904=\"0\"", "date1904=\"false\"", "defaultThemeVersion=\"1\""}) {
            assertThat(LeitorDePlanilha.ler("d.xlsx", comWorkbookPr(atributos), 0).data1904())
                    .as(atributos).isFalse();
        }
    }

    @Test
    void csvRecusaAspasSemFecharSemRepetirOConteudo() {
        byte[] csv = "nome;obs\nAna;\"segredo sem fechar\nBia;x\n".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> LeitorDePlanilha.ler("alunos.csv", csv, 0))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                    assertThat(e.getCodigo()).isEqualTo("ARQUIVO_INVALIDO");
                    assertThat(e.getMessage()).doesNotContain("segredo").doesNotContain("Ana");
                });
    }

    @Test
    void csvCelulaEntreAspasComQuebraDeLinhaNaoViraOutraLinha() {
        byte[] csv = "nome;obs\nAna;\"linha 1\nlinha 2\"\nBia;x\n".getBytes(StandardCharsets.UTF_8);
        var linhas = LeitorDePlanilha.ler("alunos.csv", csv, 0).linhas();
        assertThat(linhas).hasSize(3);
        assertThat(linhas.get(1).celulas().get(1).texto()).isEqualTo("linha 1\nlinha 2");
        assertThat(linhas.get(2).celulas().get(0).texto()).isEqualTo("Bia");
    }

    @Test
    void csvLimitaTextoEColunasComoOXlsx() {
        byte[] longo = ("nome;obs\nAna;" + "x".repeat(4001) + "\nBia;" + "y".repeat(4000) + "\n")
                .getBytes(StandardCharsets.UTF_8);
        var linhas = LeitorDePlanilha.ler("alunos.csv", longo, 0).linhas();
        assertThat(linhas.get(1).celulas().get(1).erro()).isTrue();
        assertThat(linhas.get(1).celulas().get(1).texto()).isEmpty();
        assertThat(linhas.get(2).celulas().get(1).texto()).hasSize(4000);
        byte[] largo = ("a" + ";b".repeat(256) + "\n").getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> LeitorDePlanilha.ler("largo.csv", largo, 0))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(e.getMessage()).isEqualTo("A planilha passa de 256 colunas."));
    }

    private static String planilhaXml(String linhas) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
                %s
                </sheetData></worksheet>
                """.formatted(linhas);
    }

    private static byte[] folha(String linhas) {
        return xlsx(Map.of("xl/worksheets/sheet1.xml", planilhaXml(linhas)));
    }

    /** Linhas de números sem {@code r} nas células (a posição é a ordem), para chegar ao teto sem arquivo enorme. */
    private static byte[] folhaDensa(int linhas, int colunas) {
        String celula = "<c><v>1</v></c>";
        StringBuilder xml = new StringBuilder();
        for (int i = 1; i <= linhas; i++) {
            xml.append("<row r=\"").append(i).append("\">").append(celula.repeat(colunas)).append("</row>");
        }
        return folha(xml.toString());
    }

    private static byte[] comWorkbookPr(String atributos) {
        return xlsx(Map.of(
                "xl/workbook.xml", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                        <workbookPr %s/><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>
                        """.formatted(atributos),
                "xl/worksheets/sheet1.xml", planilhaXml("<row r=\"1\"><c r=\"A1\"><v>1</v></c></row>")));
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
