package br.com.treinos.api.atualizacoes;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
public interface AtualizacaoRepository extends JpaRepository<Atualizacao, UUID> {
    Optional<Atualizacao> findByPastaId(UUID pastaId);
    List<Atualizacao> findByAlunoIdOrderByDataAtualizacaoDesc(UUID alunoId);
    List<Atualizacao> findAllByOrderByDataAtualizacaoDesc();
}
