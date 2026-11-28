package br.com.treinos.api.importacao.assistida.ia;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** D1: o portão do arquivo. Os bytes só chegam ao Claude com as duas chaves e texto incompleto. Só bytes fictícios. */
class RoteadorInterpretadorIaArquivoTest {

    private static final byte[] BYTES = "%PDF-1.4 ficticio".getBytes(StandardCharsets.US_ASCII);

    private final InterpretadorGemini gemini = mock(InterpretadorGemini.class);
    private final InterpretadorClaude claude = mock(InterpretadorClaude.class);
    private final InterpretadorPorRegras regras = new InterpretadorPorRegras();

    private static ConfiguracaoIaImportacao config(String provedor, boolean dados, boolean arquivo) {
        ConfiguracaoIaImportacao c = new ConfiguracaoIaImportacao();
        c.setProvedor(provedor);
        c.setGeminiApiKey("chave-ficticia-gemini");
        c.setClaudeApiKey("chave-ficticia-claude");
        c.setEnviarDadosAoProvedor(dados);
        c.setEnviarArquivoAoProvedor(arquivo);
        return c;
    }

    private static ContextoIa contexto(String formato, String texto) {
        return new ContextoIa("arquivo-ficticio.pdf", formato, List.of(), texto, List.of(), Map.of());
    }

    private RoteadorInterpretadorIa roteador(ConfiguracaoIaImportacao c) {
        return new RoteadorInterpretadorIa(c, gemini, claude, regras);
    }

    @Test
    void chaveDoArquivoNasceDesligadaEOEuSoLigaComTudo() {
        assertThat(new ConfiguracaoIaImportacao().isEnviarArquivoAoProvedor()).isFalse();
        assertThat(new ConfiguracaoIaImportacao().arquivoVaiAoProvedor()).isFalse();
        assertThat(roteador(config("claude", true, true)).arquivoVaiAoProvedor()).isTrue();
        assertThat(roteador(config("claude", false, true)).arquivoVaiAoProvedor()).isFalse();
        assertThat(roteador(config("claude", true, false)).arquivoVaiAoProvedor()).isFalse();
        assertThat(roteador(config("gemini", true, true)).arquivoVaiAoProvedor()).isFalse();
        assertThat(roteador(config("regras", true, true)).arquivoVaiAoProvedor()).isFalse();
        ConfiguracaoIaImportacao semChave = config("claude", true, true);
        semChave.setClaudeApiKey("");
        assertThat(roteador(semChave).arquivoVaiAoProvedor()).isFalse();
    }

    @Test
    void portaoSoAbreComCoberturaIncompletaFormatoAceitoETamanhoDentroDoTeto() {
        RoteadorInterpretadorIa r = roteador(config("claude", true, true));

        ContextoIa pdf = r.comArquivoSeCouber(contexto("PDF", ""), BYTES, "SEM_TEXTO");
        assertThat(pdf.arquivo().tipoDeMidia()).isEqualTo("application/pdf");
        assertThat(pdf.arquivo().base64()).isEqualTo(Base64.getEncoder().encodeToString(BYTES));
        assertThat(r.comArquivoSeCouber(contexto("PDF", "x"), BYTES, "PARCIAL").arquivo()).isNotNull();
        assertThat(r.comArquivoSeCouber(contexto("JPG", ""), BYTES, "SEM_TEXTO").arquivo().tipoDeMidia())
                .isEqualTo("image/jpeg");
        assertThat(r.comArquivoSeCouber(contexto("PNG", ""), BYTES, "SEM_TEXTO").arquivo().tipoDeMidia())
                .isEqualTo("image/png");

        assertThat(r.comArquivoSeCouber(contexto("PDF", "x"), BYTES, "COMPLETA").arquivo()).isNull();
        assertThat(r.comArquivoSeCouber(contexto("PDF", ""), BYTES, null).arquivo()).isNull();
        assertThat(r.comArquivoSeCouber(contexto("DOCX", ""), BYTES, "SEM_TEXTO").arquivo()).isNull();
        assertThat(r.comArquivoSeCouber(contexto("PDF", ""), new byte[0], "SEM_TEXTO").arquivo()).isNull();
        assertThat(r.comArquivoSeCouber(contexto("PDF", ""),
                new byte[RoteadorInterpretadorIa.BYTES_MAXIMOS_DO_ARQUIVO + 1], "SEM_TEXTO").arquivo()).isNull();
        // Chave do arquivo desligada: o comportamento de hoje, sem bytes.
        assertThat(roteador(config("claude", true, false)).comArquivoSeCouber(contexto("PDF", ""), BYTES, "SEM_TEXTO")
                .arquivo()).isNull();
    }

