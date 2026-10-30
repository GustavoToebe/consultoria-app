package br.com.treinos.api.pastas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}). */
public interface PastaRepository extends JpaRepository<PastaPlano, UUID> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PastaPlano p where p.id = :id")
    java.util.Optional<PastaPlano> travarParaAtualizacao(UUID id);

    List<PastaPlano> findByAlunoIdOrderByCriadoEmDesc(UUID alunoId);

    /**
     * As pastas que pedem "Renovar" (mesma regra de {@code precisaRenovar} do app, {@code dominio/resumoDoAluno.ts}): não
     * arquivada, aberta (sem {@code concluidaEm}), com fim até {@code limite} (hoje + 7; inclui a que já terminou) e sem
     * outra pasta não arquivada do mesmo aluno que comece depois do fim dela. Só de alunos ativos do escopo ("Meus alunos"
     * quando há responsável). Pastas, não alunos; do fim mais antigo ao mais novo. A contagem e a lista do painel saem
     * desta mesma consulta.
     */
    @org.springframework.data.jpa.repository.Query("select p from PastaPlano p "
            + "where p.alunoId in (select a.id from Aluno a where a.ativo = true "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)) "
            + "and p.arquivado = false and p.concluidaEm is null and p.fim is not null and p.fim <= :limite "
            + "and not exists (select 1 from PastaPlano q where q.alunoId = p.alunoId and q.id <> p.id "
            + "and q.arquivado = false and q.inicio is not null and q.inicio > p.fim) "
            + "order by p.fim asc, p.criadoEm asc, p.id asc")
    List<PastaPlano> aRenovar(UUID responsavelId, java.time.LocalDate limite);
}
