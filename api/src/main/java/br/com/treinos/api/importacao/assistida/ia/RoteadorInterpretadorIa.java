package br.com.treinos.api.importacao.assistida.ia;

import org.springframework.stereotype.Component;

/**
 * Roteador dos interpretadores de IA: seleciona o provedor configurado (Gemini / Claude / Regras)
 * e garante fallback determinístico transparente para regras caso as chaves não estejam disponíveis,
 * o envio esteja desligado ou a chamada externa falhe.
 */
@Component
public class RoteadorInterpretadorIa {

    public record ExecucaoInterpretacao(ResultadoInterpretacao resultado, String modoEfetivo,
                                        String provedorConfigurado, boolean fallbackParaRegras,
                                        String motivoFallback) {
    }

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
        return interpretarComModo(contexto).resultado();
    }

    public ExecucaoInterpretacao interpretarComModo(ContextoIa contexto) {
        String provedor = config.getProvedor();
        // Fail-closed (LGPD): sem a chave explícita nada sai do servidor, mesmo com provedor e chave de API.
        if (!config.isEnviarDadosAoProvedor()) {
            String motivo = "regras".equals(provedor) ? null : "ENVIO_DESLIGADO";
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, false, motivo);
        }

        if ("gemini".equals(provedor)) {
            return viaIa(contexto, provedor, config.temChaveGemini(), gemini);
        }

        if ("claude".equals(provedor)) {
            return viaIa(contexto, provedor, config.temChaveClaude(), claude);
        }

        // Padrão determinístico: regras locais
        return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, false, null);
    }

    private ExecucaoInterpretacao viaIa(ContextoIa contexto, String provedor, boolean temChave, InterpretadorIa conector) {
        if (!temChave) {
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, true, "CHAVE_AUSENTE");
        }
        try {
            // Só aqui (depois do fail-closed) a biblioteca vai junto: a IA devolve o nome que já existe nela.
            ContextoIa paraIa = contexto.comBiblioteca(regras.nomesDeExercicios(), regras.nomesDeAlimentos());
            return new ExecucaoInterpretacao(regras.comDuvidasDaBiblioteca(conector.interpretar(paraIa), contexto), "IA",
                    provedor, false, null);
        } catch (DecodificadorDaProposta.RespostaCortada e) {
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, true, "RESPOSTA_CORTADA");
        } catch (Exception e) {
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, true, "ERRO_PROVEDOR");
        }
    }
}
