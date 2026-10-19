package br.com.treinos.api.inscricoes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/** Uma configuração por consultoria; a da sessão sai pelo {@code @TenantId}. */
public interface InscricaoConfiguracaoRepository extends JpaRepository<InscricaoConfiguracao, UUID> {

    @Query("select c from InscricaoConfiguracao c")
    Optional<InscricaoConfiguracao> atual();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from InscricaoConfiguracao c")
    Optional<InscricaoConfiguracao> atualParaAlterar();
}
