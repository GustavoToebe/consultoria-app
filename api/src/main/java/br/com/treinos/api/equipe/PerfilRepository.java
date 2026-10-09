package br.com.treinos.api.equipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface PerfilRepository extends JpaRepository<Perfil,UUID> {
    @Query("select distinct p from Perfil p left join fetch p.permissoes where p.id=:id and p.consultoriaId=:consultoriaId")
    Optional<Perfil> buscar(UUID id,UUID consultoriaId);
    List<Perfil> findAllByOrderByNomeAsc();
}
