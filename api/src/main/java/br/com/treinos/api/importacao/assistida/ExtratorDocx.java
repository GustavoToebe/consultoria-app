package br.com.treinos.api.importacao.assistida;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Extrator nativo para documentos .docx (Google Docs baixado ou Microsoft Word).
 * Um arquivo DOCX é um ZIP contendo 'word/document.xml'.
 * Lê parágrafos e células de tabelas na ordem exata sem dependências externas vulneráveis.
 */
public final class ExtratorDocx {

    private ExtratorDocx() {
    }

    public static ResultadoExtracao extrair(String nomeArquivo, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return new ResultadoExtracao("DOCX", "", List.of(), Map.of());
        }

        StringBuilder textoCompleto = new StringBuilder();
        List<BlocoTexto> blocos = new ArrayList<>();
        int blocoIdx = 1;

        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("word/document.xml".equals(entry.getName())) {
                    XMLInputFactory factory = XMLInputFactory.newFactory();
                    factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
                    factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);

                    XMLStreamReader reader = factory.createXMLStreamReader(zis, StandardCharsets.UTF_8.name());
                    StringBuilder paragrafoAtual = new StringBuilder();
                    StringBuilder celulaAtual = new StringBuilder();
                    List<String> celulasLinha = new ArrayList<>();
                    boolean emTabela = false;
                    boolean emTexto = false;

                    while (reader.hasNext()) {
                        int event = reader.next();
                        switch (event) {
                            case XMLStreamConstants.START_ELEMENT -> {
                                String localName = reader.getLocalName();
                                if ("tbl".equals(localName)) {
                                    emTabela = true;
                                } else if ("tr".equals(localName)) {
                                    celulasLinha.clear();
                                    celulaAtual.setLength(0);
                                } else if ("tc".equals(localName)) {
                                    celulaAtual.setLength(0);
                                } else if ("t".equals(localName)) {
                                    emTexto = true;
                                }
                            }
                            case XMLStreamConstants.CHARACTERS -> {
                                if (emTexto) {
                                    String txt = reader.getText();
                                    if (txt != null && !txt.isEmpty()) {
                                        if (emTabela) {
                                            celulaAtual.append(txt);
                                        } else {
                                            paragrafoAtual.append(txt);
                                        }
                                    }
                                }
                            }
                            case XMLStreamConstants.END_ELEMENT -> {
                                String localName = reader.getLocalName();
                                if ("t".equals(localName)) {
                                    emTexto = false;
                                } else if ("tc".equals(localName)) {
                                    if (emTabela) {
                                        celulasLinha.add(celulaAtual.toString().strip());
                                        celulaAtual.setLength(0);
                                    }
                                } else if ("tr".equals(localName)) {
                                    if (!celulasLinha.isEmpty()) {
                                        String lin = String.join(" | ", celulasLinha).strip();
                                        if (!lin.isEmpty()) {
                                            textoCompleto.append(lin).append('\n');
                                            blocos.add(new BlocoTexto("Tabela linha " + blocoIdx, lin, nomeArquivo, blocoIdx++));
                                        }
                                    }
                                    celulasLinha.clear();
                                } else if ("tbl".equals(localName)) {
                                    emTabela = false;
                                    textoCompleto.append('\n');
                                } else if ("p".equals(localName) && !emTabela) {
                                    if (paragrafoAtual.length() > 0) {
                                        String p = paragrafoAtual.toString().strip();
                                        if (!p.isEmpty()) {
                                            textoCompleto.append(p).append('\n');
                                            blocos.add(new BlocoTexto("Parágrafo " + blocoIdx, p, nomeArquivo, blocoIdx++));
                                        }
                                        paragrafoAtual.setLength(0);
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
            }
        } catch (Exception e) {
            // Em caso de XML corrompido, retorna o que conseguiu extrair
        }

        return new ResultadoExtracao("DOCX", textoCompleto.toString(), List.copyOf(blocos),
                Map.of("paragrafosETabelas", blocos.size()));
    }
}
