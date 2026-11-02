package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ApiError;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Faixa de datas por tipo de campo (C76: pastas no ano 0260 e "atrasada há 644943 dias"). A mesma data é válida num
 * campo e absurda em outro, por isso a regra é por tipo, e não uma só para tudo. Espelho em
 * {@code app/src/dominio/datasValidas.ts}: mudou uma, mude a outra.
 *
 * <ul>
 *   <li>{@link #PLANEJAMENTO}: o que se agenda ou se planeja (pasta, plano, compromisso, evento, retorno, nova data da
 *       atualização, filtros de período). De 01/01/2000 até 31/12 do ano de hoje + 5.</li>
 *   <li>{@link #REGISTRO}: o que aconteceu (peso, avaliação física, lesão, finalizar pasta) e nascimento. De 01/01/1900
 *       até hoje; futuro não.</li>
 *   <li>{@link #DATA_COM_FUTURO}: pergunta DATA do questionário sem {@code somentePassado}. De 01/01/1900 até 31/12 do
 *       ano de hoje + 5.</li>
 * </ul>
 *
 * "Hoje" é o dia em Brasília. Quem recusa responde 422 com o campo em {@code fieldErrors}; a mensagem nomeia o campo e a
 * faixa e nunca repete o valor recebido (dado digitado pode ir parar em log e tela).
 */
public enum FaixaDeData {
    PLANEJAMENTO(2000),
    REGISTRO(1900),
    DATA_COM_FUTURO(1900);

    /** Quantos anos à frente o planejamento e a pergunta DATA aceitam. */
    public static final int ANOS_A_FRENTE = 5;

    private static final DateTimeFormatter TELA = DateTimeFormatter.ofPattern("dd/MM/uuuu");

    private final int anoInicial;

    FaixaDeData(int anoInicial) {
        this.anoInicial = anoInicial;
    }

    /** O primeiro dia aceito. */
    public LocalDate minimo() {
        return LocalDate.of(anoInicial, 1, 1);
    }

    /** O último dia aceito, no dia {@code hoje}. */
    public LocalDate maximo(LocalDate hoje) {
        return this == REGISTRO ? hoje : LocalDate.of(hoje.getYear() + ANOS_A_FRENTE, 12, 31);
    }

    /** Hoje, em Brasília. */
    public static LocalDate hoje() {
        return LocalDate.now(Fuso.BRASILIA);
    }

    public boolean aceita(LocalDate data, LocalDate hoje) {
        return !data.isBefore(minimo()) && !data.isAfter(maximo(hoje));
    }

    /** Ex.: "Início da pasta: use uma data entre 01/01/2000 e 31/12/2031" (no registro, termina em "hoje"). */
    public String mensagem(String rotulo, LocalDate hoje) {
        String fim = this == REGISTRO ? "hoje" : maximo(hoje).format(TELA);
        return rotulo + ": use uma data entre " + minimo().format(TELA) + " e " + fim;
    }

    /** Um campo a conferir: o nome no corpo da requisição, o rótulo que a pessoa vê e o valor (nulo = não preenchido, passa). */
    public record Campo(FaixaDeData faixa, String campo, String rotulo, LocalDate valor) { }

    /** Monta o campo a conferir desta faixa. */
    public Campo campo(String campo, String rotulo, LocalDate valor) {
        return new Campo(this, campo, rotulo, valor);
    }

    /** Os problemas (um por campo fora da faixa); lista vazia = tudo na faixa. Datas nulas não são conferidas aqui. */
    public static List<ApiError.FieldError> problemas(LocalDate hoje, Campo... campos) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        for (Campo c : campos) {
            if (c.valor() != null && !c.faixa().aceita(c.valor(), hoje)) {
                erros.add(new ApiError.FieldError(c.campo(), c.faixa().mensagem(c.rotulo(), hoje)));
            }
        }
        return erros;
    }

    /** 422 {@code codigo} com um erro por campo fora da faixa; não faz nada se todos estiverem dentro. */
    public static void exigir(String codigo, Campo... campos) {
        exigir(hoje(), codigo, campos);
    }

    public static void exigir(LocalDate hoje, String codigo, Campo... campos) {
        List<ApiError.FieldError> erros = problemas(hoje, campos);
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira as datas informadas.", codigo, erros);
        }
    }
}
