package br.com.treinos.api.numeros;

import br.com.treinos.api.alunos.Aluno;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Consultas agregadas do relatório "Números". Só JPQL: o {@code @TenantId} de {@code Aluno} e de {@code Atualizacao}
 * vale nas duas consultas, então a consultoria nunca vem do cliente. Nada aqui devolve id, nome ou dado de pessoa.
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
}
