package br.com.treinos.api.consultoria;

import br.com.treinos.api.consultoria.MarcaService.ConsultoriaResponse;
import br.com.treinos.api.consultoria.MarcaService.MarcaRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.BadRequestException;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** Marca e metodologia da consultoria do treinador logado (a consultoria vem sempre da sessão). */
@RestController
@RequestMapping("/consultoria")
public class MarcaController {

    private final MarcaService marcas;

    public MarcaController(MarcaService marcas) {
        this.marcas = marcas;
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER') or hasAuthority('PERM_DIETA_LER') or hasAuthority('PERM_MODELO_LER') or hasAuthority('PERM_MARCA_ALTERAR') or hasAuthority('PERM_METODOLOGIA_ALTERAR')")
    @GetMapping
    public ConsultoriaResponse consultoria(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return marcas.consultoria(eu.consultoriaId());
    }

    @PreAuthorize("hasAuthority('PERM_MARCA_ALTERAR')")
    @PutMapping("/marca")
    public ConsultoriaResponse alterarMarca(@AuthenticationPrincipal UsuarioAutenticado eu,
                                           @RequestBody @Valid MarcaRequest request) {
        return marcas.alterarMarca(eu.consultoriaId(), request);
    }

    @PreAuthorize("hasAuthority('PERM_MARCA_ALTERAR')")
    @PutMapping(value = "/marca/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MarcaPublica enviarLogo(@AuthenticationPrincipal UsuarioAutenticado eu,
                                   @RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return marcas.enviarLogo(eu.consultoriaId(), arquivo.getBytes());
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    @PreAuthorize("hasAuthority('PERM_MARCA_ALTERAR')")
    @DeleteMapping("/marca/logo")
    public MarcaPublica removerLogo(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return marcas.removerLogo(eu.consultoriaId());
    }

    @PreAuthorize("hasAuthority('PERM_METODOLOGIA_ALTERAR')")
    @PutMapping("/configuracao")
    public ConsultoriaResponse alterarConfiguracao(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                  @RequestBody ConfiguracaoConsultoria configuracao) {
        return marcas.alterarConfiguracao(eu.consultoriaId(), configuracao);
    }
}
