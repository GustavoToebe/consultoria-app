package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.BadRequestException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Respostas da prévia (leitura, recusa sem eco e hash) e a busca de exercícios citados do "Desfazer". Sem banco. */
class RespostasDaPlanilhaTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void vazioEhSemResposta() {
        assertThat(RespostasDaPlanilha.ler(null, JSON)).isEqualTo(RespostasDaPlanilha.VAZIAS);
        assertThat(RespostasDaPlanilha.ler("  ", JSON)).isEqualTo(RespostasDaPlanilha.VAZIAS);
    }

    @Test
    void leAsRespostas() {
        RespostasDaPlanilha r = RespostasDaPlanilha.ler("""
                {"abas":[{"indice":8,"tipo":"IGNORAR"},{"indice":1,"tipo":"PESOS"}],
                 "ligacoes":[{"aba":6,"linha":4,"linhaDaMae":2}],
                 "exercicios":[{"nome":"Remada fictícia","acao":"CRIAR"}],
                 "suplementos":[{"nome":"Creatina","destino":"SUPLEMENTO"}]}""", JSON);
        assertThat(r.tiposDasAbas()).containsEntry(8, TipoDeAba.DESCONHECIDA).containsEntry(1, TipoDeAba.PESOS);
        assertThat(r.ligacoesPorLinha()).containsEntry("6:4", 2);
        assertThat(r.exerciciosPorChave()).containsKey(CasamentoDeNomes.chave("remada ficticia"));
        assertThat(r.suplementosPorNome()).containsEntry("creatina", "SUPLEMENTO");
        assertThat(r.alimentos()).isEmpty();
    }

    @Test
    void respostaInvalidaEhRecusadaSemRepetirOConteudo() {
        for (String ruim : List.of("{", "{\"abas\":[{\"indice\":1,\"tipo\":\"XPTO\"}]}",
                "{\"exercicios\":[{\"nome\":\"Remada\",\"acao\":\"BIBLIOTECA\"}]}",
                "{\"suplementos\":[{\"nome\":\"Remédio fictício\",\"destino\":\"OUTRO\"}]}")) {
            assertThatThrownBy(() -> RespostasDaPlanilha.ler(ruim, JSON)).isInstanceOf(BadRequestException.class)
                    .hasMessage("As respostas da importação são inválidas.");
        }
    }

    @Test
    void hashMudaComOArquivoEComAsRespostas() {
        byte[] a = "arquivo fictício".getBytes(StandardCharsets.UTF_8);
        byte[] b = "outro arquivo fictício".getBytes(StandardCharsets.UTF_8);
        RespostasDaPlanilha r = new RespostasDaPlanilha(List.of(new RespostasDaPlanilha.TipoDaAba(0, "IGNORAR")), null,
                null, null, null);
        String base = RespostasDaPlanilha.hash(a, RespostasDaPlanilha.VAZIAS, JSON);
        assertThat(RespostasDaPlanilha.hash(a, RespostasDaPlanilha.VAZIAS, JSON)).isEqualTo(base).hasSize(64);
        assertThat(RespostasDaPlanilha.hash(b, RespostasDaPlanilha.VAZIAS, JSON)).isNotEqualTo(base);
        assertThat(RespostasDaPlanilha.hash(a, r, JSON)).isNotEqualTo(base);
    }

    @Test
    void desfazerAchaOsExerciciosCitadosNosPlanos() {
        UUID usado = UUID.randomUUID();
        UUID livre = UUID.randomUUID();
        UUID outro = UUID.randomUUID();
        Set<UUID> usados = new HashSet<>();
        DesfazerDaPlanilha.citados(List.of(
                "{\"sessoes\":[{\"exercicios\":[{\"exercicioId\": \"" + usado + "\",\"nome\":\"x\"}]}]}",
                "{\"exercicioId\":\"" + outro + "\"}", "{\"observacao\":\"" + livre + "\"}"), Set.of(usado, livre), usados);
        assertThat(usados).containsExactly(usado);
    }
}
