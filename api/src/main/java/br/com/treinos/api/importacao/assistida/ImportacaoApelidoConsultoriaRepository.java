package br.com.treinos.api.importacao.assistida;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportacaoApelidoConsultoriaRepository extends JpaRepository<ImportacaoApelidoConsultoria, UUID> {

    List<ImportacaoApelidoConsultoria> findByConsultoriaIdOrderByTermoOriginalAsc(UUID consultoriaId);

    List<ImportacaoApelidoConsultoria> findByConsultoriaIdAndTipo(UUID consultoriaId, String tipo);

    Optional<ImportacaoApelidoConsultoria> findByConsultoriaIdAndTipoAndTermoNormalizado(UUID consultoriaId,
                                                                                       String tipo,
                                                                                       String termoNormalizado);

    Optional<ImportacaoApelidoConsultoria> findByIdAndConsultoriaId(UUID id, UUID consultoriaId);
}
