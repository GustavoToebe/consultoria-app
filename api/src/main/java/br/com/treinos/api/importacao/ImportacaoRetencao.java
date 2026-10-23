package br.com.treinos.api.importacao;

import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.web.Fuso;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;

/** Apaga importações com mais de um ano. O mesmo horário e o mesmo recorte da auditoria. */
@Component
public class ImportacaoRetencao {

    private final JdbcTemplate jdbc;
    private final ConsultoriaRepository consultorias;

    public ImportacaoRetencao(JdbcTemplate jdbc, ConsultoriaRepository consultorias) {
        this.jdbc = jdbc;
        this.consultorias = consultorias;
    }

    @Scheduled(cron = "0 20 3 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public void limparAntigos() {
        Instant limite = LocalDate.now(Fuso.BRASILIA).minusYears(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        consultorias.findAll().forEach(c -> jdbc.update(
                "delete from importacao where consultoria_id = ? and criado_em < ?", c.getId(), Timestamp.from(limite)));
    }
}
