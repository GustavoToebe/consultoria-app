package br.com.treinos.api.fotos;

import java.util.UUID;

/** Um objeto no bucket: a foto e a consultoria dona dela (os dois vêm do banco). Só ids, nada de pessoa. */
record ObjetoDeFoto(UUID consultoriaId, UUID fotoId) {

    String chave() {
        return ChaveDeFoto.de(consultoriaId, fotoId);
    }

    static ObjetoDeFoto de(AtualizacaoFoto foto) {
        return new ObjetoDeFoto(foto.getConsultoriaId(), foto.getId());
    }
}
