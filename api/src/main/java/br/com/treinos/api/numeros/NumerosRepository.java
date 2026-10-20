package br.com.treinos.api.numeros;

import br.com.treinos.api.alunos.Aluno;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Consultas agregadas do relatório "Números". Só JPQL: o {@code @TenantId} das entidades vale em todas as consultas,
 * então a consultoria nunca vem do cliente. Nada aqui devolve id, nome ou dado de pessoa.
 */
public interface NumerosRepository extends Repository<Aluno, UUID> {

    /**
     * Alunos que existiam e estavam ativos no instante {@code limite} (exclusivo): criados antes dele e ainda não
     * inativados nem anonimizados. Ver a aproximação sobre reativação em {@link NumerosService}.
     */
    @Query("select count(a) from Aluno a where a.criadoEm < :limite "
            + "and (a.inativadoEm is null or a.inativadoEm >= :limite) "
            + "and (a.anonimizadoEm is null or a.anonimizadoEm >= :limite)")
    long ativosEm(Instant limite);

    /** Mês corrente ("agora"): mesma regra, mais a situação de hoje, que é a que o painel conta. */
    @Query("select count(a) from Aluno a where a.ativo = true and a.criadoEm < :limite "
            + "and (a.inativadoEm is null or a.inativadoEm >= :limite) "
            + "and (a.anonimizadoEm is null or a.anonimizadoEm >= :limite)")
    long ativosAgora(Instant limite);

    /**
     * Só as três datas de cada atualização da consultoria, sem aluno. Filtro grosso por data (o prazo é
     * {@code max(data, atrasoAte)}, ou seja, está na janela se uma das duas datas está em {@code [inicio, ...]}); o recorte
     * exato do mês é feito em Java com {@code RegrasAtualizacao.prazo}.
     */
    @Query("select new br.com.treinos.api.numeros.LinhaPrazo(u.dataAtualizacao, u.atrasoAte, u.enviadaEm) "
            + "from Atualizacao u where u.dataAtualizacao <= :fim and (u.dataAtualizacao >= :inicio or u.atrasoAte >= :inicio)")
    List<LinhaPrazo> prazosNaJanela(LocalDate inicio, LocalDate fim);

    /**
     * Pastas da janela sem linha de atualização, que o painel trataria como "tem atualização": não arquivada, com
     * {@code fim} e com treino ou dieta publicado (e não arquivado). Cada pasta aparece uma vez. O recorte por mês e
     * "prazo antes de hoje" é feito em Java; aqui só o filtro grosso por {@code fim}.
     */
    @Query("select new br.com.treinos.api.numeros.PastaSemLinha(p.fim, a.criadoEm, a.inativadoEm, a.anonimizadoEm) "
            + "from PastaPlano p join Aluno a on a.id = p.alunoId "
            + "where p.arquivado = false and p.fim between :inicio and :fim "
            + "and not exists (select u.id from Atualizacao u where u.pastaId = p.id) "
            + "and (exists (select t.id from PlanoTreino t where t.pastaId = p.id and t.arquivado = false "
            + "and t.publicadoEm is not null) "
            + "or exists (select d.id from PlanoDieta d where d.pastaId = p.id and d.arquivado = false "
            + "and d.publicadoEm is not null))")
    List<PastaSemLinha> pastasSemLinhaNaJanela(LocalDate inicio, LocalDate fim);
}
