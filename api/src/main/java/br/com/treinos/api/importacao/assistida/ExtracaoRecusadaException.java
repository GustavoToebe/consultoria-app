package br.com.treinos.api.importacao.assistida;

/** O arquivo não pode ser lido com segurança; {@code codigo} é fixo e é o que vai para {@code erro_codigo}. */
public final class ExtracaoRecusadaException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String codigo;

    public ExtracaoRecusadaException(String codigo) {
        super(codigo);
        this.codigo = codigo;
    }

    public String codigo() {
        return codigo;
    }
}
