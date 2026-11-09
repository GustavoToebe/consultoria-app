package br.com.treinos.api.importacao.assistida.ia;

/**
 * Interface comum para conectores de interpretação de importação (Gemini, Claude, Regras).
 */
public interface InterpretadorIa {

    ResultadoInterpretacao interpretar(ContextoIa contexto);

    String nomeProvedor();
}
