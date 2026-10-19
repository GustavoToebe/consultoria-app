package br.com.treinos.api.questionarios;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos (imagem de outra consultoria não aparece). */
public interface QuestionarioImagemRepository extends JpaRepository<QuestionarioImagem, UUID> {

    /** Ids (sem os bytes) das imagens criadas antes de {@code limite}: candidatas a órfãs. */
    @Query("select i.id from QuestionarioImagem i where i.criadaEm < :limite")
    List<UUID> idsCriadosAntes(Instant limite);

    /** Quais destes ids existem na consultoria (sem carregar os bytes). */
    @Query("select i.id from QuestionarioImagem i where i.id in :ids")
    List<UUID> existentes(Collection<UUID> ids);
}
