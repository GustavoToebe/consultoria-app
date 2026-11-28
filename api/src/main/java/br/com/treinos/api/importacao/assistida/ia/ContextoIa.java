package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;

import java.util.List;
import java.util.Map;

/**
 * Contexto dos interpretadores. {@code blocos} e {@code nomeArquivo} só servem ao interpretador local (regras);
 * um conector externo só pode usar {@code textoParaProvedor} (o texto extraído inteiro, com CPF, e-mail, telefone
 * e CEP; só sai com {@code treinos.importacao.ia.enviar-dados-ao-provedor}), a metodologia, os apelidos e os
 * nomes da biblioteca da consultoria (exercícios e alimentos: não são dado pessoal). {@code arquivo} (o PDF ou a imagem
 * em base64) só existe quando o {@link RoteadorInterpretadorIa#comArquivoSeCouber} libera, e só o conector do Claude o
 * lê. Nunca o nome do arquivo.
 */
public record ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos, String textoParaProvedor,
                         List<String> metodosConsultoria,
                         Map<String, String> apelidosConhecidos,
                         List<String> exerciciosDaBiblioteca, List<String> alimentosDaBiblioteca,
                         ArquivoOriginal arquivo) {

    /**
     * O arquivo como ele vai ao provedor: o tipo vem da lista fixa do formato (nunca do envio) e os bytes em base64 sem
     * quebra de linha. O {@code toString} não mostra os bytes.
     */
    public record ArquivoOriginal(String tipoDeMidia, String base64) {
        public boolean pdf() {
            return "application/pdf".equals(tipoDeMidia);
        }

        @Override
        public String toString() {
            return "ArquivoOriginal[tipoDeMidia=" + tipoDeMidia + "]";
        }
    }

    public ContextoIa {
        exerciciosDaBiblioteca = exerciciosDaBiblioteca == null ? List.of() : List.copyOf(exerciciosDaBiblioteca);
        alimentosDaBiblioteca = alimentosDaBiblioteca == null ? List.of() : List.copyOf(alimentosDaBiblioteca);
    }

    public ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos, String textoParaProvedor,
                      List<String> metodosConsultoria, Map<String, String> apelidosConhecidos,
                      List<String> exerciciosDaBiblioteca, List<String> alimentosDaBiblioteca) {
        this(nomeArquivo, formato, blocos, textoParaProvedor, metodosConsultoria, apelidosConhecidos,
                exerciciosDaBiblioteca, alimentosDaBiblioteca, null);
    }

    /** Sem os nomes da biblioteca: quem não os conhece (ou só usa as regras locais) segue assim. */
    public ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos, String textoParaProvedor,
                      List<String> metodosConsultoria, Map<String, String> apelidosConhecidos) {
        this(nomeArquivo, formato, blocos, textoParaProvedor, metodosConsultoria, apelidosConhecidos,
                List.of(), List.of(), null);
    }

    public ContextoIa comBiblioteca(List<String> exercicios, List<String> alimentos) {
        return new ContextoIa(nomeArquivo, formato, blocos, textoParaProvedor, metodosConsultoria,
                apelidosConhecidos, exercicios, alimentos, arquivo);
    }

    ContextoIa comArquivo(ArquivoOriginal novo) {
        return new ContextoIa(nomeArquivo, formato, blocos, textoParaProvedor, metodosConsultoria,
                apelidosConhecidos, exerciciosDaBiblioteca, alimentosDaBiblioteca, novo);
    }

    public ContextoIa semArquivo() {
        return arquivo == null ? this : comArquivo(null);
    }

    @Override
    public String toString() {
        return "ContextoIa[formato=" + formato + ", blocos=" + (blocos == null ? 0 : blocos.size())
                + ", arquivo=" + (arquivo != null) + "]";
    }
}
