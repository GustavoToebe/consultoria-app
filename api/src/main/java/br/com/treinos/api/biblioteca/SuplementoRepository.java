package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface SuplementoRepository extends JpaRepository<Suplemento, UUID> {

    /** {@code categoria} vazia = todas. {@code padrao} já vem sem acento e escapado ({@code Buscas.padraoSemAcento}). */
    @Query("select s from Suplemento s where s.ativo = true and s.nomeBusca like :padrao escape '\\' "
            + "and (:categoria = '' or s.categoria = :categoria) order by s.nomeBusca")
    List<Suplemento> buscarAtivos(String padrao, String categoria);

    @Query("select distinct s.categoria from Suplemento s where s.ativo = true and s.categoria is not null "
            + "order by s.categoria")
    List<String> categoriasAtivas();

    @Query("select count(s) > 0 from Suplemento s where s.ativo = true and s.nomeBusca = :nomeBusca and s.id <> :exceto")
    boolean existeNomeAtivo(String nomeBusca, UUID exceto);
}
