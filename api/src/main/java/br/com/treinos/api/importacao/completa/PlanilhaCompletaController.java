package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Confirmacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Desfeita;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Previa;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * Planilha completa (várias abas ligadas entre si): análise e prévia só leem; a confirmação grava tudo em rascunho numa
 * transação; o "Desfazer" apaga o que ficou intocado. Mesmo limite por usuário da importação de uma aba (prévia e
 * confirmação) e o mesmo leitor (tamanho, zip, linhas, colunas e texto). Toda rota exige {@code ALUNO_ALTERAR}; as
 * outras permissões são conferidas por parte no serviço.
 */
@RestController
@RequestMapping("/importacoes")
public class PlanilhaCompletaController {

    private final PlanilhaCompletaService service;
    private final GravacaoDaPlanilha gravacao;
    private final DesfazerDaPlanilha desfazer;
    private final LimiteTentativas limites;

    public PlanilhaCompletaController(PlanilhaCompletaService service, GravacaoDaPlanilha gravacao,
                                      DesfazerDaPlanilha desfazer, LimiteTentativas limites) {
        this.service = service;
        this.gravacao = gravacao;
        this.desfazer = desfazer;
        this.limites = limites;
    }

    @PostMapping(value = "/planilha-completa/analisar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Analise analisar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo)
            throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return service.analisar(arquivo.getOriginalFilename(), arquivo.getBytes());
    }

    @PostMapping(value = "/planilha-completa/previa", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Previa previa(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo,
                         @RequestPart(value = "respostas", required = false) String respostas) throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return gravacao.previa(arquivo.getOriginalFilename(), arquivo.getBytes(), respostas);
    }

    @PostMapping(value = "/planilha-completa/confirmar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Confirmacao confirmar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                 @RequestPart("arquivo") MultipartFile arquivo,
                                 @RequestPart(value = "respostas", required = false) String respostas,
                                 @RequestParam String hash) throws IOException {
        limites.confirmacaoDeImportacao(eu.usuarioId());
        return gravacao.confirmar(eu, arquivo.getOriginalFilename(), arquivo.getBytes(), respostas, hash);
    }

    @PostMapping("/{id}/desfazer")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Desfeita desfazer(@PathVariable UUID id) {
        return desfazer.desfazer(id);
    }
}
