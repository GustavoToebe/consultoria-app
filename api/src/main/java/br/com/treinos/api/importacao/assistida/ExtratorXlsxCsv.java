package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.completa.LeituraDasAbas;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Extrator para planilhas XLSX e CSV aproveitando o LeituraDasAbas existente.
 * Transforma cada aba em blocos estruturados preservando nome da aba, colunas e linhas. O texto que vai ao provedor
 * de IA marca a linha de títulos de cada aba ("Colunas: ..."), achada pela mesma detecção da planilha completa, para
 * a IA saber o nome de cada coluna; os blocos (que as regras locais leem) ficam sem a marca.
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
                StringBuilder paraProvedor = new StringBuilder();
                String titulo = "=== ABA: " + aba.nome() + " ===\n";
                conteudoAba.append(titulo);
                paraProvedor.append(titulo);
                boolean temConteudo = false;
                int posicaoDoCabecalho = ReconhecimentoDeAbas.posicaoDoCabecalho(aba.linhas());

                for (int i = 0; i < aba.linhas().size(); i++) {
                    Linha linha = aba.linhas().get(i);
                    List<String> valores = new ArrayList<>();
                    for (LeitorDePlanilha.Celula c : linha.celulas()) {
                        String txt = c != null ? c.texto() : "";
                        valores.add(txt != null ? txt.strip() : "");
                    }
                    // Ignora linhas totalmente vazias
                    if (valores.stream().allMatch(String::isEmpty)) {
                        continue;
                    }
                    temConteudo = true;
                    String linhaFormatada = String.join(" | ", valores);
                    conteudoAba.append(linhaFormatada).append('\n');
                    paraProvedor.append(i == posicaoDoCabecalho ? "Colunas: " : "").append(linhaFormatada).append('\n');
                }

                if (temConteudo) {
                    String textoAba = conteudoAba.toString();
                    textoCompleto.append(paraProvedor).append('\n');
                    blocos.add(new BlocoTexto("Aba: " + aba.nome(), textoAba, nomeArquivo, aba.indice() + 1));
                }
            }
        } catch (Exception e) {
            throw new ExtracaoRecusadaException("PLANILHA_CORROMPIDA");
        }

        String cobertura = blocos.isEmpty() ? "SEM_TEXTO" : "COMPLETA";
        return new ResultadoExtracao("PLANILHA", textoCompleto.toString(), List.copyOf(blocos),
                Map.of("cobertura", cobertura, "abas", blocos.size(), "blocos", blocos.size()));
    }
}
