package br.com.treinos.api.receitas;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface PastaModeloRepository extends JpaRepository<PastaModelo, UUID> {
    List<PastaModelo> findAllByOrderByNomeAsc();
}
