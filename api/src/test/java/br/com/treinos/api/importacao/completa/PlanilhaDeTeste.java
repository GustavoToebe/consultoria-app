package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Planilhas fictícias montadas na memória para os testes da planilha completa (nenhuma planilha de verdade entra no
 * repositório). Célula: {@code String} (texto compartilhado), {@code Number}, {@code Boolean}, {@code null} (vazia) ou
 * {@link #data(String)} (o número de série, como o Excel grava uma data).
 */
final class PlanilhaDeTeste {

    record Data(String iso) {
    }

    /** Célula com erro de fórmula ("#REF!"). */
    record Erro(String codigo) {
    }

    private PlanilhaDeTeste() {
    }

    static Data data(String iso) {
        return new Data(iso);
    }

    /** Série do Excel de uma data (o contrário do {@code dataDoExcel}), como o {@code serie} do apoio dos testes em Node. */
    static long serie(String iso) {
        return ChronoUnit.DAYS.between(LocalDate.of(1899, 12, 30), LocalDate.parse(iso));
    }

    static List<Object> linha(Object... celulas) {
        return Arrays.asList(celulas);
    }

    /** Linhas já lidas (número no arquivo = posição + 1), para as regras puras. */
    static List<Linha> linhas(List<List<Object>> linhas) {
        List<Linha> saida = new ArrayList<>();
        for (int i = 0; i < linhas.size(); i++) {
            List<Celula> celulas = new ArrayList<>();
            for (Object v : linhas.get(i)) {
                celulas.add(celula(v));
            }
            saida.add(new Linha(i + 1, celulas));
        }
        return saida;
    }

    static Celula celula(Object v) {
        if (v == null) {
            return new Celula("", false, false);
        }
        if (v instanceof Data d) {
            return new Celula(String.valueOf(serie(d.iso())), true, false);
        }
        if (v instanceof Erro) {
            return new Celula("", false, true);
        }
        if (v instanceof Number n) {
            return new Celula(new BigDecimal(n.toString()).stripTrailingZeros().toPlainString(), true, false);
        }
        if (v instanceof Boolean b) {
            return new Celula(b ? "verdadeiro" : "falso", false, false);
        }
        return new Celula(v.toString(), false, false);
    }

    static Celula texto(String t) {
        return new Celula(t, false, false);
    }

    static Celula numero(String t) {
        return new Celula(t, true, false);
    }

    /** Um .xlsx com as abas na ordem do mapa. */
    static byte[] xlsx(Map<String, List<List<Object>>> abas) {
        List<String> compartilhados = new ArrayList<>();
        Map<String, String> folhas = new LinkedHashMap<>();
        int n = 1;
        for (List<List<Object>> linhas : abas.values()) {
            StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"")
                    .append(NS).append("\"><sheetData>");
            for (int r = 0; r < linhas.size(); r++) {
                xml.append("<row r=\"").append(r + 1).append("\">");
                List<Object> celulas = linhas.get(r);
                for (int c = 0; c < celulas.size(); c++) {
                    Object v = celulas.get(c);
                    if (v == null) {
                        continue;
                    }
                    String ref = coluna(c) + (r + 1);
                    if (v instanceof Data d) {
                        xml.append("<c r=\"").append(ref).append("\" s=\"1\"><v>").append(serie(d.iso())).append("</v></c>");
                    } else if (v instanceof Number num) {
                        xml.append("<c r=\"").append(ref).append("\"><v>").append(num).append("</v></c>");
                    } else if (v instanceof Erro e) {
                        xml.append("<c r=\"").append(ref).append("\" t=\"e\"><v>").append(escapar(e.codigo())).append("</v></c>");
                    } else if (v instanceof Boolean b) {
                        xml.append("<c r=\"").append(ref).append("\" t=\"b\"><v>").append(b ? 1 : 0).append("</v></c>");
                    } else {
                        int i = compartilhados.indexOf(v.toString());
                        if (i < 0) {
                            compartilhados.add(v.toString());
                            i = compartilhados.size() - 1;
                        }
                        xml.append("<c r=\"").append(ref).append("\" t=\"s\"><v>").append(i).append("</v></c>");
                    }
                }
                xml.append("</row>");
            }
            xml.append("</sheetData></worksheet>");
            folhas.put("xl/worksheets/sheet" + n + ".xml", xml.toString());
            n++;
        }
        StringBuilder sheets = new StringBuilder();
        StringBuilder rels = new StringBuilder();
        int i = 1;
        for (String nome : abas.keySet()) {
            sheets.append("<sheet name=\"").append(escapar(nome)).append("\" sheetId=\"").append(i).append("\" r:id=\"rId")
                    .append(i).append("\"/>");
            rels.append("<Relationship Id=\"rId").append(i).append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/")
                    .append("2006/relationships/worksheet\" Target=\"worksheets/sheet").append(i).append(".xml\"/>");
            i++;
        }
        StringBuilder sst = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><sst xmlns=\"").append(NS).append("\">");
        for (String t : compartilhados) {
            sst.append("<si><t xml:space=\"preserve\">").append(escapar(t)).append("</t></si>");
        }
        sst.append("</sst>");
        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(saida)) {
                gravar(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\""
                        + "http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" "
                        + "ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" "
                        + "ContentType=\"application/xml\"/></Types>");
                gravar(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\""
                        + "http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\""
                        + "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
                        + "Target=\"xl/workbook.xml\"/></Relationships>");
                gravar(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"" + NS
                        + "\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>"
                        + sheets + "</sheets></workbook>");
                gravar(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\""
                        + "http://schemas.openxmlformats.org/package/2006/relationships\">" + rels + "</Relationships>");
                gravar(zip, "xl/sharedStrings.xml", sst.toString());
                for (Map.Entry<String, String> f : folhas.entrySet()) {
                    gravar(zip, f.getKey(), f.getValue());
                }
            }
            return saida.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static final String NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    private static String coluna(int indice) {
        int n = indice + 1;
        StringBuilder s = new StringBuilder();
        while (n > 0) {
            n--;
            s.insert(0, (char) ('A' + n % 26));
            n /= 26;
        }
        return s.toString();
    }

    private static String escapar(String t) {
        return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static void gravar(ZipOutputStream zip, String nome, String xml) throws Exception {
        zip.putNextEntry(new ZipEntry(nome));
        zip.write(xml.getBytes(StandardCharsets.UTF_8));
    }

    // ------------------------------------------------------------------ a planilha fictícia no formato do primeiro treinador

    static final List<Object> CAB_ALUNOS = linha("ID", "Nome", "Email", "Telefone", "Peso Inicial (kg)", "Objetivo",
            "Data Início", "Status", "Obs");
    static final List<Object> CAB_PESOS = linha("ID", "ID Aluno", "Nome Aluno", "Data", "Semana Nº", "Peso (kg)",
            "Variação (kg)", "Observação");
    static final List<Object> CAB_PLANOS = linha("ID Plano", "ID Aluno", "Nome Aluno", "Intra-treino", "Hidratação",
            "Refeição Livre", "Obs Gerais", "Data Criação", "Ativo", "Versão");
    static final List<Object> CAB_REF = linha("ID Ref", "ID Plano", "Nº Refeição", "Título", "Opção", "Item Nº", "Alimento",
            "Quantidade (g)", "Kcal", "Proteína (g)", "Carb (g)", "Gord (g)", "Dica", "Unidade Mode", "Peso Unidade (g)");
    static final List<Object> CAB_SUP = linha("ID", "ID Plano", "Nome Aluno", "Suplemento / Medicamento", "Dose", "Horário",
            "Observação");
    static final List<Object> CAB_ROT = linha("ID Rotina", "ID Aluno", "Nome Aluno", "Modelo Base", "Obs Gerais",
            "Recomendações", "Data Criação", "Ativo", "Divisão Semanal", "Acessórios");
    static final List<Object> CAB_EX = linha("ID Exerc", "ID Rotina", "Letra Treino", "Nome Treino", "Categoria", "Ordem",
            "Nome Exercício", "WS", "FS", "TS", "BO", "Rep Range", "Obs Específica", "Link Vídeo", "Back Off %");
    static final List<Object> CAB_LISTA = linha("Exercício", "Grupo Muscular", "Link Vídeo");

    /**
     * Abas como as do {@code planos.test.mjs} (dados fictícios), mais a lista de exercícios e a tabela de alimentos de
     * terceiros. O aluno AL9 não existe (plano sem ligação) e a rotina R9 também não.
     */
    static Map<String, List<List<Object>>> abasDoTreinador() {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos", List.of(CAB_ALUNOS,
                linha("AL1", "Aluno Um", "um@example.com", null, null, null, null, "Ativo", null),
                linha("AL2", "Aluno Dois", "nao-e-email", null, null, null, null, "Ativo", null),
                linha("AL4", "Aluno Quatro", null, null, null, null, null, "Ativo", null),
                linha("AL5", "Aluno Cinco", null, null, null, null, null, "Ativo", null),
                linha("AL6", "Aluno Seis", null, null, null, null, null, "Ativo", null)));
        abas.put("Histórico Pesos", List.of(CAB_PESOS,
                linha("P1", "AL1", "Aluno Um", data("2026-01-05"), 1, 80.5, null, null),
                linha("P2", "AL1", "Aluno Um", data("2026-01-12"), 2, 79.9000000001, -0.6, null),
                linha("P3", "AL1", "Aluno Um", null, 3, 79.5, null, null),
                linha("P4", "AL1", "Aluno Um", data("2099-01-01"), 4, 79, null, null),
                linha("P5", "AL2", "Aluno Dois", data("2026-02-08"), 1, 81.955, null, null),
                linha("P6", "AL9", "Aluno Nove", data("2026-02-08"), 1, 90, null, null)));
        abas.put("Planos", List.of(CAB_PLANOS,
                linha("P1", "AL1", "x", "Intra fictício", "Muita água fictícia", null, "Observação geral fictícia",
                        data("2026-01-10"), true, 1),
                linha("P2", "AL2", "x", null, null, null, null, data("2026-01-10"), true, 1),
                linha("P9", "AL9", "x", null, null, null, null, data("2026-01-10"), true, 1)));
        abas.put("Refeições", List.of(CAB_REF,
                linha("r1", "P1", 2, "Almoço fictício", null, 1, "Feijão fictício", 150, 120, 8, 20, 1, null, "g", 0),
                linha("r2", "P1", 1, "Café fictício", "A", 2, "Pão fictício", 50, 130, 4, 25, 2, "Pode trocar", "g", 0),
                linha("r3", "P1", 1, "Café fictício", "A", 1, "Ovo fictício", 2, 140, 12, 1, 10, null, "un", 50),
                linha("r7", "P1", 1, "Café fictício", "A", 5, null, null, 1, null, null, null, null, "g", 0),
                linha("r8", "P2", 1, "Única fictícia", "A", 1, "Aveia fictícia", 30, 110, 4, 19, 2, null, "g", 0)));
        abas.put("Suplementos", List.of(CAB_SUP,
                linha("s1", "P1", "x", "Creatina", "5 g", "08:00", null),
                linha("s2", "P1", "x", "Remédio Fictício XYZ", 20, null, null),
                linha("s4", "P1", "x", null, "1", null, null)));
        abas.put("Treinos_Rotinas", List.of(CAB_ROT,
                linha("R1", "AL1", "x", "Modelo", "Obs rotina fictícia", "Recomendação fictícia", data("2026-01-10"), true,
                        "Segunda: A | Terça: B", "Acessórios fictícios"),
                linha("R6", "AL6", "x", "Modelo", null, null, data("2026-01-10"), true, null, null)));
        abas.put("Treinos_Exercicios", List.of(CAB_EX,
                linha("e1", "R1", "A", "Segunda - Costas", "Principal", 2, "Remada fictícia", 1, 3, false, true, "3a6",
                        "Obs fictícia", "https://youtu.be/abc123", 0.85),
                linha("e2", "R1", "A", "Segunda - Costas", "Principal", 1, "Puxada fictícia", 3, 0, false, false, "6a8",
                        null, null, 0.8),
                linha("e3", "R1", "B", "Treino B", "Principal", 1, "Exercício data", 1, 2, false, true, 46364, null, null, 0.9),
                linha("e4", "R1", "B", "Treino B", "Principal", 2, "Supino reto c/ hal.", 23, 4, false, false, 8, null, null,
                        0.8),
                linha("e5", "R1", "B", "Treino B", "Principal", 3, "Xyzzy qwerty", 2, 1, true, false, "qualquer coisa", null,
                        null, 0),
                linha("e6", "R1", "B", "Treino B", "Principal", 4, "Impossível", 1, null, false, false, data("1999-05-06"),
                        null, null, 0),
                linha("e7", "R9", "A", "Treino A", "Principal", 1, "Rotina inexistente", 1, 1, false, false, "3a6", null,
                        null, 0),
                linha("e8", "R6", "A", "Treino A", "Principal", 1, null, null, null, false, false, "3a6", null, null, 0)));
        abas.put("Lista_Exercicios", List.of(CAB_LISTA,
                linha("Puxada fictícia", "Costas", null),
                linha("Remada fictícia", "Costas", "https://youtu.be/abc123")));
        abas.put("TACO", List.of(linha("Descrição dos alimentos", "Energia (kcal)", "Proteína (g)", "Lipídeos (g)",
                "Carboidrato (g)"), linha("Algo de terceiros", 1, 1, 1, 1)));
        return abas;
    }
}
