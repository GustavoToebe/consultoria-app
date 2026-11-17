package br.com.treinos.api.comunidade;

import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * XP e nível (plano {@code xp-e-niveis}): regra pura, derivada a cada leitura, sem estado, relógio nem banco. Espelho de
 * {@code app/src/dominio/xp.ts} (mudou uma, mude a outra e o {@code scripts/xp/gerar-fixtures.mjs}; os dois lados leem as mesmas
 * fixtures de {@code paridade-xp/}).
 * <ul>
 * <li>Treino: no máximo UM por dia conta, o melhor do dia (completo 10, parcial 5). Sessão reaberta ({@code concluida=false})
 * não vale nada, então reabrir tira o XP.</li>
 * <li>Semana completa +20 (uma vez por semana), cada tipo de conquista +50, recorde +15 (no máximo um por exercício por dia).</li>
 * <li>Nível = 1 + XP / 100. Nada de XP por peso, medida, foto ou dieta.</li>
 * </ul>
 * Quem chama entrega os dados já filtrados por aluno e aceitos ({@code situacao = ACEITO}); datas em Brasília.
 */
public final class RegrasXp {

    public static final int XP_TREINO_COMPLETO = 10;
    public static final int XP_TREINO_PARCIAL = 5;
    public static final int XP_SEMANA_COMPLETA = 20;
    public static final int XP_CONQUISTA = 50;
    public static final int XP_RECORDE = 15;
    public static final int XP_POR_NIVEL = 100;

    private static final String COMPLETA = "COMPLETA";
    private static final String PARCIAL = "PARCIAL";

    private RegrasXp() {
    }

    /** Uma sessão do aluno como a API a guarda ({@code sessao_concluida}): {@code resultado} é {@code COMPLETA} ou {@code PARCIAL}. */
    public record SessaoDoDia(LocalDate data, boolean concluida, String resultado) {
    }

    /** A semana que começa na segunda {@code inicio}: treinos com dia fixo previstos ({@code total}) e feitos ({@code feitas}). */
    public record SemanaDoPlano(LocalDate inicio, int feitas, int total) {
    }

    /** Um exercício que bateu recorde em {@code data} (qualquer tipo de recorde; vale um por exercício por dia). */
    public record RecordeDoDia(LocalDate data, String exercicioId) {
    }

    /** {@code xpNoNivel} (0 a 99) e {@code faltam} (1 a 100) descrevem a barra até o próximo nível. */
    public record Xp(long xp, int nivel, int xpNoNivel, int faltam) {
    }

    /** Mesma conta do {@code semanaCompleta} do app: plano sem treino com dia fixo ({@code total} zero) nunca comemora. */
    public static boolean semanaCompleta(int feitas, int total) {
        return total > 0 && feitas >= total;
    }

    /** Começa no nível 1 e sobe a cada 100 XP. Número negativo conta como zero. */
    public static int nivel(long xp) {
        return 1 + (int) (Math.max(0, xp) / XP_POR_NIVEL);
    }

    public static Xp calcular(List<SessaoDoDia> sessoes, List<SemanaDoPlano> semanas, Collection<String> tiposDeConquista,
            List<RecordeDoDia> recordes) {
        Map<LocalDate, Integer> melhorDoDia = new HashMap<>();
        for (SessaoDoDia s : sessoes) {
            melhorDoDia.merge(s.data(), valorDoTreino(s), Math::max);
        }
        long xp = 0;
        for (int valor : melhorDoDia.values()) {
            xp += valor;
        }
        Set<LocalDate> semanasCompletas = new HashSet<>();
        for (SemanaDoPlano w : semanas) {
            if (semanaCompleta(w.feitas(), w.total())) {
                semanasCompletas.add(w.inicio());
            }
        }
        xp += (long) semanasCompletas.size() * XP_SEMANA_COMPLETA;
        xp += (long) new HashSet<>(tiposDeConquista).size() * XP_CONQUISTA;
        xp += (long) new HashSet<>(recordes).size() * XP_RECORDE;
        int noNivel = (int) (xp % XP_POR_NIVEL);
        return new Xp(xp, nivel(xp), noNivel, XP_POR_NIVEL - noNivel);
    }

    private static int valorDoTreino(SessaoDoDia s) {
        if (!s.concluida()) {
            return 0;
        }
        if (COMPLETA.equals(s.resultado())) {
            return XP_TREINO_COMPLETO;
        }
        return PARCIAL.equals(s.resultado()) ? XP_TREINO_PARCIAL : 0;
    }
}
