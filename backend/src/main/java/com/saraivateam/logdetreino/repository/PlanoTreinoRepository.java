package com.saraivateam.logdetreino.repository;

import com.saraivateam.logdetreino.domain.PlanoTreino;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlanoTreinoRepository extends JpaRepository<PlanoTreino, Long> {
}
