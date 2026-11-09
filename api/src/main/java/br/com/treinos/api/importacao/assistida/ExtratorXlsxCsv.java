package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.completa.LeituraDasAbas;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Extrator para planilhas XLSX e CSV aproveitando o LeituraDasAbas existente.
 * Transforma cada aba em blocos estruturados preservando nome da aba, colunas e linhas.
 */
public final class ExtratorXlsxCsv {

    private ExtratorXlsxCsv() {
    }

    public static ResultadoExtracao extrair(String nomeArquivo, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return new ResultadoExtracao("PLANILHA", "", List.of(), Map.of());
        }

        StringBuilder textoCompleto = new StringBuilder();
        List<BlocoTexto> blocos = new ArrayList<>();

        try {
            LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeArquivo, bytes);
            for (LeituraDasAbas.AbaLida aba : leitura.abas()) {
                StringBuilder conteudoAba = new StringBuilder();
                conteudoAba.append("=== ABA: ").append(aba.nome()).append(" ===\n");

                for (Linha linha : aba.linhas()) {
                    List<String> valores = new ArrayList<>();
                    for (LeitorDePlanilha.Celula c : linha.celulas()) {
                        String txt = c != null ? c.texto() : "";
                        valores.add(txt != null ? txt.strip() : "");
                    }
                    // Ignora linhas totalmente vazias
                    if (valores.stream().allMatch(String::isEmpty)) {
                        continue;
                    }
                    String linhaFormatada = String.join(" | ", valores);
                    conteudoAba.append(linhaFormatada).append('\n');
                }

                String textoAba = conteudoAba.toString();
                textoCompleto.append(textoAba).append('\n');
                blocos.add(new BlocoTexto("Aba: " + aba.nome(), textoAba, nomeArquivo, aba.indice() + 1));
            }
        } catch (Exception e) {
            // Em caso de erro de leitura de aba, devolve o que foi possível
        }

        return new ResultadoExtracao("PLANILHA", textoCompleto.toString(), List.copyOf(blocos),
                Map.of("abas", blocos.size()));
    }
}
