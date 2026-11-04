package br.com.treinos.api.push;

import br.com.treinos.api.push.PushDoExpo.Grupo;
import br.com.treinos.api.push.PushDoExpo.Mensagem;
import br.com.treinos.api.push.PushRepositorio.Reservado;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regras do push que não precisam de banco nem de servidor: o corte das chamadas ao Expo e o endereço exigido. */
class PushUnitarioTest {

    private static Grupo grupo(int tokens) {
        Reservado envio = new Reservado(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 0);
        List<String> lista = new ArrayList<>();
        for (int i = 0; i < tokens; i++) {
            lista.add("ExponentPushToken[" + UUID.randomUUID() + "]");
        }
        return new Grupo(envio, lista);
    }

    @Test
    void asMensagensDeUmMesmoEnvioNuncaSeparamEntreDuasChamadas() {
        // 98 envios de 1 mensagem e depois um de 5: 98 + 5 passa de 100, então o de 5 vai inteiro para a chamada seguinte.
        List<Grupo> grupos = new ArrayList<>(Stream.generate(() -> grupo(1)).limit(98).toList());
        Grupo cinco = grupo(5);
        grupos.add(cinco);
        grupos.add(grupo(1));

        List<List<Mensagem>> chamadas = PushDoExpo.emChamadas(grupos);

        assertThat(chamadas).hasSize(2);
        assertThat(chamadas).allSatisfy(c -> assertThat(c.size()).isLessThanOrEqualTo(ExpoCliente.MAXIMO_POR_CHAMADA));
        assertThat(chamadas.get(0)).hasSize(98);
        assertThat(chamadas.get(1)).hasSize(6);
        // Cada envio aparece em uma chamada só.
        for (Grupo g : grupos) {
            long chamadasDoEnvio = chamadas.stream().filter(c -> c.stream().anyMatch(m -> m.envio().equals(g.envio()))).count();
            assertThat(chamadasDoEnvio).isEqualTo(1);
        }
        assertThat(chamadas.stream().mapToInt(List::size).sum()).isEqualTo(98 + 5 + 1);
    }

    @Test
    void cabeNoLimiteExatoSemAbrirOutraChamada() {
        List<Grupo> grupos = Stream.generate(() -> grupo(5)).limit(20).toList();
        assertThat(PushDoExpo.emChamadas(grupos)).hasSize(1).first().satisfies(c -> assertThat(c).hasSize(100));
        assertThat(PushDoExpo.emChamadas(List.of())).isEmpty();
    }

    @Test
    void ligadoExigeHttpsMenosParaOServidorLocalDeMentira() {
        assertThatThrownBy(() -> new PushProperties(true, "http://exp.host/--/api/v2/push/send", "", null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("https");
        assertThatThrownBy(() -> new PushProperties(true, "ftp://exp.host/push", "", null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PushProperties(true, "isto nao e um endereco", "", null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatCode(() -> new PushProperties(true, "https://exp.host/--/api/v2/push/send", "", null, null)).doesNotThrowAnyException();
        assertThatCode(() -> new PushProperties(true, null, "", null, null)).as("o padrão é https").doesNotThrowAnyException();
        assertThatCode(() -> new PushProperties(true, "http://127.0.0.1:8099/push/send", "", null, null)).doesNotThrowAnyException();
        assertThatCode(() -> new PushProperties(true, "http://localhost:8099/push/send", "", null, null)).doesNotThrowAnyException();
        // Desligado, o endereço não é conferido (a chave desligada não usa o Expo).
        assertThatCode(() -> new PushProperties(false, "http://exp.host/push", "", null, null)).doesNotThrowAnyException();
    }

    @Test
    void oEnderecoRecusadoNaoVazaOTokenDeAcesso() {
        assertThatThrownBy(() -> new PushProperties(true, "http://exp.host/push", "segredo-de-teste-xyz", null, null))
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("segredo-de-teste-xyz"));
        assertThat(new PushProperties(true, "https://exp.host/push", "segredo-de-teste-xyz", null, null).toString())
                .doesNotContain("segredo-de-teste-xyz");
    }
}
