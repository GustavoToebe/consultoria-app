package br.com.treinos.api.importacao.assistida;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportacaoArquivoRepository extends JpaRepository<ImportacaoArquivo, UUID> {

    List<ImportacaoArquivo> findBySessaoIdOrderByCriadoEmAsc(UUID sessaoId);

    Optional<ImportacaoArquivo> findByIdAndSessaoId(UUID id, UUID sessaoId);

    void deleteBySessaoId(UUID sessaoId);

    long countBySessaoId(UUID sessaoId);

    /** Soma dos bytes enviados à sessão (teto por sessão), sem carregar o conteúdo. */
    @Query("select coalesce(sum(a.tamanhoBytes), 0) from ImportacaoArquivo a where a.sessaoId = :sessaoId")
    long somaDeBytes(UUID sessaoId);

    /** Libera os bytes originais quando a sessão é concluída ou não restam grupos pendentes. */
    @Modifying
    @Query("update ImportacaoArquivo a set a.conteudoBytes = null where a.sessaoId = :sessaoId and a.conteudoBytes is not null")
    int limparConteudoBytesDaSessao(UUID sessaoId);
}
