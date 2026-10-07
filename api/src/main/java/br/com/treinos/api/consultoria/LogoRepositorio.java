package br.com.treinos.api.consultoria;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Bytes da logo, fora da entidade {@link Consultoria} para não irem junto em todo login (até 512 KiB). SQL nativo
 * permitido no {@code ArquiteturaTest}: a tabela {@code consultoria} é global e toda instrução filtra pelo id.
 */
@Component
public class LogoRepositorio {

    /** Classe, não record: array em record compara por referência (Error Prone, ArrayRecordComponent). */
    public static final class Logo {
        private final byte[] bytes;
        private final String tipo;

        Logo(byte[] bytes, String tipo) {
            this.bytes = bytes;
            this.tipo = tipo;
        }

        public byte[] bytes() {
            return bytes.clone();
        }

        public String tipo() {
            return tipo;
        }
    }

    private final JdbcTemplate jdbc;

    public LogoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void gravar(UUID consultoriaId, byte[] bytes, String tipo) {
        jdbc.update("update consultoria set logo = ?, logo_tipo = ?, logo_versao = logo_versao + 1 where id = ?",
                bytes, tipo, consultoriaId);
    }

    public void remover(UUID consultoriaId) {
        jdbc.update("update consultoria set logo = null, logo_tipo = null, logo_versao = logo_versao + 1 "
                + "where id = ? and logo is not null", consultoriaId);
    }

    public Optional<Logo> ler(UUID consultoriaId) {
        List<Logo> logos = jdbc.query("select logo, logo_tipo from consultoria where id = ? and logo is not null",
                (rs, n) -> new Logo(rs.getBytes(1), rs.getString(2)), consultoriaId);
        return logos.stream().findFirst();
    }
}
