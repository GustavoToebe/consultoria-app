package br.com.treinos.api.planos.liberacao;

import br.com.plataforma.comum.web.ApiError.FieldError;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.PlanoRepositorio;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * O ponto único da liberação do plano para o aluno (V105): a regra da data, "liberar" (o plano vira o vigente e o aluno passa
 * a ver a versão publicada) e o aviso. Quem libera é a publicação sem data, o "Liberar agora" e a rotina diária
 * ({@link RotinaDeLiberacaoDePlanos}); todos passam por {@link #liberar}.
 */
@Component
public class LiberacaoDePlano {

    private static final DateTimeFormatter TELA = DateTimeFormatter.ofPattern("dd/MM/uuuu");

    private final AvisosDePlanoLiberado avisos;

    LiberacaoDePlano(AvisosDePlanoLiberado avisos) {
        this.avisos = avisos;
    }

    /**
     * A data de liberação, quando vem: de amanhã (dia de Brasília) até o fim da faixa de planejamento. Nula passa (libera na
     * hora). 422 {@code LIBERACAO_INVALIDA} no campo {@code liberarEm}, sem repetir o valor.
     */
    public static void exigirDataValida(LocalDate liberarEm, LocalDate hoje) {
        if (liberarEm == null) {
            return;
        }
        LocalDate amanha = hoje.plusDays(1);
        LocalDate maximo = FaixaDeData.PLANEJAMENTO.maximo(hoje);
        if (liberarEm.isBefore(amanha) || liberarEm.isAfter(maximo)) {
            throw new ValidacaoException("Confira a data de liberação.", "LIBERACAO_INVALIDA", List.of(new FieldError("liberarEm",
                    "Liberar para o aluno em: use uma data entre " + amanha.format(TELA) + " e " + maximo.format(TELA))));
        }
    }

    /**
     * Libera o plano agora: desativa o vigente do aluno (se for outro plano), liga este com a versão publicada e, se pedido,
     * avisa o aluno (aviso do app e push). O plano já vem travado ou recém-lido pela transação de quem chama.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public <P extends PlanoBase> void liberar(PlanoRepositorio<P> planos, P plano, boolean avisar) {
        UUID alunoId = plano.getAlunoId();
        planos.desativarOutros(alunoId, plano.getId());
        plano.liberarVersaoPublicada();
        planos.saveAndFlush(plano);
        if (avisar) {
            avisos.avisar(alunoId);
        }
    }

    /** Só o aviso (a publicação sem data já ligou o plano por conta própria). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void avisar(UUID alunoId) {
        avisos.avisar(alunoId);
    }
}
