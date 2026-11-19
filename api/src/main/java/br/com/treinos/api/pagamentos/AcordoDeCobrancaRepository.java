package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** O {@code @TenantId} filtra a consultoria: acordo ou pedido de outra consultoria não aparece. */
public interface AcordoDeCobrancaRepository extends JpaRepository<AcordoDeCobranca, UUID> {

    Optional<AcordoDeCobranca> findByPedidoId(UUID pedidoId);

    List<AcordoDeCobranca> findByAlunoIdOrderByCriadoEmDescIdDesc(UUID alunoId);

    /**
     * O aluno do acordo sem carregar a entidade: a linha só entra na sessão depois da trava do aluno, para o "já desfeito" e a
     * repetição do pedido lerem o estado de depois da espera (a sessão não relê uma entidade que já tem).
     */
    @Query("select a.alunoId from AcordoDeCobranca a where a.id = :id")
    Optional<UUID> alunoDe(UUID id);
}
