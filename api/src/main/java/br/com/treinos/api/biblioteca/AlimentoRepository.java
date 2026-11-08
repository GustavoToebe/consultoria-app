package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface AlimentoRepository extends JpaRepository<Alimento, UUID> {

    /**
     * Ativos de um tipo. Alimento comum casa o nome com acento ({@code lower}); suplemento usa {@code nomeBusca}
     * (sem acento), na consulta {@link #buscarSuplementos}.
     */
    @Query("select a from Alimento a where a.ativo = true and a.tipo = :tipo and lower(a.nome) like :padrao escape '\\' "
            + "order by lower(a.nome)")
    List<Alimento> buscarAtivosDoTipo(String padrao, Alimento.Tipo tipo);

    /** Alimentos comuns ativos. O suplemento não entra: a lista de alimentos de hoje continua só com {@code ALIMENTO}. */
    default List<Alimento> buscarAtivos(String padrao) {
        return buscarAtivosDoTipo(padrao, Alimento.Tipo.ALIMENTO);
    }

    /** {@code grupo} vazio = todas as categorias. {@code padrao} já vem sem acento e escapado. */
    @Query("select a from Alimento a where a.ativo = true and a.tipo = :tipo and a.nomeBusca like :padrao escape '\\' "
            + "and (:grupo = '' or a.grupo = :grupo) order by a.nomeBusca")
    List<Alimento> buscarSuplementos(String padrao, String grupo, Alimento.Tipo tipo);

    @Query("select count(a) > 0 from Alimento a where a.ativo = true and a.tipo = :tipo and lower(a.nome) = :nome "
            + "and a.id <> :exceto")
    boolean existeNomeAtivo(String nome, Alimento.Tipo tipo, UUID exceto);

    @Query("select count(a) > 0 from Alimento a where a.ativo = true and a.tipo = :tipo and a.nomeBusca = :nomeBusca "
            + "and a.id <> :exceto")
    boolean existeNomeBusca(String nomeBusca, Alimento.Tipo tipo, UUID exceto);

    @Query("select lower(a.nome) from Alimento a where a.ativo = true and a.tipo = :tipo")
    List<String> nomesAtivos(Alimento.Tipo tipo);

    /** Nomes deste tipo, ativos ou não: o padrão não recria o que o treinador tirou. */
    @Query("select a.nome from Alimento a where a.tipo = :tipo")
    List<String> nomes(Alimento.Tipo tipo);
}
