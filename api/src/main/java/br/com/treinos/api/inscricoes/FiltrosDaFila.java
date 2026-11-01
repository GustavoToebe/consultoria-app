package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.FiltrosDeLista;
import br.com.treinos.api.web.Fuso;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Filtros da fila de interessados ({@code GET /inscricoes} e {@code /contagens}), já lidos e conferidos. Todos opcionais
 * e combinados com E; dentro de um filtro de várias opções (responsável, origem), OU. Viram uma {@link Specification}
 * (Criteria, sem SQL nativo; o {@code @TenantId} de {@link Inscricao} vale).
 *
 * <ul>
 *   <li>responsáveis: ids de membros e/ou "sem responsável" ({@code nenhum}); {@code meus} chega como o próprio id;</li>
 *   <li>origens: valores de {@link Crm.Origem} e/ou {@code NAO_INFORMADA};</li>
 *   <li>busca: nome (sem acento, pela coluna {@code nome_busca}), e-mail ou 4+ dígitos do WhatsApp;</li>
 *   <li>entrada ({@code de}/{@code ate}) e última atividade ({@code atividadeDe}/{@code atividadeAte}): dias de Brasília,
 *       cada ponta opcional e inclusiva.</li>
 * </ul>
 */
record FiltrosDaFila(Set<UUID> responsaveis, boolean semResponsavel, Set<Crm.Origem> origens, boolean semOrigem,
                     String busca, Periodo entrada, Periodo atividade) {

    static final String SEM_ORIGEM = "NAO_INFORMADA";
    private static final String CODIGO_PERIODO = "PERIODO_INVALIDO";

    /** Dias de Brasília {@code [de, ate]} como instantes {@code [inicio, fim)}; ponta nula = aberta. */
    record Periodo(Instant inicio, Instant fim) {

        static final Periodo QUALQUER = new Periodo(null, null);

        static Periodo de(LocalDate de, LocalDate ate) {
            FiltrosDeLista.exigirPeriodo(de, ate, 0, CODIGO_PERIODO);
            return new Periodo(de == null ? null : de.atStartOfDay(Fuso.BRASILIA).toInstant(),
                    ate == null ? null : ate.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant());
        }
    }

    /**
     * Lê o pedido cru (400 {@code FILTRO_INVALIDO} sem repetir o valor; período invertido = 400 {@code PERIODO_INVALIDO}).
     * {@code meus} junto de {@code responsavel} também é 400. Quem chama confere se os responsáveis são da equipe.
     */
    static FiltrosDaFila ler(UUID meus, List<String> responsavel, List<String> origem, String busca, LocalDate de,
                             LocalDate ate, LocalDate atividadeDe, LocalDate atividadeAte) {
        FiltrosDeLista.Responsaveis r = FiltrosDeLista.Responsaveis.ler(responsavel, meus != null);
        Set<UUID> ids = meus != null ? Set.of(meus) : r.ids();
        Set<Crm.Origem> origens = EnumSet.noneOf(Crm.Origem.class);
        boolean semOrigem = false;
        for (String o : FiltrosDeLista.valores(origem, "origem")) {
            if (SEM_ORIGEM.equalsIgnoreCase(o)) semOrigem = true;
            else origens.add(FiltrosDeLista.umEnum(Crm.Origem.class, o, "origem"));
        }
        return new FiltrosDaFila(ids, r.semResponsavel(), Set.copyOf(origens), semOrigem, Buscas.opcional(busca),
                Periodo.de(de, ate), Periodo.de(atividadeDe, atividadeAte));
    }

    /** Os filtros com as situações escolhidas (vazio = todas). */
    Specification<Inscricao> especificacao(Set<SituacaoInscricao> situacoes) {
        return (root, query, cb) -> {
            List<Predicate> e = new ArrayList<>();
            if (situacoes != null && !situacoes.isEmpty() && situacoes.size() < SituacaoInscricao.values().length) {
                e.add(root.get("situacao").in(situacoes));
            }
            if (!responsaveis.isEmpty() || semResponsavel) {
                List<Predicate> ou = new ArrayList<>();
                if (!responsaveis.isEmpty()) ou.add(root.get("responsavelId").in(responsaveis));
                if (semResponsavel) ou.add(cb.isNull(root.get("responsavelId")));
                e.add(cb.or(ou.toArray(Predicate[]::new)));
            }
            if (!origens.isEmpty() || semOrigem) {
                List<Predicate> ou = new ArrayList<>();
                if (!origens.isEmpty()) ou.add(root.get("origem").in(origens));
                if (semOrigem) ou.add(cb.isNull(root.get("origem")));
                e.add(cb.or(ou.toArray(Predicate[]::new)));
            }
            if (busca != null) {
                List<Predicate> ou = new ArrayList<>();
                ou.add(cb.like(root.get("nomeBusca"), Buscas.padraoSemAcento(busca), '\\'));
                ou.add(cb.like(cb.lower(root.get("email")), Buscas.padrao(busca), '\\'));
                String digitos = digitos(busca);
                if (!digitos.isEmpty()) ou.add(cb.like(root.get("whatsappDigitos"), "%" + digitos + "%"));
                e.add(cb.or(ou.toArray(Predicate[]::new)));
            }
            intervalo(e, cb, root.get("criadaEm"), entrada);
            intervalo(e, cb, root.get("ultimaAtividadeEm"), atividade);
            return cb.and(e.toArray(Predicate[]::new));
        };
    }

    private static void intervalo(List<Predicate> e, jakarta.persistence.criteria.CriteriaBuilder cb,
                                  jakarta.persistence.criteria.Path<Instant> campo, Periodo p) {
        if (p.inicio() != null) e.add(cb.greaterThanOrEqualTo(campo, p.inicio()));
        if (p.fim() != null) e.add(cb.lessThan(campo, p.fim()));
    }

    /** Dígitos da busca para o WhatsApp (4 a 20; o número colado com +55 também acha, o gravado não tem o 55). */
    static String digitos(String texto) {
        String digitos = texto.replaceAll("\\D", "");
        if ((digitos.length() == 12 || digitos.length() == 13) && digitos.startsWith("55")) digitos = digitos.substring(2);
        if (digitos.length() < 4) return "";
        return digitos.length() > 20 ? digitos.substring(0, 20) : digitos;
    }

    /** {@code ABERTAS} (padrão), {@code TODAS} ou uma situação da inscrição. */
    static Set<SituacaoInscricao> situacoes(String situacao) {
        String valor = situacao == null || situacao.isBlank() ? "ABERTAS" : situacao.trim().toUpperCase(Locale.ROOT);
        if (valor.equals("ABERTAS")) return SituacaoInscricao.ABERTAS;
        if (valor.equals("TODAS")) return EnumSet.allOf(SituacaoInscricao.class);
        try {
            return EnumSet.of(SituacaoInscricao.valueOf(valor));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Situação precisa ser ABERTAS, TODAS ou uma situação da inscrição.");
        }
    }
}
