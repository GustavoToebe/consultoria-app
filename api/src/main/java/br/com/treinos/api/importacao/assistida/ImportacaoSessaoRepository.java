package br.com.treinos.api.importacao.assistida;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportacaoSessaoRepository extends JpaRepository<ImportacaoSessao, UUID> {

    Optional<ImportacaoSessao> findByIdAndConsultoriaId(UUID id, UUID consultoriaId);

    @Query("SELECT s FROM ImportacaoSessao s WHERE s.expiraEm < :agora")
    List<ImportacaoSessao> buscarExpiradas(@Param("agora") Instant agora);
}
