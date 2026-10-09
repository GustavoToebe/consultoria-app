package br.com.treinos.api.atualizacoes;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface AtualizacaoModeloRepository extends JpaRepository<AtualizacaoModelo, UUID> {
    Optional<AtualizacaoModelo> findFirstByOrderByVersaoDesc();
    Optional<AtualizacaoModelo> findByVersao(int versao);
}
