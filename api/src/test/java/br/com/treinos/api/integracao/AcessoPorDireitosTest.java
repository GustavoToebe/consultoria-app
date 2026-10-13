package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.DireitosLocais;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regra do contrato: liberado = acessoLiberado E (agora − confirmadoEm) ≤ tolerância. */
class AcessoPorDireitosTest {

    private static final Instant AGORA = Instant.parse("2026-10-13T12:00:00Z");

    private static DireitosLocais direitos(boolean liberado, String motivo, Instant confirmadoEm) {
        return new DireitosLocais(UUID.randomUUID(), UUID.randomUUID(), 1, liberado ? "ATIVA" : "BLOQUEADA", liberado, motivo,
                null, "pro", "Profissional", Map.of(), List.of(), confirmadoEm);
    }

    @Test
    void semLinhaFicaLiberado() {
        assertThat(AcessoPorDireitos.avaliar(null, AGORA, 72).liberado()).isTrue();
    }

    @Test
    void liberadoEConfirmadoDentroDaToleranciaLibera() {
        assertThat(AcessoPorDireitos.avaliar(direitos(true, null, AGORA.minus(72, ChronoUnit.HOURS)), AGORA, 72).liberado()).isTrue();
    }

    @Test
    void confirmacaoAlemDaToleranciaBloqueia() {
        var decisao = AcessoPorDireitos.avaliar(direitos(true, null, AGORA.minus(73, ChronoUnit.HOURS)), AGORA, 72);
        assertThat(decisao.liberado()).isFalse();
        assertThat(decisao.motivo()).contains("confirmar o plano");
    }

    @Test
    void acessoNaoLiberadoBloqueiaComOuSemMotivo() {
        var comMotivo = AcessoPorDireitos.avaliar(direitos(false, "Inadimplência", AGORA), AGORA, 72);
        assertThat(comMotivo.liberado()).isFalse();
        assertThat(comMotivo.motivo()).contains("suspenso").contains("Inadimplência");
        assertThat(AcessoPorDireitos.avaliar(direitos(false, " ", AGORA), AGORA, 72).motivo()).contains("suspenso");
    }
}
