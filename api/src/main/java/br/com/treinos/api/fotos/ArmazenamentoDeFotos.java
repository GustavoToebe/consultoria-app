package br.com.treinos.api.fotos;

import java.util.UUID;

/**
 * Bucket privado das fotos. O nome do objeto é só o UUID da foto. Existe como bean apenas com as fotos ligadas
 * ({@code treinos.fotos.habilitado=true}); o resto do app recebe um {@code ObjectProvider} e trata a ausência.
 */
public interface ArmazenamentoDeFotos {

    void gravar(UUID objeto, byte[] jpeg);

    /** @throws br.com.treinos.api.web.NaoEncontradoException se o objeto não existe no bucket */
    byte[] ler(UUID objeto);

    /** Apagar o que já não existe não é erro (a remoção é repetida até dar certo). */
    void apagar(UUID objeto);
}
