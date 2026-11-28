package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Nas regras só o cabeçalho do documento dá nome; sem ele o nome fica nulo e a origem diz o que sobrou. */
class InterpretadorPorRegrasOrigemDoNomeTest {

    private final InterpretadorPorRegras regras = new InterpretadorPorRegras();

    private ResultadoInterpretacao.PropostaGrupo ler(String nomeArquivo, String formato, String texto) {
        ContextoIa contexto = new ContextoIa(nomeArquivo, formato, List.of(new BlocoTexto("Geral", texto, nomeArquivo, 1)),
                texto, List.of(), Map.of());
        return regras.interpretar(contexto).grupos().getFirst();
    }

    @Test
    void cabecalhoDoDocumentoEConteudo() {
        ResultadoInterpretacao.PropostaGrupo g = ler("Treino - Outro Nome.pdf", "PDF", "Aluno: Carla Ficticia\nPeso: 61 kg\n");
        assertThat(g.nomeAluno()).isEqualTo("Carla Ficticia");
        assertThat(g.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.CONTEUDO);
    }

    @Test
    void doisArquivosSemNomeNoTextoComOMesmoNomeDeArquivoFicamSemNome() {
        for (int i = 0; i < 2; i++) {
            ResultadoInterpretacao.PropostaGrupo g = ler("Treino - Maria Ficticia.pdf", "PDF", "Treino A\n1. Supino 3x10\n");
            assertThat(g.nomeAluno()).isNull();
            assertThat(g.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
            assertThat(g.identificadorOrigem()).isEqualTo("Treino - Maria Ficticia.pdf");
        }
    }

    @Test
    void doisTextosColadosComOTituloPadraoFicamSemNome() {
        for (int i = 0; i < 2; i++) {
            ResultadoInterpretacao.PropostaGrupo g = ler("Texto livre do WhatsApp", "TEXTO_LIVRE", "Treino A\n1. Supino 3x10\n");
            assertThat(g.nomeAluno()).isNull();
            assertThat(g.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.TITULO_DO_TEXTO);
        }
        // O título que o treinador digitou no texto colado conta como nome de arquivo, não como conteúdo.
        ResultadoInterpretacao.PropostaGrupo digitado = ler("Joana Ficticia", "TEXTO_LIVRE", "Treino A\n1. Supino 3x10\n");
        assertThat(digitado.nomeAluno()).isNull();
        assertThat(digitado.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
    }

    @Test
    void semNadaQueParecaNomeEAusente() {
        ResultadoInterpretacao.PropostaGrupo g = ler("2026.pdf", "PDF", "Treino A\n1. Supino 3x10\n");
        assertThat(g.nomeAluno()).isNull();
        assertThat(g.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.AUSENTE);
    }
}
