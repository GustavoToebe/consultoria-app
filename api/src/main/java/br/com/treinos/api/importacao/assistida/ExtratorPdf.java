package br.com.treinos.api.importacao.assistida;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrator nativo para arquivos PDF de prescrição de treinos e dietas.
 * Extrai texto simples de blocos de texto (BT ... ET, Tj, TJ) para análise por regras,
 * e preserva os bytes brutos do PDF para conectores de IA multimodais (Gemini e Claude).
 */
public final class ExtratorPdf {

    // Extrai strings literais (...) Tj ou (...) ' ou (...) "
    private static final Pattern TJ_REGEX = Pattern.compile("\\(([^()\\\\]*(?:\\\\.[^()\\\\]*)*)\\)\\s*(?:Tj|'|\")");
    // Extrai arrays [ (...) -10 (...) ] TJ
    private static final Pattern ARRAY_TJ_REGEX = Pattern.compile("\\[([^\\]]+)\\]\\s*TJ");
    private static final Pattern ITEM_ARRAY_REGEX = Pattern.compile("\\(([^()\\\\]*(?:\\\\.[^()\\\\]*)*)\\)");

    private ExtratorPdf() {
    }

    public static ResultadoExtracao extrair(String nomeArquivo, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return new ResultadoExtracao("PDF", "", List.of(), Map.of());
        }

        StringBuilder textoExtraido = new StringBuilder();
        List<BlocoTexto> blocos = new ArrayList<>();

        try {
            // Conversão de streams de texto para ISO-8859-1 para preservar bytes de texto
            String conteudoPdf = new String(bytes, StandardCharsets.ISO_8859_1);

            // 1. Extração por comandos de texto PDF
            Matcher mArray = ARRAY_TJ_REGEX.matcher(conteudoPdf);
            while (mArray.find()) {
                String arrayConteudo = mArray.group(1);
                Matcher mItem = ITEM_ARRAY_REGEX.matcher(arrayConteudo);
                StringBuilder pedaco = new StringBuilder();
                while (mItem.find()) {
                    pedaco.append(decodificarTextoPdf(mItem.group(1)));
                }
                String linha = pedaco.toString().strip();
                if (!linha.isEmpty()) {
                    textoExtraido.append(linha).append('\n');
                }
            }

            Matcher mTj = TJ_REGEX.matcher(conteudoPdf);
            while (mTj.find()) {
                String pedaco = decodificarTextoPdf(mTj.group(1)).strip();
                if (!pedaco.isEmpty()) {
                    textoExtraido.append(pedaco).append('\n');
                }
            }

            // Se o PDF tinha texto extraído, segmenta em blocos
            String textoFinal = textoExtraido.toString();
            if (!textoFinal.isBlank()) {
                String[] linhas = textoFinal.split("\\R");
                StringBuilder blocoAtual = new StringBuilder();
                int numBloco = 1;
                for (String lin : linhas) {
                    if (lin.isBlank()) {
                        if (blocoAtual.length() > 0) {
                            blocos.add(new BlocoTexto("Página/Seção " + numBloco, blocoAtual.toString().strip(),
                                    nomeArquivo, numBloco++));
                            blocoAtual.setLength(0);
                        }
                    } else {
                        blocoAtual.append(lin).append('\n');
                    }
                }
                if (blocoAtual.length() > 0) {
                    blocos.add(new BlocoTexto("Página/Seção " + numBloco, blocoAtual.toString().strip(),
                            nomeArquivo, numBloco));
                }
            } else {
                // Caso não tenha texto simples no fluxo (ex: texto compactado com FlateDecode),
                // o bloco carrega aviso e a extração multimodal da IA (Gemini/Claude) fará a leitura nativa do PDF
                blocos.add(new BlocoTexto("PDF Multimodal", "[Documento PDF com layout original]", nomeArquivo, 1));
            }
        } catch (Exception e) {
            // Preserva o que conseguiu
        }

        return new ResultadoExtracao("PDF", textoExtraido.toString(), List.copyOf(blocos),
                Map.of("tamanhoBytes", bytes.length, "pdfDisponivel", true));
    }

    private static String decodificarTextoPdf(String textoBruto) {
        if (textoBruto == null) return "";
        return textoBruto
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t")
                .replace("\\(", "(")
                .replace("\\)", ")")
                .replace("\\\\", "\\");
    }
}
