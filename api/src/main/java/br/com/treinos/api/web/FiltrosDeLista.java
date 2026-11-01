package br.com.treinos.api.web;

import br.com.plataforma.comum.web.BadRequestException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Leitura dos filtros das listas do treinador (lote 2 de {@code docs/planos/filtros-nas-listas.md}): parâmetros
 * repetíveis ({@code ?a=1&a=2} ou {@code ?a=1,2}), enums fechados, ids e períodos. Valor desconhecido é 400
 * {@code FILTRO_INVALIDO} e a mensagem cita só o nome do parâmetro, nunca o valor recebido (o valor pode ser qualquer
 * coisa digitada na URL e iria parar no log do cliente e na tela).
 */
public final class FiltrosDeLista {

    public static final String CODIGO = "FILTRO_INVALIDO";
    /** Teto de valores de um parâmetro repetível: acima disso é 400 (ninguém marca 50 opções numa tela). */
    public static final int MAXIMO_VALORES = 50;
    /** "Sem responsável" nos filtros de responsável (o mesmo valor do {@code GET /alunos}). */
    public static final String SEM_RESPONSAVEL = "nenhum";

    private FiltrosDeLista() { }

    /** Os valores sem vazios, sem espaços nas pontas e sem repetir, na ordem recebida. Mais de {@value #MAXIMO_VALORES} = 400. */
    public static List<String> valores(List<String> crus, String campo) {
        if (crus == null) return List.of();
        Set<String> limpos = new LinkedHashSet<>();
        for (String v : crus) {
            if (v != null && !v.isBlank()) limpos.add(v.trim());
        }
        if (limpos.size() > MAXIMO_VALORES) {
            throw new BadRequestException("Escolha até " + MAXIMO_VALORES + " valores em " + campo + ".", CODIGO);
        }
        return List.copyOf(limpos);
    }

    /** Cada valor tem de ser uma constante do enum (sem diferença de caixa). */
    public static <E extends Enum<E>> Set<E> enums(Class<E> tipo, List<String> crus, String campo) {
        Set<E> saida = EnumSet.noneOf(tipo);
        for (String v : valores(crus, campo)) saida.add(umEnum(tipo, v, campo));
        return saida;
    }

    /** Um valor do enum, ou {@code null} se vazio. */
    public static <E extends Enum<E>> E umEnum(Class<E> tipo, String cru, String campo) {
        if (cru == null || cru.isBlank()) return null;
        try {
            return Enum.valueOf(tipo, cru.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw invalido(campo);
        }
    }

    public static UUID uuid(String cru, String campo) {
        try {
            return UUID.fromString(cru.trim());
        } catch (IllegalArgumentException e) {
            throw invalido(campo);
        }
    }

    /** Ids (UUID) repetíveis; vazio = sem filtro. */
    public static Set<UUID> uuids(List<String> crus, String campo) {
        Set<UUID> ids = new LinkedHashSet<>();
        for (String v : valores(crus, campo)) ids.add(uuid(v, campo));
        return Set.copyOf(ids);
    }

    /**
     * Período em dias (as duas pontas incluídas). Fim antes do início, ou mais longo que {@code maximoDias} (quando
     * positivo), é 400 com o {@code codigo} que a rota já usa.
     */
    public static void exigirPeriodo(LocalDate de, LocalDate ate, int maximoDias, String codigo) {
        if (de != null && ate != null && ate.isBefore(de)) {
            throw new BadRequestException("A data final vem antes da inicial.", codigo);
        }
        if (maximoDias > 0 && de != null && ate != null && ChronoUnit.DAYS.between(de, ate) + 1 > maximoDias) {
            throw new BadRequestException("Escolha um período de até " + maximoDias + " dias.", codigo);
        }
    }

    /** A mensagem cita só o nome do parâmetro, nunca o valor recebido. */
    public static BadRequestException invalido(String campo) {
        return new BadRequestException("Filtro " + campo + " com valor desconhecido.", CODIGO);
    }

    /**
     * Filtro de responsável repetível: ids de membros e/ou {@value #SEM_RESPONSAVEL}. {@code meus=true} junto de
     * {@code responsavel} é 400 (um ou outro, como no {@code GET /alunos}). Quem chama confere se os ids são da equipe.
     */
    public record Responsaveis(Set<UUID> ids, boolean semResponsavel) {

        public static final Responsaveis NENHUM = new Responsaveis(Set.of(), false);

        public static Responsaveis ler(List<String> crus, boolean meus) {
            List<String> valores = valores(crus, "responsavel");
            if (meus && !valores.isEmpty()) {
                throw new BadRequestException("Use meus ou responsavel, não os dois.", CODIGO);
            }
            Set<UUID> ids = new LinkedHashSet<>();
            boolean nenhum = false;
            for (String v : valores) {
                if (SEM_RESPONSAVEL.equalsIgnoreCase(v)) nenhum = true;
                else ids.add(uuid(v, "responsavel"));
            }
            return new Responsaveis(Set.copyOf(ids), nenhum);
        }

        /** Só o usuário da sessão ("Meus"). */
        public static Responsaveis so(UUID usuarioId) {
            return new Responsaveis(Set.of(usuarioId), false);
        }

        public boolean filtra() {
            return !ids.isEmpty() || semResponsavel;
        }

        /** O responsável de um registro passa no filtro? (sem filtro, sempre). */
        public boolean aceita(UUID responsavelId) {
            if (!filtra()) return true;
            return responsavelId == null ? semResponsavel : ids.contains(responsavelId);
        }
    }
}
