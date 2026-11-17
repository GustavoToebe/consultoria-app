package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Aniversariantes dos próximos dias para o Início do treinador (plano {@code docs/planos/aniversarios.md}). Mostra só nome,
 * dia e mês, nunca o ano nem a idade (D1); a consulta já não traz o ano. Não é auditado e nada disso vai a log (D6).
 * Quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos ({@link MonthDay#atYear}).
 */
@Service
public class AniversariantesService {

    /** Janelas aceitas (D3): 0 = só hoje. */
    static final Set<Integer> JANELAS = Set.of(0, 3, 7, 15);

    /** Uma linha da resposta: sem ano, sem idade. {@code diasAte} = 0 é hoje. */
    public record Aniversariante(UUID alunoId, String nome, int dia, int mes, int diasAte) {

        /** Nome e dia/mês são dado pessoal (D6): um log futuro não pode imprimi-los. */
        @Override
        public String toString() {
            return "Aniversariante[...]";
        }
    }

    private final AlunoRepository alunos;

    public AniversariantesService(AlunoRepository alunos) {
        this.alunos = alunos;
    }

    /** Alunos ativos e não anonimizados; com {@code responsavelId}, só os dele ("Meus alunos"). Janela fora de 0/3/7/15 = 400. */
    @Transactional(readOnly = true)
    public List<Aniversariante> proximos(int dias, UUID responsavelId) {
        if (!JANELAS.contains(dias)) {
            throw new BadRequestException("Escolha 0, 3, 7 ou 15 dias.", "DIAS_INVALIDOS");
        }
        return proximos(alunos.nascimentosSemAnoDoEscopo(responsavelId), dias, LocalDate.now(Fuso.BRASILIA));
    }

    /** Regra pura (sem banco nem relógio), com virada de ano; mais próximo primeiro, empate por nome. */
    static List<Aniversariante> proximos(List<NascimentoSemAno> nascimentos, int dias, LocalDate hoje) {
        return nascimentos.stream()
                .map(n -> new Aniversariante(n.alunoId(), n.nome(), n.dia(), n.mes(), diasAte(MonthDay.of(n.mes(), n.dia()), hoje)))
                .filter(a -> a.diasAte() <= dias)
                .sorted(Comparator.comparingInt(Aniversariante::diasAte).thenComparing(Aniversariante::nome, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    static int diasAte(MonthDay aniversario, LocalDate hoje) {
        LocalDate proximo = aniversario.atYear(hoje.getYear());
        if (proximo.isBefore(hoje)) {
            proximo = aniversario.atYear(hoje.getYear() + 1);
        }
        return (int) ChronoUnit.DAYS.between(hoje, proximo);
    }
}
