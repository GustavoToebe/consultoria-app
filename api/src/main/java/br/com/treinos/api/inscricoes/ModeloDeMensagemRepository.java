package br.com.treinos.api.inscricoes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Respostas prontas da consultoria da sessão ({@code @TenantId}). */
public interface ModeloDeMensagemRepository extends JpaRepository<ModeloDeMensagem, UUID> {

    @Query("select m from ModeloDeMensagem m order by m.ordem, m.nome")
    List<ModeloDeMensagem> todos();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from ModeloDeMensagem m where m.id = :id")
    Optional<ModeloDeMensagem> buscarParaAlterar(UUID id);

    @Query("select count(m) > 0 from ModeloDeMensagem m where lower(m.nome) = lower(:nome) and (:id is null or m.id <> :id)")
    boolean nomeEmUso(String nome, UUID id);

}
