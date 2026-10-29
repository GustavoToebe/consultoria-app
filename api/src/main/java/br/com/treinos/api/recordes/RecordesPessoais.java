package br.com.treinos.api.recordes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Regra pura dos recordes pessoais (frente Engajamento, passo 0.2, decisões P3 e P10). Espelhada em
 * {@code app/src/dominio/recordesPessoais.ts}: mudou uma, mude a outra (os testes dos dois lados usam os mesmos casos).
 *
 * <p>Só série simples conta (sem técnica, sem etapas, com carga em kg e repetições, feita): quem chama filtra pela versão
 * ({@code IndiceVersao.LocalSerie.simples}). Três tipos, comparados com o melhor de antes:
 * <ul>
 *   <li>{@link Tipo#MAIOR_CARGA}: carga maior que a maior já registrada no exercício;</li>
 *   <li>{@link Tipo#MAIS_REPETICOES}: mais repetições do que já fez com <b>a mesma carga</b> (carga nova não conta aqui);</li>
 *   <li>{@link Tipo#MAIOR_VOLUME}: carga × repetições da série maior que o maior volume de uma série.</li>
 * </ul>
 * Sem nada antes ({@code base} nulo) não há recorde: o primeiro registro do exercício não conta. Empate não é recorde.
 * Não há 1RM estimado (P7): nada é calculado além de carga × repetições.
 */
public final class RecordesPessoais {

    public enum Tipo { MAIOR_CARGA, MAIS_REPETICOES, MAIOR_VOLUME }

    /** Uma série simples feita: carga (kg, maior que zero) e repetições (maior que zero). */
    public record Marca(BigDecimal carga, int repeticoes) {

        public BigDecimal volume() {
            return carga.multiply(BigDecimal.valueOf(repeticoes));
        }
    }

    /** Mais repetições já feitas com uma carga. */
    public record RepeticoesNaCarga(BigDecimal carga, int repeticoes) {
    }

    /**
     * Os melhores valores de um exercício até agora. {@code repeticoesPorCarga} tem uma linha por carga (comparada pelo
     * valor: 70 e 70.00 são a mesma), em ordem crescente de carga.
     */
    public record Melhores(BigDecimal maiorCarga, BigDecimal maiorVolume, List<RepeticoesNaCarga> repeticoesPorCarga) {
    }

    /** Um recorde da série: o tipo, a carga e as repetições da série e o valor que bateu (carga, repetições ou volume). */
    public record Recorde(Tipo tipo, BigDecimal carga, int repeticoes, BigDecimal valor) {
    }

    private RecordesPessoais() {
    }

    /** A série entra na conta? Carga e repetições presentes e maiores que zero. */
    public static boolean conta(BigDecimal carga, Integer repeticoes) {
        return carga != null && repeticoes != null && carga.signum() > 0 && repeticoes > 0;
    }

    /** Os melhores de um conjunto de séries (a ordem não importa); vazio = {@code null} (nunca registrou). */
    public static Melhores melhores(Collection<Marca> marcas) {
        Melhores m = null;
        for (Marca marca : marcas) {
            m = acumular(m, marca);
        }
        return m;
    }

    /** Os melhores depois de mais uma série. */
    public static Melhores acumular(Melhores base, Marca marca) {
        if (base == null) {
            return new Melhores(marca.carga(), marca.volume(), List.of(new RepeticoesNaCarga(marca.carga(), marca.repeticoes())));
        }
        Map<BigDecimal, RepeticoesNaCarga> porCarga = new TreeMap<>();
        for (RepeticoesNaCarga r : base.repeticoesPorCarga()) {
            porCarga.put(r.carga(), r);
        }
        RepeticoesNaCarga atual = porCarga.get(marca.carga());
        if (atual == null || marca.repeticoes() > atual.repeticoes()) {
            porCarga.put(marca.carga(), new RepeticoesNaCarga(atual == null ? marca.carga() : atual.carga(), marca.repeticoes()));
        }
        return new Melhores(
                marca.carga().compareTo(base.maiorCarga()) > 0 ? marca.carga() : base.maiorCarga(),
                marca.volume().compareTo(base.maiorVolume()) > 0 ? marca.volume() : base.maiorVolume(),
                new ArrayList<>(porCarga.values()));
    }

    /** Os recordes que a série bate contra {@code base}, na ordem dos tipos. {@code base} nulo = nenhum (primeiro registro). */
    public static List<Recorde> recordes(Melhores base, Marca marca) {
        List<Recorde> lista = new ArrayList<>();
        if (base == null) {
            return lista;
        }
        if (marca.carga().compareTo(base.maiorCarga()) > 0) {
            lista.add(new Recorde(Tipo.MAIOR_CARGA, marca.carga(), marca.repeticoes(), marca.carga()));
        }
        for (RepeticoesNaCarga r : base.repeticoesPorCarga()) {
            if (r.carga().compareTo(marca.carga()) == 0 && marca.repeticoes() > r.repeticoes()) {
                lista.add(new Recorde(Tipo.MAIS_REPETICOES, marca.carga(), marca.repeticoes(), BigDecimal.valueOf(marca.repeticoes())));
            }
        }
        if (marca.volume().compareTo(base.maiorVolume()) > 0) {
            lista.add(new Recorde(Tipo.MAIOR_VOLUME, marca.carga(), marca.repeticoes(), marca.volume()));
        }
        return lista;
    }

    /**
     * Os recordes de cada série de um dia, na ordem em que vieram (a do plano): cada série compara com o que veio antes
     * dela, o histórico mais as séries anteriores do mesmo dia. Série que não conta ({@code null}) não tem recorde nem muda
     * a base. Sem histórico ({@code base} nulo), nenhuma série do dia é recorde: o primeiro dia do exercício não conta.
     */
    public static List<List<Recorde>> doDia(Melhores base, List<Marca> emOrdem) {
        List<List<Recorde>> resultado = new ArrayList<>();
        Melhores atual = base;
        for (Marca marca : emOrdem) {
            if (marca == null) {
                resultado.add(List.of());
                continue;
            }
            resultado.add(base == null ? List.of() : recordes(atual, marca));
            atual = acumular(atual, marca);
        }
        return resultado;
    }
}
