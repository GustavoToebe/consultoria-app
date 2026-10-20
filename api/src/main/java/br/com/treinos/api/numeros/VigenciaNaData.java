package br.com.treinos.api.numeros;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Qual pasta era a vigente de um aluno numa data do passado. É a ideia de {@code PastaVigente} (que olha o plano ativo de
 * hoje) aplicada só com as datas que existem: entre as candidatas do aluno, a de maior {@code inicio} que seja menor ou
 * igual à data; empate de {@code inicio}, a de {@code criado_em} mais recente. Pasta que começa depois da data não tira a
 * anterior (a seguinte começar no dia seguinte ao fim é o normal). Sem Spring nem banco, para testar com tabelas de datas.
 */
final class VigenciaNaData {

    private static final Comparator<PastaCandidata> MAIS_VIGENTE = Comparator
            .comparing(PastaCandidata::inicio)
            .thenComparing(PastaCandidata::criadoEm)
            .thenComparing(PastaCandidata::pastaId);

    private final Map<UUID, List<PastaCandidata>> porAluno = new HashMap<>();

    VigenciaNaData(Collection<PastaCandidata> candidatas) {
        for (PastaCandidata candidata : candidatas) {
            porAluno.computeIfAbsent(candidata.alunoId(), a -> new ArrayList<>()).add(candidata);
        }
    }

    /** Id da pasta vigente do aluno em {@code data}, ou vazio se nenhuma candidata já tinha começado. */
    Optional<UUID> vigente(UUID alunoId, LocalDate data) {
        return porAluno.getOrDefault(alunoId, List.of()).stream()
                .filter(p -> !p.inicio().isAfter(data))
                .max(MAIS_VIGENTE)
                .map(PastaCandidata::pastaId);
    }
}
