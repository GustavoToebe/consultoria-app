package br.com.treinos.api.importacao;

import org.hibernate.resource.jdbc.spi.StatementInspector;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Conta os {@code SELECT ... FOR [NO KEY] UPDATE} que o Hibernate emite sobre a tabela {@code aluno} (a trava de linha do
 * {@code PESSIMISTIC_WRITE}). Registrado só no teste, por {@code hibernate.session_factory.statement_inspector}; o Hibernate
 * o instancia pelo construtor sem argumentos, por isso o contador é estático (quem usa zera antes de medir).
 */
public class TravasDeAlunoNoSql implements StatementInspector {

    private static final Pattern DA_TABELA_ALUNO = Pattern.compile("\\bfrom\\s+aluno\\s");
    private static final AtomicInteger TRAVAS = new AtomicInteger();

    static void zerar() {
        TRAVAS.set(0);
    }

    static int travas() {
        return TRAVAS.get();
    }

    @Override
    public String inspect(String sql) {
        String s = sql.toLowerCase(Locale.ROOT);
        if ((s.contains(" for update") || s.contains(" for no key update")) && DA_TABELA_ALUNO.matcher(s).find()) {
            TRAVAS.incrementAndGet();
        }
        return sql;
    }
}
