package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Regras do lote que o banco não deixa simular de ponta a ponta (corrida entre a leitura das origens e a trava). Dados fictícios. */
@ExtendWith(MockitoExtension.class)
class PlaylistsServiceTest {

    @Mock private ComunidadePlaylistRepository playlists;
    @Mock private ComunidadeAulaRepository aulas;

    private static ComunidadeAula aulaNaPlaylist(UUID id, UUID playlistId) {
        ComunidadeAula a = new ComunidadeAula("Aulão fictício", null, "https://exemplo.test/v", playlistId, 3, true);
        ReflectionTestUtils.setField(a, "id", id);
        return a;
    }

    private ComunidadePlaylist destinoTravado(UUID destino) {
        ComunidadePlaylist travada = new ComunidadePlaylist("Destino fictício", 0);
        ReflectionTestUtils.setField(travada, "id", destino);
        when(playlists.travarTodas(anyCollection())).thenReturn(List.of(travada));
        return travada;
    }

    @Test
    void loteComOrigemQueMudouDepoisDaLeituraDa409SemMoverNada() {
        UUID aulaId = UUID.randomUUID();
        UUID origemNova = UUID.randomUUID();
        UUID destino = UUID.randomUUID();
        // A leitura escalar (antes da trava) não viu origem; sob a trava o aulão já estava numa playlist que ninguém travou.
        when(aulas.playlistsDosAuloes(anyCollection())).thenReturn(List.of());
        destinoTravado(destino);
        ComunidadeAula aula = aulaNaPlaylist(aulaId, origemNova);
        when(aulas.findAllById(anyCollection())).thenReturn(List.of(aula));

        PlaylistsService service = new PlaylistsService(playlists, aulas);
        assertThatThrownBy(() -> service.moverEmLote(List.of(aulaId), destino))
                .isInstanceOfSatisfying(ConflictException.class, e -> assertThat(e.getCodigo()).isEqualTo("CONFLITO_EDICAO"));
        assertThat(aula.getPlaylistId()).isEqualTo(origemNova);
        verify(aulas, never()).maiorOrdemDaPlaylist(destino);
    }

    @Test
    void loteComOrigemJaTravadaSegue() {
        UUID aulaId = UUID.randomUUID();
        UUID origem = UUID.randomUUID();
        UUID destino = UUID.randomUUID();
        when(aulas.playlistsDosAuloes(anyCollection())).thenReturn(List.of(origem));
        destinoTravado(destino);
        ComunidadeAula aula = aulaNaPlaylist(aulaId, origem);
        when(aulas.findAllById(anyCollection())).thenReturn(List.of(aula));
        when(aulas.maiorOrdemDaPlaylist(destino)).thenReturn(-1);

        new PlaylistsService(playlists, aulas).moverEmLote(List.of(aulaId), destino);
        assertThat(aula.getPlaylistId()).isEqualTo(destino);
        assertThat(aula.getOrdem()).isZero();
    }
}
