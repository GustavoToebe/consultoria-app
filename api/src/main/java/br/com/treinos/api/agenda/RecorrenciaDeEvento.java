package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * A regra de repetição de um evento sem aluno (D4): dada a data do primeiro dia e a regra, quais dias caem numa janela.
 * Classe pura, sem banco, sem relógio e sem fuso (são datas de Brasília); a hora é aplicada por quem chama.
 *
 * <p>O fim é opcional: sem {@code ate} nem {@code vezes} a série "nunca termina" e só é expandida dentro da janela pedida.
 * {@code vezes} (de 2 a {@value #VEZES_MAXIMO}) conta as ocorrências da REGRA a partir da primeira, inclusive as que uma
 * exceção cancelou ou moveu. Mês sem o dia (31, 30, 29/02) é pulado e 29/02 só cai em ano bissexto, como no compromisso
 * ({@link RepeticaoDeCompromisso}, de onde vêm os passos de "próxima data"). Dias úteis são segunda a sexta, sem feriado.
 *
 * <p>A primeira ocorrência é a primeira data da regra a partir do dia dado ({@link #primeira}): numa regra semanal ou de
 * dias úteis o dia dado não precisa casar, a série começa no primeiro que casa.
 *
 * <p>Erros de regra são 400 {@code REPETICAO_INVALIDA}.
 */
final class RecorrenciaDeEvento {

    static final int VEZES_MINIMO = 2;
    static final int VEZES_MAXIMO = 999;
    /** Datas aceitas em evento e regra: fora disso o laço de expansão poderia girar sem fim útil. */
    static final LocalDate PRIMEIRO_DIA = LocalDate.of(2000, 1, 1);
    static final LocalDate ULTIMO_DIA = LocalDate.of(2100, 12, 31);

    private RecorrenciaDeEvento() { }

    /** A regra: {@code dias} só na semanal; {@code ate} e {@code vezes} no máximo um dos dois (nenhum = nunca termina). */
    record Regra(TipoDeRecorrencia tipo, Set<DayOfWeek> dias, LocalDate ate, Integer vezes) {

        static final Regra NENHUMA = new Regra(TipoDeRecorrencia.NENHUMA, Set.of(), null, null);

        Regra {
            dias = dias == null ? Set.of() : Set.copyOf(dias);
        }

        boolean repete() {
            return tipo != TipoDeRecorrencia.NENHUMA;
        }

        Regra semFim() {
            return new Regra(tipo, dias, null, null);
        }
    }

    /** Confere a regra de um evento que começa em {@code inicio} (400 {@code REPETICAO_INVALIDA}). */
    static void validar(LocalDate inicio, Regra r) {
        if (inicio == null || r == null || r.tipo() == null) {
            throw invalida("Escolha como o evento se repete.");
        }
        foraDoIntervalo(inicio);
        if (r.tipo() == TipoDeRecorrencia.NENHUMA) {
            if (!r.dias().isEmpty() || r.ate() != null || r.vezes() != null) {
                throw invalida("Um evento que não se repete não tem dias, data final nem número de vezes.");
            }
            return;
        }
        if (r.ate() != null && r.vezes() != null) {
            throw invalida("Informe o fim da repetição: uma data final ou o número de vezes (não os dois), ou deixe sem fim.");
        }
        if (r.vezes() != null && (r.vezes() < VEZES_MINIMO || r.vezes() > VEZES_MAXIMO)) {
            throw invalida("O número de vezes precisa ser de " + VEZES_MINIMO + " a " + VEZES_MAXIMO + ".");
        }
        if (r.ate() != null) {
            foraDoIntervalo(r.ate());
        }
        if (r.tipo() == TipoDeRecorrencia.SEMANAL) {
            if (r.dias().isEmpty()) {
                throw invalida("Escolha os dias da semana.");
            }
        } else if (!r.dias().isEmpty()) {
            throw invalida("Os dias da semana só valem para a repetição semanal.");
        }
        if (r.ate() != null && r.ate().isBefore(primeira(inicio, r))) {
            throw invalida("A data final não pode ser antes do primeiro dia do evento.");
        }
    }

    private static void foraDoIntervalo(LocalDate data) {
        if (data.isBefore(PRIMEIRO_DIA) || data.isAfter(ULTIMO_DIA)) {
            throw invalida("Use datas entre " + PRIMEIRO_DIA.getYear() + " e " + ULTIMO_DIA.getYear() + ".");
        }
    }

    /** O primeiro dia da regra a partir de {@code inicio} (inclusive): o próprio dia, salvo na semanal e nos dias úteis. */
    static LocalDate primeira(LocalDate inicio, Regra r) {
        return switch (r.tipo()) {
            case SEMANAL -> r.dias().contains(inicio.getDayOfWeek()) ? inicio
                    : RepeticaoDeCompromisso.proximoDiaEscolhido(inicio, r.dias());
            case DIAS_UTEIS -> RepeticaoDeCompromisso.ehFimDeSemana(inicio.getDayOfWeek())
                    ? RepeticaoDeCompromisso.diaUtilDepoisDe(inicio) : inicio;
            default -> inicio;
        };
    }

    /**
     * Os dias da regra que caem em [{@code de}, {@code ate}] (inclusive), em ordem. Não conhece exceções: cancelada ou
     * movida continua aqui e quem chama aplica a exceção. Sem {@code vezes}, uma série diária, semanal ou de dias úteis
     * pula direto para a janela (a conta não cresce com a idade da série); com {@code vezes} o laço conta desde o início
     * (no máximo {@value #VEZES_MAXIMO} passos).
     */
    static List<LocalDate> expandir(LocalDate inicio, Regra r, LocalDate de, LocalDate ate) {
        List<LocalDate> dias = new ArrayList<>();
        if (ate.isBefore(de)) {
            return dias;
        }
        if (!r.repete()) {
            if (!inicio.isBefore(de) && !inicio.isAfter(ate)) {
                dias.add(inicio);
            }
            return dias;
        }
        LocalDate atual = primeira(inicio, r);
        boolean semContagem = r.vezes() == null;
        boolean semEstado = r.tipo() == TipoDeRecorrencia.DIARIA || r.tipo() == TipoDeRecorrencia.SEMANAL
                || r.tipo() == TipoDeRecorrencia.DIAS_UTEIS;
        if (semContagem && semEstado && atual.isBefore(de)) {
            atual = primeira(de, r);
        }
        LocalDate limite = r.ate() == null || r.ate().isAfter(ate) ? ate : r.ate();
        int contador = 1;
        while (!atual.isAfter(limite) && !atual.isAfter(ULTIMO_DIA) && (semContagem || contador <= r.vezes())) {
            if (!atual.isBefore(de)) {
                dias.add(atual);
            }
            atual = proxima(atual, r);
            contador++;
        }
        return dias;
    }

    /** {@code data} é um dia da regra (uma ocorrência possível, ainda que cancelada ou movida)? */
    static boolean ocorre(LocalDate inicio, Regra r, LocalDate data) {
        return !expandir(inicio, r, data, data).isEmpty();
    }

    /** Quantas ocorrências a regra tem antes de {@code corte} (exclusive). */
    static int contarAntes(LocalDate inicio, Regra r, LocalDate corte) {
        return expandir(inicio, r, inicio, corte.minusDays(1)).size();
    }

    private static LocalDate proxima(LocalDate ultima, Regra r) {
        return switch (r.tipo()) {
            case DIARIA -> ultima.plusDays(1);
            case DIAS_UTEIS -> RepeticaoDeCompromisso.diaUtilDepoisDe(ultima);
            case SEMANAL -> RepeticaoDeCompromisso.proximoDiaEscolhido(ultima, r.dias());
            case MENSAL -> RepeticaoDeCompromisso.mesmoDiaDoMes(ultima);
            case ANUAL -> RepeticaoDeCompromisso.mesmoDiaDoAno(ultima);
            case NENHUMA -> throw new IllegalStateException("Evento sem repetição não tem próxima data.");
        };
    }

    // ---- dias da semana <-> máscara de 7 bits (bit 0 = segunda ... bit 6 = domingo) ----

    static int mascara(Set<DayOfWeek> dias) {
        int mascara = 0;
        for (DayOfWeek d : dias) {
            mascara |= 1 << (d.getValue() - 1);
        }
        return mascara;
    }

    static Set<DayOfWeek> dias(int mascara) {
        Set<DayOfWeek> dias = EnumSet.noneOf(DayOfWeek.class);
        for (DayOfWeek d : DayOfWeek.values()) {
            if ((mascara & (1 << (d.getValue() - 1))) != 0) {
                dias.add(d);
            }
        }
        return dias;
    }

    private static BadRequestException invalida(String mensagem) {
        return new BadRequestException(mensagem, "REPETICAO_INVALIDA");
    }
}