    @Test
    void claudeRecebeOArquivoEMarcaEnviadoComoArquivo() {
        when(claude.interpretar(any())).thenReturn(new ResultadoInterpretacao(List.of(), List.of()));
        RoteadorInterpretadorIa r = roteador(config("claude", true, true));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = r.interpretarComModo(
                r.comArquivoSeCouber(contexto("PDF", ""), BYTES, "SEM_TEXTO"));

        ArgumentCaptor<ContextoIa> enviado = ArgumentCaptor.forClass(ContextoIa.class);
        verify(claude).interpretar(enviado.capture());
        assertThat(enviado.getValue().arquivo()).isNotNull();
        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.enviadoComoArquivo()).isTrue();
    }

    @Test
    void semAChaveDoArquivoOClaudeNaoRecebeBytesMesmoSeOContextoTrouxer() {
        when(claude.interpretar(any())).thenReturn(new ResultadoInterpretacao(List.of(), List.of()));
        ContextoIa comBytes = contexto("PDF", "Supino 3x10")
                .comArquivo(new ContextoIa.ArquivoOriginal("application/pdf", "AAAA"));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador(config("claude", true, false))
                .interpretarComModo(comBytes);

        ArgumentCaptor<ContextoIa> enviado = ArgumentCaptor.forClass(ContextoIa.class);
        verify(claude).interpretar(enviado.capture());
        assertThat(enviado.getValue().arquivo()).isNull();
        assertThat(exec.enviadoComoArquivo()).isFalse();
    }

    @Test
    void geminiNuncaRecebeOArquivo() {
        when(gemini.interpretar(any())).thenReturn(new ResultadoInterpretacao(List.of(), List.of()));
        ContextoIa comBytes = contexto("PDF", "Supino 3x10")
                .comArquivo(new ContextoIa.ArquivoOriginal("application/pdf", "AAAA"));

        roteador(config("gemini", true, true)).interpretarComModo(comBytes);

        ArgumentCaptor<ContextoIa> enviado = ArgumentCaptor.forClass(ContextoIa.class);
        verify(gemini).interpretar(enviado.capture());
        assertThat(enviado.getValue().arquivo()).isNull();
        verifyNoInteractions(claude);
    }

    @Test
    void envioDeDadosDesligadoNadaSaiNemComAChaveDoArquivo() {
        RoteadorInterpretadorIa r = roteador(config("claude", false, true));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = r.interpretarComModo(
                r.comArquivoSeCouber(contexto("PDF", ""), BYTES, "SEM_TEXTO"));

        assertThat(exec.modoEfetivo()).isEqualTo("REGRAS");
        assertThat(exec.enviadoComoArquivo()).isFalse();
        verifyNoInteractions(claude, gemini);
    }

    @Test
    void documentoGrandeEmPartesNaoLevaOArquivo() {
        when(claude.interpretarTrecho(any(), anyString())).thenReturn(new ResultadoInterpretacao(List.of(), List.of()));
        StringBuilder texto = new StringBuilder();
        for (int p = 1; texto.length() <= RoteadorInterpretadorIa.CARACTERES_PARA_DIVIDIR_NA_IDA; p++) {
            texto.append("=== PÁGINA ").append(p).append(" ===\n").append("Supino 3x10 ficticio\n".repeat(500));
        }
        ContextoIa comBytes = contexto("PDF", texto.toString())
                .comArquivo(new ContextoIa.ArquivoOriginal("application/pdf", "AAAA"));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador(config("claude", true, true))
                .interpretarComModo(comBytes);

        ArgumentCaptor<ContextoIa> enviado = ArgumentCaptor.forClass(ContextoIa.class);
        verify(claude, atLeast(2)).interpretarTrecho(enviado.capture(), anyString());
        assertThat(enviado.getAllValues()).allSatisfy(c -> assertThat(c.arquivo()).isNull());
        assertThat(exec.enviadoComoArquivo()).isFalse();
    }
}
