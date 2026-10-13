package br.com.treinos.api.consultoria;

import br.com.treinos.api.web.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

class RepeticoesDaMetodologiaTest {

    private static ConfiguracaoConsultoria com(Map<String, ConfiguracaoConsultoria.Repeticoes> repeticoes) {
        ConfiguracaoConsultoria p = ConfiguracaoConsultoria.padrao();
        return new ConfiguracaoConsultoria(p.tiposSerie(), p.tipoTrabalho(), p.tipoPreparacao(), p.regraPreparacao(),
                p.arredondamentoKg(), p.instrucoesTreino(), p.rodapePdf(), repeticoes);
    }

    @Test
    void padraoTrazAsFaixasDoSaraivaEPassaNaValidacao() {
        ConfiguracaoConsultoria p = ConfiguracaoConsultoria.padrao();
        assertThat(p.repeticoes()).containsEntry("FS", new ConfiguracaoConsultoria.Repeticoes(3, 3))
                .containsEntry("WS", new ConfiguracaoConsultoria.Repeticoes(3, 6));
        assertThatNoException().isThrownBy(() -> MarcaService.validar(p));
    }

    @Test
    void semFaixasContinuaValida() {
        assertThatNoException().isThrownBy(() -> MarcaService.validar(com(null)));
        assertThatNoException().isThrownBy(() -> MarcaService.validar(com(Map.of())));
    }

    @Test
    void recusaTipoForaDaListaEFaixaInvalida() {
        assertThatThrownBy(() -> MarcaService.validar(com(Map.of("Drop set", new ConfiguracaoConsultoria.Repeticoes(8, 10)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> MarcaService.validar(com(Map.of("WS", new ConfiguracaoConsultoria.Repeticoes(6, 3)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> MarcaService.validar(com(Map.of("WS", new ConfiguracaoConsultoria.Repeticoes(3, null)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> MarcaService.validar(com(Map.of("WS", new ConfiguracaoConsultoria.Repeticoes(1, 501)))))
                .isInstanceOf(BadRequestException.class);
    }
}
