package br.com.treinos.api.fotos;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * SQL nativo da manutenção das fotos, permitido no {@code ArquiteturaTest}: a fila de remoção é global (só os UUIDs da foto e da
 * consultoria, sem aluno) e a limpeza das pendentes vê todas as consultorias de uma vez, no job, sem {@code TenantContext}.
 * O {@code @TenantId} não protege SQL nativo, por isso aqui nada devolve dado de pessoa: só ids de objeto e de consultoria. Quem remove foto de
 * um aluno específico usa a JPA (com o tenant) e só chama {@link #enfileirar}.
 */
@Component
class FotoRemocaoRepositorio {

    /** Espera após a n-ésima tentativa: 60 s × 2^n, no máximo 6 h. */
    private static final String ESPERA = "least(60 * power(2, r.tentativas), 21600)";

    private final JdbcTemplate jdbc;

    FotoRemocaoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static OffsetDateTime em(Instant instante) {
        return OffsetDateTime.ofInstant(instante, ZoneOffset.UTC);
    }

    void enfileirar(Collection<ObjetoDeFoto> objetos) {
        for (ObjetoDeFoto objeto : objetos) {
            jdbc.update("insert into foto_remocao (objeto, consultoria_id) values (?, ?) on conflict (objeto) do nothing",
                    objeto.fotoId(), objeto.consultoriaId());
        }
    }

    /**
     * Pendentes que ninguém ligou a uma atualização dentro do prazo: marca como removidas e enfileira o objeto, na mesma
     * transação. Devolve quantas.
     */
    int removerPendentesAntigas(Instant limite, Instant agora) {
        return jdbc.update("with p as (update atualizacao_foto set removida_em = ? where atualizacao_id is null "
                + "and removida_em is null and criada_em < ? returning id, consultoria_id) "
                + "insert into foto_remocao (objeto, consultoria_id) select id, consultoria_id from p on conflict (objeto) do nothing", em(agora), em(limite));
    }

    /** Linhas removidas há tempo suficiente para o limite diário já não depender delas. */
    int apagarRemovidasAntigas(Instant limite) {
        return jdbc.update("delete from atualizacao_foto where removida_em is not null and removida_em < ? and criada_em < ?",
                em(limite), em(limite));
    }

    /**
     * Arrenda um lote vencido: num só comando, empurra a próxima tentativa para frente (espera crescente) e devolve os objetos.
     * O HTTP de apagar roda depois, fora da transação; se der certo, {@link #concluir}; se falhar ou o processo cair, o objeto
     * volta sozinho quando o prazo vencer. {@code skip locked} evita dois processos com o mesmo lote.
     */
    List<ObjetoDeFoto> arrendarVencidas(Instant agora, int limite) {
        return jdbc.query("update foto_remocao r set tentativas = r.tentativas + 1, proxima_tentativa = ?::timestamptz + "
                + "make_interval(secs => " + ESPERA + ") where r.objeto in (select objeto from foto_remocao "
                + "where proxima_tentativa <= ? order by proxima_tentativa limit ? for update skip locked) returning r.objeto, r.consultoria_id",
                (rs, n) -> new ObjetoDeFoto(rs.getObject("consultoria_id", UUID.class), rs.getObject("objeto", UUID.class)),
                em(agora), em(agora), limite);
    }

    void concluir(ObjetoDeFoto objeto) {
        jdbc.update("delete from foto_remocao where objeto = ?", objeto.fotoId());
    }

    long naFila() {
        Long n = jdbc.queryForObject("select count(*) from foto_remocao", Long.class);
        return n == null ? 0 : n;
    }
}
