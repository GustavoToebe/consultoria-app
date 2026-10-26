package br.com.treinos.api.importacao;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.biblioteca.LeitorCsv;
import br.com.treinos.api.web.ValidacaoException;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Lê .xlsx (zip + StAX, sem Apache POI) ou .csv. Não devolve conteúdo de célula em erro: a mensagem é fixa.
 * Limites: 900 KB, 200 entradas no zip, 20 MB descompactados, 5.001 linhas (cabeçalho + 5.000), 256 colunas, 500.000
 * células guardadas (sem as vazias do fim da linha) e 4.000 caracteres por célula (acima disso a célula vira "com erro", nunca texto cortado).
 */
public final class LeitorDePlanilha {

    public static final int ARQUIVO_MAXIMO = 900 * 1024;
    static final int ZIP_ENTRADAS = 200;
    static final int ZIP_DESCOMPACTADO = 20 * 1024 * 1024;
    /** Cabeçalho + 5.000 linhas de dados. Quem chama confere as linhas de dados de novo. */
    static final int LINHAS_LIDAS = 5001;
    /**
     * Até a coluna IV. A referência {@code r="ZZZZZZ1"} não pode virar centenas de milhões de células vazias; célula vazia
     * além dela é ignorada, com conteúdo recusa a planilha.
     */
    static final int COLUNAS_MAXIMAS = 256;
    /** Células guardadas na planilha toda (5.000 linhas x 100 colunas), contadas no fim de cada linha, sem as vazias do fim. */
    static final int CELULAS_MAXIMAS = 500_000;
    /** Texto de uma célula ou de uma shared string; maior que isso a célula vira "com erro". */
    static final int TEXTO_MAXIMO = 4000;
    private static final LocalDate EPOCA = LocalDate.of(1899, 12, 30);

    public record Celula(String texto, boolean numero, boolean erro) {
        private static final Celula VAZIA = new Celula("", false, false);

        static Celula vazia() {
            return VAZIA;
        }

        static Celula deTexto(String t) {
            return new Celula(t == null ? "" : t, false, false);
        }

        static Celula deNumero(String t) {
            return new Celula(t, true, false);
        }

        static Celula comErro() {
            return new Celula("", false, true);
        }
    }

    public record Linha(int numero, List<Celula> celulas) {
    }

    public record Planilha(List<String> abas, int aba, List<Linha> linhas, boolean data1904) {
    }

    private LeitorDePlanilha() {
    }

    public static Planilha ler(String nome, byte[] bytes, int aba) {
        if (bytes == null || bytes.length == 0) {
            throw arquivo("O arquivo está vazio.");
        }
        if (bytes.length > ARQUIVO_MAXIMO) {
            throw arquivo("O arquivo passa de 900 KB.");
        }
        String ext = extensao(nome);
        if ("xls".equals(ext) || ole(bytes)) {
            throw arquivo("Salve a planilha como .xlsx ou .csv e envie de novo.");
        }
        try {
            if ("xlsx".equals(ext) || zip(bytes)) {
                return lerXlsx(bytes, aba);
            }
            if ("csv".equals(ext) || "txt".equals(ext) || ext.isEmpty()) {
                return lerCsv(bytes, aba);
            }
            throw arquivo("Envie um arquivo .xlsx ou .csv.");
        } catch (BadRequestException e) {
            throw arquivo(e.getMessage());
        }
    }

    /** Número serial do Excel (sistema 1900) para data. Abaixo de 61 recusa o dia inventado de 1900. */
    public static LocalDate dataSerial(BigDecimal serial, boolean data1904) {
        if (serial == null) {
            return null;
        }
        BigDecimal n = data1904 ? serial.add(new BigDecimal("1462")) : serial;
        if (n.stripTrailingZeros().scale() > 0) {
            return null;
        }
        long dias = n.longValue();
        if (dias < 61 || dias > 80000) {
            return null;
        }
        return EPOCA.plusDays(dias);
    }

