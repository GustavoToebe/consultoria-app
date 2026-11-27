package br.com.treinos.api.atencao;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** JPQL derivada: o {@code @TenantId} recorta pela consultoria da sessão. */
public interface RegraDeAtencaoRepository extends JpaRepository<RegraDeAtencao, UUID> {

    List<RegraDeAtencao> findAllByOrderByCriadoEmAscIdAsc();

    List<RegraDeAtencao> findByAtivaTrue();
}
