package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/** Filtrado pela consultoria da sessão ({@code @TenantId}): no máximo uma subconta Asaas por consultoria. */
public interface SubcontaAsaasRepository extends JpaRepository<SubcontaAsaas, UUID> {

    @Query("select s from SubcontaAsaas s")
    Optional<SubcontaAsaas> daConsultoria();

    @Query("select count(s) > 0 from SubcontaAsaas s where s.situacao = :situacao")
    boolean existeNaSituacao(SubcontaAsaas.Situacao situacao);

    default boolean estaAtiva() {
        return existeNaSituacao(SubcontaAsaas.Situacao.ATIVA);
    }
}
