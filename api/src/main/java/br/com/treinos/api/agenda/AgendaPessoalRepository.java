package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Agendas pessoais. Leitura filtrada pelo {@code @TenantId}; toda busca leva também o dono (a sessão), então agenda de
 * outro membro ou de outra consultoria nunca aparece (404 no serviço).
 */
public interface AgendaPessoalRepository extends JpaRepository<AgendaPessoal, UUID> {

    List<AgendaPessoal> findByDonoId(UUID donoId);

    Optional<AgendaPessoal> findByIdAndDonoId(UUID id, UUID donoId);

    long countByDonoId(UUID donoId);

    boolean existsByDonoIdAndNomeIgnoreCase(UUID donoId, String nome);

    boolean existsByDonoIdAndNomeIgnoreCaseAndIdNot(UUID donoId, String nome, UUID id);
}
