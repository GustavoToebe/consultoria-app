package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface ErgogenicoRepository extends JpaRepository<Ergogenico, UUID> {

    /**
     * {@code categoria} vazia = todas. {@code padrao} já vem sem acento e escapado ({@code Buscas.padraoSemAcento});
     * a busca olha o nome e o princípio ativo.
     */
    @Query("select e from Ergogenico e where e.ativo = true and (e.nomeBusca like :padrao escape '\\' "
            + "or e.principioBusca like :padrao escape '\\') "
            + "and (:categoria = '' or e.categoria = :categoria) order by e.nomeBusca, e.concentracao")
    List<Ergogenico> buscarAtivos(String padrao, String categoria);

    /** Mesmo nome, concentração e apresentação (ausente = vazio) entre os ativos. */
    @Query("select count(e) > 0 from Ergogenico e where e.ativo = true and e.nomeBusca = :nomeBusca "
            + "and coalesce(e.concentracao, '') = :concentracao and coalesce(e.apresentacao, '') = :apresentacao "
            + "and e.id <> :exceto")
    boolean existeIgual(String nomeBusca, String concentracao, String apresentacao, UUID exceto);
}
