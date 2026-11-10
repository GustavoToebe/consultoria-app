package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** LGPD fail-closed: nada do arquivo vai a um provedor sem a propriedade explícita. Só valores fictícios. */
class RoteadorInterpretadorIaTest {

    private static final String SENTINELA = "Sentinela Zzyx Fulano";

    private final InterpretadorGemini gemini = mock(InterpretadorGemini.class);
    private final InterpretadorClaude claude = mock(InterpretadorClaude.class);
    private final InterpretadorPorRegras regras = new InterpretadorPorRegras();

    private static ContextoIa contexto() {
        String texto = "Aluno: " + SENTINELA + "\nPeso: 80 kg\n";
        return new ContextoIa("arquivo-secreto.pdf", "PDF", List.of(new BlocoTexto("Geral", texto, "arquivo-secreto.pdf", 1)),
                "Aluno: [NOME]\n", "CADASTROS_E_PLANOS_ATUAIS", List.of(), Map.of());
    }

    private ConfiguracaoIaImportacao config(String provedor, boolean enviar) {
        ConfiguracaoIaImportacao c = new ConfiguracaoIaImportacao();
        c.setProvedor(provedor);
        c.setGeminiApiKey("chave-ficticia-gemini");
        c.setClaudeApiKey("chave-ficticia-claude");
        c.setEnviarDadosAoProvedor(enviar);
        return c;
    }

    @Test
    void padraoNaoEnviaNada() {
        assertThat(new ConfiguracaoIaImportacao().isEnviarDadosAoProvedor()).isFalse();
    }

    @Test
    void semAPropriedadeOProvedorConfiguradoNuncaEChamadoEOValorSentinelaNaoSai() {
        for (String provedor : List.of("gemini", "claude")) {
            RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config(provedor, false), gemini, claude, regras);

            ResultadoInterpretacao r = roteador.interpretar(contexto());

            // Resultado local (regras): o nome saiu do bloco original, que só existe no servidor.
            assertThat(r.grupos().getFirst().nomeAluno().toLowerCase(java.util.Locale.ROOT)).contains("sentinela zzyx");
        }
        verifyNoInteractions(gemini, claude);
    }

    @Test
    void comAPropriedadeLigadaOConectorRecebeOContextoMasFalhaVoltaParaRegras() {
        when(gemini.interpretar(any())).thenThrow(new IllegalStateException("falha fixa"));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regras);

        ResultadoInterpretacao r = roteador.interpretar(contexto());

        verify(gemini).interpretar(any());
        assertThat(r.grupos()).hasSize(1);
    }

    @Test
    void conectorSoEnviaOTextoDoContextoEExigeTexto() {
        ContextoIa c = contexto();
        assertThat(DecodificadorDaProposta.textoParaEnvio(c)).isEqualTo("Aluno: [NOME]\n").doesNotContain("Sentinela");

        ContextoIa semTexto = new ContextoIa("a.pdf", "PDF", List.of(), " ", null, List.of(), Map.of());
        assertThatThrownBy(() -> DecodificadorDaProposta.textoParaEnvio(semTexto)).isInstanceOf(IllegalStateException.class);
    }
}
