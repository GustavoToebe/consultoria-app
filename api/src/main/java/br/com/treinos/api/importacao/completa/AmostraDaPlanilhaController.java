package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.completa.AmostraDaPlanilha.Amostra;
import br.com.treinos.api.migracao.ExigeMigracaoAssistida;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Migração assistida, fase 2: {@code POST /importacoes/planilha-completa/amostra} mostra ao treinador, para até
 * {@value AmostraDaPlanilha#ALUNOS_POR_AMOSTRA} alunos por vez, o que a confirmação vai gravar (em rascunho). Não grava nada, não
 * cria registro de importação e não audita, como a prévia; o arquivo e a resposta nunca ficam guardados. Mesmos partes e limite
 * da prévia ({@code importacao-previa}) e a mesma permissão da planilha completa. Controller próprio porque
 * {@link ExigeMigracaoAssistida} vale para a classe inteira.
 */
@RestController
@RequestMapping("/importacoes")
@ExigeMigracaoAssistida
public class AmostraDaPlanilhaController {

    private final GravacaoDaPlanilha gravacao;
    private final LimiteTentativas limites;

    public AmostraDaPlanilhaController(GravacaoDaPlanilha gravacao, LimiteTentativas limites) {
        this.gravacao = gravacao;
        this.limites = limites;
    }

    @PostMapping(value = "/planilha-completa/amostra", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Amostra amostra(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo,
                           @RequestPart(value = "respostas", required = false) String respostas,
                           @RequestParam(defaultValue = "0") int inicio) throws IOException {
        // Só a primeira página conta no limite da prévia: folhear a amostra não pode esgotar a cota de 30 por hora,
        // que também vale para analisar e para a prévia (e bloquearia a correção de uma resposta depois).
        if (inicio <= 0) limites.previaDeImportacao(eu.usuarioId());
        return gravacao.amostra(eu.usuarioId(), arquivo.getOriginalFilename(), arquivo.getBytes(), respostas, inicio);
    }
}
