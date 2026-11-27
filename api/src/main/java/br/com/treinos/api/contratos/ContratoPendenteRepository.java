package br.com.treinos.api.contratos;

import org.springframework.data.repository.Repository;

import java.time.Instant;
import java.util.UUID;

/** Só a pergunta da trava (D5), separada do {@link ContratoAlunoRepository}. O {@code @TenantId} filtra por consultoria. */
public interface ContratoPendenteRepository extends Repository<ContratoAluno, UUID> {

    /** Pendente com {@code prazo_ate} já passado (prazo nulo nunca vence: a comparação com nulo não casa). */
    boolean existsByAlunoIdAndSituacaoAndPrazoAteBefore(UUID alunoId, ContratoAluno.Situacao situacao, Instant agora);
}
