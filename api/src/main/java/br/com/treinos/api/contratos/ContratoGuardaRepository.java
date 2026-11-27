package br.com.treinos.api.contratos;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Consultas da guarda do contrato assinado (D16, {@link GuardaDoContratoAssinado}). SQL nativo de propósito: a entidade
 * {@link ContratoAluno} não mapeia {@code apagado_em} e o apagar é um UPDATE dirigido que tira os campos {@code updatable = false}
 * da entidade. Toda consulta leva {@code consultoria_id} explícito (o {@code @TenantId} não protege SQL nativo) e, onde há aluno, o
 * {@code aluno_id} da própria linha. Só a lista de consultorias é global ({@code Consultoria} não tem tenant).
 */
interface ContratoGuardaRepository extends Repository<ContratoAluno, UUID> {

    /** Os ids de todas as consultorias, para a rotina entrar em cada uma com o {@code TenantContext}. */
    @Query("select c.id from Consultoria c order by c.id")
    List<UUID> consultorias();

    /**
     * Assinados ainda guardados de aluno anonimizado: {@code [id, contratacao_id (ou nulo), dia de Brasília da assinatura
     * (aaaa-mm-dd)]}, tudo como texto (sem depender do tipo que o driver devolve).
     */
    @Query(nativeQuery = true, value = """
            select cast(c.id as text), cast(c.contratacao_id as text),
                   to_char(c.assinado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
              from contrato_aluno c
              join aluno a on a.consultoria_id = c.consultoria_id and a.id = c.aluno_id
             where c.consultoria_id = :consultoriaId
               and c.situacao = 'ASSINADO' and c.apagado_em is null
               and a.anonimizado_em is not null
             order by c.id
            """)
    List<Object[]> guardadosDeAlunoAnonimizado(UUID consultoriaId);

    /**
     * Apaga texto, evidências e link e marca o apagado; ficam id, título, sha256, situação e grupo. Idempotente (só casa com o não
     * apagado) e só de aluno anonimizado. Devolve 1 se apagou.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(nativeQuery = true, value = """
            update contrato_aluno
               set texto = null, assinado_em = null, assinado_por_usuario_id = null, assinante_nome = null, assinante_cpf = null,
                   assinante_ip = null, assinante_agente = null, assinante_declarou_responsavel = null,
                   link_hash = null, link_expira_em = null,
                   apagado_em = :agora, atualizado_em = :agora, versao = versao + 1
             where consultoria_id = :consultoriaId and id = :id
               and situacao = 'ASSINADO' and apagado_em is null
               and exists (select 1 from aluno a
                            where a.consultoria_id = contrato_aluno.consultoria_id and a.id = contrato_aluno.aluno_id
                              and a.anonimizado_em is not null)
            """)
    int apagar(UUID consultoriaId, UUID id, Instant agora);

    /** Os bytes do PDF do contrato (a linha de {@code contrato_arquivo}); sem PDF, 0. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(nativeQuery = true, value = "delete from contrato_arquivo where consultoria_id = :consultoriaId and contrato_id = :id")
    int apagarPdf(UUID consultoriaId, UUID id);
}
