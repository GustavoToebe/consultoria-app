package br.com.treinos.api.importacao;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface ImportacaoRepository extends JpaRepository<Importacao, UUID> {

    @Query("select i from Importacao i where i.destino in :destinos "
            + "and (:destino is null or i.destino = :destino) "
            + "and (:situacao is null or i.situacao = :situacao) "
            + "and (:arquivo = '' or lower(i.nomeArquivo) = :arquivo) "
            + "and i.criadoEm >= :inicio and i.criadoEm < :fim "
            + "order by i.criadoEm desc")
    Page<Importacao> buscar(Collection<String> destinos, String destino, String situacao, String arquivo, Instant inicio,
                            Instant fim, Pageable pagina);
}
