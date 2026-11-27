package br.com.treinos.api.contratos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface ContratoAlunoRepository extends JpaRepository<ContratoAluno, UUID> {

    List<ContratoAluno> findByAlunoIdOrderByGeradoEmDescIdDesc(UUID alunoId);

    Optional<ContratoAluno> findByPedidoId(UUID pedidoId);

    /** Os dois contratos do par aluno + responsável (ou um só, se o outro ainda não existe). */
    List<ContratoAluno> findByGrupoId(UUID grupoId);

    /** Só o do aluno dado: de outro aluno ou consultoria não aparece. */
    Optional<ContratoAluno> findByIdAndAlunoId(UUID id, UUID alunoId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoAluno c where c.id = :id")
    Optional<ContratoAluno> buscarParaAlterar(UUID id);

    /** O grupo de um contrato, sem carregar a entidade (a trava vem depois, de uma vez só e em ordem). */
    @Query("select c.grupoId from ContratoAluno c where c.id = :id")
    Optional<UUID> grupoDe(UUID id);

    /** Trava o grupo inteiro em ordem de id: duas chamadas em contratos irmãos esperam uma pela outra em vez de travar em cruz. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoAluno c where c.grupoId = :grupoId order by c.id")
    List<ContratoAluno> buscarGrupoParaAlterar(UUID grupoId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoAluno c where c.id = :id and c.alunoId = :alunoId")
    Optional<ContratoAluno> buscarDoAlunoParaAlterar(UUID id, UUID alunoId);

    /** Página pública, só leitura: o contrato do link (a consultoria já está no contexto). */
    Optional<ContratoAluno> findByLinkHash(String linkHash);

    /**
     * Assinar pelo link: a linha fica travada, então duas assinaturas ao mesmo tempo gravam uma só. Depois que a primeira confirma, o
     * link some da linha e a segunda, que esperava a trava, não acha nada (o mesmo 404 de código usado).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoAluno c where c.linkHash = :linkHash")
    Optional<ContratoAluno> buscarPorLinkParaAlterar(String linkHash);

    /**
     * Anonimização e "Excluir minha conta" (D16): o pendente e o cancelado saem (o PDF vai junto, pelo cascade do banco); o assinado
     * fica. O filtro de consultoria vem do {@code @TenantId}.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from ContratoAluno c where c.alunoId = :alunoId and c.situacao <> :assinado")
    int apagarNaoAssinados(UUID alunoId, ContratoAluno.Situacao assinado);
}
