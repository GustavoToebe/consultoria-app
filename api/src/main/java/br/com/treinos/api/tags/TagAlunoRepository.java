package br.com.treinos.api.tags;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Filtrado pela consultoria da sessão ({@code @TenantId}); tag de outra consultoria nunca aparece. */
public interface TagAlunoRepository extends JpaRepository<TagAluno, UUID> {

    boolean existsByNomeNormalizado(String nomeNormalizado);

    boolean existsByNomeNormalizadoAndIdNot(String nomeNormalizado, UUID id);

    /**
     * As tags pedidas para o aluno, com trava de leitura (FOR SHARE) em ordem de id: apagar a tag ao mesmo tempo espera esta
     * transação e não deixa uma ligação nascer para uma tag que acabou de sumir. Não conflita com outra gravação de tags.
     */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select t from TagAluno t where t.id in :ids order by t.id")
    List<TagAluno> travarLeitura(Collection<UUID> ids);

    @Query("select t from TagAluno t order by t.nomeNormalizado, t.id")
    List<TagAluno> todasEmOrdem();

    @Query("select count(t) from TagAluno t where t.id in :ids")
    long contarExistentes(Collection<UUID> ids);
}
