package br.com.treinos.api.planos.liberacao;

import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.mobilidade.PlanoMobilidadeRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A rotina de liberação sem banco: a falha de uma consultoria não impede (nem desfaz) a liberação das outras. */
class RotinaDeLiberacaoDePlanosTest {

    private final LocalDate hoje = LocalDate.of(2026, 11, 26);
    private final UUID quebrada = UUID.randomUUID();
    private final UUID sadia = UUID.randomUUID();
    private final UUID plano = UUID.randomUUID();

    private final ConsultoriaRepository consultorias = mock(ConsultoriaRepository.class);
    private final PlanoTreinoRepository treinos = mock(PlanoTreinoRepository.class);
    private final PlanoDietaRepository dietas = mock(PlanoDietaRepository.class);
    private final PlanoMobilidadeRepository mobilidades = mock(PlanoMobilidadeRepository.class);
    private final LiberacaoDePlano liberacao = mock(LiberacaoDePlano.class);
    private final AvisosDePlanoLiberado avisos = mock(AvisosDePlanoLiberado.class);

    private static Consultoria consultoria(UUID id) {
        Consultoria c = mock(Consultoria.class);
        when(c.getId()).thenReturn(id);
        return c;
    }

    @Test
    void falhaDeUmaConsultoriaNaoImpedeAsOutras() {
        Consultoria c1 = consultoria(quebrada);
        Consultoria c2 = consultoria(sadia);
        when(consultorias.findAll()).thenReturn(List.of(c1, c2));
        when(treinos.idsParaLiberar(hoje)).thenAnswer(i -> {
            if (quebrada.equals(TenantContext.get())) {
                throw new IllegalStateException("falha simulada");
            }
            return List.of(plano);
        });
        PlanoTreino p = mock(PlanoTreino.class);
        when(p.isArquivado()).thenReturn(false);
        when(p.getLiberarEm()).thenReturn(hoje);
        when(treinos.travarParaLiberar(plano)).thenReturn(Optional.of(p));
        var rotina = new RotinaDeLiberacaoDePlanos(consultorias, treinos, dietas, mobilidades, liberacao, avisos,
                mock(PlatformTransactionManager.class), true);

        var resultado = rotina.rodar(hoje);

        assertThat(resultado.liberados()).isEqualTo(1);
        assertThat(resultado.falhas()).isEqualTo(1);
        verify(liberacao).liberar(treinos, p, false);
        verify(avisos).limpar(any(), any());
        verify(avisos, never()).limpar(org.mockito.ArgumentMatchers.eq(quebrada), any());
    }
}
