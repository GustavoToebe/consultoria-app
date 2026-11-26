package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.EnvioDeEmailException;
import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** O {@code emailEnviado} da troca do e-mail de acesso, sem banco: só conta o aviso ao endereço NOVO. Endereços fictícios. */
class AvisoDeTrocaDeEmailDeAcessoTest {

    private final ConsultoriaRepository consultorias = mock(ConsultoriaRepository.class);
    private final UUID consultoriaId = UUID.randomUUID();

    @SuppressWarnings("unchecked")
    private AvisoDeTrocaDeEmailDeAcesso aviso(EnviadorDeEmail envio) {
        ObjectProvider<EnviadorDeEmail> provedor = mock(ObjectProvider.class);
        when(provedor.getIfAvailable()).thenReturn(envio);
        when(consultorias.findById(consultoriaId)).thenReturn(Optional.of(new Consultoria("Consultoria Fictícia", "fake-" + consultoriaId)));
        return new AvisoDeTrocaDeEmailDeAcesso(provedor, consultorias);
    }

    @Test
    void semEnvioLigadoNaoPreparaNada() {
        assertThat(aviso(null).preparar(consultoriaId, "antigo@exemplo.test", "novo@exemplo.test")).isNull();
    }

    @Test
    void entregueAoProvedorDevolveTrueEMandaOsDoisAvisos() {
        List<String> para = new ArrayList<>();
        var a = aviso(mensagem -> para.add(mensagem.para()));
        assertThat(a.enviar(a.preparar(consultoriaId, "antigo@exemplo.test", "novo@exemplo.test"))).isTrue();
        assertThat(para).containsExactly("antigo@exemplo.test", "novo@exemplo.test");
    }

    @Test
    void falhaNoEnderecoNovoDevolveFalseMesmoSeOAnteriorFoi() {
        var a = aviso(mensagem -> {
            if (mensagem.para().startsWith("novo")) {
                throw new EnvioDeEmailException("Provedor de teste fora do ar.");
            }
        });
        assertThat(a.enviar(a.preparar(consultoriaId, "antigo@exemplo.test", "novo@exemplo.test"))).isFalse();
    }

    @Test
    void falhaNoEnderecoAnteriorNaoImpedeOTrueDoNovo() {
        var a = aviso(mensagem -> {
            if (mensagem.para().startsWith("antigo")) {
                throw new EnvioDeEmailException("Provedor de teste fora do ar.");
            }
        });
        assertThat(a.enviar(a.preparar(consultoriaId, "antigo@exemplo.test", "novo@exemplo.test"))).isTrue();
    }
}