    private static Planilha lerCsv(byte[] bytes, int aba) {
        if (aba != 0) {
            throw arquivo("Escolha uma aba da planilha.");
        }
        String texto = decodificar(bytes);
        List<LeitorCsv.Linha> lidas = LeitorCsv.lerLivre(texto, LINHAS_LIDAS);
        List<Linha> linhas = new ArrayList<>();
        int total = 0;
        for (LeitorCsv.Linha l : lidas) {
            if (l.campos().size() > COLUNAS_MAXIMAS) {
                throw arquivo("A planilha passa de 256 colunas.");
            }
            total += l.campos().size();
            if (total > CELULAS_MAXIMAS) {
                throw arquivo("A planilha tem células demais.");
            }
            List<Celula> celulas = new ArrayList<>();
            for (String c : l.campos()) {
                celulas.add(c.length() > TEXTO_MAXIMO ? Celula.comErro() : Celula.deTexto(c));
            }
            linhas.add(new Linha(l.numero(), celulas));
        }
        return new Planilha(List.of("Planilha"), 0, linhas, false);
    }

    private static Planilha lerXlsx(byte[] bytes, int abaPedida) {
        Map<String, byte[]> entradas = abrirZip(bytes);
        byte[] workbook = entradas.get("xl/workbook.xml");
        if (workbook == null) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        boolean data1904 = tem(workbook, "date1904", v -> "1".equals(v) || "true".equalsIgnoreCase(v));
        List<String> nomes = new ArrayList<>();
        List<String> relacoes = new ArrayList<>();
        elementos(workbook, "sheet", (nome, rid) -> {
            nomes.add(nome);
            relacoes.add(rid);
        });
        if (nomes.isEmpty()) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        if (abaPedida < 0 || abaPedida >= nomes.size()) {
            throw arquivo("Escolha uma aba da planilha.");
        }
        Map<String, String> alvos = relacoes(entradas.get("xl/_rels/workbook.xml.rels"));
        String alvo = alvos.get(relacoes.get(abaPedida));
        if (alvo == null) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        String caminho = alvo.startsWith("/") ? alvo.substring(1) : "xl/" + alvo.replace("\\", "/");
        byte[] folha = entradas.get(caminho);
        if (folha == null) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        List<String> textos = textos(entradas.get("xl/sharedStrings.xml"));
        return new Planilha(List.copyOf(nomes), abaPedida, folha(folha, textos), data1904);
    }

