package br.com.treinos.api.fotos;

/**
 * Bucket privado das fotos. A chave do objeto é {@code consultorias/<consultoriaId>/fotos/<fotoId>.jpg} ({@link ChaveDeFoto}).
 * Existe como bean apenas com as fotos ligadas ({@code treinos.fotos.habilitado=true}); o resto do app recebe um
 * {@code ObjectProvider} e trata a ausência.
 */
public interface ArmazenamentoDeFotos {

    void gravar(String chave, byte[] jpeg);

    /** @throws br.com.treinos.api.web.NaoEncontradoException se o objeto não existe no bucket */
    byte[] ler(String chave);

    /** Apagar o que já não existe não é erro (a remoção é repetida até dar certo). */
    void apagar(String chave);
}
