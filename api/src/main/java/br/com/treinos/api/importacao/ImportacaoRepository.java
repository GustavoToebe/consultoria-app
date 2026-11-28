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

    /** {@code destinos} e {@code situacoes} nunca vazios: sem filtro, quem chama passa todos. */
    @Query("select i from Importacao i where i.destino in :destinos "
            + "and i.situacao in :situacoes "
            + "and (:arquivo = '' or lower(i.nomeArquivo) = :arquivo) "
            + "and i.criadoEm >= :inicio and i.criadoEm < :fim "
            + "order by i.criadoEm desc")
    Page<Importacao> buscar(Collection<String> destinos, Collection<String> situacoes, String arquivo, Instant inicio,
                            Instant fim, Pageable pagina);
}
