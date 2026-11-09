package br.com.treinos.api.importacao.assistida.ia;

import org.springframework.stereotype.Component;

/**
 * Roteador dos interpretadores de IA: seleciona o provedor configurado (Gemini / Claude / Regras)
 * e garante fallback determinístico transparente para regras caso as chaves não estejam disponíveis
 * ou a chamada externa falhe.
 */
@Component
public class RoteadorInterpretadorIa {

    private final ConfiguracaoIaImportacao config;
    private final InterpretadorGemini gemini;
    private final InterpretadorClaude claude;
    private final InterpretadorPorRegras regras;

    public RoteadorInterpretadorIa(ConfiguracaoIaImportacao config,
                                  InterpretadorGemini gemini,
                                  InterpretadorClaude claude,
                                  InterpretadorPorRegras regras) {
        this.config = config;
        this.gemini = gemini;
        this.claude = claude;
        this.regras = regras;
    }

    public ResultadoInterpretacao interpretar(ContextoIa contexto) {
        String provedor = config.getProvedor();

        if ("gemini".equals(provedor) && config.temChaveGemini()) {
            try {
                return gemini.interpretar(contexto);
            } catch (Exception e) {
                // Fallback gracioso para regras em caso de falha de rede/cota
                return regras.interpretar(contexto);
            }
        }

        if ("claude".equals(provedor) && config.temChaveClaude()) {
            try {
                return claude.interpretar(contexto);
            } catch (Exception e) {
                // Fallback gracioso para regras em caso de falha de rede/cota
                return regras.interpretar(contexto);
            }
        }

        // Padrão determinístico: regras locais
        return regras.interpretar(contexto);
    }
}
