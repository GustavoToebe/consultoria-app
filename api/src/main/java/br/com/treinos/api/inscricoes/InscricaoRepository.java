package br.com.treinos.api.inscricoes;

import br.com.treinos.api.alunos.Aluno;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
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
public interface InscricaoRepository extends JpaRepository<Inscricao, UUID>, JpaSpecificationExecutor<Inscricao> {

    /** Contato de uma inscrição, só para o aviso de duplicidade (e-mail já em minúsculas). */
    record Contato(UUID id, String email, String whatsapp, SituacaoInscricao situacao) {
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

    /**
     * Indicação por link: o aluno com este código, só se estiver ativo e não anonimizado. O {@code @TenantId} restringe à
     * consultoria da sessão (a do link público, dentro do {@code TenantContext.executarComo}); de outra consultoria, vazio.
     * Chamar só depois do INSERT da inscrição (consultoria antes de aluno, como a anonimização). Trava a linha em modo
     * compartilhado até o fim da transação: a anonimização trava o aluno para escrita, então ela espera a
     * inscrição gravar (e depois zera a coluna) ou termina antes e este código já não vale.
     */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select a from Aluno a where a.codigoIndicacao = :codigo and a.ativo = true and a.anonimizadoEm is null")
    Optional<Aluno> indicadorValido(UUID codigo);

    /**
     * Grava o indicador na inscrição recém-criada (a coluna é {@code updatable=false} na entidade). Roda depois do INSERT e do
     * {@link #indicadorValido}, com a linha do aluno já travada; não sobe a versão.
     */
    @Modifying(flushAutomatically = true)
    @Query("update Inscricao i set i.indicadoPorAlunoId = :aluno where i.id = :id")
    int gravarIndicador(UUID id, UUID aluno);

    /** Nome do aluno da consultoria (só o detalhe da inscrição, para quem tem {@code ALUNO_LER}). */
    @Query("select a.nome from Aluno a where a.id = :id")
    Optional<String> nomeDoAluno(UUID id);

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
