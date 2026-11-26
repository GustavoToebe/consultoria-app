package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;

import java.util.List;
import java.util.Map;

/**
 * Contexto dos interpretadores. {@code blocos} e {@code nomeArquivo} só servem ao interpretador local (regras);
 * um conector externo só pode usar {@code textoParaProvedor} (o texto extraído inteiro, com CPF, e-mail, telefone
 * e CEP; só sai com {@code treinos.importacao.ia.enviar-dados-ao-provedor}), a metodologia, os apelidos e os
 * nomes da biblioteca da consultoria (exercícios e alimentos: não são dado pessoal).
 * Nunca o PDF bruto nem o nome do arquivo.
 */
public record ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos, String textoParaProvedor,
                         String objetivo, List<String> metodosConsultoria,
                         Map<String, String> apelidosConhecidos,
                         List<String> exerciciosDaBiblioteca, List<String> alimentosDaBiblioteca) {

    public ContextoIa {
        exerciciosDaBiblioteca = exerciciosDaBiblioteca == null ? List.of() : List.copyOf(exerciciosDaBiblioteca);
        alimentosDaBiblioteca = alimentosDaBiblioteca == null ? List.of() : List.copyOf(alimentosDaBiblioteca);
    }

    /** Sem os nomes da biblioteca: quem não os conhece (ou só usa as regras locais) segue assim. */
    public ContextoIa(String nomeArquivo, String formato, List<BlocoTexto> blocos, String textoParaProvedor,
                      String objetivo, List<String> metodosConsultoria, Map<String, String> apelidosConhecidos) {
        this(nomeArquivo, formato, blocos, textoParaProvedor, objetivo, metodosConsultoria, apelidosConhecidos,
                List.of(), List.of());
    }

    public ContextoIa comBiblioteca(List<String> exercicios, List<String> alimentos) {
        return new ContextoIa(nomeArquivo, formato, blocos, textoParaProvedor, objetivo, metodosConsultoria,
                apelidosConhecidos, exercicios, alimentos);
    }

    @Override
    public String toString() {
        return "ContextoIa[formato=" + formato + ", blocos=" + (blocos == null ? 0 : blocos.size()) + "]";
    }
}
