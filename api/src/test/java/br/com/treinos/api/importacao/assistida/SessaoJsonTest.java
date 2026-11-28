package br.com.treinos.api.importacao.assistida;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Marca da leitura e alunos criados no progresso da sessão. */
class SessaoJsonTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private ImportacaoSessao sessao() {
        return new ImportacaoSessao(UUID.randomUUID());
    }

    @Test
    void marcaDaLeituraSoReconheceALeituraAtual() {
        ImportacaoSessao s = sessao();
        UUID primeira = UUID.randomUUID();
        UUID segunda = UUID.randomUUID();
        assertThat(SessaoJson.marcaDaLeitura(json, s)).isNull();
        assertThat(SessaoJson.mesmaLeitura(json, s, primeira)).isFalse();

        SessaoJson.marcarNovaLeitura(json, s, primeira, 2);
        assertThat(SessaoJson.marcaDaLeitura(json, s)).isEqualTo(primeira);
        assertThat(SessaoJson.mesmaLeitura(json, s, primeira)).isTrue();

        SessaoJson.marcarNovaLeitura(json, s, segunda, 1);
        assertThat(SessaoJson.mesmaLeitura(json, s, primeira)).isFalse();
        assertThat(SessaoJson.mesmaLeitura(json, s, segunda)).isTrue();
        assertThat(SessaoJson.mesmaLeitura(json, s, null)).isFalse();

        s.atualizarResultados(null, null, "{ilegivel");
        assertThat(SessaoJson.marcaDaLeitura(json, s)).isNull();
        assertThat(SessaoJson.mesmaLeitura(json, s, segunda)).isFalse(); // falha fechada
    }

    @Test
    void novaLeituraLimpaOErroEOInicioDaAnteriorEAEsperaNaFilaNaoEPresa() {
        ImportacaoSessao s = sessao();
        s.atualizarEstado("PROCESSANDO");
        SessaoJson.marcarFlagProgresso(json, s, "erroProcessamento", true);
        SessaoJson.textoNoProgresso(json, s, "processandoDesde", Instant.now().minusSeconds(86_400 * 2).toString());
        assertThat(SessaoJson.estadoEfetivo(json, s)).isEqualTo("ERRO");

        SessaoJson.marcarNovaLeitura(json, s, UUID.randomUUID(), 3);
        // Na fila (sem processandoDesde) não conta como presa, por mais que espere.
        assertThat(SessaoJson.estadoEfetivo(json, s)).isEqualTo("PROCESSANDO");
        assertThat(s.getProgressoJson()).contains("\"aLer\":3").contains("\"lidos\":0");

        SessaoJson.leituraComecou(json, s);
        assertThat(s.getProgressoJson()).contains("processandoDesde");
        assertThat(SessaoJson.estadoEfetivo(json, s)).isEqualTo("PROCESSANDO");
    }

    @Test
    void alunosCriadosAcumulaOsIdsEFalhaFechadoComJsonIlegivel() {
        ImportacaoSessao s = sessao();
        assertThat(SessaoJson.alunosCriados(json, s)).isEmpty();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        SessaoJson.registrarAlunoCriado(json, s, a);
        SessaoJson.registrarAlunoCriado(json, s, b);
        assertThat(SessaoJson.alunosCriados(json, s)).containsExactly(a, b);

        s.atualizarResultados(null, null, "{ilegivel");
        assertThatThrownBy(() -> SessaoJson.alunosCriados(json, s)).isInstanceOf(RuntimeException.class);
    }
}
