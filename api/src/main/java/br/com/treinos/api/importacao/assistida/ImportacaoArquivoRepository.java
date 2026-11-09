package br.com.treinos.api.importacao.assistida;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportacaoArquivoRepository extends JpaRepository<ImportacaoArquivo, UUID> {

    List<ImportacaoArquivo> findBySessaoIdOrderByCriadoEmAsc(UUID sessaoId);

    Optional<ImportacaoArquivo> findByIdAndSessaoId(UUID id, UUID sessaoId);

    void deleteBySessaoId(UUID sessaoId);
}
