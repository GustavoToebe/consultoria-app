package br.com.treinos.api.inscricoes;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Toda leitura sai filtrada pela consultoria da sessão ({@code @TenantId} em {@link Inscricao} e {@code Aluno}). Os
 * {@code delete} em lote levam a consultoria ou o aluno explícitos, sem depender do filtro do tenant.
 */
public interface InscricaoRepository extends JpaRepository<Inscricao, UUID> {

    /** Contato de uma inscrição, só para o aviso de duplicidade (e-mail já em minúsculas). */
    record Contato(UUID id, String email, String whatsapp) {
    }

    /** E-mail (em minúsculas) de um aluno, só para o aviso de duplicidade. */
    record AlunoComEmail(UUID id, String email) {
    }

    @Query("select i from Inscricao i where i.situacao in :situacoes "
            + "and (:responsavelId is null or i.responsavelId = :responsavelId) order by i.criadaEm desc, i.id")
    Page<Inscricao> buscar(Collection<SituacaoInscricao> situacoes, UUID responsavelId, Pageable pagina);

    /** Trava a inscrição: dois aceites (ou aceite e recusa) simultâneos ficam em série. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inscricao i where i.id = :id")
    Optional<Inscricao> buscarParaAlterar(UUID id);

    /** Inscrições ainda em atendimento com o mesmo e-mail ou WhatsApp (o chamador tira a própria da conta). */
    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$Contato(i.id, lower(i.email), i.whatsapp) "
            + "from Inscricao i where i.situacao in :abertas and (lower(i.email) in :emails or i.whatsapp in :whatsapps)")
    List<Contato> abertasComContato(Collection<SituacaoInscricao> abertas, Collection<String> emails,
                                    Collection<String> whatsapps);

    /** Alunos da consultoria com um destes e-mails (o cadastro do aluno não tem telefone). */
    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$AlunoComEmail(a.id, lower(a.email)) "
            + "from Aluno a where lower(a.email) in :emails order by a.criadoEm")
    List<AlunoComEmail> alunosComEmail(Collection<String> emails);

    Optional<Inscricao> findByAlunoId(UUID alunoId);

    /** Retenção: recusadas e desistentes paradas desde antes do limite. As notas saem pela FK em cascata. */
    @Modifying
    @Query("delete from Inscricao i where i.consultoriaId = :consultoriaId and i.situacao in :situacoes "
            + "and i.atualizadaEm < :limite")
    int apagarEncerradas(UUID consultoriaId, Collection<SituacaoInscricao> situacoes, Instant limite);
}