    private static Map<String, byte[]> abrirZip(byte[] bytes) {
        Map<String, byte[]> entradas = new LinkedHashMap<>();
        int total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entrada;
            while ((entrada = zip.getNextEntry()) != null) {
                if (entradas.size() >= ZIP_ENTRADAS) {
                    throw arquivo("O arquivo da planilha é grande demais.");
                }
                if (entrada.isDirectory()) {
                    continue;
                }
                String nome = entrada.getName().replace('\\', '/');
                if (nome.contains("..") || nome.startsWith("/")) {
                    throw arquivo("Não foi possível ler a planilha.");
                }
                byte[] dados = lerLimitado(zip, ZIP_DESCOMPACTADO - total);
                total += dados.length;
                entradas.put(nome, dados);
            }
        } catch (IOException e) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        return entradas;
    }

    private static byte[] lerLimitado(ZipInputStream zip, int restante) throws IOException {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        byte[] bloco = new byte[8192];
        int lido;
        while ((lido = zip.read(bloco)) >= 0) {
            if (lido > restante) {
                throw arquivo("O arquivo da planilha é grande demais.");
            }
            saida.write(bloco, 0, lido);
            restante -= lido;
        }
        return saida.toByteArray();
    }

    private static List<Linha> folha(byte[] xml, List<String> textos) {
        List<Linha> linhas = new ArrayList<>();
        try {
            XMLStreamReader r = leitor(xml);
            int numero = 0;
            List<Celula> celulas = null;
            int guardadas = 0;
            int coluna = 0;
            String tipo = null;
            boolean formula = false;
            boolean valor = false;
            boolean erro = false;
            boolean longo = false;
            boolean foraDoLimite = false;
            StringBuilder texto = new StringBuilder();
            boolean emValor = false;
            boolean emInline = false;
            while (r.hasNext()) {
                int ev = r.next();
                if (ev == XMLStreamConstants.START_ELEMENT && "row".equals(r.getLocalName())) {
                    numero = inteiro(atributo(r, "r"), linhas.size() + 1);
                    celulas = new ArrayList<>();
                } else if (ev == XMLStreamConstants.START_ELEMENT && "c".equals(r.getLocalName()) && celulas != null) {
                    int posicao = colunaDe(atributo(r, "r"));
                    if (posicao >= 0 && posicao < celulas.size()) {
                        throw arquivo("A planilha tem células repetidas ou fora de ordem.");
                    }
                    coluna = posicao < 0 ? celulas.size() : posicao;
                    // Célula vazia só com formatação além da coluna IV (o Excel grava bordas e estilos assim) é
                    // ignorada; só a que tem conteúdo recusa a planilha, no fim da célula.
                    foraDoLimite = coluna >= COLUNAS_MAXIMAS;
                    tipo = atributo(r, "t");
                    formula = false;
                    valor = false;
                    erro = "e".equals(tipo);
                    longo = false;
                    texto.setLength(0);
                } else if (ev == XMLStreamConstants.START_ELEMENT && "f".equals(r.getLocalName())) {
                    formula = true;
                } else if (ev == XMLStreamConstants.START_ELEMENT && "v".equals(r.getLocalName())) {
                    emValor = true;
                } else if (ev == XMLStreamConstants.END_ELEMENT && "v".equals(r.getLocalName())) {
                    emValor = false;
                    valor = true;
                } else if (ev == XMLStreamConstants.START_ELEMENT && "t".equals(r.getLocalName()) && "inlineStr".equals(tipo)) {
                    emInline = true;
                } else if (ev == XMLStreamConstants.END_ELEMENT && "t".equals(r.getLocalName())) {
                    emInline = false;
                    valor = true;
                } else if (ev == XMLStreamConstants.CHARACTERS || ev == XMLStreamConstants.CDATA) {
                    if ((emValor || emInline) && !longo) {
                        if (texto.length() + r.getTextLength() > TEXTO_MAXIMO) {
                            longo = true;
                            texto.setLength(0);
                        } else {
                            texto.append(r.getText());
                        }
                    }
                } else if (ev == XMLStreamConstants.END_ELEMENT && "c".equals(r.getLocalName()) && celulas != null) {
                    Celula lida = longo ? Celula.comErro() : celula(tipo, formula, valor, erro, texto.toString(), textos);
                    if (foraDoLimite) {
                        if (!vazia(lida)) {
                            throw arquivo("A planilha passa de 256 colunas.");
                        }
                    } else {
                        if (celulas.size() > coluna) {
                            throw arquivo("A planilha tem células repetidas ou fora de ordem.");
                        }
                        while (celulas.size() < coluna) {
                            celulas.add(Celula.vazia());
                        }
                        celulas.add(lida);
                    }
                } else if (ev == XMLStreamConstants.END_ELEMENT && "row".equals(r.getLocalName()) && celulas != null) {
                    // As vazias do fim (borda ou estilo) não contam no teto nem ocupam a linha guardada.
                    while (!celulas.isEmpty() && vazia(celulas.getLast())) {
                        celulas.removeLast();
                    }
                    if (!celulas.isEmpty()) {
                        if (linhas.size() >= LINHAS_LIDAS) {
                            throw arquivo("O arquivo passa de 5.000 linhas.");
                        }
                        guardadas += celulas.size();
                        if (guardadas > CELULAS_MAXIMAS) {
                            throw arquivo("A planilha tem células demais.");
                        }
                        linhas.add(new Linha(numero, List.copyOf(celulas)));
                    }
                    celulas = null;
                }
            }
            r.close();
        } catch (XMLStreamException e) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        return linhas;
    }

    private static Celula celula(String tipo, boolean formula, boolean valor, boolean erro, String bruto,
                                 List<String> textos) {
        if (erro) {
            return Celula.comErro();
        }
        if (formula && !valor) {
            return Celula.comErro();
        }
        String t = bruto == null ? "" : bruto;
        if ("s".equals(tipo)) {
            int i = inteiro(t, -1);
            if (i < 0 || i >= textos.size()) {
                return Celula.deTexto("");
            }
            String guardado = textos.get(i);
            return guardado == null ? Celula.comErro() : Celula.deTexto(guardado);
        }
        if ("inlineStr".equals(tipo) || "str".equals(tipo)) {
            return Celula.deTexto(t);
        }
        if ("b".equals(tipo)) {
            return Celula.deTexto("1".equals(t) ? "verdadeiro" : "falso");
        }
        if (t.isBlank()) {
            return Celula.vazia();
        }
        try {
            BigDecimal n = new BigDecimal(t);
            return Celula.deNumero(n.stripTrailingZeros().toPlainString());
        } catch (NumberFormatException e) {
            return Celula.deTexto(t);
        }
    }

    /** Shared string maior que {@link #TEXTO_MAXIMO} não é guardada: a posição fica {@code null} e a célula vira erro. */
    private static List<String> textos(byte[] xml) {
        if (xml == null) {
            return List.of();
        }
        List<String> saida = new ArrayList<>();
        try {
            XMLStreamReader r = leitor(xml);
            StringBuilder atual = null;
            boolean longo = false;
            boolean emT = false;
            while (r.hasNext()) {
                int ev = r.next();
                if (ev == XMLStreamConstants.START_ELEMENT && "si".equals(r.getLocalName())) {
                    atual = new StringBuilder();
                    longo = false;
                } else if (ev == XMLStreamConstants.START_ELEMENT && "t".equals(r.getLocalName()) && atual != null) {
                    emT = true;
                } else if ((ev == XMLStreamConstants.CHARACTERS || ev == XMLStreamConstants.CDATA) && emT && atual != null
                        && !longo) {
                    if (atual.length() + r.getTextLength() > TEXTO_MAXIMO) {
                        longo = true;
                        atual.setLength(0);
                    } else {
                        atual.append(r.getText());
                    }
                } else if (ev == XMLStreamConstants.END_ELEMENT && "t".equals(r.getLocalName())) {
                    emT = false;
                } else if (ev == XMLStreamConstants.END_ELEMENT && "si".equals(r.getLocalName()) && atual != null) {
                    saida.add(longo ? null : atual.toString());
                    atual = null;
                }
            }
            r.close();
        } catch (XMLStreamException e) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        return saida;
    }

    private static Map<String, String> relacoes(byte[] xml) {
        Map<String, String> saida = new LinkedHashMap<>();
        if (xml == null) {
            return saida;
        }
        try {
            XMLStreamReader r = leitor(xml);
            while (r.hasNext()) {
                if (r.next() == XMLStreamConstants.START_ELEMENT && "Relationship".equals(r.getLocalName())) {
                    String id = atributo(r, "Id");
                    String alvo = atributo(r, "Target");
                    if (id != null && alvo != null) {
                        saida.put(id, alvo);
                    }
                }
            }
            r.close();
        } catch (XMLStreamException e) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        return saida;
    }

    private interface Folha {
        void aceitar(String nome, String relacao);
    }

    private static void elementos(byte[] xml, String tag, Folha folha) {
        try {
            XMLStreamReader r = leitor(xml);
            while (r.hasNext()) {
                if (r.next() == XMLStreamConstants.START_ELEMENT && tag.equals(r.getLocalName())) {
                    folha.aceitar(atributo(r, "name"), atributo(r, "id"));
                }
            }
            r.close();
        } catch (XMLStreamException e) {
            throw arquivo("Não foi possível ler a planilha.");
        }
    }

    private static boolean tem(byte[] xml, String atributo, Predicate<String> valido) {
        try {
            XMLStreamReader r = leitor(xml);
            while (r.hasNext()) {
                if (r.next() == XMLStreamConstants.START_ELEMENT) {
                    String lido = atributo(r, atributo);
                    if (lido != null && valido.test(lido)) {
                        r.close();
                        return true;
                    }
                }
            }
            r.close();
        } catch (XMLStreamException e) {
            throw arquivo("Não foi possível ler a planilha.");
        }
        return false;
    }

    private static XMLStreamReader leitor(byte[] xml) throws XMLStreamException {
        XMLInputFactory fabrica = XMLInputFactory.newFactory();
        fabrica.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        fabrica.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        return fabrica.createXMLStreamReader(new ByteArrayInputStream(xml));
    }

    private static String atributo(XMLStreamReader r, String local) {
        for (int i = 0; i < r.getAttributeCount(); i++) {
            if (local.equals(r.getAttributeLocalName(i))) {
                return r.getAttributeValue(i);
            }
        }
        return null;
    }

    /** Índice da coluna (A = 0) ou -1 sem letras. Acima de {@link #COLUNAS_MAXIMAS} recusa antes de o int estourar. */
    private static boolean vazia(Celula c) {
        return c.texto().isEmpty() && !c.erro();
    }

    static int colunaDe(String referencia) {
        if (referencia == null) {
            return -1;
        }
        int n = 0;
        for (int i = 0; i < referencia.length(); i++) {
            char c = referencia.charAt(i);
            if (c >= 'A' && c <= 'Z') {
                n = n * 26 + (c - 'A' + 1);
            } else if (c >= 'a' && c <= 'z') {
                n = n * 26 + (c - 'a' + 1);
            } else {
                break;
            }
            if (n > COLUNAS_MAXIMAS) {
                // Fora do limite: para de somar (o int não estoura) e quem chama decide pelo conteúdo da célula.
                return COLUNAS_MAXIMAS;
            }
        }
        return n - 1;
    }

    public static String letra(int indice) {
        int n = indice + 1;
        StringBuilder s = new StringBuilder();
        while (n > 0) {
            n--;
            s.insert(0, (char) ('A' + n % 26));
            n /= 26;
        }
        return s.toString();
    }

    private static int inteiro(String texto, int padrao) {
        if (texto == null || texto.isBlank()) {
            return padrao;
        }
        try {
            return Integer.parseInt(texto.trim());
        } catch (NumberFormatException e) {
            return padrao;
        }
    }

    private static String decodificar(byte[] bytes) {
        int inicio = bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF ? 3 : 0;
        try {
            CharsetDecoder decodificador = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT);
            return decodificador.decode(java.nio.ByteBuffer.wrap(bytes, inicio, bytes.length - inicio)).toString();
        } catch (CharacterCodingException e) {
            throw arquivo("Salve o CSV em UTF-8 e envie de novo.");
        }
    }

    private static String extensao(String nome) {
        if (nome == null) {
            return "";
        }
        String limpo = nome.replace('\\', '/');
        int barra = limpo.lastIndexOf('/');
        if (barra >= 0) {
            limpo = limpo.substring(barra + 1);
        }
        int ponto = limpo.lastIndexOf('.');
        return ponto < 0 ? "" : limpo.substring(ponto + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean zip(byte[] bytes) {
        return bytes.length >= 2 && bytes[0] == 'P' && bytes[1] == 'K';
    }

    private static boolean ole(byte[] bytes) {
        return bytes.length >= 4 && (bytes[0] & 0xFF) == 0xD0 && (bytes[1] & 0xFF) == 0xCF
                && (bytes[2] & 0xFF) == 0x11 && (bytes[3] & 0xFF) == 0xE0;
    }

    private static ValidacaoException arquivo(String mensagem) {
        return new ValidacaoException(mensagem, "ARQUIVO_INVALIDO", List.of());
    }
}
