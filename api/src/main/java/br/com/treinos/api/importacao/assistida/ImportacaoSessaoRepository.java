package br.com.treinos.api.importacao.assistida;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); a limpeza das vencidas leva a consultoria explícita. */
public interface ImportacaoSessaoRepository extends JpaRepository<ImportacaoSessao, UUID> {

    Optional<ImportacaoSessao> findByIdAndConsultoriaId(UUID id, UUID consultoriaId);

    /** Trava a sessão até o fim da transação: confirmações do mesmo grupo não correm uma sobre a outra. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ImportacaoSessao s where s.id = :id and s.consultoriaId = :consultoriaId")
    Optional<ImportacaoSessao> buscarParaAlterar(UUID id, UUID consultoriaId);

    /** Sessões ainda vigentes de quem as abriu (teto de sessões abertas por usuário). */
    long countByCriadoPorAndExpiraEmAfter(UUID criadoPor, Instant agora);

    /** Retenção: apaga as vencidas; os arquivos saem pela FK {@code ON DELETE CASCADE} (V066). Devolve quantas. */
    @Modifying
    @Query("delete from ImportacaoSessao s where s.consultoriaId = :consultoriaId and s.expiraEm < :agora")
    int apagarVencidas(UUID consultoriaId, Instant agora);
}
