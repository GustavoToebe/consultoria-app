package br.com.treinos.api.importacao.assistida;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); a limpeza das vencidas leva a consultoria explícita. */
public interface ImportacaoSessaoRepository extends JpaRepository<ImportacaoSessao, UUID> {

    Optional<ImportacaoSessao> findByIdAndConsultoriaId(UUID id, UUID consultoriaId);

    List<ImportacaoSessao> findTop20ByConsultoriaIdOrderByCriadoEmDesc(UUID consultoriaId);

    /** Trava a sessão até o fim da transação: confirmações do mesmo grupo não correm uma sobre a outra. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ImportacaoSessao s where s.id = :id and s.consultoriaId = :consultoriaId")
    Optional<ImportacaoSessao> buscarParaAlterar(UUID id, UUID consultoriaId);

    /**
     * Sessões abertas de quem as abriu (teto por usuário): nem concluídas nem canceladas (as duas ficam {@code CONCLUIDA}
     * na coluna) e ainda não vencidas.
     */
    long countByCriadoPorAndEstadoNotAndExpiraEmAfter(UUID criadoPor, String estado, Instant agora);

    /**
     * Na subida da API: as que ficaram {@code PROCESSANDO} (a leitura morava só na memória da instância anterior). Trava
     * as linhas como {@link #buscarParaAlterar}: soltar não corre com a conclusão de uma leitura que ainda grava.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<ImportacaoSessao> findByConsultoriaIdAndEstado(UUID consultoriaId, String estado);

    /** Retenção: apaga as vencidas; os arquivos saem pela FK {@code ON DELETE CASCADE} (V066). Devolve quantas. */
    @Modifying
    @Query("delete from ImportacaoSessao s where s.consultoriaId = :consultoriaId and s.expiraEm < :agora")
    int apagarVencidas(UUID consultoriaId, Instant agora);
}
