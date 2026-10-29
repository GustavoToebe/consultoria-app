package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.agenda.AgendaDtos.Repeticao;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * A regra da série de compromissos (D4): dado o dia do primeiro compromisso e a repetição, quais são os dias das
 * ocorrências. Classe pura: sem banco, sem relógio e sem fuso (são só datas de Brasília); a hora é aplicada por quem chama.
 *
 * <p>Regras: a primeira ocorrência é a data dada e conta; o fim é obrigatório (exatamente um de {@code ate} ou
 * {@code vezes}); no máximo {@value AgendaDtos#OCORRENCIAS_MAXIMO} ocorrências (um {@code ate} que passe disso é recusado,
 * nunca cortado em silêncio) e no mínimo {@value AgendaDtos#OCORRENCIAS_MINIMO}. Mês sem o dia (31, 30, 29/02) é pulado, e
 * 29/02 só cai em ano bissexto. Dias úteis são segunda a sexta, sem tabela de feriados. A regra precisa incluir a primeira
 * data (semanal: o dia da semana dela está escolhido; dias úteis: ela não é sábado nem domingo).
 *
 * <p>Erros são 400 ({@code REPETICAO_INVALIDA}, {@code SERIE_GRANDE_DEMAIS}).
 */
final class RepeticaoDeCompromisso {

    private RepeticaoDeCompromisso() { }

    /** Os dias das ocorrências, em ordem crescente, começando em {@code primeira}. */
    static List<LocalDate> expandir(LocalDate primeira, Repeticao repeticao) {
        validar(primeira, repeticao);
        boolean porData = repeticao.ate() != null;
        // Com data final gera até uma a mais que o máximo, só para saber que passou (uma série diária por anos não é
        // expandida inteira para depois ser contada).
        int limite = porData ? AgendaDtos.OCORRENCIAS_MAXIMO + 1 : repeticao.vezes();
        List<LocalDate> dias = new ArrayList<>(limite);
        dias.add(primeira);
        while (dias.size() < limite) {
            LocalDate ultima = dias.getLast();
            LocalDate proxima = switch (repeticao.tipo()) {
                case DIARIA -> ultima.plusDays(1);
                case DIAS_UTEIS -> diaUtilDepoisDe(ultima);
                case SEMANAL -> proximoDiaEscolhido(ultima, diasEscolhidos(repeticao));
                case MENSAL -> mesmoDiaDoMes(ultima);
                case ANUAL -> mesmoDiaDoAno(ultima);
            };
            if (porData && proxima.isAfter(repeticao.ate())) {
                break;
            }
            dias.add(proxima);
        }
        if (dias.size() > AgendaDtos.OCORRENCIAS_MAXIMO) {
            throw new BadRequestException("A série pode ter no máximo " + AgendaDtos.OCORRENCIAS_MAXIMO
                    + " compromissos. Escolha uma data final mais próxima.", "SERIE_GRANDE_DEMAIS");
        }
        if (dias.size() < AgendaDtos.OCORRENCIAS_MINIMO) {
            throw invalida("A repetição precisa ter pelo menos " + AgendaDtos.OCORRENCIAS_MINIMO + " compromissos.");
        }
        return List.copyOf(dias);
    }

    private static void validar(LocalDate primeira, Repeticao r) {
        if (primeira == null || r == null || r.tipo() == null) {
            throw invalida("Escolha como o compromisso se repete.");
        }
        if ((r.ate() == null) == (r.vezes() == null)) {
            throw invalida("Informe o fim da repetição: uma data final ou o número de vezes (não os dois).");
        }
        if (r.vezes() != null && (r.vezes() < AgendaDtos.OCORRENCIAS_MINIMO || r.vezes() > AgendaDtos.OCORRENCIAS_MAXIMO)) {
            throw invalida("O número de vezes precisa ser de " + AgendaDtos.OCORRENCIAS_MINIMO + " a "
                    + AgendaDtos.OCORRENCIAS_MAXIMO + ".");
        }
        if (r.ate() != null && !r.ate().isAfter(primeira)) {
            throw invalida("A data final precisa ser depois da data do compromisso.");
        }
        boolean temDias = r.diasDaSemana() != null && !r.diasDaSemana().isEmpty();
        Set<DayOfWeek> dias = diasEscolhidos(r);
        switch (r.tipo()) {
            case SEMANAL -> {
                if (!temDias) {
                    throw invalida("Escolha os dias da semana.");
                }
                if (!dias.contains(primeira.getDayOfWeek())) {
                    throw invalida("Os dias da semana precisam incluir o dia do compromisso.");
                }
            }
            case DIAS_UTEIS -> {
                if (ehFimDeSemana(primeira.getDayOfWeek())) {
                    throw invalida("O compromisso precisa cair de segunda a sexta para repetir nos dias úteis.");
                }
                semDias(temDias);
            }
            default -> semDias(temDias);
        }
    }

    /** Os nomes de {@link DayOfWeek} do pedido (texto, sem diferença de caixa); outro valor, inclusive número, é 400. */
    private static Set<DayOfWeek> diasEscolhidos(Repeticao r) {
        Set<DayOfWeek> dias = EnumSet.noneOf(DayOfWeek.class);
        if (r.diasDaSemana() == null) {
            return dias;
        }
        for (String nome : r.diasDaSemana()) {
            try {
                dias.add(DayOfWeek.valueOf(nome == null ? "" : nome.trim().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw invalida("Dia da semana inválido. Use MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY ou SUNDAY.");
            }
        }
        return dias;
    }

    private static void semDias(boolean temDias) {
        if (temDias) {
            throw invalida("Os dias da semana só valem para a repetição semanal.");
        }
    }

    private static boolean ehFimDeSemana(DayOfWeek dia) {
        return dia == DayOfWeek.SATURDAY || dia == DayOfWeek.SUNDAY;
    }

    private static LocalDate diaUtilDepoisDe(LocalDate dia) {
        LocalDate proximo = dia.plusDays(1);
        while (ehFimDeSemana(proximo.getDayOfWeek())) {
            proximo = proximo.plusDays(1);
        }
        return proximo;
    }

    private static LocalDate proximoDiaEscolhido(LocalDate dia, Set<DayOfWeek> dias) {
        LocalDate proximo = dia.plusDays(1);
        while (!dias.contains(proximo.getDayOfWeek())) {
            proximo = proximo.plusDays(1);
        }
        return proximo;
    }

    /** O mesmo dia do mês seguinte, sem encostar o 31 no 30: o mês que não tem o dia é pulado. */
    private static LocalDate mesmoDiaDoMes(LocalDate ultima) {
        int dia = ultima.getDayOfMonth();
        YearMonth mes = YearMonth.from(ultima).plusMonths(1);
        // Cada dia do mês existe em pelo menos um mês de cada dois seguidos: o laço termina sempre.
        while (!mes.isValidDay(dia)) {
            mes = mes.plusMonths(1);
        }
        return mes.atDay(dia);
    }

    /** O mesmo dia e mês no ano seguinte; 29/02 pula para o próximo bissexto em vez de virar 28/02. */
    private static LocalDate mesmoDiaDoAno(LocalDate ultima) {
        MonthDay mesDia = MonthDay.from(ultima);
        int ano = ultima.getYear() + 1;
        while (!mesDia.isValidYear(ano)) {
            ano++;
        }
        return mesDia.atYear(ano);
    }

    private static BadRequestException invalida(String mensagem) {
        return new BadRequestException(mensagem, "REPETICAO_INVALIDA");
    }
}
