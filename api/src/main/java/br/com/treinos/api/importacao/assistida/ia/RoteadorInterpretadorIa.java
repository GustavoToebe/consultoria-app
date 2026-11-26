package br.com.treinos.api.importacao.assistida.ia;

import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Roteador dos interpretadores de IA: seleciona o provedor configurado (Gemini / Claude / Regras)
 * e garante fallback determinístico transparente para regras caso as chaves não estejam disponíveis,
 * o envio esteja desligado ou a chamada externa falhe.
 */
@Component
public class RoteadorInterpretadorIa {

    /** Uma chamada e, só se a falha for passageira, mais uma. */
    static final int TENTATIVAS = 2;
    static final Duration ESPERA_ENTRE_TENTATIVAS = Duration.ofSeconds(2);
    /**
     * Quanto um arquivo pode levar na pior das hipóteses: as tentativas no provedor mais lento (o Claude, 5 min cada),
     * a espera entre elas e uma folga para extrair o texto e calcular as dúvidas. O corte da sessão parte daqui.
     */
    public static final Duration TEMPO_MAXIMO_POR_ARQUIVO = InterpretadorClaude.TIMEOUT_HTTP.multipliedBy(TENTATIVAS)
            .plus(ESPERA_ENTRE_TENTATIVAS.multipliedBy(TENTATIVAS - 1)).plusSeconds(60);

    public record ExecucaoInterpretacao(ResultadoInterpretacao resultado, String modoEfetivo,
                                        String provedorConfigurado, boolean fallbackParaRegras,
                                        String motivoFallback) {
    }

    private final ConfiguracaoIaImportacao config;
    private final InterpretadorGemini gemini;
    private final InterpretadorClaude claude;
    private final InterpretadorPorRegras regras;
    // Só o teste mexe: sem espera de verdade entre as tentativas.
    Duration espera = ESPERA_ENTRE_TENTATIVAS;

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
            return new ExecucaoInterpretacao(regras.comDuvidasDaBiblioteca(interpretarComNovaTentativa(conector, paraIa),
                    contexto), "IA", provedor, false, null);
        } catch (DecodificadorDaProposta.RespostaCortada e) {
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, true, "RESPOSTA_CORTADA");
        } catch (Exception e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, true, "ERRO_PROVEDOR");
        }
    }

    private ResultadoInterpretacao interpretarComNovaTentativa(InterpretadorIa conector, ContextoIa contexto)
            throws InterruptedException {
        for (int tentativa = 1; ; tentativa++) {
            try {
                return conector.interpretar(contexto);
            } catch (FalhaPassageiraDoProvedor e) {
                if (tentativa >= TENTATIVAS) {
                    throw e;
                }
                Thread.sleep(espera); // interrompida (sessão cortada): sai sem tentar de novo
            }
        }
    }
}
