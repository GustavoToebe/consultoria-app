package br.com.treinos.api.push;

import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.push.PushDtos.RegistrarRequest;
import br.com.treinos.api.push.PushDtos.RemoverRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Token de push do aparelho do aluno da sessão. Registrar exige {@code TREINOS_PUSH_HABILITADO} (desligado, 503
 * {@code PUSH_INDISPONIVEL}); apagar não: só tira os tokens do próprio usuário, sem efeito colateral nem variável, e o "Sair"
 * precisa conseguir apagar mesmo depois de a chave ser desligada. Sempre o aluno da sessão, nunca um id do cliente; o token vai
 * no corpo (nunca no caminho, que cai em log de acesso) e não é auditado. {@code DELETE} sem corpo apaga todos os tokens do
 * próprio usuário (o aparelho que saiu sem conseguir ler o token). Só alunos: o treinador não recebe push nesta fase.
 */
@RestController
public class AlunoPushTokenController {

    private final PushService push;

    public AlunoPushTokenController(PushService push) {
        this.push = push;
    }

    @ExigePush
    @PreAuthorize("hasRole('ALUNO')")
    @PutMapping("/aluno/push-token")
    public ResponseEntity<Void> registrar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid RegistrarRequest corpo) {
        AlunoAppService.alunoDaSessao(eu);
        push.registrar(eu.usuarioId(), corpo.token(), corpo.plataforma());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PreAuthorize("hasRole('ALUNO')")
    @DeleteMapping("/aluno/push-token")
    public ResponseEntity<Void> remover(@AuthenticationPrincipal UsuarioAutenticado eu,
                                        @RequestBody(required = false) @Valid RemoverRequest corpo) {
        AlunoAppService.alunoDaSessao(eu);
        if (corpo == null) {
            push.removerTodos(eu.usuarioId());
        } else {
            push.remover(eu.usuarioId(), corpo.token());
        }
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
