package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ConquistaAlunoRepository extends JpaRepository<ConquistaAluno, UUID> {
    List<ConquistaAluno> findByAlunoIdOrderByConquistadaEmDesc(UUID alunoId);
    boolean existsByAlunoIdAndTipo(UUID alunoId, String tipo);
}
