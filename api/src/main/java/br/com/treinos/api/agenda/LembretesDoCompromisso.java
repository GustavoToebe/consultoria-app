package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.web.ValidacaoException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Antecedências dos lembretes de um compromisso (plano lembretes-do-compromisso, D1 e D2): de 0 a {@value #MAXIMO}
 * minutos-antes, cada um de {@value #MINIMO} a {@value #MAXIMO_MINUTOS} (28 dias), sem repetir. Lista vazia = sem lembrete.
 * Espelho em {@code app/src/dominio/lembretesCompromisso.ts}. Erros: 422 {@code COMPROMISSO_INVALIDO} com o campo em
 * {@code fieldErrors} ({@code lembretesMinutos} ou {@code lembretesMinutos[i]}); a mensagem nunca repete o valor.
 */
final class LembretesDoCompromisso {

    static final int MAXIMO = 5;
    static final int MINIMO = 1;
    static final int MAXIMO_MINUTOS = 40320;
    static final List<Integer> PADRAO = List.of(30);
    static final String CAMPO = "lembretesMinutos";

    private LembretesDoCompromisso() { }

    /** Confere e devolve a lista (na ordem recebida); {@code null} não é validado aqui (quem chama decide o padrão). */
    static List<Integer> validar(List<Integer> pedido) {
        // Acima do limite recusa já, sem um erro por item: o DTO não tem @Size e a lista pode vir enorme.
        if (pedido.size() > MAXIMO) {
            throw new ValidacaoException("Confira os lembretes do compromisso.", "COMPROMISSO_INVALIDO",
                    List.of(new ApiError.FieldError(CAMPO, "Use no máximo " + MAXIMO + " lembretes.")));
        }
        List<ApiError.FieldError> erros = new ArrayList<>();
        Set<Integer> vistos = new HashSet<>();
        boolean repetido = false;
        for (int i = 0; i < pedido.size(); i++) {
            Integer minutos = pedido.get(i);
            if (minutos == null || minutos < MINIMO || minutos > MAXIMO_MINUTOS) {
                erros.add(new ApiError.FieldError(CAMPO + "[" + i + "]",
                        "O lembrete precisa ser de " + MINIMO + " minuto a 28 dias antes."));
            } else if (!vistos.add(minutos)) {
                repetido = true;
            }
        }
        if (repetido) {
            erros.add(new ApiError.FieldError(CAMPO, "Há lembretes repetidos."));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os lembretes do compromisso.", "COMPROMISSO_INVALIDO", erros);
        }
        return List.copyOf(pedido);
    }
}
