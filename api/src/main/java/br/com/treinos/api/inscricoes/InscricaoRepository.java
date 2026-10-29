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
    record Contato(UUID id, String email, String whatsapp, SituacaoInscricao situacao) {
    }

    /** Linha das contagens por situação. */
    record PorSituacao(SituacaoInscricao situacao, long quantidade) {
    }

    /** Entrada e aceite de uma inscrição (tempo até o aceite, nos indicadores). */
    record EntradaEAceite(Instant criadaEm, Instant aceitaEm) {
    }

    /** Linha da contagem por origem (indicadores). */
    record PorOrigem(Crm.Origem origem, long entradas, long aceites) {
    }

    /** E-mail (em minúsculas) de um aluno, só para o aviso de duplicidade. */
    record AlunoComEmail(UUID id, String email) {
    }

    /** Filtros da fila (o mesmo trecho da lista e das contagens). */
    String FILTROS = "(:responsavelId is null or i.responsavelId = :responsavelId) "
            + "and (:semResponsavel = false or i.responsavelId is null) "
            + "and (:origem is null or i.origem = :origem) and (:semOrigem = false or i.origem is null) "
            + "and (:busca = false or i.nomeBusca like :nome escape '\\' or lower(i.email) like :texto escape '\\' "
            + "or (:digitos <> '' and i.whatsappDigitos like :digitosPadrao))";

    /**
     * Fila filtrada: situações, responsável ({@code responsavelId} ou só as sem responsável), origem (uma ou só as sem
     * origem) e busca por nome (sem acento), e-mail ou dígitos do WhatsApp. Mais novas primeiro (ordem fixa).
     */
    @Query("select i from Inscricao i where i.situacao in :situacoes and " + FILTROS + " order by i.criadaEm desc, i.id")
    Page<Inscricao> buscar(Collection<SituacaoInscricao> situacoes, UUID responsavelId, boolean semResponsavel,
                           Crm.Origem origem, boolean semOrigem, boolean busca, String nome, String texto, String digitos,
                           String digitosPadrao, Pageable pagina);

    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$PorSituacao(i.situacao, count(i)) "
            + "from Inscricao i where " + FILTROS + " group by i.situacao")
    List<PorSituacao> contarPorSituacao(UUID responsavelId, boolean semResponsavel, Crm.Origem origem, boolean semOrigem,
                                        boolean busca, String nome, String texto, String digitos, String digitosPadrao);

    /** Trava a inscrição: dois aceites (ou aceite e recusa) simultâneos ficam em série. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inscricao i where i.id = :id")
    Optional<Inscricao> buscarParaAlterar(UUID id);

    /** Inscrições (de qualquer situação) com o mesmo e-mail ou WhatsApp (o chamador tira a própria da conta). */
    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$Contato(i.id, lower(i.email), i.whatsapp, i.situacao) "
            + "from Inscricao i where lower(i.email) in :emails or i.whatsapp in :whatsapps")
    List<Contato> comContato(Collection<String> emails, Collection<String> whatsapps);

    /** Até 20 inscrições com o mesmo e-mail ou WhatsApp, mais novas primeiro (a própria fica de fora). */
    @Query("select i from Inscricao i where i.id <> :id and ((:email is not null and lower(i.email) = :email) "
            + "or i.whatsapp = :whatsapp) order by i.criadaEm desc, i.id")
    List<Inscricao> semelhantes(UUID id, String email, String whatsapp, Pageable limite);

    /** Alunos da consultoria com um destes e-mails (o cadastro do aluno não tem telefone). */
    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$AlunoComEmail(a.id, lower(a.email)) "
            + "from Aluno a where lower(a.email) in :emails order by a.criadoEm")
    List<AlunoComEmail> alunosComEmail(Collection<String> emails);

    Optional<Inscricao> findByAlunoId(UUID alunoId);

    /** Inscrições da consultoria recebidas desde {@code inicio} (teto diário do link público). */
    long countByCriadaEmAfter(Instant inicio);

    // ---- Indicadores (períodos [inicio, fim)) ----

    @Query("select count(i) from Inscricao i where i.criadaEm >= :inicio and i.criadaEm < :fim")
    long entradas(Instant inicio, Instant fim);

    @Query("select count(distinct i.whatsappDigitos) from Inscricao i where i.criadaEm >= :inicio and i.criadaEm < :fim")
    long pessoas(Instant inicio, Instant fim);

    @Query("select count(i) from Inscricao i where i.criadaEm >= :inicio and i.criadaEm < :fim and i.aceitaEm is not null")
    long aceitesDasEntradas(Instant inicio, Instant fim);

    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$EntradaEAceite(i.criadaEm, i.aceitaEm) "
            + "from Inscricao i where i.aceitaEm >= :inicio and i.aceitaEm < :fim")
    List<EntradaEAceite> aceites(Instant inicio, Instant fim, Pageable limite);

    @Query("select count(i) from Inscricao i where i.aceitaEm >= :inicio and i.aceitaEm < :fim")
    long contarAceites(Instant inicio, Instant fim);

    @Query("select new br.com.treinos.api.inscricoes.InscricaoRepository$PorOrigem(i.origem, count(i), "
            + "sum(case when i.aceitaEm is not null then 1L else 0L end)) "
            + "from Inscricao i where i.criadaEm >= :inicio and i.criadaEm < :fim group by i.origem")
    List<PorOrigem> porOrigem(Instant inicio, Instant fim);

    /**
     * Retenção: recusadas e desistentes sem atividade desde antes do limite. As notas saem pela FK em cascata. Quem
     * registra atividade grava {@code ultimaAtividadeEm} na mesma linha antes (ver {@link #registrarAtividade}): o
     * {@code delete} espera a trava da linha e confere de novo o valor gravado, então uma nota de agora segura a limpeza.
     */
    @Modifying
    @Query("delete from Inscricao i where i.consultoriaId = :consultoriaId and i.situacao in :situacoes "
            + "and i.ultimaAtividadeEm < :limite")
    int apagarEncerradas(UUID consultoriaId, Collection<SituacaoInscricao> situacoes, Instant limite);

    /**
     * Atividade que não altera a inscrição (nota, retorno, mensagem preparada): só a coluna da atividade, sem subir a
     * versão (quem está editando o andamento não leva 409 por uma nota). Trava a linha até o fim da transação;
     * devolve 0 se a inscrição não existe mais (outra consultoria ou apagada pela retenção).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("update Inscricao i set i.ultimaAtividadeEm = :agora where i.consultoriaId = :consultoriaId and i.id = :id")
    int registrarAtividade(UUID consultoriaId, UUID id, Instant agora);
}
